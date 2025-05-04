from pymongo import MongoClient
from datetime import datetime
from bson import ObjectId
import os
from dotenv import load_dotenv
import sys
from passlib.context import CryptContext

# Load environment variables
load_dotenv()

# MongoDB Atlas connection string
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://dbRod:dekdek812@cluster0.hl5tp.mongodb.net/cvsu_alumni?retryWrites=true&w=majority&appName=Cluster0")
MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    """Generate password hash"""
    return pwd_context.hash(password)

def create_admin_user(email, full_name, password, student_id=None, graduation_year=None):
    try:
        # Connect to MongoDB Atlas
        client = MongoClient(MONGODB_URL)
        db = client[MONGODB_DB]
        
        # Check if user already exists
        existing_user = db.users.find_one({"email": email})
        if existing_user:
            print(f"User with email {email} already exists. Updating admin privileges and activating account.")
            
            # Update the existing account to make sure it's active and has admin privileges
            update_data = {
                "$set": {
                    "is_active": True,
                    "is_admin": True,
                    "hashed_password": get_password_hash(password),
                    "updated_at": datetime.utcnow()
                }
            }
            
            if student_id:
                update_data["$set"]["student_id"] = student_id
                
            if graduation_year:
                update_data["$set"]["graduation_year"] = graduation_year
            
            result = db.users.update_one({"email": email}, update_data)
            
            if result.modified_count > 0:
                print(f"User updated successfully: {email}")
                print(f"User ID: {existing_user['_id']}")
                return True
            else:
                print("No changes were made to the existing user.")
                return False
        
        # Create admin user
        now = datetime.utcnow()
        new_user = {
            "_id": str(ObjectId()),
            "email": email,
            "full_name": full_name,
            "hashed_password": get_password_hash(password),
            "is_active": True,
            "is_admin": True,  # Set admin flag
            "student_id": student_id,
            "graduation_year": graduation_year,
            "created_at": now,
            "updated_at": now
        }
        
        # Insert user to database
        db.users.insert_one(new_user)
        print(f"Admin user created successfully: {email}")
        print(f"User ID: {new_user['_id']}")
        
        # Let's verify the user exists in the database
        verify_user = db.users.find_one({"email": email})
        if verify_user:
            print("Verified: User exists in database")
            print(f"Is active: {verify_user.get('is_active', False)}")
            print(f"Is admin: {verify_user.get('is_admin', False)}")
        else:
            print("WARNING: User not found in database after creation!")
            
        return True
    
    except Exception as e:
        print(f"Error creating admin user: {e}")
        return False
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    # Default admin information
    default_email = "admin@cvsu.edu.ph"
    default_name = "System Administrator"
    default_password = "Admin123"  # Recommend changing after creation
    
    # Get input from the command line
    if len(sys.argv) >= 4:
        email = sys.argv[1]
        full_name = sys.argv[2]
        password = sys.argv[3]
        student_id = sys.argv[4] if len(sys.argv) >= 5 else None
        graduation_year = int(sys.argv[5]) if len(sys.argv) >= 6 else None
    else:
        # Use defaults or prompt for input
        email = input(f"Admin email [{default_email}]: ") or default_email
        full_name = input(f"Full name [{default_name}]: ") or default_name
        password = input(f"Password [{default_password}]: ") or default_password
        student_id = input("Student ID (optional): ") or None
        grad_year_input = input("Graduation year (optional): ")
        graduation_year = int(grad_year_input) if grad_year_input else None
    
    # Create the admin user
    success = create_admin_user(email, full_name, password, student_id, graduation_year)
    
    if success:
        print("\nAdmin account created or updated successfully!")
        print(f"Email: {email}")
        print(f"Password: {password}")
        print("\nPlease change the password after first login.")
    else:
        print("\nFailed to create admin account. See error above.")
        sys.exit(1) 