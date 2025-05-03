from datetime import datetime
from typing import Optional, List
from bson import ObjectId

from app.config.database import get_database_async
from app.models.student import Student, StudentCreate, StudentUpdate
import logging

# Set up logging
logger = logging.getLogger(__name__)

class StudentRepository:
    collection_name = "students"
    
    @staticmethod
    async def create_student(student: StudentCreate) -> ObjectId:
        """Create a new student and return the student ID."""
        try:
            # Get database connection
            db = await get_database_async()
            
            # Convert to dict and add timestamps
            student_dict = student.dict()
            now = datetime.utcnow()
            student_dict.update({
                "created_at": now,
                "updated_at": now
            })
            
            # Insert new student document
            result = await db[StudentRepository.collection_name].insert_one(student_dict)
            
            logger.info(f"Successfully created student with ID: {result.inserted_id}")
            return result.inserted_id
        except Exception as e:
            logger.error(f"Error creating student: {str(e)}")
            raise
    
    @staticmethod
    async def get_student_by_email(email: str) -> Optional[Student]:
        """Get a student by email address."""
        try:
            db = await get_database_async()
            student_data = await db[StudentRepository.collection_name].find_one({"email": email})
            
            if student_data:
                return Student(**student_data)
            return None
        except Exception as e:
            logger.error(f"Error getting student by email {email}: {str(e)}")
            raise
    
    @staticmethod
    async def get_student(student_id: ObjectId) -> Optional[Student]:
        """Get a student by ID."""
        try:
            db = await get_database_async()
            student_data = await db[StudentRepository.collection_name].find_one({"_id": student_id})
            
            if student_data:
                return Student(**student_data)
            return None
        except Exception as e:
            logger.error(f"Error getting student by ID {student_id}: {str(e)}")
            raise
    
    @staticmethod
    async def update_student(student_id: ObjectId, student_update: StudentUpdate) -> Optional[Student]:
        """Update a student and return the updated student."""
        try:
            db = await get_database_async()
            
            # Filter out None values
            update_data = {k: v for k, v in student_update.dict().items() if v is not None}
            update_data["updated_at"] = datetime.utcnow()
            
            await db[StudentRepository.collection_name].update_one(
                {"_id": student_id},
                {"$set": update_data}
            )
            
            updated_student = await db[StudentRepository.collection_name].find_one({"_id": student_id})
            if updated_student:
                return Student(**updated_student)
            return None
        except Exception as e:
            logger.error(f"Error updating student {student_id}: {str(e)}")
            raise
    
    @staticmethod
    async def delete_student(student_id: ObjectId) -> bool:
        """Delete a student and return whether the operation was successful."""
        try:
            db = await get_database_async()
            result = await db[StudentRepository.collection_name].delete_one({"_id": student_id})
            
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting student {student_id}: {str(e)}")
            raise
    
    @staticmethod
    async def get_all_students() -> List[Student]:
        """Get all students."""
        try:
            db = await get_database_async()
            cursor = db[StudentRepository.collection_name].find({})
            
            students = []
            async for student in cursor:
                students.append(Student(**student))
            
            return students
        except Exception as e:
            logger.error(f"Error fetching all students: {str(e)}")
            raise 