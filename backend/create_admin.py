from pymongo import MongoClient
from datetime import datetime
from bson import ObjectId
import os
from dotenv import load_dotenv
import sys
from passlib.context import CryptContext

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    """Generate password hash"""
    return pwd_context.hash(password)

def create_admin_user(email, full_name, password, student_id=None, graduation_year=None):
    try:
        # Connect to MongoDB
        client = MongoClient("mongodb://localhost:27017/")
        db = client["cvsu_alumni"]
        
        # Check if user already exists
        existing_user = db.users.find_one({"email": email})
        if existing_user:
            print(f"User with email {email} already exists.")
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
        print("\nAdmin account created successfully!")
        print(f"Email: {email}")
        print(f"Password: {password}")
        print("\nPlease change the password after first login.")
    else:
        print("\nFailed to create admin account. See error above.")
        sys.exit(1) 