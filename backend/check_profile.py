from pymongo import MongoClient
from bson import ObjectId
import json
from datetime import datetime

# Custom JSON encoder to handle MongoDB ObjectId and datetime
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)

# Connect to MongoDB
client = MongoClient("mongodb://localhost:27017/")
db = client["cvsu_alumni"]

# List all collections
print("Collections in database:", db.list_collection_names())

# First, retrieve all alumni to check the ID format
print("\nChecking all alumni records:")
all_alumni = list(db["alumni"].find())
print(f"Found {len(all_alumni)} alumni records")

if all_alumni:
    # Get the first alumni record
    alumni = all_alumni[0]
    print("\n--- ALUMNI PROFILE ---")
    alumni_json = json.dumps(alumni, indent=2, cls=MongoJSONEncoder)
    print(alumni_json)
    
    # Get the user record
    user_id = alumni.get("user_id")
    if user_id:
        user = db["users"].find_one({"_id": ObjectId(user_id)})
        print("\n--- USER INFORMATION ---")
        if user:
            user_json = json.dumps(user, indent=2, cls=MongoJSONEncoder)
            print(user_json)
        else:
            print(f"User not found with ID: {user_id}")
    
    # Get the documents for this alumni
    alumni_id = str(alumni.get("_id"))
    documents = list(db["documents"].find({"alumni_id": alumni_id}))
    
    print(f"\n--- DOCUMENTS ({len(documents)}) ---")
    for doc in documents:
        doc_json = json.dumps(doc, indent=2, cls=MongoJSONEncoder)
        print(doc_json)
        print("-" * 40)
else:
    print("No alumni records found.")

# Close the connection
client.close() 