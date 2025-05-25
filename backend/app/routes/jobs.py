from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
from bson import ObjectId

from app.schemas.jobs import JobCreate, JobUpdate, JobResponse
from app.utils.auth import get_current_user
from app.config.database import get_database
from app.models.user import UserInDB

router = APIRouter()

@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job: JobCreate, 
    current_user: UserInDB = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Create a new job posting.
    """
    # Check permissions (only employers or admins can create jobs)
    if current_user.role not in ["employer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to create job postings"
        )
    
    job_data = job.dict()
    job_data["created_by"] = str(current_user.id)
    job_data["created_at"] = datetime.utcnow()
    job_data["updated_at"] = datetime.utcnow()
    
    result = await db.jobs.insert_one(job_data)
    
    created_job = await db.jobs.find_one({"_id": result.inserted_id})
    created_job["id"] = str(created_job["_id"])
    
    return created_job

@router.get("/", response_model=List[JobResponse])
async def get_jobs(
    skip: int = 0, 
    limit: int = 100,
    employer_id: Optional[str] = None,
    status: Optional[str] = None,
    db = Depends(get_database)
):
    """
    Get all job postings with optional filtering.
    """
    query = {}
    
    if employer_id:
        query["employer_id"] = employer_id
    
    if status:
        query["status"] = status
    
    jobs_cursor = db.jobs.find(query).skip(skip).limit(limit)
    jobs = await jobs_cursor.to_list(length=limit)
    
    # Convert ObjectId to string for each job
    for job in jobs:
        job["id"] = str(job["_id"])
    
    return jobs

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    db = Depends(get_database)
):
    """
    Get a specific job posting by ID.
    """
    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    job["id"] = str(job["_id"])
    return job

@router.put("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str,
    job_update: JobUpdate,
    current_user: UserInDB = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Update a job posting.
    """
    existing_job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    
    if not existing_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # Check if user is authorized to update this job
    if (str(existing_job.get("created_by")) != str(current_user.id) and 
        current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this job posting"
        )
    
    update_data = job_update.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    await db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": update_data}
    )
    
    updated_job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    updated_job["id"] = str(updated_job["_id"])
    
    return updated_job

@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: str,
    current_user: UserInDB = Depends(get_current_user),
    db = Depends(get_database)
):
    """
    Delete a job posting.
    """
    existing_job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    
    if not existing_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # Check if user is authorized to delete this job
    if (str(existing_job.get("created_by")) != str(current_user.id) and 
        current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this job posting"
        )
    
    await db.jobs.delete_one({"_id": ObjectId(job_id)}) 