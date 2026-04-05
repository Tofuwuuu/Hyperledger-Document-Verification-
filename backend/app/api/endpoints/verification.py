from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import hashlib
import json
import logging

from app.utils.auth import get_admin_user, get_current_user
from app.clients.fabric_client import FabricClient
from app.config.fabric_config import load_connection_profile, get_admin_identity

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/verification",
    tags=["verification"]
)

# Models
class BlockchainVerifyRequest(BaseModel):
    document_id: str
    hash: str
    verifier: Optional[str] = None

class BlockchainStoreRequest(BaseModel):
    document_id: str
    hash: str
    owner: str
    document_type: str
    metadata: Optional[Dict[str, Any]] = None

# Helper function to get a fabric client instance
def get_fabric_client() -> FabricClient:
    """Get a configured Fabric client."""
    try:
        # Load connection profile
        connection_profile = load_connection_profile("alumni-document-network")
        if not connection_profile:
            logger.error("Failed to load connection profile")
            raise ValueError("Failed to load connection profile")
        
        # Get admin identity
        admin_identity = get_admin_identity()
        if not admin_identity:
            logger.error("Failed to load admin identity")
            raise ValueError("Failed to load admin identity")
        
        # Create client
        client = FabricClient(
            connection_profile_path="app/config/fabric/connection-profile.json",
            identity_type="admin",
            msp_id=admin_identity.get("msp_id"),
            cert_path=admin_identity.get("cert_path"),
            key_path=admin_identity.get("key_path"),
            channel_name="alumni-channel"
        )
        
        # Connect to the network
        success = client.connect()
        if not success:
            logger.error("Failed to connect to Fabric network")
            raise ValueError("Failed to connect to Fabric network")
        
        return client
    except Exception as e:
        logger.error(f"Error creating Fabric client: {str(e)}")
        raise ValueError(f"Error creating Fabric client: {str(e)}")

# Calculate file hash helper
def calculate_hash(file_content: bytes) -> str:
    """Calculate SHA-256 hash of file content."""
    return hashlib.sha256(file_content).hexdigest()

# Blockchain verification endpoints
@router.post("/blockchain/verify")
async def verify_document_blockchain(
    request: BlockchainVerifyRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Verify a document against the blockchain."""
    try:
        client = get_fabric_client()
        
        # Set verifier if not provided
        verifier = request.verifier or current_user.get("username", "unknown")
        
        # Query chaincode
        result = client.query_chaincode(
            "final-smart-contract", 
            "VerifyDocument", 
            [request.document_id, request.hash, verifier]
        )
        
        # Close client
        client.close()
        
        if not result["success"]:
            # Enhanced error handling with detailed information
            error_msg = result.get("error", "Verification failed")
            error_category = result.get("category", "unknown_error")
            error_details = result.get("details", {})
            
            logger.error(f"Blockchain verification failed: {error_msg}", extra={
                "category": error_category,
                "details": error_details,
                "document_id": request.document_id
            })
            
            status_code = status.HTTP_400_BAD_REQUEST
            
            # Adjust status code based on error category
            if error_category == "authentication_error":
                status_code = status.HTTP_401_UNAUTHORIZED
            elif error_category == "network_error":
                status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            elif error_category == "connection_error":
                status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            elif error_category == "timeout_error":
                status_code = status.HTTP_504_GATEWAY_TIMEOUT
            
            return JSONResponse(
                status_code=status_code,
                content={
                    "success": False, 
                    "message": error_msg,
                    "error_category": error_category,
                    "document_id": request.document_id,
                    "details": error_details
                }
            )
        
        # Parse verification result from chaincode response
        verification_data = result.get("result", None)
        try:
            if isinstance(verification_data, str):
                verification_result = verification_data.lower() == "true"
            elif isinstance(verification_data, dict):
                verification_result = verification_data.get("verified", False)
            else:
                verification_result = False
        except:
            verification_result = False
        
        return {
            "success": True,
            "verified": verification_result,
            "document_id": request.document_id
        }
    except Exception as e:
        logger.exception(f"Blockchain verification error: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "message": f"Blockchain verification error: {str(e)}"}
        )

@router.post("/blockchain/store")
async def store_document_blockchain(
    request: BlockchainStoreRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Store a document hash on the blockchain."""
    try:
        client = get_fabric_client()
        
        # Prepare metadata
        metadata_str = json.dumps(request.metadata or {})
        
        # Invoke chaincode
        result = client.invoke_chaincode(
            "final-smart-contract", 
            "StoreDocument", 
            [request.document_id, request.hash, request.owner, request.document_type, metadata_str]
        )
        
        # Close client
        client.close()
        
        if not result["success"]:
            # Enhanced error handling with detailed information
            error_msg = result.get("error", "Failed to store document")
            error_category = result.get("category", "unknown_error")
            error_details = result.get("details", {})
            
            logger.error(f"Blockchain storage failed: {error_msg}", extra={
                "category": error_category,
                "details": error_details,
                "document_id": request.document_id
            })
            
            status_code = status.HTTP_400_BAD_REQUEST
            
            # Adjust status code based on error category
            if error_category == "authentication_error":
                status_code = status.HTTP_401_UNAUTHORIZED
            elif error_category == "network_error":
                status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            elif error_category == "connection_error":
                status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            elif error_category == "endorsement_error":
                status_code = status.HTTP_400_BAD_REQUEST
            elif error_category == "timeout_error":
                status_code = status.HTTP_504_GATEWAY_TIMEOUT
            
            return JSONResponse(
                status_code=status_code,
                content={
                    "success": False, 
                    "message": error_msg,
                    "error_category": error_category,
                    "document_id": request.document_id,
                    "details": error_details
                }
            )
        
        return {
            "success": True,
            "transaction_id": result.get("transactionId", "unknown"),
            "document_id": request.document_id
        }
    except Exception as e:
        logger.exception(f"Blockchain storage error: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "message": f"Blockchain storage error: {str(e)}"}
        )

@router.get("/blockchain/history/{document_id}")
async def get_document_history_blockchain(
    document_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get document verification history from the blockchain."""
    try:
        client = get_fabric_client()
        
        # Query chaincode
        result = client.query_chaincode(
            "final-smart-contract", 
            "GetDocumentHistory", 
            [document_id]
        )
        
        # Close client
        client.close()
        
        if not result["success"]:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": result.get("message", "Failed to get document history")}
            )
        
        # Parse history data
        try:
            history_data = json.loads(result.get("data", "[]"))
        except:
            history_data = []
        
        return {
            "success": True,
            "history": history_data,
            "document_id": document_id
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Blockchain history error: {str(e)}"}
        )

@router.post("/blockchain/verify-file")
async def verify_document_by_file_blockchain(
    document_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """Verify a document by file against the blockchain."""
    try:
        # Read file content
        file_content = await file.read()
        
        # Calculate hash
        document_hash = calculate_hash(file_content)
        
        # Verify using the blockchain
        client = get_fabric_client()
        
        # Query chaincode
        result = client.query_chaincode(
            "final-smart-contract", 
            "VerifyDocument", 
            [document_id, document_hash, current_user.get("username", "unknown")]
        )
        
        # Close client
        client.close()
        
        if not result["success"]:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": result.get("message", "Verification failed")}
            )
        
        # Parse verification result
        try:
            verification_result = json.loads(result.get("data", "false"))
        except:
            verification_result = False
        
        return {
            "success": True,
            "verified": verification_result,
            "document_id": document_id,
            "hash": document_hash
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Blockchain verification error: {str(e)}"}
        ) 