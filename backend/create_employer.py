from pymongo import MongoClient
from datetime import datetime
from bson import ObjectId
import os
import sys
from passlib.context import CryptContext

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    """Generate password hash"""
    return pwd_context.hash(password)

def create_employer_account(email, company_name, industry, contact_person, phone, address, password, website=None):
    try:
        # Connect to MongoDB
        client = MongoClient("mongodb://localhost:27017/")
        db = client["cvsu_alumni"]
        
        # Check if employer already exists
        existing_employer = db.employers.find_one({"email": email})
        if existing_employer:
            print(f"Employer with email {email} already exists.")
            return False
        
        # Check if email already exists as a user
        existing_user = db.users.find_one({"email": email})
        if existing_user:
            print(f"Email {email} already exists as a user.")
            return False
        
        # Create employer account
        now = datetime.utcnow()
        new_employer = {
            "_id": str(ObjectId()),
            "email": email,
            "company_name": company_name,
            "industry": industry,
            "contact_person": contact_person,
            "phone": phone,
            "address": address,
            "website": website,
            "hashed_password": get_password_hash(password),
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
        
        # Insert employer to database
        db.employers.insert_one(new_employer)
        print(f"Employer account created successfully: {email}")
        print(f"Employer ID: {new_employer['_id']}")
        return True
    
    except Exception as e:
        print(f"Error creating employer account: {e}")
        return False
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    # Default employer information
    default_email = "testemployer@company.com"
    default_company = "Test Company Inc."
    default_industry = "Technology"
    default_contact = "Test User"
    default_phone = "1234567890"
    default_address = "123 Company St., Business City"
    default_password = "Password123"  # Recommend changing after creation
    default_website = "http://www.testcompany.com"
    
    # Get input from the command line or use defaults
    email = input(f"Employer email [{default_email}]: ") or default_email
    company_name = input(f"Company name [{default_company}]: ") or default_company
    industry = input(f"Industry [{default_industry}]: ") or default_industry
    contact_person = input(f"Contact person [{default_contact}]: ") or default_contact
    phone = input(f"Phone number [{default_phone}]: ") or default_phone
    address = input(f"Address [{default_address}]: ") or default_address
    website = input(f"Website [{default_website}]: ") or default_website
    password = input(f"Password [{default_password}]: ") or default_password
    
    # Create the employer account
    success = create_employer_account(
        email=email,
        company_name=company_name,
        industry=industry,
        contact_person=contact_person,
        phone=phone,
        address=address,
        password=password,
        website=website
    )
    
    if success:
        print("\nEmployer account created successfully!")
        print(f"Email: {email}")
        print(f"Password: {password}")
        print(f"Company: {company_name}")
        print("\nYou can now use these credentials to log in.")
    else:
        print("\nFailed to create employer account. See error above.")
        sys.exit(1) 