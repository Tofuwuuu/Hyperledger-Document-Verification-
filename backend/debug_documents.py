import asyncio
import os
from dotenv import load_dotenv
from app.config.database import connect_to_mongo
from bson import json_util
import json
import sys

# Load environment variables
load_dotenv()

async def debug_documents():
    """Debug documents stored in the database"""
    print("Connecting to MongoDB...")
    await connect_to_mongo()
    
    from app.config.database import get_database
    db = get_database()
    
    print("Fetching documents...")
    documents = await db.documents.find({}).to_list(length=None)
    
    if not documents:
        print("No documents found in the database.")
        return
    
    print(f"Found {len(documents)} documents.")
    
    # Print document details
    for idx, doc in enumerate(documents):
        print(f"\nDocument {idx+1}:")
        print(f"ID: {doc.get('_id')}")
        print(f"Title: {doc.get('title')}")
        print(f"Type: {doc.get('document_type')}")
        print(f"Status: {doc.get('verification_status')}")
        print(f"File Path: {doc.get('file_path')}")
        
        # Check if file exists
        file_path = doc.get('file_path')
        if file_path:
            full_path = os.path.join(os.getcwd(), '..', file_path)
            exists = os.path.isfile(full_path)
            print(f"File exists: {exists}")
            print(f"Full path: {full_path}")
            
            # Check uploads directory structure
            dir_path = os.path.dirname(full_path)
            print(f"Directory exists: {os.path.isdir(dir_path)}")
            if os.path.isdir(dir_path):
                print(f"Directory contents: {os.listdir(dir_path)}")

async def main():
    await debug_documents()

if __name__ == "__main__":
    asyncio.run(main()) 