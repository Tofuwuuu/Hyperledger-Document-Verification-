from pymongo import MongoClient
import os
from dotenv import load_dotenv
import hashlib
import secrets
import sys

# Load environment variables
load_dotenv()

# MongoDB settings
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://dbRod:dekdek812@cluster0.hl5tp.mongodb.net/cvsu_alumni?retryWrites=true&w=majority&appName=Cluster0")
MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")

def update_admin_password(email, new_password):
    try:
        # Connect to MongoDB Atlas
        client = MongoClient(MONGODB_URL)
        db = client[MONGODB_DB]
        
        # Check if user exists
        existing_user = db.users.find_one({"email": email})
        if not existing_user:
            print(f"Error: User with email {email} does not exist.")
            return False
        
        # Generate a simpler password hash
        # Using SHA-256 instead of bcrypt to avoid compatibility issues
        # Note: In production, you should use bcrypt, but we're working around an issue
        salt = secrets.token_hex(16)
        password_hash = hashlib.sha256((new_password + salt).encode()).hexdigest()
        
        # Store the hash with salt in a format that's easy to verify
        hash_with_salt = f"sha256${salt}${password_hash}"
        
        # Update the user's password
        result = db.users.update_one(
            {"email": email},
            {"$set": {
                "hashed_password": hash_with_salt,
                "password_algo": "sha256"  # Indicate we're using SHA-256
            }}
        )
        
        if result.modified_count > 0:
            print(f"Password updated successfully for {email}")
            print(f"New login credentials:")
            print(f"Email: {email}")
            print(f"Password: {new_password}")
            return True
        else:
            print("No changes were made to the user.")
            return False
            
    except Exception as e:
        print(f"Error updating password: {e}")
        return False
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    # Email of the admin account to fix
    email = "joemarlou.opella@cvsu.edu.ph"
    
    # New password to set
    new_password = "Admin@12345"
    
    # Get input password if provided
    if len(sys.argv) >= 2:
        new_password = sys.argv[1]
    
    success = update_admin_password(email, new_password)
    
    if success:
        print("\nPassword has been updated. Please update the auth.py file to check for this special case.")
        print("Add the following code to auth.py in the verify_password function:")
        print("\n# Special case for SHA-256 hashed passwords")
        print("if hashed_password.startswith('sha256$'):")
        print("    salt = hashed_password.split('$')[1]")
        print("    hash_part = hashed_password.split('$')[2]")
        print("    password_hash = hashlib.sha256((plain_password + salt).encode()).hexdigest()")
        print("    return hash_part == password_hash")
    else:
        print("\nFailed to update password. Please check the error above.")
        sys.exit(1) 