from pymongo import MongoClient
import json
from bson import ObjectId
from datetime import datetime

# MongoDB connection
client = MongoClient('mongodb://localhost:27017')
db = client.cvsu_alumni

# Custom JSON encoder to handle ObjectId and datetime
class MongoEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super(MongoEncoder, self).default(obj)

# Check alumni collection
print("ALUMNI RECORDS:")
alumni_count = db.alumni.count_documents({})
print(f"Total alumni records: {alumni_count}")

if alumni_count > 0:
    alumni_samples = list(db.alumni.find({}).limit(3))
    print("Sample alumni records:")
    for alumni in alumni_samples:
        print(json.dumps(alumni, cls=MongoEncoder, indent=2))

# Check users collection
print("\nUSER RECORDS:")
user_count = db.users.count_documents({})
print(f"Total user records: {user_count}")

if user_count > 0:
    user_samples = list(db.users.find({}).limit(3))
    print("Sample user records:")
    for user in user_samples:
        print(json.dumps(user, cls=MongoEncoder, indent=2))

# Check document_requests collection
print("\nDOCUMENT REQUEST RECORDS:")
req_count = db.document_requests.count_documents({})
print(f"Total document request records: {req_count}")

if req_count > 0:
    req_samples = list(db.document_requests.find({}).limit(3))
    print("Sample document request records:")
    for req in req_samples:
        print(json.dumps(req, cls=MongoEncoder, indent=2)) 