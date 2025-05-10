from pymongo import MongoClient
import logging
import json
from bson import ObjectId
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def connect_to_db():
    # Replace with your actual MongoDB connection string
    mongo_url = "mongodb://localhost:27017"  # Update this with your connection string
    try:
        client = MongoClient(mongo_url)
        db = client.cvsu_alumni  # Use your database name
        return db
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {e}")
        return None

def test_user_query(user_id, query, collection_name="users"):
    """Test if a specific user would match a MongoDB query"""
    db = connect_to_db()
    if not db:
        return {"error": "Failed to connect to database"}
    
    # Get the collection
    collection = getattr(db, collection_name, None)
    if not collection:
        return {"error": f"Collection {collection_name} not found"}
    
    # Try to find the user
    try:
        user_id_obj = user_id
        # If string, try to convert to ObjectId
        if isinstance(user_id, str):
            try:
                user_id_obj = ObjectId(user_id)
            except:
                # If conversion fails, use as is
                user_id_obj = user_id
        
        # Try both the original and converted ID
        user = collection.find_one({"_id": user_id_obj})
        if not user and isinstance(user_id, str):
            user = collection.find_one({"_id": user_id})
        
        if not user:
            return {
                "exists": False,
                "would_match": False,
                "reason": f"User not found with ID {user_id}"
            }
        
        # Test if this user would match the unverified query
        # Debug the user document
        logger.info(f"User document: {str(user)}")
        
        # Check for is_verified field
        is_verified = user.get("is_verified", None)
        logger.info(f"is_verified value: {is_verified} (type: {type(is_verified)})")
        
        # Test both query formats
        original_query = {"is_verified": {"$ne": True}}
        new_query = {"$or": [
            {"is_verified": False},
            {"is_verified": {"$exists": False}}
        ]}
        
        # Manual check for original query
        original_match = is_verified != True
        
        # Manual check for new query
        new_match = is_verified is False or "is_verified" not in user
        
        # Test with specific query if provided
        would_match = None
        if query:
            # For demo purposes only
            # In production, don't eval queries like this
            # Instead, you should use a proper MongoDB driver function
            if "$or" in query:
                or_conditions = []
                for cond in query["$or"]:
                    if "is_verified" in cond:
                        if isinstance(cond["is_verified"], dict) and "$exists" in cond["is_verified"]:
                            exists_match = ("is_verified" in user) == cond["is_verified"]["$exists"]
                            or_conditions.append(exists_match)
                        else:
                            field_match = user.get("is_verified") == cond["is_verified"]
                            or_conditions.append(field_match)
                would_match = any(or_conditions)
            elif "is_verified" in query:
                if isinstance(query["is_verified"], dict) and "$ne" in query["is_verified"]:
                    would_match = user.get("is_verified") != query["is_verified"]["$ne"]
                else:
                    would_match = user.get("is_verified") == query["is_verified"]
        
        # Return the results
        return {
            "exists": True,
            "user_id": str(user.get("_id", "")),
            "original_query_match": original_match,
            "new_query_match": new_match,
            "provided_query_match": would_match,
            "is_verified_value": is_verified,
            "is_verified_type": str(type(is_verified)),
            "is_verified_present": "is_verified" in user,
            "user_fields": {
                key: str(value) for key, value in user.items() 
                if key in ["is_verified", "is_active", "verification_pending", "email", "full_name"]
            }
        }
        
    except Exception as e:
        logger.error(f"Error in test_user_query: {e}")
        return {"error": str(e)}

def check_all_unverified_users():
    """Check how many users match the unverified query"""
    db = connect_to_db()
    if not db:
        return {"error": "Failed to connect to database"}
    
    # Try both query versions
    original_query = {"is_verified": {"$ne": True}}
    new_query = {"$or": [
        {"is_verified": False},
        {"is_verified": {"$exists": False}}
    ]}
    
    # Count results
    try:
        original_count = db.users.count_documents(original_query)
        new_count = db.users.count_documents(new_query)
        
        # Get all users for debugging
        all_users = list(db.users.find({}, {"email": 1, "full_name": 1, "is_verified": 1}))
        user_count = len(all_users)
        
        # Count verification status manually
        true_count = 0
        false_count = 0
        missing_count = 0
        
        for user in all_users:
            if "is_verified" not in user:
                missing_count += 1
            elif user["is_verified"] is True:
                true_count += 1
            else:
                false_count += 1
        
        # Sample users with each status
        verified_example = next((u for u in all_users if u.get("is_verified") is True), {})
        unverified_example = next((u for u in all_users if u.get("is_verified") is False), {})
        missing_example = next((u for u in all_users if "is_verified" not in u), {})
        
        return {
            "total_users": user_count,
            "original_query_count": original_count,
            "new_query_count": new_count,
            "verified_true_count": true_count,
            "verified_false_count": false_count,
            "verified_missing_count": missing_count,
            "verified_example": {
                "id": str(verified_example.get("_id", "")),
                "email": verified_example.get("email", "")
            },
            "unverified_example": {
                "id": str(unverified_example.get("_id", "")),
                "email": unverified_example.get("email", "")
            },
            "missing_example": {
                "id": str(missing_example.get("_id", "")),
                "email": missing_example.get("email", "")
            }
        }
    except Exception as e:
        logger.error(f"Error in check_all_unverified_users: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    # Test a specific user
    user_id = "681fa5ae8d75ad66fa728ae7"  # The ID from your message
    result = test_user_query(user_id, None)
    print("\nSingle User Test:")
    print(json.dumps(result, indent=2))
    
    # Check all unverified users
    all_result = check_all_unverified_users()
    print("\nAll Users Test:")
    print(json.dumps(all_result, indent=2)) 