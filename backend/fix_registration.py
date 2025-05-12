from pymongo import MongoClient
import json
import logging
from bson import ObjectId, json_util
import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Connect to the database
client = MongoClient('mongodb://localhost:27017/')
db = client['cvsu_alumni']

# Define the user email we're looking for
test_email = "api_test_user@example.com"
roderick_email = "rodericksalise801@gmail.com"

# Custom JSON encoder to handle MongoDB types
def parse_json(data):
    return json.loads(json_util.dumps(data))

def check_user_across_collections(email):
    """Check for the user in all collections in the database"""
    logger.info(f"Searching for user with email {email} across all collections...")
    
    # Get all collections
    collections = db.list_collection_names()
    logger.info(f"Found {len(collections)} collections: {', '.join(collections)}")
    
    # Search for the user in each collection
    found_in = []
    
    for collection_name in collections:
        collection = db[collection_name]
        documents = list(collection.find({"email": email}))
        
        if documents:
            logger.info(f"Found {len(documents)} document(s) in '{collection_name}' collection")
            found_in.append(collection_name)
            
            # Print the first document (if multiple found)
            doc = documents[0]
            # Convert ObjectId to string for printing
            if "_id" in doc and isinstance(doc["_id"], ObjectId):
                doc["_id"] = str(doc["_id"])
            # Convert datetime objects to strings
            for key, value in list(doc.items()):
                if isinstance(value, datetime.datetime):
                    doc[key] = value.isoformat()
            
            logger.info(f"Document in '{collection_name}': {json.dumps(doc, indent=2)}")
    
    if not found_in:
        logger.warning(f"User with email {email} not found in any collection!")
    else:
        logger.info(f"User found in {len(found_in)} collection(s): {', '.join(found_in)}")
    
    return found_in

def fix_login_issue(email):
    """Fix login issues for the given user email"""
    # Find the user in all collections
    check_user_across_collections(email)
    
    # Check specifically in the users collection
    user = db.users.find_one({"email": email})
    if not user:
        logger.error(f"User {email} not found in the users collection")
        return False
    
    # Check if the user has a hashed_password field
    if "hashed_password" not in user:
        logger.warning(f"User {email} exists but has no hashed_password field!")
        
        # Generate a temporary password hash
        temp_password_hash = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"  # Hash for 'password'
        
        # Add the hashed_password field
        result = db.users.update_one(
            {"email": email},
            {"$set": {"hashed_password": temp_password_hash}}
        )
        
        if result.modified_count > 0:
            logger.info(f"Added temporary password hash for user {email}")
            logger.info(f"You can now log in with username {email} and password 'password'")
            return True
        else:
            logger.error(f"Failed to update user {email}")
            return False
    
    logger.info(f"User {email} exists and has a hashed_password field")
    return True

if __name__ == "__main__":
    # Check both test users
    logger.info("CHECKING TEST USER:")
    check_user_across_collections(test_email)
    
    logger.info("\nCHECKING RODERICK USER:")
    check_user_across_collections(roderick_email)
    
    # Fix any issues found
    logger.info("\nATTEMPTING TO FIX TEST USER:")
    fix_login_issue(test_email)
    
    logger.info("\nATTEMPTING TO FIX RODERICK USER:")
    fix_login_issue(roderick_email) 