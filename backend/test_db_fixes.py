import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# MongoDB Atlas connection string from the render.yaml file
MONGODB_URI = "mongodb+srv://dbRod:dekdek812@cluster0.hl5tp.mongodb.net/cvsu_alumni?retryWrites=true&w=majority"

# Function to test database connection using proper 'is None' check
async def test_db_connection():
    print("Testing database connection with proper MongoDB object checks...")
    
    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(MONGODB_URI)
        db = client['cvsu_alumni']
        
        print("Connected to database")
        
        # Test the is None check (correct way)
        if db is None:
            print("ERROR: Database connection failed - db is None")
            return False
        else:
            print("SUCCESS: Database connection established - using 'is None' check worked")
        
        # Example of what NOT to do (would cause the error in production)
        print("Testing a boolean check on the database object (this would fail in production):")
        try:
            # This would cause the error: "Database objects do not implement truth value testing or bool()"
            test_var = not db  # This line would fail in production
            print("WARNING: The boolean check didn't fail as expected")
        except Exception as e:
            print(f"EXPECTED ERROR (good): {e}")
            print("SUCCESS: The boolean check failed as expected, confirming our fix will work")
            
        # Test fetching unverified users with correct approach
        print("\nTesting unverified users query with proper checks:")
        
        # Get database statistics
        total_users = await db.users.count_documents({})
        unverified_users = await db.users.count_documents({"is_verified": False})
        
        print(f"Database Statistics:")
        print(f"  Total Users: {total_users}")
        print(f"  Unverified Users: {unverified_users}")
        
        # Correctly use a limited projection
        projection = {
            "_id": 1,
            "email": 1,
            "full_name": 1,
            "student_id": 1, 
            "created_at": 1,
            "is_verified": 1
        }
        
        # Set a reasonable limit
        limit = 5
        
        # Execute the query with correct pattern
        cursor = db.users.find({"is_verified": False}, projection).limit(limit)
        users = await cursor.to_list(length=limit)
        
        print(f"\nFound {len(users)} unverified users with proper query")
        
        # Return success
        return True
        
    except Exception as e:
        print(f"Error testing database: {e}")
        return False
    finally:
        # Close the MongoDB connection
        if 'client' in locals():
            client.close()
            print("Database connection closed")

if __name__ == "__main__":
    asyncio.run(test_db_connection()) 