import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import logging
import requests
import json

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Database connection string
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "cvsu_alumni")
API_URL = os.getenv("API_URL", "https://alumni-api-klrk.onrender.com/api/v1")

async def test_api_vs_database():
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    logger.info(f"Connected to database: {DATABASE_NAME}")
    
    try:
        # 1. Direct database query for unverified users
        # First check if any unverified users exist at all
        unverified_count = await db.users.count_documents({"is_verified": False})
        logger.info(f"Database query - Users with is_verified=False: {unverified_count}")
        
        # List sample unverified users from the database
        logger.info("Sample unverified users directly from database:")
        cursor = db.users.find({"is_verified": False}).limit(3)
        async for user in cursor:
            logger.info(f"ID: {user['_id']}, Email: {user.get('email')}, is_verified: {user.get('is_verified')}")
        
        # 2. Check if the API query parameter is processed correctly
        # Try a query with various formats to see which one works
        for query_param in [
            {"is_verified": False},
            {"is_verified": {"$eq": False}},
            {"is_verified": 0},
            {"is_verified": "false"},
            {"$or": [
                {"is_verified": False},
                {"is_verified": {"$exists": False}},
                {"is_verified": None},
                {"verification_pending": True}
            ]}
        ]:
            count = await db.users.count_documents(query_param)
            logger.info(f"Database query with {query_param}: {count} results")
        
        # 3. Check the data types in the database for the is_verified field
        logger.info("Checking data types for is_verified field in database:")
        pipeline = [
            {"$group": {"_id": {"value": "$is_verified", "type": {"$type": "$is_verified"}}, "count": {"$sum": 1}}}
        ]
        async for result in db.users.aggregate(pipeline):
            logger.info(f"is_verified value: {result['_id']['value']}, type: {result['_id']['type']}, count: {result['count']}")
        
        # 4. Check if the API query is working at all by making a direct API call
        try:
            # Get a token for authentication
            token = os.getenv("AUTH_TOKEN", "")
            if not token:
                logger.warning("No AUTH_TOKEN environment variable found, API call may fail")
            
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "X-Admin-Access": "true"
            }
            
            # Make the API call
            api_url = f"{API_URL}/auth/unverified-users?db=cvsu_alumni&collection=users&filter=is_verified:false"
            logger.info(f"Making API request to: {api_url}")
            response = requests.get(api_url, headers=headers)
            
            logger.info(f"API response status: {response.status_code}")
            if response.status_code == 200:
                users = response.json()
                logger.info(f"API returned {len(users)} unverified users")
                if users:
                    logger.info(f"First user: {json.dumps(users[0], indent=2)}")
                else:
                    logger.warning("API returned empty array despite having unverified users in database")
            else:
                logger.error(f"API request failed: {response.text}")
        except Exception as api_err:
            logger.error(f"Error making API request: {api_err}")
        
        # 5. Check test user specifically
        test_user = await db.users.find_one({"email": "testmark213@outlook.com"})
        if test_user:
            logger.info(f"Test user: {test_user.get('email')}")
            logger.info(f"is_verified: {test_user.get('is_verified')}")
            logger.info(f"is_verified type: {type(test_user.get('is_verified'))}")
            
            # Try updating the test user to ensure is_verified is boolean False
            logger.info("Updating test user to ensure is_verified is boolean False")
            result = await db.users.update_one(
                {"email": "testmark213@outlook.com"},
                {"$set": {"is_verified": False}}
            )
            logger.info(f"Update result: {result.modified_count} document(s) modified")
            
            # Check the user again after update
            test_user = await db.users.find_one({"email": "testmark213@outlook.com"})
            logger.info(f"Test user after update - is_verified: {test_user.get('is_verified')}")
            logger.info(f"Test user after update - is_verified type: {type(test_user.get('is_verified'))}")
        else:
            logger.info("Test user not found")
            
    except Exception as e:
        logger.error(f"Error testing API vs database: {e}")
    finally:
        # Close the connection
        client.close()

if __name__ == "__main__":
    asyncio.run(test_api_vs_database()) 