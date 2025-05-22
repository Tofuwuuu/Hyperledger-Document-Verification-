from fastapi import APIRouter, Depends, HTTPException, status
from app.utils.auth import get_current_user, get_admin_user
from app.config.database import db
from app.schemas.user import UserOut
from typing import List, Optional, Dict, Any
from bson import ObjectId
import logging
import traceback

# Set up router
router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)

@router.get("/exit-interviews", response_model=List[Dict[str, Any]])
async def get_exit_interviews(current_user: dict = Depends(get_current_user)):
    """
    Get all exit interviews submitted by students transferring to other schools.
    Only admin users can access this endpoint.
    """
    # Verify the user is an admin
    logger.info(f"User attempting to access exit interviews: {current_user.get('_id')}")
    logger.info(f"Is admin: {current_user.get('is_admin', False)}")
    
    if not current_user.get("is_admin", False):
        logger.warning(f"Non-admin user {current_user.get('_id')} attempted to access exit interviews")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resource"
        )
    
    try:
        # Initialize empty list for questionnaires
        questionnaires = []
        
        # Get database collections
        collections = await db.list_collection_names()
        logger.info(f"Available collections: {collections}")
        
        # Method 1: Try to get questionnaires from the questionnaires collection
        if "questionnaires" in collections:
            logger.info("Fetching from questionnaires collection")
            questionnaire_docs = await db.questionnaires.find().to_list(length=1000)
            
            logger.info(f"Found {len(questionnaire_docs)} questionnaires in separate collection")
            
            # Process questionnaires from the dedicated collection
            for q in questionnaire_docs:
                try:
                    # Convert ObjectId to string for JSON serialization
                    q["_id"] = str(q["_id"])
                    if "user_id" in q and isinstance(q["user_id"], ObjectId):
                        q["user_id"] = str(q["user_id"])
                        
                        # Try to get user info
                        user = await db.users.find_one({"_id": ObjectId(q["user_id"])})
                        if user:
                            q["email"] = user.get("email", "")
                            q["student_id"] = user.get("student_id", "")
                            q["full_name"] = user.get("full_name", "")
                    
                    # Convert any other ObjectId fields to strings
                    for key, value in q.items():
                        if isinstance(value, ObjectId):
                            q[key] = str(value)
                    
                    questionnaires.append(q)
                except Exception as e:
                    logger.error(f"Error processing questionnaire {q.get('_id')}: {str(e)}")
                    logger.error(traceback.format_exc())
        else:
            logger.info("Questionnaires collection does not exist")
        
        # Method 2: Also check users who have the questionnaire field
        if "users" in collections:
            logger.info("Fetching users with embedded questionnaires")
            users_with_questionnaires = await db.users.find(
                {"has_completed_questionnaire": True, "questionnaire": {"$exists": True}}
            ).to_list(length=1000)
            
            logger.info(f"Found {len(users_with_questionnaires)} users with embedded questionnaires")
            
            # Process questionnaires from users
            for user in users_with_questionnaires:
                try:
                    if "questionnaire" in user and user["questionnaire"]:
                        # Create a new object with questionnaire data and user info
                        questionnaire_data = dict(user["questionnaire"])
                        
                        # Skip if we already have this user's questionnaire
                        if any(q.get("user_id") == str(user["_id"]) for q in questionnaires):
                            continue
                        
                        # Add user information
                        questionnaire_data["_id"] = str(user["_id"])
                        questionnaire_data["user_id"] = str(user["_id"])
                        questionnaire_data["email"] = user.get("email", "")
                        questionnaire_data["student_id"] = user.get("student_id", "")
                        questionnaire_data["full_name"] = user.get("full_name", "")
                        
                        # Convert any ObjectId to string
                        for key, value in dict(questionnaire_data).items():
                            if isinstance(value, ObjectId):
                                questionnaire_data[key] = str(value)
                        
                        questionnaires.append(questionnaire_data)
                except Exception as e:
                    logger.error(f"Error processing user {user.get('_id')}: {str(e)}")
                    logger.error(traceback.format_exc())
        else:
            logger.info("Users collection does not exist")
        
        logger.info(f"Total questionnaires found: {len(questionnaires)}")
        
        # Return empty list if no questionnaires found
        return questionnaires
    except Exception as e:
        logger.error(f"Error fetching exit interviews: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching exit interviews: {str(e)}"
        ) 