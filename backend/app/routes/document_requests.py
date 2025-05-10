from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path
from fastapi.responses import JSONResponse, FileResponse
from typing import List, Optional, Dict, Any
from datetime import datetime
import os
from bson import ObjectId

from app.config.database import get_database, db, connect_to_mongo, get_transaction_session
from app.models.document_request import (
    DocumentRequestCreate, 
    DocumentRequest,
    DocumentRequestUpdate,
    DocumentRequestOut,
    DocumentRequestStatus,
    DocumentRequestType
)
from app.utils.auth import get_current_user, get_admin_user
from app.services.document_generator import generate_document_from_template, calculate_document_hash
from app.services.notification_service import notify_document_request_created, notify_document_request_status_update
from app.models.document import DocumentCreate, DocumentType, VerificationStatus

router = APIRouter()

@router.post("/", response_model=Dict[str, Any])
async def create_document_request(
    request_data: DocumentRequestCreate = Body(...),
    current_user = Depends(get_current_user)
):
    """
    Create a new document request
    """
    global db  # Add this to ensure we're using the global db variable
    try:
        # Check if database connection is active
        if db is None:
            # Try to reconnect
            print("Database connection lost, attempting to reconnect...")
            await connect_to_mongo()
            
            # Important: Get the updated db reference after reconnection
            from app.config.database import db as reconnected_db
            db = reconnected_db
            
        # If still None after reconnect attempt, fail
        if db is None:
            print("Error: Database connection is not available")
            raise HTTPException(
                status_code=500, 
                detail="Database connection not available. Please check MongoDB connection."
            )
        
        # Get alumni ID from user ID
        alumni = await db.alumni.find_one({"user_id": str(current_user["_id"])})
        if not alumni:
            raise HTTPException(status_code=404, detail="Alumni record not found")
        
        # Store the alumni_id as a string for consistency
        alumni_id = str(alumni["_id"])
        print(f"Creating document request for alumni ID: {alumni_id}, Name: {alumni.get('full_name', 'Unknown')}")
        
        # Create document request
        document_request = DocumentRequest(
            alumni_id=alumni_id,
            document_type=request_data.document_type,
            purpose=request_data.purpose,
            status=DocumentRequestStatus.PENDING,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Insert into database
        document_request_dict = document_request.dict(by_alias=True)
        result = await db.document_requests.insert_one(document_request_dict)
        
        # Get the ID of the inserted document
        document_request_id = str(result.inserted_id)
        
        # Notify alumni and admins about the new request
        await notify_document_request_created(
            request_id=document_request_id,
            document_type=request_data.document_type.value,
            user_id=str(current_user["_id"])
        )
        
        return {
            "success": True,
            "message": "Document request created successfully",
            "request_id": document_request_id
        }
    except Exception as e:
        # Log the error for debugging
        print(f"Error in create_document_request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/", response_model=List[DocumentRequestOut])
async def get_document_requests(
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user = Depends(get_current_user)
):
    """
    Get all document requests for the current alumni
    """
    global db  # Add this line to ensure we're using the global db variable
    try:
        # Check if database connection is active
        if db is None:
            # Try to reconnect
            print("Database connection lost, attempting to reconnect...")
            await connect_to_mongo()
            
            # Important: Get the updated db reference after reconnection
            from app.config.database import db as reconnected_db
            db = reconnected_db
            
        # If still None after reconnect attempt, fail
        if db is None:
            print("Error: Database connection is not available")
            raise HTTPException(
                status_code=500, 
                detail="Database connection not available. Please check MongoDB connection."
            )
        
        # Special handling for admin bypass users - redirect to admin endpoint
        if current_user.get("is_admin", False):
            # For admin users, call the admin endpoint
            print(f"Admin user detected, redirecting to admin document requests endpoint")
            
            # Build query for admin view
            query = {}
            if status:
                query["status"] = status
            
            # Get all document requests
            cursor = db.document_requests.find(query)
            requests = await cursor.to_list(length=100)
            
            # Return simplified data for admin overview
            result = []
            for request in requests:
                result.append(request)
            
            return result
        
        # Regular user flow - get alumni ID from user ID
        alumni = await db.alumni.find_one({"user_id": str(current_user["_id"])})
        if not alumni:
            # Provide more detailed error for missing alumni record
            print(f"Alumni record not found for user ID: {current_user['_id']}")
            raise HTTPException(
                status_code=404, 
                detail="Alumni record not found for your user account"
            )
        
        alumni_id = str(alumni["_id"])
        
        # Build query
        query = {"alumni_id": alumni_id}
        if status:
            query["status"] = status
        
        # Get document requests
        cursor = db.document_requests.find(query)
        requests = await cursor.to_list(length=100)
        
        return requests
    except Exception as e:
        # Log the error for debugging
        print(f"Error in get_document_requests: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/admin", response_model=List[DocumentRequestOut])
async def get_all_document_requests(
    status: Optional[str] = Query(None, description="Filter by status"),
    admin_user = Depends(get_admin_user)
):
    """
    Get all document requests (admin only)
    """
    global db  # Add this line to ensure we're using the global db variable
    try:
        # Check if database connection is active
        if db is None:
            # Try to reconnect
            print("Database connection lost, attempting to reconnect...")
            await connect_to_mongo()
            
            # Important: Get the updated db reference after reconnection
            from app.config.database import db as reconnected_db
            db = reconnected_db
            
        # If still None after reconnect attempt, fail
        if db is None:
            print("Error: Database connection is not available")
            raise HTTPException(
                status_code=500, 
                detail="Database connection not available. Please check MongoDB connection."
            )
            
        # Build query
        query = {}
        if status:
            query["status"] = status
        
        # Get document requests
        cursor = db.document_requests.find(query)
        requests = await cursor.to_list(length=100)
        
        # Enrich with alumni information
        result = []
        for request in requests:
            request_out = request.copy()
            
            # Safely get alumni information
            try:
                alumni_id = request.get("alumni_id")
                print(f"Looking up alumni with ID: {alumni_id}")
                
                # Try both string ID and ObjectId formats
                alumni = None
                
                # First try with the ID as is
                alumni = await db.alumni.find_one({"_id": alumni_id})
                
                # If not found, try converting to ObjectId if it's a string
                if not alumni and isinstance(alumni_id, str):
                    try:
                        alumni = await db.alumni.find_one({"_id": ObjectId(alumni_id)})
                    except Exception as e:
                        print(f"Error converting alumni_id to ObjectId: {e}")
                        
                # If still not found, try looking up by string _id
                if not alumni:
                    alumni = await db.alumni.find_one({"_id": str(alumni_id)})
                        
                if alumni:
                    print(f"Found alumni: {alumni.get('full_name')}")
                    request_out["alumni_name"] = alumni.get("full_name", "Unknown")
                    request_out["student_id"] = alumni.get("student_id", "N/A")
                    request_out["course"] = alumni.get("course", "N/A")
                    request_out["graduation_year"] = alumni.get("graduation_year", None)
                else:
                    # Handle case where alumni not found
                    print(f"Alumni not found for ID: {alumni_id}")
                    request_out["alumni_name"] = "Unknown (Alumni not found)"
                    request_out["student_id"] = "N/A"
                    request_out["course"] = "N/A"
                    request_out["graduation_year"] = None
            except Exception as e:
                # Handle errors getting alumni info
                print(f"Error getting alumni info for request {request['_id']}: {str(e)}")
                request_out["alumni_name"] = "Error retrieving alumni"
                request_out["student_id"] = "Error"
                request_out["course"] = "Error"
                request_out["graduation_year"] = None
            
            result.append(request_out)
        
        return result
    except Exception as e:
        # Log the error for debugging
        print(f"Error in get_all_document_requests: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/{request_id}", response_model=DocumentRequestOut)
async def get_document_request(
    request_id: str = Path(..., description="Document request ID"),
    current_user = Depends(get_current_user)
):
    """
    Get a specific document request
    """
    # Check if user is admin
    is_admin = current_user.get("role") == "admin"
    
    # Get alumni ID from user ID if not admin
    alumni_id = None
    if not is_admin:
        alumni = await db.alumni.find_one({"user_id": str(current_user["_id"])})
        if not alumni:
            raise HTTPException(status_code=404, detail="Alumni record not found")
        alumni_id = str(alumni["_id"])
    
    # Build query
    query = {"_id": ObjectId(request_id)}
    if not is_admin and alumni_id:
        query["alumni_id"] = alumni_id
    
    # Get document request
    request = await db.document_requests.find_one(query)
    if not request:
        raise HTTPException(status_code=404, detail="Document request not found")
    
    # Enrich with alumni information
    request_out = request.copy()
    
    # Safely get alumni information
    try:
        doc_alumni_id = request.get("alumni_id")
        print(f"Looking up alumni with ID: {doc_alumni_id}")
        
        # Try both string ID and ObjectId formats
        alumni = None
        
        # First try with the ID as is
        alumni = await db.alumni.find_one({"_id": doc_alumni_id})
        
        # If not found, try converting to ObjectId if it's a string
        if not alumni and isinstance(doc_alumni_id, str):
            try:
                alumni = await db.alumni.find_one({"_id": ObjectId(doc_alumni_id)})
            except Exception as e:
                print(f"Error converting alumni_id to ObjectId: {e}")
                
        # If still not found, try looking up by string _id
        if not alumni:
            alumni = await db.alumni.find_one({"_id": str(doc_alumni_id)})
                
        if alumni:
            print(f"Found alumni: {alumni.get('full_name')}")
            request_out["alumni_name"] = alumni.get("full_name", "Unknown")
            request_out["student_id"] = alumni.get("student_id", "N/A")
            request_out["course"] = alumni.get("course", "N/A")
            request_out["graduation_year"] = alumni.get("graduation_year", None)
        else:
            # Handle case where alumni not found
            print(f"Alumni not found for ID: {doc_alumni_id}")
            request_out["alumni_name"] = "Unknown (Alumni not found)"
            request_out["student_id"] = "N/A"
            request_out["course"] = "N/A"
            request_out["graduation_year"] = None
    except Exception as e:
        # Handle errors getting alumni info
        print(f"Error getting alumni info for request {request['_id']}: {str(e)}")
        request_out["alumni_name"] = "Error retrieving alumni"
        request_out["student_id"] = "Error"
        request_out["course"] = "Error"
        request_out["graduation_year"] = None
    
    return request_out

@router.put("/{request_id}/update", response_model=Dict[str, Any])
async def update_document_request(
    request_id: str = Path(..., description="Document request ID"),
    update_data: DocumentRequestUpdate = Body(...),
    admin_user = Depends(get_admin_user)
):
    """
    Update a document request status (admin only)
    """
    # Get document request
    request = await db.document_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Document request not found")
    
    # Prepare update data
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    # If status is changed to completed, set completed_at
    if update_data.status == DocumentRequestStatus.COMPLETED:
        update_dict["completed_at"] = datetime.utcnow()
    
    # Update document request
    result = await db.document_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": update_dict}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to update document request")
    
    # Notify alumni of status update
    if update_data.status:
        await notify_document_request_status_update(
            request_id=request_id,
            document_type=request["document_type"],
            alumni_id=request["alumni_id"],
            new_status=update_data.status.value,
            admin_notes=update_data.admin_notes,
            rejection_reason=update_data.rejection_reason,
            document_id=update_data.document_id
        )
    
    return {
        "success": True,
        "message": "Document request updated successfully"
    }

@router.post("/{request_id}/generate", response_model=Dict[str, Any])
async def generate_document(
    request_id: str = Path(..., description="Document request ID"),
    admin_user = Depends(get_admin_user)
):
    """
    Generate a document for a document request.
    Only admin users can generate documents.
    """
    try:
        # Get document request
        request = await db.document_requests.find_one({"_id": ObjectId(request_id)})
        if not request:
            raise HTTPException(
                status_code=404,
                detail=f"Document request with ID {request_id} not found"
            )
        
        # Check if document is already generated
        if request.get("document_id"):
            # Return existing document
            document = await db.documents.find_one({"_id": ObjectId(request.get("document_id"))})
            if document:
                return {
                    "success": True,
                    "message": "Document already generated",
                    "document_id": str(document["_id"]),
                    "document_url": f"/api/v1/documents/{document['_id']}/download"
                }
        
        # Get alumni data
        alumni = await db.alumni.find_one({"_id": ObjectId(request["alumni_id"])})
        if not alumni:
            raise HTTPException(
                status_code=404,
                detail=f"Alumni with ID {request['alumni_id']} not found"
            )
        
        # Generate document
        try:
            file_path = await generate_document_from_template(
                document_type=request["document_type"],
                alumni_data=alumni
            )
            
            absolute_path = os.path.join(os.getcwd(), "uploads", file_path)
            
            # Calculate file hash
            file_hash = calculate_document_hash(absolute_path)
            
            # Create document record
            document = DocumentCreate(
                alumni_id=request["alumni_id"],
                document_type=DocumentType.CERTIFICATE,
                title=f"{request['document_type'].replace('_', ' ').title()} for {alumni.get('full_name', 'Unknown')}",
                description=f"Auto-generated {request['document_type'].replace('_', ' ')} document",
                file_path=file_path,
                file_hash=file_hash
            )
            
            # Use transactions to ensure atomic operations
            document_dict = document.dict()
            document_dict["verification_status"] = VerificationStatus.VERIFIED
            document_dict["verified_by"] = str(admin_user.id) if hasattr(admin_user, 'id') else str(admin_user["_id"])
            document_dict["verification_date"] = datetime.utcnow()
            document_dict["created_at"] = datetime.utcnow()
            document_dict["updated_at"] = datetime.utcnow()
            
            document_id = None
            
            # Start transaction
            async with get_transaction_session() as session:
                async with session.start_transaction():
                    # Insert document within transaction
                    result = await db.documents.insert_one(document_dict, session=session)
                    document_id = str(result.inserted_id)
                    
                    # Update document request within same transaction
                    await db.document_requests.update_one(
                        {"_id": ObjectId(request_id)},
                        {
                            "$set": {
                                "document_id": document_id,
                                "status": DocumentRequestStatus.COMPLETED.value,
                                "completed_at": datetime.utcnow(),
                                "updated_at": datetime.utcnow()
                            }
                        },
                        session=session
                    )
            
            # Send notification after transaction completes
            await notify_document_request_status_update(
                request_id=request_id,
                user_id=request["user_id"],
                status="completed",
                message=f"Your document request has been completed. You can download your document from the portal."
            )
            
            return {
                "success": True,
                "message": "Document generated successfully",
                "document_id": document_id,
                "document_url": f"/api/v1/documents/{document_id}/download"
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate document: {str(e)}"
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred: {str(e)}"
        )

@router.get("/{request_id}/download", response_class=FileResponse)
async def download_generated_document(
    request_id: str = Path(..., description="Document request ID"),
    current_user = Depends(get_current_user)
):
    """
    Download the generated document
    """
    # Check if user is admin
    is_admin = current_user.get("role") == "admin"
    
    # Get alumni ID from user ID if not admin
    alumni_id = None
    if not is_admin:
        try:
            # Try to find the alumni record for the current user
            user_id = str(current_user["_id"])
            print(f"Looking up alumni record for user ID: {user_id}")
            
            alumni = await db.alumni.find_one({"user_id": user_id})
            if alumni:
                alumni_id = str(alumni["_id"])
                print(f"Found alumni ID: {alumni_id} for user: {alumni.get('full_name', 'Unknown')}")
            else:
                print(f"Alumni record not found for user ID: {user_id}")
                raise HTTPException(status_code=404, detail="Alumni record not found")
        except Exception as e:
            print(f"Error finding alumni record for user: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error finding alumni record: {str(e)}")
    
    # Build query
    query = {"_id": ObjectId(request_id)}
    if not is_admin and alumni_id:
        query["alumni_id"] = alumni_id
    
    # Get document request
    request = await db.document_requests.find_one(query)
    if not request:
        raise HTTPException(status_code=404, detail="Document request not found")
    
    # Check if document has been generated
    if not request.get("document_id"):
        raise HTTPException(status_code=400, detail="Document has not been generated yet")
    
    # Get document
    document = await db.documents.find_one({"_id": ObjectId(request["document_id"])})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Check if file exists
    file_path = os.path.join(os.getcwd(), "uploads", document["file_path"])
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Document file not found")
    
    # Return file
    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=f"{document['document_type']}_{document['title']}.pdf"
    ) 