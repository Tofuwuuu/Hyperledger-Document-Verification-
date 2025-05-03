import pymongo
import jwt
import sys

def decode_token(token):
    """Decode JWT token to get user_id (without verification)"""
    try:
        # Decode without verification to extract payload
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload.get("sub")  # "sub" should contain the user ID
    except Exception as e:
        print(f"Error decoding token: {str(e)}")
        return None

def main():
    # Get token from input
    token = input("Enter your JWT token from localStorage: ")
    user_id = decode_token(token)
    
    if not user_id:
        print("Could not extract user ID from token")
        sys.exit(1)
    
    print(f"Extracted user ID: {user_id}")
    
    # Connect to MongoDB
    client = pymongo.MongoClient("mongodb://localhost:27017/")
    db = client["cvsu_alumni"]
    
    # Check user exists
    user = db.users.find_one({"_id": user_id})
    if not user:
        print("User not found in database!")
        sys.exit(1)
    
    print(f"Found user: {user.get('first_name')} {user.get('last_name')} ({user.get('email')})")
    
    # Check alumni profiles
    alumni_profiles = list(db.alumni.find({"user_id": user_id}))
    if not alumni_profiles:
        print("No alumni profiles found for this user!")
        print("This is why you don't see any activities - the activities endpoint looks up documents via alumni profiles.")
        print("\nWould you like to create an alumni profile? (y/n)")
        choice = input().lower()
        if choice == 'y':
            create_alumni_profile(db, user_id, user)
    else:
        print(f"Found {len(alumni_profiles)} alumni profile(s):")
        for profile in alumni_profiles:
            print(f"  - ID: {profile.get('_id')}")
            print(f"    Name: {profile.get('full_name')}")
            print(f"    Email: {profile.get('email')}")
            print(f"    Student ID: {profile.get('student_id')}")
    
    # Check documents
    for profile in alumni_profiles:
        documents = list(db.documents.find({"alumni_id": profile.get("_id")}))
        print(f"\nDocuments for alumni {profile.get('_id')}:")
        if not documents:
            print("  No documents found!")
        else:
            print(f"  Found {len(documents)} document(s):")
            for doc in documents:
                print(f"  - ID: {doc.get('_id')}")
                print(f"    Title: {doc.get('title')}")
                print(f"    Type: {doc.get('document_type')}")
                print(f"    Status: {doc.get('verification_status')}")

def create_alumni_profile(db, user_id, user):
    """Create a basic alumni profile for the user"""
    import datetime
    from bson import ObjectId
    
    # Get basic info
    print("\nCreating alumni profile...")
    student_id = input("Enter student ID: ")
    graduation_year = int(input("Enter graduation year: "))
    department = input("Enter department: ")
    course = input("Enter course: ")
    
    # Create profile
    now = datetime.datetime.utcnow()
    profile = {
        "_id": str(ObjectId()),
        "user_id": user_id,
        "student_id": student_id,
        "full_name": f"{user.get('first_name')} {user.get('last_name')}",
        "email": user.get('email'),
        "graduation_year": graduation_year,
        "department": department,
        "course": course,
        "batch": str(graduation_year),
        "created_at": now,
        "updated_at": now
    }
    
    # Insert to database
    db.alumni.insert_one(profile)
    print(f"Alumni profile created with ID: {profile['_id']}")

if __name__ == "__main__":
    main() 