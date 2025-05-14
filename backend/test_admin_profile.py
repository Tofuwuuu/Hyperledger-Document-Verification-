#!/usr/bin/env python
"""
Test script to check if the admin profile endpoint exists and what might be causing the failure.
"""

import os
import json
import logging
import requests
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
from pprint import pprint

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_admin_profile_endpoint():
    """Test the /admin/profile endpoint."""
    api_base = os.environ.get("API_URL", "http://localhost:8000")
    token = input("Enter a valid admin token: ")
    
    # Remove trailing slash if present
    api_base = api_base[:-1] if api_base.endswith('/') else api_base
    
    # Add /api/v1 if it's not already there
    if not api_base.endswith('/api/v1'):
        api_base = f"{api_base}/api/v1"
    
    # First, test the /auth/me endpoint which should always work
    me_url = f"{api_base}/auth/me"
    logger.info(f"Testing /auth/me endpoint: {me_url}")
    
    me_headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        me_response = requests.get(me_url, headers=me_headers)
        logger.info(f"Status code: {me_response.status_code}")
        
        if me_response.status_code == 200:
            logger.info("Auth/me endpoint works! User data:")
            user_data = me_response.json()
            pprint(user_data)
            
            # Now try the admin profile endpoint
            admin_profile_url = f"{api_base}/admin/profile"
            logger.info(f"Testing admin profile endpoint: {admin_profile_url}")
            
            admin_headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "X-Admin-Bypass": "true"
            }
            
            profile_response = requests.get(admin_profile_url, headers=admin_headers)
            logger.info(f"Status code: {profile_response.status_code}")
            
            if profile_response.status_code == 200:
                logger.info("Admin profile endpoint works! Data:")
                profile_data = profile_response.json()
                pprint(profile_data)
            else:
                logger.error(f"Admin profile endpoint failed with status: {profile_response.status_code}")
                logger.error(f"Response body: {profile_response.text}")
        else:
            logger.error(f"Auth/me endpoint failed with status: {me_response.status_code}")
            logger.error(f"Response body: {me_response.text}")
    except Exception as e:
        logger.error(f"Exception occurred: {str(e)}")

def check_mongodb_for_admin_profiles():
    """Check MongoDB to see if admin profiles exist."""
    # Get MongoDB connection string from environment or use default
    mongo_uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/")
    
    try:
        # Connect to MongoDB
        client = MongoClient(mongo_uri)
        db = client.cvsu_alumni
        
        # Find all users with is_admin=true
        admin_users = list(db.users.find({"is_admin": True}))
        
        if admin_users:
            logger.info(f"Found {len(admin_users)} admin users in the database:")
            for admin in admin_users:
                # Convert ObjectId to string for printing
                if '_id' in admin:
                    admin['_id'] = str(admin['_id'])
                pprint(admin)
        else:
            logger.warning("No admin users found in the database!")
    except Exception as e:
        logger.error(f"Error connecting to MongoDB: {str(e)}")

if __name__ == "__main__":
    print("Admin profile endpoint test")
    print("==========================")
    
    # Test the endpoint
    test_admin_profile_endpoint()
    
    # Check MongoDB for admin users
    print("\nChecking MongoDB for admin profiles...")
    check_mongodb_for_admin_profiles() 