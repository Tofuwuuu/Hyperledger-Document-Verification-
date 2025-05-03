import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

async def clean_document_requests():
    """Clean all document requests from the database"""
    load_dotenv()
    
    # MongoDB settings
    MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[MONGODB_DB]
    
    # Delete all document requests
    result = await db.document_requests.delete_many({})
    print(f"Deleted {result.deleted_count} document requests")
    
    # Close connection
    client.close()
    print("Database cleaned!")

if __name__ == "__main__":
    asyncio.run(clean_document_requests()) 