from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.utils.auth import get_current_user
from app.models.user import User
from app.config.database import get_database

router = APIRouter()

# Schema for questionnaire feedback item
class FeedbackItem(BaseModel):
    category: str
    feedback: str
    suggestion: str

# Schema for questionnaire submission
class QuestionnaireSubmission(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    courseYearSection: Optional[str] = None
    address: Optional[str] = None
    transferSchool: Optional[str] = None
    transferCourse: Optional[str] = None
    reasons: List[str]
    otherReason: Optional[str] = None
    importantLesson: str
    feedbacks: List[FeedbackItem]
    counselorNote: Optional[str] = None

@router.post("/questionnaire", status_code=status.HTTP_200_OK)
async def submit_questionnaire(
    submission: QuestionnaireSubmission,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit an exit interview form for the currently logged-in user.
    The form contains personal information, transfer details, reasons for transfer, 
    feedback and counselor notes.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    # Create the questionnaire document
    questionnaire_doc = {
        "user_id": str(current_user["_id"]),
        "name": submission.name,
        "date": submission.date,
        "course_year_section": submission.courseYearSection,
        "address": submission.address,
        "transfer_school": submission.transferSchool,
        "transfer_course": submission.transferCourse,
        "reasons": submission.reasons,
        "other_reason": submission.otherReason if submission.otherReason else None,
        "important_lesson": submission.importantLesson,
        "feedbacks": [
            {
                "category": item.category,
                "feedback": item.feedback,
                "suggestion": item.suggestion
            }
            for item in submission.feedbacks
        ],
        "counselor_note": submission.counselorNote,
        "created_at": datetime.utcnow()
    }
    
    # Add the questionnaire document to the database
    try:
        # Get database instance
        db = get_database()
        
        # First, save the questionnaire data
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": {
                "questionnaire": questionnaire_doc,
                "has_completed_questionnaire": True,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Create an activity record for this submission
        timestamp = datetime.utcnow()
        activity = {
            "user_id": str(current_user["_id"]),
            "type": "exit_interview",
            "description": "You completed the exit interview form",
            "timestamp": timestamp,
            "metadata": {
                "submission_date": timestamp.isoformat()
            }
        }
        
        # Save the activity
        await db.user_activities.insert_one(activity)
        
        return {
            "status": "success",
            "message": "Exit interview form submitted successfully"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save form data: {str(e)}"
        ) 