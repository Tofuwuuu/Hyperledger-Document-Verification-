from pymongo import MongoClient
import json
from bson import ObjectId
from datetime import datetime

# Custom JSON encoder to handle MongoDB ObjectId and datetime
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)

def check_document_verification():
    try:
        # Connect to MongoDB
        client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
        
        # Force connection to verify
        client.server_info()
        
        print("Successfully connected to MongoDB!")
        
        # Get all documents in the cvsu_portal database
        db = client["cvsu_portal"]
        documents = db["documents"].find({})
        
        print("--- DOCUMENTS VERIFICATION STATUS ---")
        for doc in documents:
            # Format the document for easy reading
            print(f"\nDocument ID: {doc.get('_id')}")
            print(f"Title: {doc.get('title')}")
            print(f"Type: {doc.get('document_type')}")
            print(f"User ID: {doc.get('user_id')}")
            print(f"Verification Status: {doc.get('verification_status', 'pending')}")
            print(f"Is Verified: {doc.get('is_verified', False)}")
            print(f"Admin Verification Date: {doc.get('admin_verification_date')}")
            print(f"Blockchain TX Hash: {doc.get('blockchain_tx_hash')}")
            print(f"File Hash: {doc.get('file_hash')}")
            print('-' * 50)
        
        # Check if there are any verification records in cvsu_alumni_db
        if "cvsu_alumni_db" in client.list_database_names():
            db_alumni = client["cvsu_alumni_db"]
            if "verification_requests" in db_alumni.list_collection_names():
                verification_requests = db_alumni["verification_requests"].find({})
                print("\n--- VERIFICATION REQUESTS ---")
                for req in verification_requests:
                    print(f"Request ID: {req.get('_id')}")
                    print(f"Document ID: {req.get('document_id')}")
                    print(f"Status: {req.get('status')}")
                    print(f"Requested by: {req.get('requested_by')}")
                    print(f"Created at: {req.get('created_at')}")
                    print('-' * 50)
        
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    check_document_verification() 