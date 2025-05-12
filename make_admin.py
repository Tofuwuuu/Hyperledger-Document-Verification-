import pymongo
import bcrypt
import sys
from datetime import datetime
from bson import ObjectId

# Connect to MongoDB
client = pymongo.MongoClient("mongodb://localhost:27017/")
db = client["cvsu_alumni"]

def get_password_hash(password: str) -> str:
    """Create password hash using bcrypt"""
    salt = bcrypt.gensalt()
    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_pw.decode('utf-8')

def make_admin(email):
    """Make a user admin by email"""
    # Check if user exists
    user = db.users.find_one({"email": email})
    
    if user:
        # Update user to admin
        result = db.users.update_one(
            {"email": email},
            {"$set": {
                "is_admin": True,
                "updated_at": datetime.utcnow()
            }}
        )
        
        if result.modified_count > 0:
            print(f"✅ User {email} is now an admin")
        else:
            print(f"⚠️ User {email} might already be an admin")
        return True
    else:
        # Create new admin user
        password = "Admin123"  # Default password
        hashed_password = get_password_hash(password)
        user_id = str(ObjectId())
        now = datetime.utcnow()
        
        new_user = {
            "_id": user_id,
            "email": email,
            "full_name": email.split('@')[0],
            "hashed_password": hashed_password,
            "is_active": True,
            "is_admin": True,
            "created_at": now,
            "updated_at": now,
            "is_verified": True
        }
        
        db.users.insert_one(new_user)
        print(f"✅ Created new admin user: {email}")
        print(f"   Password: {password}")
        return True

if __name__ == "__main__":
    email = "joemarlou.opella@cvsu.edu.ph"
    
    try:
        if make_admin(email):
            print(f"You can now log in with {email} as an admin")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1) 