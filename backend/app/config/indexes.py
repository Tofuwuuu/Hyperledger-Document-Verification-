"""
Database indexes creation and management.
This module provides functions to create and manage MongoDB indexes for better performance.
"""

import logging
from app.config.database import get_database

logger = logging.getLogger(__name__)

async def create_indexes():
    """
    Create MongoDB indexes for better query performance.
    This function is called during application startup to ensure all necessary
    indexes are in place.
    """
    db = get_database()
    logger.info("Creating database indexes for performance optimization...")
    
    try:
        # Users collection indexes
        await db.users.create_index("email", unique=True)
        await db.users.create_index("student_id", sparse=True)
        await db.users.create_index("reset_token", sparse=True)
        await db.users.create_index("reset_token_expires", sparse=True)
        
        # Alumni profiles collection indexes
        await db.alumni.create_index("user_id", unique=True)
        await db.alumni.create_index("student_id", sparse=True)
        await db.alumni.create_index("graduation_year", sparse=True)
        await db.alumni.create_index("email")
        
        # Documents collection indexes
        await db.documents.create_index("alumni_id")
        await db.documents.create_index("file_hash")
        await db.documents.create_index("verification_status")
        await db.documents.create_index([("alumni_id", 1), ("document_type", 1)])
        
        # Document requests collection indexes
        await db.document_requests.create_index("alumni_id")
        await db.document_requests.create_index("status")
        await db.document_requests.create_index("document_type")
        await db.document_requests.create_index("created_at")
        
        # Verification requests collection indexes
        await db.verification_requests.create_index("document_id")
        await db.verification_requests.create_index("status")
        
        # Audit logs collection indexes
        await db.audit_logs.create_index("timestamp")
        await db.audit_logs.create_index("action")
        await db.audit_logs.create_index("user_id")
        
        # Jobs collection indexes
        await db.jobs.create_index("title")
        
        # Applications collection indexes
        await db.applications.create_index("job_id")
        await db.applications.create_index("applicant_email")
        
        # Events collection indexes
        await db.events.create_index("start_date")
        await db.events.create_index("end_date")
        await db.events.create_index("is_active")
        await db.events.create_index("created_by")
        
        # Event registrations collection indexes
        await db.event_registrations.create_index("event_id")
        await db.event_registrations.create_index("user_id")
        await db.event_registrations.create_index([("event_id", 1), ("user_id", 1)], unique=True)
        await db.event_registrations.create_index("qr_code_data", unique=True, sparse=True)
        
        # Meetings collection indexes
        await db.meetings.create_index("event_id")
        await db.meetings.create_index("start_time")
        await db.meetings.create_index("status")
        await db.meetings.create_index([("event_id", 1), ("start_time", 1)])
        
        # Notifications collection indexes
        await db.notifications.create_index("user_id")
        await db.notifications.create_index("is_read")
        await db.notifications.create_index("created_at")
        
        logger.info("Database indexes created successfully!")
        return True
    except Exception as e:
        logger.error(f"Error creating database indexes: {e}")
        return False 