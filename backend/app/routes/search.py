from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from bson import ObjectId

from app.utils.auth import get_current_user
from app.config.database import get_database
from app.models.user import UserInDB

router = APIRouter()

@router.get("/", response_model=Dict[str, Any])
async def search(
    q: str = Query(..., description="Search query string"),
    type: Optional[str] = Query(None, description="Type of entity to search for (alumni, jobs, events, etc.)"),
    skip: int = 0,
    limit: int = 20,
    db = Depends(get_database),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Search across different entities in the system.
    """
    results = {}
    search_query = {"$text": {"$search": q}}
    
    # If type is specified, only search that collection
    if type:
        if type == "alumni":
            alumni_cursor = db.alumni.find(
                search_query
            ).skip(skip).limit(limit)
            
            alumni_results = await alumni_cursor.to_list(length=limit)
            for item in alumni_results:
                item["id"] = str(item["_id"])
            
            results["alumni"] = alumni_results
        
        elif type == "jobs":
            jobs_cursor = db.jobs.find(
                search_query
            ).skip(skip).limit(limit)
            
            jobs_results = await jobs_cursor.to_list(length=limit)
            for item in jobs_results:
                item["id"] = str(item["_id"])
            
            results["jobs"] = jobs_results
        
        elif type == "events":
            events_cursor = db.events.find(
                search_query
            ).skip(skip).limit(limit)
            
            events_results = await events_cursor.to_list(length=limit)
            for item in events_results:
                item["id"] = str(item["_id"])
            
            results["events"] = events_results
        
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid search type: {type}"
            )
    
    # If no type specified, search across all collections
    else:
        # Search alumni
        alumni_cursor = db.alumni.find(
            search_query
        ).limit(limit)
        alumni_results = await alumni_cursor.to_list(length=limit)
        for item in alumni_results:
            item["id"] = str(item["_id"])
        results["alumni"] = alumni_results
        
        # Search jobs
        jobs_cursor = db.jobs.find(
            search_query
        ).limit(limit)
        jobs_results = await jobs_cursor.to_list(length=limit)
        for item in jobs_results:
            item["id"] = str(item["_id"])
        results["jobs"] = jobs_results
        
        # Search events
        events_cursor = db.events.find(
            search_query
        ).limit(limit)
        events_results = await events_cursor.to_list(length=limit)
        for item in events_results:
            item["id"] = str(item["_id"])
        results["events"] = events_results
    
    return {
        "query": q,
        "type": type,
        "results": results,
        "counts": {
            key: len(value) for key, value in results.items()
        },
        "total_count": sum(len(value) for value in results.values())
    }

@router.get("/autocomplete", response_model=List[Dict[str, Any]])
async def autocomplete(
    q: str = Query(..., description="Search prefix for autocomplete"),
    type: str = Query(..., description="Type of entity for autocomplete (alumni, jobs, events, etc.)"),
    limit: int = 10,
    db = Depends(get_database),
    current_user: UserInDB = Depends(get_current_user)
):
    """
    Provide autocomplete suggestions for a given prefix and entity type.
    """
    results = []
    
    if type == "alumni":
        # Search in alumni collection by name
        query = {"name": {"$regex": f"^{q}", "$options": "i"}}
        cursor = db.alumni.find(query).limit(limit)
        results = await cursor.to_list(length=limit)
        
        # Convert _id to string
        for item in results:
            item["id"] = str(item["_id"])
            item["type"] = "alumni"
    
    elif type == "jobs":
        # Search in jobs collection by title
        query = {"title": {"$regex": f"^{q}", "$options": "i"}}
        cursor = db.jobs.find(query).limit(limit)
        results = await cursor.to_list(length=limit)
        
        # Convert _id to string
        for item in results:
            item["id"] = str(item["_id"])
            item["type"] = "jobs"
    
    elif type == "events":
        # Search in events collection by title
        query = {"title": {"$regex": f"^{q}", "$options": "i"}}
        cursor = db.events.find(query).limit(limit)
        results = await cursor.to_list(length=limit)
        
        # Convert _id to string
        for item in results:
            item["id"] = str(item["_id"])
            item["type"] = "events"
    
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid autocomplete type: {type}"
        )
    
    return results 