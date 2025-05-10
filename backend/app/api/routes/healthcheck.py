from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from app.config.database import get_database

router = APIRouter()

@router.get("/health", response_model=Dict[str, Any])
async def health_check():
    """
    Basic health check endpoint for the API without authentication
    """
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "message": "API is operational"
    }

@router.get("/health/db", response_model=Dict[str, Any])
async def db_health_check():
    """
    Health check endpoint for the database connection
    """
    db = get_database()
    db_status = "ok"
    collection_names = []
    error_details = None
    
    try:
        # Try to get collection names
        collection_names = await db.list_collection_names()
    except Exception as e:
        db_status = "error"
        error_details = str(e)
    
    return {
        "status": "ok",
        "database_status": db_status,
        "collection_names": collection_names,
        "error_details": error_details,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/health/alumni", response_model=Dict[str, Any])
async def alumni_health_check():
    """
    Health check endpoint for the alumni collection
    """
    db = get_database()
    db_status = "ok"
    alumni_count = 0
    error_details = None
    alumni_sample = []
    
    try:
        # Try to count alumni
        alumni_count = await db.alumni.count_documents({})
        
        # Get a sample of alumni
        if alumni_count > 0:
            cursor = db.alumni.find({}).limit(3)
            alumni_sample = await cursor.to_list(length=3)
            # Convert ObjectId to string
            for alumni in alumni_sample:
                alumni["_id"] = str(alumni["_id"])
    except Exception as e:
        db_status = "error"
        error_details = str(e)
    
    return {
        "status": "ok",
        "database_status": db_status,
        "alumni_count": alumni_count,
        "alumni_sample": alumni_sample,
        "error_details": error_details,
        "timestamp": datetime.utcnow().isoformat()
    } 