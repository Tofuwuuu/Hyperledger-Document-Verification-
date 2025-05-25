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
from app.schemas.job import JobCreate, JobResponse, JobUpdate, JobStatus, JobApplicantCreate, JobApplicantUpdate, JobApplicantResponse

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
            # Before returning error, check if this might be a regular user account
            user = await db.users.find_one({"email": form_data.username})
            if user:
                # This is a user account trying to log in via employer route
                logger.warning(f"Regular user account attempting to login via employer route: {form_data.username}")
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "This email is registered as an ALUMNI/STUDENT account. Please select 'Alumni / Student' account type instead of 'Employer'."},
                    headers={"WWW-Authenticate": "Bearer", "X-Account-Type": "alumni"}
                )
            
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
        
        # Use the core security functions correctly
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
            "user_type": "employer"
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

        # Make sure we're dealing with an employer (check both user_type and type for backward compatibility)
        if not (current_user.get("user_type") == "employer" or current_user.get("type") == "employer"):
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
        if not (current_user.get("user_type") == "employer" or current_user.get("type") == "employer"):
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

# Job related routes
@router.post("/jobs", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job_posting(
    job: JobCreate, 
    current_user=Depends(get_current_user), 
    db=Depends(get_database)
):
    """
    Create a new job posting (employer only)
    """
    # Verify that the current user is an employer
    if not (current_user.get("user_type") == "employer" or current_user.get("type") == "employer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can create job postings"
        )
    
    # Extract employer ID - Always use string format for consistency
    employer_id = None
    
    # Debug log current user
    logger.info(f"Creating job with current_user: {current_user}")
    
    # Get ID from either _id or id field
    if "_id" in current_user:
        employer_id = str(current_user["_id"])
    elif "id" in current_user:
        employer_id = str(current_user["id"])
        
    if not employer_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not determine employer identity"
        )
        
    logger.info(f"Using employer_id: {employer_id}")
    
    # Get employer data for company name
    employer = None
    
    # Try to find the employer in multiple ways
    # First try with the string ID directly
    employer = await db.employers.find_one({"_id": employer_id})
    
    # If not found and the ID looks like a valid ObjectId, try with ObjectId conversion
    if not employer and len(employer_id) == 24:
        try:
            obj_id = ObjectId(employer_id)
            employer = await db.employers.find_one({"_id": obj_id})
            logger.info(f"Found employer using ObjectId: {obj_id}")
        except Exception as e:
            logger.warning(f"Could not convert employer_id to ObjectId: {e}")
    
    if not employer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employer not found"
        )
    
    # Prepare job data - always store employer_id as string for consistency
    now = datetime.utcnow()
    job_data = job.dict()
    job_data.update({
        "employer_id": employer_id,  # Store as string
        "company_name": employer.get("company_name", ""),
        "created_at": now,
        "updated_at": now,
    })
    
    # Insert the job
    try:
        result = await db.jobs.insert_one(job_data)
        
        # Get the created job
        created_job = await db.jobs.find_one({"_id": result.inserted_id})
        
        # Transform for response
        response_job = {
            "id": str(created_job["_id"]),
            "employer_id": str(created_job["employer_id"]),
            "employer_name": employer.get("company_name", ""),
            "title": created_job["title"],
            "description": created_job["description"],
            "location": created_job["location"],
            "company_name": created_job["company_name"],
            "skills": created_job.get("skills", []),
            "requirements": created_job.get("requirements", []),
            "responsibilities": created_job.get("responsibilities", []),
            "employment_type": created_job.get("employment_type"),
            "salary_range": created_job.get("salary_range"),
            "application_deadline": created_job.get("application_deadline"),
            "is_remote": created_job.get("is_remote", False),
            "status": created_job.get("status", "active"),
            "created_at": created_job["created_at"],
            "updated_at": created_job["updated_at"],
        }
        
        return response_job
    except Exception as e:
        logger.error(f"Error creating job posting: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating job posting: {str(e)}"
        )

@router.get("/jobs", response_model=List[JobResponse])
async def get_employer_jobs(
    status: Optional[JobStatus] = None,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get all jobs posted by the current employer
    """
    try:
        # Verify that the current user is an employer
        if not (current_user.get("user_type") == "employer" or current_user.get("type") == "employer"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only employers can access their job listings"
            )
        
        # Debug logging of current user object
        logger.info(f"Current user: {current_user}")
        
        # Get employer ID as string - SIMPLIFIED approach
        employer_id_str = None
        
        if "_id" in current_user:
            if isinstance(current_user["_id"], ObjectId):
                employer_id_str = str(current_user["_id"])
            else:
                employer_id_str = current_user["_id"]
            logger.info(f"Using _id field: {employer_id_str}")
        elif "id" in current_user:
            employer_id_str = str(current_user["id"])
            logger.info(f"Using id field: {employer_id_str}")
        else:
            # Log all keys in current_user for debugging
            logger.error(f"No id or _id found in current_user. Keys: {list(current_user.keys())}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not determine employer identity"
            )
            
        logger.info(f"Using employer_id_str: {employer_id_str}")
        
        # Build a query with multiple options to match employer ID
        # This handles both string IDs and ObjectId cases
        try:
            # Try to convert to ObjectId for query if it looks like a valid ObjectId
            obj_id_query = None
            if len(employer_id_str) == 24:  # Valid ObjectId length
                try:
                    obj_id = ObjectId(employer_id_str)
                    obj_id_query = {"employer_id": obj_id}
                    logger.info(f"Adding ObjectId query: {obj_id}")
                except Exception as e:
                    logger.warning(f"Could not convert employer ID to ObjectId: {e}")
            
            # Start with string query
            query = {"employer_id": employer_id_str}
            
            # Use $or to check both string and ObjectId representations if available
            if obj_id_query:
                query = {"$or": [query, obj_id_query]}
                
            # Add status filter if provided
            if status:
                if "$or" in query:
                    # Add status to both conditions
                    query["$or"][0]["status"] = status
                    query["$or"][1]["status"] = status
                else:
                    query["status"] = status
            
            logger.info(f"Final query: {query}")
            
            # Fetch jobs
            cursor = db.jobs.find(query).sort("created_at", -1)
            jobs = []
            
            async for job in cursor:
                # Convert employer_id to string for consistent response
                employer_id_value = job.get("employer_id")
                if employer_id_value and isinstance(employer_id_value, ObjectId):
                    employer_id_str = str(employer_id_value)
                else:
                    employer_id_str = str(employer_id_value) if employer_id_value else None
                    
                jobs.append({
                    "id": str(job["_id"]),
                    "employer_id": employer_id_str,
                    "employer_name": job.get("company_name", ""),
                    "title": job["title"],
                    "description": job["description"],
                    "location": job["location"],
                    "company_name": job.get("company_name", ""),
                    "skills": job.get("skills", []),
                    "requirements": job.get("requirements", []),
                    "responsibilities": job.get("responsibilities", []),
                    "employment_type": job.get("employment_type"),
                    "salary_range": job.get("salary_range"),
                    "application_deadline": job.get("application_deadline"),
                    "is_remote": job.get("is_remote", False),
                    "status": job.get("status", "active"),
                    "created_at": job["created_at"],
                    "updated_at": job["updated_at"],
                    "applicant_count": await db.job_applications.count_documents({"job_id": str(job["_id"])})
                })
            
            return jobs
        except Exception as e:
            logger.error(f"Error building query: {e}")
            raise
            
    except Exception as e:
        logger.error(f"Error in get_employer_jobs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching jobs: {str(e)}"
        )

@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job_by_id(
    job_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get a specific job posting by ID
    """
    try:
        # Convert string ID to ObjectId
        job_object_id = ObjectId(job_id)
    except Exception as e:
        logger.error(f"Invalid job ID format: {job_id}, error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format"
        )
    
    # Fetch the job
    job = await db.jobs.find_one({"_id": job_object_id})
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found"
        )
    
    # Check if current user is the employer who created this job
    # Get employer ID as string for consistent comparison
    employer_id = None
    if "_id" in current_user:
        if isinstance(current_user["_id"], ObjectId):
            employer_id = str(current_user["_id"])
        else:
            employer_id = current_user["_id"]
    elif "id" in current_user:
        employer_id = str(current_user["id"])
    
    # Get the job's employer ID as string too
    job_employer_id = None
    if isinstance(job["employer_id"], ObjectId):
        job_employer_id = str(job["employer_id"])
    else:
        job_employer_id = job["employer_id"]
    
    # Check permission - employer can only access their own jobs
    if (current_user.get("user_type") == "employer" or current_user.get("type") == "employer") and job_employer_id != employer_id:
        logger.warning(f"Permission denied: user_id={employer_id}, job_employer_id={job_employer_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own job postings"
        )
    
    # Transform for response
    response_job = {
        "id": str(job["_id"]),
        "employer_id": job_employer_id,
        "employer_name": job.get("company_name", ""),
        "title": job["title"],
        "description": job["description"],
        "location": job["location"],
        "company_name": job.get("company_name", ""),
        "skills": job.get("skills", []),
        "requirements": job.get("requirements", []),
        "responsibilities": job.get("responsibilities", []),
        "employment_type": job.get("employment_type"),
        "salary_range": job.get("salary_range"),
        "application_deadline": job.get("application_deadline"),
        "is_remote": job.get("is_remote", False),
        "status": job.get("status", "active"),
        "created_at": job["created_at"],
        "updated_at": job["updated_at"],
    }
    
    return response_job

@router.put("/jobs/{job_id}", response_model=JobResponse)
async def update_job_posting(
    job_id: str,
    job_update: JobUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Update a job posting
    """
    # Verify that the current user is an employer
    if not (current_user.get("user_type") == "employer" or current_user.get("type") == "employer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can update job postings"
        )
    
    try:
        # Convert string ID to ObjectId
        job_object_id = ObjectId(job_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format"
        )
    
    # Check if job exists and belongs to this employer
    employer_id = None
    if "_id" in current_user:
        if isinstance(current_user["_id"], ObjectId):
            employer_id = str(current_user["_id"])
        else:
            employer_id = current_user["_id"]
    elif "id" in current_user:
        employer_id = str(current_user["id"])
    
    if not employer_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not determine employer identity"
        )
    
    logger.info(f"Looking for job with id: {job_id} and employer_id: {employer_id}")
    
    # Try multiple query approaches to find the job
    existing_job = None
    
    # First try with direct string comparison
    existing_job = await db.jobs.find_one({
        "_id": job_object_id,
        "employer_id": employer_id
    })
    
    # If not found and it looks like a valid ObjectId, try with ObjectId for employer_id
    if not existing_job and len(employer_id) == 24:
        try:
            employer_obj_id = ObjectId(employer_id)
            existing_job = await db.jobs.find_one({
                "_id": job_object_id,
                "employer_id": employer_obj_id
            })
            logger.info(f"Found job using ObjectId for employer: {employer_obj_id}")
        except Exception as e:
            logger.warning(f"Could not convert employer_id to ObjectId: {e}")
    
    if not existing_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found or you don't have permission to update it"
        )
    
    # Create update data, filtering out None values
    update_data = {k: v for k, v in job_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Update the job
    await db.jobs.update_one(
        {"_id": job_object_id},
        {"$set": update_data}
    )
    
    # Get the updated job
    updated_job = await db.jobs.find_one({"_id": job_object_id})
    
    # Transform for response
    response_job = {
        "id": str(updated_job["_id"]),
        "employer_id": updated_job["employer_id"],
        "employer_name": updated_job.get("company_name", ""),
        "title": updated_job["title"],
        "description": updated_job["description"],
        "location": updated_job["location"],
        "company_name": updated_job.get("company_name", ""),
        "skills": updated_job.get("skills", []),
        "requirements": updated_job.get("requirements", []),
        "responsibilities": updated_job.get("responsibilities", []),
        "employment_type": updated_job.get("employment_type"),
        "salary_range": updated_job.get("salary_range"),
        "application_deadline": updated_job.get("application_deadline"),
        "is_remote": updated_job.get("is_remote", False),
        "status": updated_job.get("status", "active"),
        "created_at": updated_job["created_at"],
        "updated_at": updated_job["updated_at"],
    }
    
    return response_job

@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job_posting(
    job_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Delete a job posting
    """
    # Verify that the current user is an employer
    if not (current_user.get("user_type") == "employer" or current_user.get("type") == "employer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can delete job postings"
        )
    
    try:
        # Convert string ID to ObjectId
        job_object_id = ObjectId(job_id)
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format"
        )
    
    # Check if job exists and belongs to this employer
    employer_id = None
    if "_id" in current_user:
        if isinstance(current_user["_id"], ObjectId):
            employer_id = str(current_user["_id"])
        else:
            employer_id = current_user["_id"]
    elif "id" in current_user:
        employer_id = str(current_user["id"])
    
    if not employer_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not determine employer identity"
        )
    
    logger.info(f"Deleting job with id: {job_id} and employer_id: {employer_id}")
    
    # Try multiple query approaches to find the job
    existing_job = None
    
    # First try with direct string comparison
    existing_job = await db.jobs.find_one({
        "_id": job_object_id,
        "employer_id": employer_id
    })
    
    # If not found and it looks like a valid ObjectId, try with ObjectId for employer_id
    if not existing_job and len(employer_id) == 24:
        try:
            employer_obj_id = ObjectId(employer_id)
            existing_job = await db.jobs.find_one({
                "_id": job_object_id,
                "employer_id": employer_obj_id
            })
            logger.info(f"Found job using ObjectId for employer: {employer_obj_id}")
        except Exception as e:
            logger.warning(f"Could not convert employer_id to ObjectId: {e}")
    
    if not existing_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found or you don't have permission to delete it"
        )
    
    # Delete the job
    await db.jobs.delete_one({"_id": job_object_id})
    
    # Also delete all applications for this job
    await db.job_applications.delete_many({"job_id": job_id})
    
    return None

@router.get("/search/alumni", response_model=List[Dict])
async def search_alumni_by_skills(
    skills: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Search for alumni by skills (employer only)
    """
    # Verify that the current user is an employer
    if not (current_user.get("user_type") == "employer" or current_user.get("type") == "employer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can search for alumni"
        )
    
    # Parse skills list
    skill_list = [skill.strip() for skill in skills.split(",") if skill.strip()]
    
    if not skill_list:
        return []
    
    # Build query - search for alumni with any of these skills
    query = {"skills": {"$in": skill_list}}
    
    # Fetch alumni
    cursor = db.alumni.find(query)
    results = []
    
    async for alumni in cursor:
        # Get matching skills
        matching_skills = list(set(alumni.get("skills", [])) & set(skill_list))
        
        # Add to results
        results.append({
            "id": str(alumni["_id"]),
            "name": alumni.get("first_name", "") + " " + alumni.get("last_name", ""),
            "email": alumni.get("email"),
            "program": alumni.get("program", ""),
            "graduation_year": alumni.get("graduation_year"),
            "skills": matching_skills,
            "match_percentage": round(len(matching_skills) / len(skill_list) * 100, 2)
        })
    
    # Sort by match percentage (highest first)
    results.sort(key=lambda x: x["match_percentage"], reverse=True)
    
    return results

@router.get("/jobs/{job_id}/applications", response_model=List[JobApplicantResponse])
async def get_job_applications(
    job_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get all applications for a specific job (employer only)
    """
    # Verify that the current user is an employer
    if not (current_user.get("user_type") == "employer" or current_user.get("type") == "employer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can view job applications"
        )
    
    # Check if job exists and belongs to this employer
    employer_id = str(current_user.get("id", current_user.get("_id")))
    
    try:
        job = await db.jobs.find_one({
            "_id": ObjectId(job_id),
            "employer_id": employer_id
        })
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format"
        )
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found or you don't have permission to view it"
        )
    
    # Fetch applications
    cursor = db.job_applications.find({"job_id": job_id})
    applications = []
    
    async for app in cursor:
        # Get alumni information
        alumni = None
        if app.get("alumni_id"):
            alumni = await db.alumni.find_one({"_id": ObjectId(app["alumni_id"])})
        
        applications.append({
            "id": str(app["_id"]),
            "job_id": app["job_id"],
            "alumni_id": app["alumni_id"],
            "alumni_name": f"{alumni.get('first_name', '')} {alumni.get('last_name', '')}" if alumni else "Unknown",
            "alumni_email": alumni.get("email") if alumni else None,
            "job_title": job["title"],
            "cover_letter": app.get("cover_letter"),
            "status": app.get("status", "applied"),
            "created_at": app["created_at"],
            "updated_at": app["updated_at"]
        })
    
    return applications

@router.put("/applications/{application_id}", response_model=JobApplicantResponse)
async def update_application_status(
    application_id: str,
    application_update: JobApplicantUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Update the status of a job application (employer only)
    """
    # Verify that the current user is an employer
    if not (current_user.get("user_type") == "employer" or current_user.get("type") == "employer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can update application status"
        )
    
    employer_id = str(current_user.get("id", current_user.get("_id")))
    
    try:
        # Find the application
        app = await db.job_applications.find_one({"_id": ObjectId(application_id)})
        
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found"
            )
        
        # Verify the job belongs to this employer
        job = await db.jobs.find_one({
            "_id": ObjectId(app["job_id"]),
            "employer_id": employer_id
        })
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this application"
            )
        
        # Update the application
        update_data = {k: v for k, v in application_update.dict().items() if v is not None}
        update_data["updated_at"] = datetime.utcnow()
        
        await db.job_applications.update_one(
            {"_id": ObjectId(application_id)},
            {"$set": update_data}
        )
        
        # Get updated application
        updated_app = await db.job_applications.find_one({"_id": ObjectId(application_id)})
        
        # Get alumni information
        alumni = None
        if updated_app.get("alumni_id"):
            alumni = await db.alumni.find_one({"_id": ObjectId(updated_app["alumni_id"])})
        
        # Return response
        return {
            "id": str(updated_app["_id"]),
            "job_id": updated_app["job_id"],
            "alumni_id": updated_app["alumni_id"],
            "alumni_name": f"{alumni.get('first_name', '')} {alumni.get('last_name', '')}" if alumni else "Unknown",
            "alumni_email": alumni.get("email") if alumni else None,
            "job_title": job["title"],
            "cover_letter": updated_app.get("cover_letter"),
            "status": updated_app.get("status", "applied"),
            "created_at": updated_app["created_at"],
            "updated_at": updated_app["updated_at"]
        }
        
    except Exception as e:
        logger.error(f"Error updating application status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update application status: {str(e)}"
        ) 