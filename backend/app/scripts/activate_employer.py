import asyncio
import sys
import argparse
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")

async def activate_employer(email):
    print(f"Attempting to activate employer account: {email}")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[MONGODB_DB]
    
    # Find the employer by email
    employer = await db.employers.find_one({"email": email})
    
    if not employer:
        print(f"Error: Employer account with email {email} not found")
        return False
    
    # Check if the account is already active
    if employer.get("is_active", False):
        print(f"Employer account {email} is already active")
        return True
    
    # Update the employer document to set is_active to True
    result = await db.employers.update_one(
        {"email": email},
        {"$set": {"is_active": True}}
    )
    
    if result.modified_count > 0:
        print(f"Successfully activated employer account: {email}")
        return True
    else:
        print(f"Failed to activate employer account: {email}")
        return False

def parse_args():
    parser = argparse.ArgumentParser(description="Activate an employer account")
    parser.add_argument("--email", required=True, help="Email of the employer account to activate")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    asyncio.run(activate_employer(args.email)) 