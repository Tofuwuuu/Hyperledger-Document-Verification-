from pymongo import MongoClient
from datetime import datetime
from bson.objectid import ObjectId

def main():
    try:
        # Connect directly to MongoDB
        client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
        db = client["cvsu_alumni"]
        
        # Get all users
        all_users = list(db["users"].find({}))
        
        if not all_users:
            print("No users found in the database.")
            return
        
        print(f"Found {len(all_users)} users to update.")
        
        # Update all users
        for user in all_users:
            user_id = user["_id"]
            name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
            
            # Get current values
            is_verified = user.get('is_verified', False)
            student_id = user.get('student_id')
            
            updates = {}
            
            # Set verified to true if not already
            if not is_verified:
                updates["is_verified"] = True
                
            # Add a default student ID if missing
            if not student_id:
                default_student_id = f"ST{str(user_id)[-6:]}".upper()
                updates["student_id"] = default_student_id
            
            # Only update if needed
            if updates:
                updates["updated_at"] = datetime.utcnow()
                
                result = db["users"].update_one(
                    {"_id": user_id},
                    {"$set": updates}
                )
                
                if result.modified_count > 0:
                    print(f"Updated user {name} (ID: {user_id}):")
                    if "is_verified" in updates:
                        print(f"  - Verified: {updates['is_verified']}")
                    if "student_id" in updates:
                        print(f"  - Student ID: {updates['student_id']}")
                else:
                    print(f"No changes made for user {name} (ID: {user_id})")
            else:
                print(f"User {name} (ID: {user_id}) already verified with student ID: {student_id}")
        
        print("\nAll users have been processed.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    main() 