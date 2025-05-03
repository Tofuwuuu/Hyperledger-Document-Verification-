from pymongo import MongoClient
from datetime import datetime
from bson.objectid import ObjectId
import json

class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return json.JSONEncoder.default(self, obj)

def main():
    try:
        # Connect directly to MongoDB
        client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
        db = client["cvsu_alumni"]
        
        # Get all users
        print("=== Users in Database ===")
        all_users = list(db["users"].find({}))
        
        if not all_users:
            print("No users found in the database.")
            return
        
        print(f"Found {len(all_users)} users:")
        for user in all_users:
            print(f"\nUser: {user.get('first_name', '')} {user.get('last_name', '')}")
            print(f"- Email: {user.get('email', 'No email')}")
            print(f"- ID: {user.get('_id')}")
            print(f"- Is verified: {user.get('is_verified', False)}")
            print(f"- Student ID: {user.get('student_id', 'None')}")
            print(f"- Is active: {user.get('is_active', False)}")
            print(f"- Is admin: {user.get('is_admin', False)}")
        
        # Ask to update a user
        user_id_input = input("\nEnter the ID of the user to update (or press Enter to skip): ").strip()
        
        if user_id_input:
            try:
                user_id = ObjectId(user_id_input)
                user = db["users"].find_one({"_id": user_id})
                
                if not user:
                    print(f"No user found with ID {user_id}")
                    return
                
                print(f"\nUpdating user: {user.get('first_name', '')} {user.get('last_name', '')}")
                
                # Update verification status
                verify_input = input("Verify user? (y/n): ").strip().lower()
                if verify_input == 'y':
                    db["users"].update_one(
                        {"_id": user_id},
                        {"$set": {"is_verified": True, "updated_at": datetime.utcnow()}}
                    )
                    print("User marked as verified.")
                
                # Update student ID
                student_id_input = input("Enter student ID (or press Enter to skip): ").strip()
                if student_id_input:
                    db["users"].update_one(
                        {"_id": user_id},
                        {"$set": {"student_id": student_id_input, "updated_at": datetime.utcnow()}}
                    )
                    print(f"Student ID updated to: {student_id_input}")
                
                # Show updated user
                updated_user = db["users"].find_one({"_id": user_id})
                print("\nUpdated user information:")
                print(json.dumps(updated_user, indent=2, cls=JSONEncoder))
                
            except Exception as e:
                print(f"Error updating user: {e}")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    main() 