from pymongo import MongoClient
import json
from bson import ObjectId
from datetime import datetime
import os
import sys

# Custom JSON encoder to handle MongoDB ObjectId and datetime
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)

def fix_database():
    """
    Organizes and consolidates the database structure:
    1. Consolidates all data into a single database (cvsu_portal)
    2. Ensures collections follow the correct schema
    3. Cleans up empty or unused databases
    """
    try:
        # Connect to MongoDB
        client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
        
        # Force connection to verify
        client.server_info()
        print("Successfully connected to MongoDB!")
        
        # Get all databases
        databases = client.list_database_names()
        print(f"Found databases: {databases}")
        
        # Target databases (those with cvsu in the name)
        target_dbs = [db for db in databases if 'cvsu' in db.lower()]
        print(f"Target databases for consolidation: {target_dbs}")
        
        # Consolidate to the main database (cvsu_portal)
        main_db_name = "cvsu_portal"
        
        # Create main database if it doesn't exist
        if main_db_name not in databases:
            print(f"Creating main database: {main_db_name}")
            client[main_db_name]
        
        main_db = client[main_db_name]
        
        # Ensure all required collections exist in the main database
        required_collections = [
            "users", 
            "alumni_profiles", 
            "documents", 
            "verification_requests", 
            "jobs", 
            "applications",
            "audit_logs"
        ]
        
        # Create collections that don't exist
        existing_collections = main_db.list_collection_names()
        for collection in required_collections:
            if collection not in existing_collections:
                print(f"Creating collection: {collection}")
                main_db.create_collection(collection)
        
        # Consolidate data from other databases
        for db_name in target_dbs:
            if db_name == main_db_name:
                continue
                
            print(f"\nProcessing database: {db_name}")
            source_db = client[db_name]
            source_collections = source_db.list_collection_names()
            
            for collection in source_collections:
                if collection in required_collections:
                    print(f"  Checking collection: {collection}")
                    # Get all documents in the source collection
                    docs = list(source_db[collection].find({}))
                    
                    if docs:
                        print(f"  Found {len(docs)} documents to migrate")
                        
                        # Check for duplicates before inserting
                        for doc in docs:
                            # Check if document with same ID already exists
                            existing = main_db[collection].find_one({"_id": doc["_id"]})
                            if not existing:
                                # Insert into main database
                                main_db[collection].insert_one(doc)
                                print(f"    Migrated document {doc['_id']}")
                            else:
                                print(f"    Document {doc['_id']} already exists in destination")
                    else:
                        print(f"  No documents found in {collection}")
        
        # Print summary of consolidated database
        print("\n=== Database Consolidation Summary ===")
        print(f"Main database: {main_db_name}")
        collections = main_db.list_collection_names()
        print(f"Collections: {collections}")
        
        for collection in collections:
            count = main_db[collection].count_documents({})
            print(f"Collection '{collection}' has {count} documents")
        
        # Ask user if they want to clean up empty databases
        print("\nWould you like to remove empty source databases? (yes/no)")
        response = input().strip().lower()
        
        if response == "yes":
            for db_name in target_dbs:
                if db_name == main_db_name:
                    continue
                
                db = client[db_name]
                collections = db.list_collection_names()
                
                # Check if all collections are empty
                is_empty = True
                for collection in collections:
                    if db[collection].count_documents({}) > 0:
                        is_empty = False
                        break
                
                if is_empty:
                    print(f"Dropping empty database: {db_name}")
                    client.drop_database(db_name)
                else:
                    print(f"Database {db_name} still contains data and will not be dropped")
        
        print("\nDatabase consolidation complete!")
        
    except Exception as e:
        print(f"Failed to fix database: {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    print("This script will consolidate all CVSU databases into a single database.")
    print("Make sure you have a backup before proceeding.")
    print("Do you want to continue? (yes/no)")
    
    response = input().strip().lower()
    if response == "yes":
        fix_database()
    else:
        print("Database consolidation cancelled.")
        sys.exit(0) 