from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, Path
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
import logging

from app.schemas.recruitment import (
    JobCreate, 
    JobUpdate, 
    JobResponse, 
    JobStatus,
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
    ApplicationStatus,
    CandidateSearchResult
)
from app.utils.auth import get_current_user
from app.config.database import get_database

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# ==================== Job Routes ====================

@router.post("/jobs", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job: JobCreate, 
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Create a new job posting.
    """
    # Check permissions (only employers can create jobs)
    if not (current_user.get("user_type") == "employer" or current_user.get("type") == "employer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can create job postings"
        )
    
    # Get employer ID
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
    
    # Get company name from employer profile
    employer = None
    try:
        employer = await db.employers.find_one({"_id": employer_id})
        if not employer and len(employer_id) == 24:
            try:
                employer = await db.employers.find_one({"_id": ObjectId(employer_id)})
            except Exception as e:
                logger.warning(f"Could not convert employer_id to ObjectId: {e}")
    except Exception as e:
        logger.error(f"Error fetching employer: {e}")
    
    company_name = employer.get("company_name", "") if employer else ""
    
    # Create job document
    job_data = job.dict()
    job_data.update({
        "employer_id": employer_id,
        "company_name": company_name,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "applicant_count": 0
    })
    
    try:
        result = await db.jobs.insert_one(job_data)
        created_job = await db.jobs.find_one({"_id": result.inserted_id})
        
        # Format response
        response_job = {
            **created_job,
            "id": str(created_job["_id"]),
            "employer_name": company_name
        }
        
        return response_job
    except Exception as e:
        logger.error(f"Error creating job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create job posting: {str(e)}"
        )

@router.get("/jobs", response_model=List[JobResponse])
async def get_jobs(
    skip: int = Query(0, description="Number of jobs to skip"),
    limit: int = Query(100, description="Number of jobs to return"),
    status: Optional[JobStatus] = Query(None, description="Filter by job status"),
    employer_id: Optional[str] = Query(None, description="Filter by employer ID"),
    search: Optional[str] = Query(None, description="Search by job title or skills"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get all job postings with optional filtering.
    """
    query = {}
    
    # Add filters if provided
    if employer_id:
        query["employer_id"] = employer_id
    
    if status:
        query["status"] = status
    
    # Add search if provided
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"skills": {"$in": [search]}}
        ]
    
    # Fetch jobs
    try:
        cursor = db.jobs.find(query).sort("created_at", -1).skip(skip).limit(limit)
        jobs = []
        
        async for job in cursor:
            # Count applicants for each job
            applicant_count = await db.applications.count_documents({"job_id": str(job["_id"])})
            
            # Format response
            jobs.append({
                **job,
                "id": str(job["_id"]),
                "applicant_count": applicant_count
            })
        
        return jobs
    except Exception as e:
        logger.error(f"Error fetching jobs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch jobs: {str(e)}"
        )

@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str = Path(..., description="The ID of the job to get"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get a specific job posting by ID.
    """
    try:
        # Try to find the job by string ID first
        job = await db.jobs.find_one({"_id": job_id})
        
        # If not found, try with ObjectId
        if not job:
            try:
                job_object_id = ObjectId(job_id)
                job = await db.jobs.find_one({"_id": job_object_id})
            except Exception as e:
                logger.error(f"Invalid job ID format: {job_id}, error: {e}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid job ID format"
                )
    except Exception as e:
        logger.error(f"Error fetching job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch job: {str(e)}"
        )
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found"
        )
    
    # Determine the job ID to use for counting applications
    job_id_for_query = str(job["_id"])
    
    # Count applicants
    applicant_count = await db.applications.count_documents({"job_id": job_id_for_query})
    
    # Format response
    response_job = {
        **job,
        "id": str(job["_id"]),
        "applicant_count": applicant_count
    }
    
    return response_job

@router.put("/jobs/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str = Path(..., description="The ID of the job to update"),
    job_update: JobUpdate = Body(..., description="The updated job data"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Update a job posting.
    """
    # Verify that the current user is an employer
    if not (current_user.get("user_type") == "employer" or current_user.get("type") == "employer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can update job postings"
        )
    
    # Get employer ID
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
    
    # Try to find the job using different ID formats
    job = None
    try:
        # Try to find by string ID first
        job = await db.jobs.find_one({"_id": job_id})
        
        # If not found, try with ObjectId
        if not job and ObjectId.is_valid(job_id):
            job_object_id = ObjectId(job_id)
            job = await db.jobs.find_one({"_id": job_object_id})
    except Exception as e:
        logger.error(f"Error finding job: {e}")
        # Continue execution to handle the case where job is None
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found"
        )
    
    # Check if job belongs to employer
    job_employer_id = str(job.get("employer_id", ""))
    if job_employer_id != employer_id:
        # Try with ObjectId if possible
        try:
            if ObjectId.is_valid(job_employer_id) and ObjectId.is_valid(employer_id):
                if str(ObjectId(job_employer_id)) != str(ObjectId(employer_id)):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You do not have permission to update this job posting"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to update this job posting"
                )
        except:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update this job posting"
            )
    
    # Prepare update data
    update_data = {k: v for k, v in job_update.dict(exclude_unset=True).items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Update job
    try:
        # Use the same ID format as stored in the database
        job_id_for_update = job["_id"]
        
        await db.jobs.update_one(
            {"_id": job_id_for_update},
            {"$set": update_data}
        )
        
        # Get updated job
        updated_job = await db.jobs.find_one({"_id": job_id_for_update})
        
        # Count applicants
        applicant_count = await db.applications.count_documents({"job_id": str(job_id_for_update)})
        
        # Format response
        response_job = {
            **updated_job,
            "id": str(updated_job["_id"]),
            "applicant_count": applicant_count
        }
        
        return response_job
    except Exception as e:
        logger.error(f"Error updating job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update job posting: {str(e)}"
        )

@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: str = Path(..., description="The ID of the job to delete"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Delete a job posting.
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
    except Exception as e:
        logger.error(f"Invalid job ID format: {job_id}, error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format"
        )
    
    # Get employer ID
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
    
    # Check if job exists and belongs to this employer
    job = await db.jobs.find_one({"_id": job_object_id})
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found"
        )
    
    # Check if job belongs to employer
    job_employer_id = str(job["employer_id"]) if job.get("employer_id") else None
    
    if job_employer_id != employer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own job postings"
        )
    
    # Delete job
    await db.jobs.delete_one({"_id": job_object_id})
    
    # Delete all applications for this job
    await db.applications.delete_many({"job_id": job_id})
    
    return None

# ==================== Application Routes ====================

@router.post("/applications", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    application: ApplicationCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Create a new job application.
    """
    # Verify that the current user is a job seeker (alumni, student)
    if current_user.get("user_type") == "employer" or current_user.get("type") == "employer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employers cannot apply for jobs"
        )
    
    # Get applicant ID
    applicant_id = None
    if "_id" in current_user:
        if isinstance(current_user["_id"], ObjectId):
            applicant_id = str(current_user["_id"])
        else:
            applicant_id = current_user["_id"]
    elif "id" in current_user:
        applicant_id = str(current_user["id"])
    
    if not applicant_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not determine applicant identity"
        )
    
    # Check if job exists
    try:
        job = await db.jobs.find_one({"_id": ObjectId(application.job_id)})
    except Exception as e:
        logger.error(f"Invalid job ID format: {application.job_id}, error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format"
        )
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found"
        )
    
    # Check if job is open for applications
    if job.get("status") not in [JobStatus.ACTIVE, JobStatus.DRAFT]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This job is {job.get('status')} and not accepting applications"
        )
    
    # Check if applicant has already applied to this job
    existing_application = await db.applications.find_one({
        "job_id": application.job_id,
        "applicant_id": applicant_id
    })
    
    if existing_application:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already applied to this job"
        )
    
    # Create application document
    application_data = application.dict()
    application_data.update({
        "applicant_id": applicant_id,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "status": ApplicationStatus.APPLIED
    })
    
    try:
        result = await db.applications.insert_one(application_data)
        created_application = await db.applications.find_one({"_id": result.inserted_id})
        
        # Get applicant and job info for response
        applicant = None
        applicant_name = "Unknown"
        applicant_email = None
        
        # Try to find in users collection first
        try:
            applicant = await db.users.find_one({"_id": ObjectId(applicant_id)})
            if not applicant and ObjectId.is_valid(applicant_id):
                applicant = await db.users.find_one({"_id": applicant_id})
        except Exception as e:
            logger.error(f"Error finding user: {e}")
            
        # If not found in users, try employers collection
        if not applicant:
            try:
                applicant = await db.employers.find_one({"_id": applicant_id})
                if not applicant and ObjectId.is_valid(applicant_id):
                    applicant = await db.employers.find_one({"_id": ObjectId(applicant_id)})
            except Exception as e:
                logger.error(f"Error finding employer: {e}")
        
        # Set applicant name and email based on what was found
        if applicant:
            if "company_name" in applicant:
                applicant_name = applicant.get("company_name", "")
            elif "full_name" in applicant:
                applicant_name = applicant.get("full_name", "")
            else:
                applicant_name = f"{applicant.get('first_name', '')} {applicant.get('last_name', '')}".strip()
            
            applicant_email = applicant.get("email")
        
        # Format response
        response_application = {
            **created_application,
            "id": str(created_application["_id"]),
            "applicant_name": applicant_name,
            "applicant_email": applicant_email,
            "job_title": job.get("title"),
            "company_name": job.get("company_name")
        }
        
        # Update job applicant count (increment by 1)
        await db.jobs.update_one(
            {"_id": ObjectId(application.job_id)},
            {"$inc": {"applicant_count": 1}}
        )
        
        return response_application
    except Exception as e:
        logger.error(f"Error creating application: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create application: {str(e)}"
        )

@router.get("/applications", response_model=List[ApplicationResponse])
async def get_applications(
    job_id: Optional[str] = Query(None, description="Filter by job ID"),
    status: Optional[ApplicationStatus] = Query(None, description="Filter by application status"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get job applications based on user type and filters.
    """
    query = {}
    
    # Add filters based on user type
    if current_user.get("user_type") == "employer" or current_user.get("type") == "employer":
        # Employers can only see applications for their jobs
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
        
        # Get all jobs by this employer
        employer_jobs = []
        cursor = db.jobs.find({"employer_id": employer_id})
        async for job in cursor:
            employer_jobs.append(str(job["_id"]))
        
        # Filter applications for these jobs
        if job_id:
            if job_id not in employer_jobs:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view applications for your own jobs"
                )
            query["job_id"] = job_id
        else:
            query["job_id"] = {"$in": employer_jobs}
    else:
        # Job seekers can only see their own applications
        applicant_id = None
        if "_id" in current_user:
            if isinstance(current_user["_id"], ObjectId):
                applicant_id = str(current_user["_id"])
            else:
                applicant_id = current_user["_id"]
        elif "id" in current_user:
            applicant_id = str(current_user["id"])
        
        if not applicant_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not determine applicant identity"
            )
        
        query["applicant_id"] = applicant_id
        
        # Add job filter if provided
        if job_id:
            query["job_id"] = job_id
    
    # Add status filter if provided
    if status:
        query["status"] = status
    
    # Fetch applications
    try:
        cursor = db.applications.find(query).sort("created_at", -1)
        applications = []
        
        async for application in cursor:
            # Get applicant and job info for response
            applicant = None
            
            # Try to find in users collection
            applicant = await db.users.find_one({"_id": ObjectId(application["applicant_id"])})
            
            # If not found in users, try employers collection
            if not applicant:
                try:
                    applicant = await db.employers.find_one({"_id": application["applicant_id"]})
                    if not applicant and ObjectId.is_valid(application["applicant_id"]):
                        applicant = await db.employers.find_one({"_id": ObjectId(application["applicant_id"])})
                except Exception as e:
                    logger.error(f"Error finding employer: {e}")
            
            job = await db.jobs.find_one({"_id": ObjectId(application["job_id"])})
            
            # Determine applicant name based on type (user or employer)
            applicant_name = "Unknown"
            applicant_email = None
            
            if applicant:
                if "company_name" in applicant:
                    applicant_name = applicant.get("company_name", "")
                elif "full_name" in applicant:
                    applicant_name = applicant.get("full_name", "")
                else:
                    applicant_name = f"{applicant.get('first_name', '')} {applicant.get('last_name', '')}".strip()
                
                applicant_email = applicant.get("email")
            
            # Format response
            applications.append({
                **application,
                "id": str(application["_id"]),
                "applicant_name": applicant_name,
                "applicant_email": applicant_email,
                "job_title": job.get("title") if job else "Unknown",
                "company_name": job.get("company_name") if job else None
            })
        
        return applications
    except Exception as e:
        logger.error(f"Error fetching applications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch applications: {str(e)}"
        )

@router.get("/applications/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: str = Path(..., description="The ID of the application to get"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Get a specific application by ID.
    """
    # Get user ID and type
    user_id = None
    user_type = None
    
    if "_id" in current_user:
        user_id = str(current_user["_id"])
    elif "id" in current_user:
        user_id = str(current_user["id"])
    
    user_type = current_user.get("user_type") or current_user.get("type")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not determine user identity"
        )
    
    # Try to find the application using different ID formats
    application = None
    try:
        # Try string ID first
        application = await db.applications.find_one({"_id": application_id})
        
        # If not found, try ObjectId
        if not application and ObjectId.is_valid(application_id):
            application_object_id = ObjectId(application_id)
            application = await db.applications.find_one({"_id": application_object_id})
    except Exception as e:
        logger.error(f"Error finding application: {e}")
        # Continue execution to handle the case where application is None
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    logger.info(f"Found application: {application}")
    
    # Check permissions - only the applicant and the employer of the job can view the application
    job_id = application.get("job_id")
    applicant_id = application.get("applicant_id")
    
    logger.info(f"Application has applicant_id: {applicant_id}")
    
    # Check if user is either the applicant or an employer
    is_applicant = (user_id == applicant_id)
    is_employer = (user_type == "employer")
    is_admin = (user_type == "admin")
    
    # If user is employer, check if they own the job
    job = None
    employer_has_permission = False
    
    if is_employer and job_id:
        try:
            # Try string ID first
            job = await db.jobs.find_one({"_id": job_id})
            
            # If not found, try ObjectId
            if not job and ObjectId.is_valid(job_id):
                job = await db.jobs.find_one({"_id": ObjectId(job_id)})
            
            if job:
                job_employer_id = str(job.get("employer_id", ""))
                if job_employer_id == user_id:
                    employer_has_permission = True
                # Also try ObjectId comparison if needed
                elif ObjectId.is_valid(job_employer_id) and ObjectId.is_valid(user_id):
                    if str(ObjectId(job_employer_id)) == str(ObjectId(user_id)):
                        employer_has_permission = True
        except Exception as e:
            logger.error(f"Error checking job ownership: {e}")
    
    # Check permissions
    if not (is_applicant or employer_has_permission or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this application"
        )
    
    # Get applicant and job details to include in response
    applicant_name = None
    applicant_email = None
    job_title = None
    company_name = None
    
    try:
        # Get applicant details - first check users collection
        applicant = None
        
        # Try to find in users collection
        logger.info(f"Looking for applicant in users collection with ID: {applicant_id}")
        applicant = await db.users.find_one({"_id": applicant_id})
        if not applicant and ObjectId.is_valid(applicant_id):
            logger.info(f"Trying with ObjectId: {ObjectId(applicant_id)}")
            applicant = await db.users.find_one({"_id": ObjectId(applicant_id)})
        
        # If not found in users, try employers collection
        if not applicant:
            logger.info(f"Not found in users, looking in employers collection with ID: {applicant_id}")
            applicant = await db.employers.find_one({"_id": applicant_id})
            if not applicant and ObjectId.is_valid(applicant_id):
                logger.info(f"Trying with ObjectId: {ObjectId(applicant_id)}")
                applicant = await db.employers.find_one({"_id": ObjectId(applicant_id)})
        
        if applicant:
            logger.info(f"Found applicant: {applicant}")
            # Check if it's an employer (has company_name) or regular user (has first/last name)
            if "company_name" in applicant:
                applicant_name = applicant.get("company_name", "")
                logger.info(f"Using company_name for applicant_name: {applicant_name}")
            elif "full_name" in applicant:
                applicant_name = applicant.get("full_name", "")
                logger.info(f"Using full_name for applicant_name: {applicant_name}")
            else:
                applicant_name = f"{applicant.get('first_name', '')} {applicant.get('last_name', '')}".strip()
                logger.info(f"Using first_name/last_name for applicant_name: {applicant_name}")
            
            applicant_email = applicant.get("email")
        else:
            logger.warning(f"Applicant not found in either users or employers collection with ID: {applicant_id}")
        
        # Get job details if not already fetched
        if not job and job_id:
            job = await db.jobs.find_one({"_id": job_id})
            if not job and ObjectId.is_valid(job_id):
                job = await db.jobs.find_one({"_id": ObjectId(job_id)})
        
        if job:
            job_title = job.get("title")
            company_name = job.get("company_name")
    except Exception as e:
        logger.error(f"Error fetching related data: {e}")
    
    # Prepare response
    response_application = {
        **application,
        "id": str(application["_id"]),
        "applicant_name": applicant_name,
        "applicant_email": applicant_email,
        "job_title": job_title,
        "company_name": company_name
    }
    
    logger.info(f"Response application: {response_application}")
    
    return response_application

@router.put("/applications/{application_id}", response_model=ApplicationResponse)
async def update_application(
    application_id: str = Path(..., description="The ID of the application to update"),
    application_update: ApplicationUpdate = Body(..., description="The updated application data"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Update a job application.
    """
    try:
        # Convert string ID to ObjectId
        application_object_id = ObjectId(application_id)
    except Exception as e:
        logger.error(f"Invalid application ID format: {application_id}, error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid application ID format"
        )
    
    # Fetch the application
    application = await db.applications.find_one({"_id": application_object_id})
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    # Check permission and set allowed fields based on user type
    allowed_fields = {}
    
    if current_user.get("user_type") == "employer" or current_user.get("type") == "employer":
        # Employers can only update status and notes of applications for their jobs
        employer_id = None
        if "_id" in current_user:
            if isinstance(current_user["_id"], ObjectId):
                employer_id = str(current_user["_id"])
            else:
                employer_id = current_user["_id"]
        elif "id" in current_user:
            employer_id = str(current_user["id"])
        
        # Get the job for this application
        job = await db.jobs.find_one({"_id": ObjectId(application["job_id"])})
        
        if not job or str(job.get("employer_id")) != employer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update applications for your own jobs"
            )
        
        # Employers can update status and notes
        if application_update.status is not None:
            allowed_fields["status"] = application_update.status
        
        if application_update.employer_notes is not None:
            allowed_fields["employer_notes"] = application_update.employer_notes
    else:
        # Job seekers can only update their own applications and only certain fields
        applicant_id = None
        if "_id" in current_user:
            if isinstance(current_user["_id"], ObjectId):
                applicant_id = str(current_user["_id"])
            else:
                applicant_id = current_user["_id"]
        elif "id" in current_user:
            applicant_id = str(current_user["id"])
        
        if str(application["applicant_id"]) != applicant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own applications"
            )
        
        # Applicants can only update cover letter and resume
        if application_update.cover_letter is not None:
            allowed_fields["cover_letter"] = application_update.cover_letter
        
        if application_update.resume_url is not None:
            allowed_fields["resume_url"] = application_update.resume_url
    
    # Update application if there are allowed fields
    if allowed_fields:
        allowed_fields["updated_at"] = datetime.utcnow()
        
        await db.applications.update_one(
            {"_id": application_object_id},
            {"$set": allowed_fields}
        )
    
    # Get updated application
    updated_application = await db.applications.find_one({"_id": application_object_id})
    
    # Get applicant and job info for response
    applicant = None
    applicant_name = "Unknown"
    applicant_email = None
    job_title = None
    company_name = None
    
    # Try to find applicant in users collection first
    try:
        applicant = await db.users.find_one({"_id": ObjectId(updated_application["applicant_id"])})
        if not applicant and ObjectId.is_valid(updated_application["applicant_id"]):
            applicant = await db.users.find_one({"_id": updated_application["applicant_id"]})
    except Exception as e:
        logger.error(f"Error finding user: {e}")
    
    # If not found in users, try employers collection
    if not applicant:
        try:
            applicant = await db.employers.find_one({"_id": updated_application["applicant_id"]})
            if not applicant and ObjectId.is_valid(updated_application["applicant_id"]):
                applicant = await db.employers.find_one({"_id": ObjectId(updated_application["applicant_id"])})
        except Exception as e:
            logger.error(f"Error finding employer: {e}")
    
    # Set applicant name and email based on what was found
    if applicant:
        if "company_name" in applicant:
            applicant_name = applicant.get("company_name", "")
        elif "full_name" in applicant:
            applicant_name = applicant.get("full_name", "")
        else:
            applicant_name = f"{applicant.get('first_name', '')} {applicant.get('last_name', '')}".strip()
        
        applicant_email = applicant.get("email")
    
    # Get job info
    job = await db.jobs.find_one({"_id": ObjectId(updated_application["job_id"])})
    if job:
        job_title = job.get("title")
        company_name = job.get("company_name")
    
    # Format response
    response_application = {
        **updated_application,
        "id": str(updated_application["_id"]),
        "applicant_name": applicant_name,
        "applicant_email": applicant_email,
        "job_title": job_title,
        "company_name": company_name
    }
    
    return response_application

@router.delete("/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    application_id: str = Path(..., description="The ID of the application to delete"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Delete a job application.
    """
    try:
        # Convert string ID to ObjectId
        application_object_id = ObjectId(application_id)
    except Exception as e:
        logger.error(f"Invalid application ID format: {application_id}, error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid application ID format"
        )
    
    # Fetch the application
    application = await db.applications.find_one({"_id": application_object_id})
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    # Check permission based on user type
    if current_user.get("user_type") == "employer" or current_user.get("type") == "employer":
        # Employers can only delete applications for their jobs
        employer_id = None
        if "_id" in current_user:
            if isinstance(current_user["_id"], ObjectId):
                employer_id = str(current_user["_id"])
            else:
                employer_id = current_user["_id"]
        elif "id" in current_user:
            employer_id = str(current_user["id"])
        
        # Get the job for this application
        job = await db.jobs.find_one({"_id": ObjectId(application["job_id"])})
        
        if not job or str(job.get("employer_id")) != employer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete applications for your own jobs"
            )
    else:
        # Job seekers can only delete their own applications
        applicant_id = None
        if "_id" in current_user:
            if isinstance(current_user["_id"], ObjectId):
                applicant_id = str(current_user["_id"])
            else:
                applicant_id = current_user["_id"]
        elif "id" in current_user:
            applicant_id = str(current_user["id"])
        
        if str(application["applicant_id"]) != applicant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own applications"
            )
    
    # Delete application
    await db.applications.delete_one({"_id": application_object_id})
    
    # Update job applicant count (decrement by 1)
    await db.jobs.update_one(
        {"_id": ObjectId(application["job_id"])},
        {"$inc": {"applicant_count": -1}}
    )
    
    return None

# ==================== Search Routes ====================

@router.get("/search/candidates", response_model=List[CandidateSearchResult])
async def search_candidates_by_skills(
    skills: str = Query(..., description="Comma-separated list of skills to search for"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Search for candidates by skills.
    """
    # Verify that the current user is an employer
    if not (current_user.get("user_type") == "employer" or current_user.get("type") == "employer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can search for candidates"
        )
    
    # Parse skills list
    skill_list = [skill.strip() for skill in skills.split(",") if skill.strip()]
    
    if not skill_list:
        return []
    
    # Build query - search for alumni with any of these skills
    query = {"skills": {"$in": skill_list}}
    
    # Fetch alumni
    try:
        cursor = db.users.find(query)
        results = []
        
        async for user in cursor:
            # Get matching skills
            user_skills = user.get("skills", [])
            matching_skills = list(set(user_skills) & set(skill_list))
            
            # Calculate match percentage
            match_percentage = round(len(matching_skills) / len(skill_list) * 100, 2)
            
            # Add to results
            results.append({
                "id": str(user["_id"]),
                "name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
                "email": user.get("email"),
                "program": user.get("program", ""),
                "graduation_year": user.get("graduation_year"),
                "skills": matching_skills,
                "match_percentage": match_percentage
            })
        
        # Sort by match percentage (highest first)
        results.sort(key=lambda x: x["match_percentage"], reverse=True)
        
        return results
    except Exception as e:
        logger.error(f"Error searching candidates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search candidates: {str(e)}"
        ) 