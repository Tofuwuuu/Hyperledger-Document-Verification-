from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict
from pydantic import BaseModel, EmailStr, HttpUrl, Field
from datetime import datetime, timedelta
from bson import ObjectId
import logging

from app.core.config import settings
from app.core.security import get_password_hash, create_access_token, verify_password, create_refresh_token
from app.config.database import get_database
from app.api.deps import get_current_user

# Use empty prefix since the prefix will be added in main.py
router = APIRouter()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic models for employer data
class EmployerBase(BaseModel):
    email: EmailStr
    company_name: str
    industry: str
    contact_person: str
    phone: str
    address: str
    website: Optional[HttpUrl] = None

class EmployerCreate(EmployerBase):
    password: str
    confirm_password: str

class EmployerDB(EmployerBase):
    id: str = Field(alias="_id")
    hashed_password: str
    is_active: bool = True
    created_at: datetime = None
    updated_at: datetime = None

    class Config:
        populate_by_name = True
        json_encoders = {
            ObjectId: str
        }

class EmployerResponse(EmployerBase):
    id: str
    created_at: datetime
    is_active: bool

# Routes
@router.post("/register", response_model=EmployerResponse, status_code=status.HTTP_201_CREATED)
async def register_employer(employer: EmployerCreate, db=Depends(get_database)):
    """
    Register a new employer account
    """
    # Debug logging
    print("Received registration data:")
    print(f"Email: {employer.email}")
    print(f"Company: {employer.company_name}")
    print(f"Industry: {employer.industry}")
    print(f"Contact: {employer.contact_person}")
    print(f"Phone: {employer.phone}")
    print(f"Website: {employer.website}")
    print(f"Address: {employer.address}")
    
    # Check if email already exists in employers collection
    if await db.employers.find_one({"email": employer.email}):
        print(f"Email already registered: {employer.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered as an employer"
        )
    
    # Also check if email exists in users collection to prevent duplicates
    if await db.users.find_one({"email": employer.email}):
        print(f"Email already exists in users: {employer.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered as a user"
        )
    
    # Check if passwords match
    if employer.password != employer.confirm_password:
        print("Passwords do not match")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match"
        )
    
    now = datetime.utcnow()
    
    # Create the employer document
    employer_data = employer.dict(exclude={"password", "confirm_password"})
    employer_data.update({
        "hashed_password": get_password_hash(employer.password),
        "created_at": now,
        "updated_at": now,
        "is_active": True,
    })
    
    # Insert into employers collection
    result = await db.employers.insert_one(employer_data)
    
    # Get the created employer
    created_employer = await db.employers.find_one({"_id": result.inserted_id})
    
    # Transform the MongoDB document for Pydantic response
    response_employer = {
        "id": str(created_employer["_id"]),
        "email": created_employer["email"],
        "company_name": created_employer["company_name"],
        "industry": created_employer["industry"],
        "contact_person": created_employer["contact_person"],
        "phone": created_employer["phone"],
        "address": created_employer["address"],
        "website": created_employer.get("website"),
        "created_at": created_employer["created_at"],
        "is_active": created_employer.get("is_active", True),
    }
    
    return response_employer

@router.post("/login")
async def login_employer(form_data: OAuth2PasswordRequestForm = Depends(), db=Depends(get_database)):
    """
    Login for employers
    """
    start_time = datetime.utcnow()
    logger.info(f"Employer login attempt started at {start_time.isoformat()} for user: {form_data.username}")
    
    try:
        # Find employer in database
        find_start = datetime.utcnow()
        employer = await db.employers.find_one({"email": form_data.username})
        find_end = datetime.utcnow()
        logger.info(f"Database lookup took {(find_end - find_start).total_seconds()} seconds")
        
        if not employer:
            logger.warning(f"Failed employer login - email not found: {form_data.username}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Incorrect email or password"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Debug log the employer data (excluding sensitive fields)
        employer_debug = {**employer}
        if "hashed_password" in employer_debug:
            employer_debug["hashed_password"] = "[REDACTED]"
        logger.info(f"Found employer: {employer_debug}")
        
        # Verify password
        password_start = datetime.utcnow()
        password_valid = verify_password(form_data.password, employer["hashed_password"])
        password_end = datetime.utcnow()
        logger.info(f"Password verification took {(password_end - password_start).total_seconds()} seconds")
        
        if not password_valid:
            logger.warning(f"Failed employer login - invalid password: {form_data.username}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Incorrect email or password"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Check if employer is active
        logger.info(f"Checking active status: is_active={employer.get('is_active', True)}")
        if not employer.get("is_active", True):
            logger.warning(f"Failed employer login - inactive account: {form_data.username}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Inactive employer account"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Create access token
        token_start = datetime.utcnow()
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        # Ensure employer ID is a string
        employer_id = str(employer["_id"])
        
        # Create token data
        token_data = {
            "sub": employer_id,
            "type": "employer"  
        }
        
        access_token = create_access_token(
            subject=employer_id,
            expires_delta=access_token_expires,
            user_type="employer"
        )
        
        refresh_token = create_refresh_token(
            subject=employer_id,
            user_type="employer"
        )
        
        token_end = datetime.utcnow()
        logger.info(f"Token creation took {(token_end - token_start).total_seconds()} seconds")
        
        end_time = datetime.utcnow()
        logger.info(f"Employer login successful for {form_data.username}. Total processing time: {(end_time - start_time).total_seconds()} seconds")
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions directly
        logger.warning(f"HTTP exception during employer login: {http_ex.detail}")
        return JSONResponse(
            status_code=http_ex.status_code,
            content={"detail": http_ex.detail},
            headers=http_ex.headers
        )
    except Exception as e:
        logger.error(f"Unexpected error during employer login: {str(e)}")
        # Log detailed error information
        import traceback
        logger.error(f"Error traceback: {traceback.format_exc()}")
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An unexpected error occurred. Please try again later."}
        )

@router.get("/me", response_model=EmployerResponse)
async def get_employer_me(current_user=Depends(get_current_user), db=Depends(get_database)):
    """
    Get current employer profile
    """
    try:
        # Debug logging
        logger.info(f"get_employer_me: current_user={current_user}")

        # Make sure we're dealing with an employer (check token type)
        if current_user.get("type") != "employer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not an employer account"
            )
            
        # Use the already fetched employer data from current_user
        employer = current_user
        
        # Format the employer response
        response_employer = {
            "id": str(employer["_id"]),
            "email": employer["email"],
            "company_name": employer["company_name"],
            "industry": employer["industry"],
            "contact_person": employer["contact_person"],
            "phone": employer["phone"],
            "address": employer["address"],
            "website": employer.get("website"),
            "created_at": employer["created_at"],
            "is_active": employer.get("is_active", True),
        }
        
        return response_employer
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching employer profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while retrieving employer profile"
        )

@router.get("/{employer_id}", response_model=EmployerResponse)
async def get_employer(employer_id: str, db=Depends(get_database)):
    """
    Get an employer by ID
    """
    try:
        employer = await db.employers.find_one({"_id": ObjectId(employer_id)})
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid employer ID format"
        )
    
    if not employer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employer not found"
        )
    
    return employer

@router.post("/verify-document")
async def verify_document(verification_data: Dict[str, str], current_user=Depends(get_current_user), db=Depends(get_database)):
    """
    Verify a document using a verification code
    """
    try:
        # Make sure user is an employer
        if current_user.get("type") != "employer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only employers can verify documents"
            )
        
        # Get verification code from request
        verification_code = verification_data.get("verification_code")
        if not verification_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code is required"
            )
        
        # Lookup document by verification code
        document = await db.documents.find_one({"verification_code": verification_code})
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found with the provided verification code"
            )
        
        # Get document owner information
        user = None
        try:
            # Try with direct ID
            user = await db.users.find_one({"_id": document["alumni_id"]})
            
            # If not found, try with ObjectId
            if not user and isinstance(document["alumni_id"], str):
                try:
                    object_id = ObjectId(document["alumni_id"])
                    user = await db.users.find_one({"_id": object_id})
                except:
                    pass
                    
        except Exception as e:
            logger.error(f"Error looking up document owner: {e}")
            
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document owner not found"
            )
        
        # If document has blockchain verification, get the data
        blockchain_verification = None
        if document.get("blockchain_hash"):
            # In a real implementation, this would verify against the blockchain
            blockchain_verification = {
                "hash": document["blockchain_hash"],
                "timestamp": document.get("blockchain_timestamp", document["created_at"]),
                "status": "Verified"
            }
        
        # Return document details with user information
        verification_result = {
            "id": str(document["_id"]),
            "type": document["document_type"],
            "title": document.get("title", document["document_type"]),
            "issueDate": document["created_at"].isoformat(),
            "verificationCode": verification_code,
            "holder": {
                "name": user.get("full_name", "Alumni"),
                "studentId": user.get("student_id", "Not available"),
                "program": user.get("program", "Not available"),
                "graduationYear": str(user.get("graduation_year", "Not available"))
            },
            "issuer": {
                "name": "Cavite State University - Carmona Campus",
                "department": "Office of the Registrar"
            },
            "blockchainVerification": blockchain_verification
        }
        
        # Log the verification attempt
        try:
            employer_id = current_user.get("sub")
            if isinstance(employer_id, str):
                try:
                    employer_id = ObjectId(employer_id)
                except:
                    pass
                    
            document_id = document["_id"]
            if isinstance(document_id, str):
                try:
                    document_id = ObjectId(document_id)
                except:
                    pass
                    
            await db.verification_logs.insert_one({
                "employer_id": employer_id,
                "document_id": document_id,
                "verification_code": verification_code,
                "timestamp": datetime.utcnow(),
                "success": True
            })
        except Exception as log_error:
            logger.error(f"Error logging verification attempt: {log_error}")
        
        return verification_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying document: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while verifying the document"
        ) 