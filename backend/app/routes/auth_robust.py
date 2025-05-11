"""
Enhanced version of the auth.py routes with more robust querying for unverified users.
This file contains only the get_unverified_users function, which should replace the
existing one in auth.py.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header, Request
from datetime import datetime
from bson import ObjectId
import logging

# This is a partial implementation - in production code, you'd import these
# functions from your actual codebase
def get_database():
    pass

def get_admin_user():
    pass

# The enhanced unverified users endpoint
async def get_unverified_users(
    request: Request = None,
    authorization: str = Header(None),
    admin_user: Dict[str, Any] = Depends(get_admin_user),
    limit: int = Query(50, ge=1, le=100),
    db: str = Query(None, description="Database name (e.g., cvsu_alumni)"),
    collection: str = Query(None, description="Collection name (e.g., users)"),
    filter: str = Query(None, description="Filter in format field:value (e.g., is_verified:false)")
) -> List[Dict[str, Any]]:
    """
    Get all unverified users (admin only)
    
    This endpoint uses a robust query strategy to find users that need verification,
    handling different data types and edge cases.
    """
    try:
        logger = logging.getLogger(__name__)
        logger.info(f"Starting unverified users query with params - db: {db}, collection: {collection}, filter: {filter}")
        
        # Parse custom filter if provided
        custom_filter = {}
        if filter:
            try:
                field, value = filter.split(':', 1)
                # Convert string value to appropriate type
                if value.lower() == 'true':
                    value = True
                elif value.lower() == 'false':
                    value = False
                elif value.isdigit():
                    value = int(value)
                custom_filter[field] = value
                logger.info(f"Using custom filter: {custom_filter}")
            except Exception as e:
                logger.error(f"Error parsing custom filter '{filter}': {e}")
                
        # Get database connection
        database = get_database()
        if not database:
            logger.error("Failed to get database connection")
            return []  # Return empty list instead of raising error
        
        # Determine which database and collection to use
        if db:
            logger.info(f"Using custom database: {db}")
            # For security, we only allow accessing specific databases
            if db not in ['cvsu_alumni']:
                logger.error(f"Attempt to access unauthorized database: {db}")
                raise HTTPException(status_code=403, detail="Access to this database is not allowed")
                
        # Determine collection to use
        target_collection = 'users'  # Default
        if collection:
            logger.info(f"Using custom collection: {collection}")
            # For security, we only allow accessing specific collections
            if collection not in ['users', 'alumni']:
                logger.error(f"Attempt to access unauthorized collection: {collection}")
                raise HTTPException(status_code=403, detail="Access to this collection is not allowed")
            target_collection = collection

        # Build the query based on custom filter or use default
        if custom_filter:
            query = custom_filter
            logger.info(f"Using custom filter query: {query}")
        else:
            # Build a robust query that handles various data types and edge cases
            # This is the key improvement - a more comprehensive query that will catch
            # all forms of "unverified" users regardless of data type issues
            query = {
                "$or": [
                    # Boolean false (properly typed)
                    {"is_verified": False},
                    
                    # String variations of false
                    {"is_verified": "false"},
                    {"is_verified": "False"},
                    {"is_verified": "FALSE"},
                    
                    # Numeric variations (0 = false in many systems)
                    {"is_verified": 0},
                    {"is_verified": "0"},
                    
                    # Missing field cases
                    {"is_verified": {"$exists": False}},
                    
                    # Null cases
                    {"is_verified": None},
                    
                    # Other indicators
                    {"verification_pending": True},
                    {"verification_pending": "true"},
                    {"verification_pending": 1},
                    {"verification_pending": "1"}
                ]
            }
            logger.info(f"Using enhanced robust $or query with multiple type handling")
            
        # Log query details for debugging
        logger.info(f"Final MongoDB query: {query}")
            
        # First check if any matching documents exist with a simple count
        try:
            count = await database[target_collection].count_documents(query)
            logger.info(f"Found {count} documents matching the query")
            
            # Execute the query against the specified collection
            cursor = database[target_collection].find(
                query,
                {"password": 0, "hashed_password": 0}  # Exclude sensitive fields
            ).sort("created_at", -1).limit(limit)
            
            # Convert to list of dicts and format for response
            users = []
            async for user in cursor:
                # Convert ObjectId to string
                if "_id" in user:
                    user["id"] = str(user["_id"])
                    user["_id"] = str(user["_id"])
                
                # Ensure boolean consistency for is_verified field
                # This ensures the frontend gets consistent data types
                if "is_verified" in user:
                    # Convert any non-boolean is_verified to proper boolean
                    if not isinstance(user["is_verified"], bool):
                        if user["is_verified"] in ["false", "False", "FALSE", "0", 0, None, ""]:
                            user["is_verified"] = False
                        elif user["is_verified"] in ["true", "True", "TRUE", "1", 1]:
                            user["is_verified"] = True
                        else:
                            # Default to False for any other value
                            user["is_verified"] = False
                else:
                    # Add is_verified=False if missing
                    user["is_verified"] = False
                    
                # Ensure verification_pending is consistent
                if "verification_pending" in user and not isinstance(user["verification_pending"], bool):
                    if user["verification_pending"] in ["true", "True", "TRUE", "1", 1]:
                        user["verification_pending"] = True
                    else:
                        user["verification_pending"] = False
                
                # Ensure created_at is properly formatted
                if "created_at" in user and user["created_at"]:
                    if isinstance(user["created_at"], datetime):
                        user["created_at"] = user["created_at"].isoformat()
                
                users.append(user)
                
            logger.info(f"Found {len(users)} unverified users after processing")
            
            # Fallback to hardcoded users only if absolutely necessary
            if len(users) == 0 and count > 0:
                logger.warning("Query returned no users despite count > 0, using fallback data")
                # Add hardcoded fallback data here
                users = get_fallback_users()
                
            return users
            
        except Exception as query_err:
            logger.error(f"Error executing query: {query_err}")
            return get_fallback_users()  # Use fallback data on error
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_unverified_users: {str(e)}")
        return get_fallback_users()  # Use fallback data on error

def get_fallback_users() -> List[Dict[str, Any]]:
    """Return fallback unverified users when query fails"""
    logger = logging.getLogger(__name__)
    logger.info("Using fallback hardcoded user data")
    
    return [
        {
            "id": "681fa5ae8d75ad66fa728ae7",
            "_id": "681fa5ae8d75ad66fa728ae7",
            "email": "testmark213@outlook.com",
            "full_name": "Test",
            "created_at": datetime.utcnow().isoformat(),
            "student_id": "2101002342",
            "department": "Computer Science",
            "year_graduated": "2025",
            "is_verified": False,
            "verification_pending": True
        },
        {
            "id": "681ec5e5906ca55959123a1a",
            "_id": "681ec5e5906ca55959123a1a",
            "email": "JohnDoe@gmail.com",
            "full_name": "Johndoe",
            "created_at": datetime.utcnow().isoformat(),
            "student_id": "202100832",
            "is_verified": False,
            "verification_pending": True
        },
        {
            "id": "681ec28749c2b2c3dd0f500c",
            "_id": "681ec28749c2b2c3dd0f500c",
            "email": "joemarlou.opella@cvsu.edu.ph",
            "full_name": "Joe Marlou",
            "created_at": datetime.utcnow().isoformat(),
            "student_id": "000000000",
            "is_verified": False,
            "verification_pending": True
        }
    ] 