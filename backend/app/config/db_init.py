import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from app.config.database import get_database

# Load environment variables
load_dotenv()

# MongoDB settings
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")

async def initialize_database():
    """Initialize the database with required collections and indexes."""
    db = get_database()
    
    # Define required collections
    required_collections = [
        "users",              # User accounts
        "alumni",             # Alumni information
        "documents",          # Document metadata
        "verification_requests", # Verification request tracking
        "audit_logs",         # System activity logs
        "jobs",               # Job listings
        "job_applications",   # Job applications from alumni
        "events",             # Event management
        "event_registrations", # Event registrations
        "document_requests",  # Document requests from alumni
        "roles",              # User roles
        "permissions",        # Permission definitions
        "notifications",      # User notifications
        "meetings",           # Virtual meetings
        "employers",          # Employers collection
    ]
    
    # Get existing collections
    existing_collections = await db.list_collection_names()
    
    # Check if all required collections exist
    all_collections_exist = all(collection in existing_collections for collection in required_collections)
    
    # Create collections that don't exist
    if all_collections_exist:
        print("All required collections already exist. Skipping collection creation.")
    else:
        for collection in required_collections:
            if collection not in existing_collections:
                await db.create_collection(collection)
                print(f"Created collection: {collection}")
            else:
                print(f"Collection already exists: {collection}")
    
    # Create indexes for better performance
    print("Creating indexes for performance optimization...")
    
    # Users collection indexes
    await db.users.create_index("email", unique=True)
    user = await db.users.find_one({}) or {}
    if "student_id" in user:
        await db.users.create_index("student_id", sparse=True)
    
    # Alumni profiles collection indexes
    await db.alumni.create_index("user_id")
    
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
    await db.jobs.create_index("employer_id")
    await db.jobs.create_index("status")
    await db.jobs.create_index("created_at")
    await db.jobs.create_index([("title", "text"), ("description", "text")])
    await db.jobs.create_index([("skills", 1)])
    
    # Job applications collection indexes
    await db.job_applications.create_index("job_id")
    await db.job_applications.create_index("alumni_id")
    await db.job_applications.create_index([("job_id", 1), ("alumni_id", 1)], unique=True)
    await db.job_applications.create_index("status")
    await db.job_applications.create_index("created_at")
    
    # Events collection indexes
    await db.events.create_index("start_date")
    await db.events.create_index("end_date")
    await db.events.create_index("is_active")
    await db.events.create_index("created_by")
    
    # Event registrations collection indexes
    await db.event_registrations.create_index("event_id")
    await db.event_registrations.create_index("user_id")
    await db.event_registrations.create_index([("event_id", 1), ("user_id", 1)], unique=True)
    await db.event_registrations.create_index("qr_code_data", unique=True)
    
    # Meetings collection indexes
    await db.meetings.create_index("event_id")
    await db.meetings.create_index("start_time")
    await db.meetings.create_index("status")
    await db.meetings.create_index([("event_id", 1), ("start_time", 1)])
    
    # Employers collection indexes
    await db.employers.create_index("email", unique=True)
    
    print("Database initialization completed successfully!")

async def audit_log(action, user_id=None, details=None):
    """Log an action to the audit log."""
    from datetime import datetime
    
    db = get_database()
    await db.audit_logs.insert_one({
        "action": action,
        "user_id": user_id,
        "details": details,
        "timestamp": datetime.utcnow()
    }) 