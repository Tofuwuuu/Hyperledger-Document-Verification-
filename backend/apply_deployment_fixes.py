import os
import sys
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Check instructions
print("=" * 80)
print("MongoDB Connection and Response Size Fix Deployment Script")
print("=" * 80)
print("\nThis script will help you deploy the fixes for:")
print("1. MongoDB boolean check error: 'Database objects do not implement truth value testing or bool()'")
print("2. Response size error: 'Too much data for declared Content-Length'")
print("\nMake sure you have:")
print("- Updated backend/app/routes/auth.py with the fixed 'is None' check")
print("- Updated backend/app/config/database.py with proper MongoDB object handling")
print("- Updated backend/app/main.py with enhanced startup logging")
print("\nFollow these steps to deploy the fixes:")
print("1. Commit all changes to your Git repository")
print("2. Push the changes to GitHub")
print("3. Deploy from GitHub to Render.com")
print("\nIf you're deploying to Render.com, the changes will be applied automatically when you push to GitHub.")

# Check if MongoDB environment variables are set
print("\nChecking environment variables...")
mongodb_uri = os.getenv("MONGODB_URI")
if mongodb_uri:
    print("✅ MONGODB_URI is set")
else:
    print("❌ MONGODB_URI is not set - this will cause connection issues")

# Test database connection
async def test_connection():
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        
        print("\nTesting MongoDB connection...")
        if not mongodb_uri:
            print("❌ Cannot test connection without MONGODB_URI")
            return
            
        # Connect to MongoDB
        client = AsyncIOMotorClient(mongodb_uri)
        db = client.get_database("cvsu_alumni")
        
        # Test the connection
        print("Pinging MongoDB server...")
        await db.command("ping")
        print("✅ MongoDB connection successful!")
        
        # Check for unverified users
        count = await db.users.count_documents({"is_verified": False})
        print(f"Found {count} unverified users in database")
        
    except Exception as e:
        print(f"❌ MongoDB connection error: {e}")
    finally:
        if 'client' in locals():
            client.close()

# Run the test
if __name__ == "__main__":
    print("\nRunning connection test...")
    asyncio.run(test_connection())
    
    print("\n" + "=" * 80)
    print("Deployment steps:")
    print("1. Git add, commit, and push your changes:")
    print("   git add .")
    print("   git commit -m \"Fix MongoDB boolean check and response size issues\"")
    print("   git push")
    print("\n2. On Render.com:")
    print("   - Go to your backend service dashboard")
    print("   - Click 'Deploy latest commit' or wait for automatic deployment")
    print("   - Monitor the logs for any errors")
    print("\n3. Testing after deployment:")
    print("   - Try loading the admin verification page")
    print("   - Check if unverified users are displayed")
    print("   - Monitor the logs for any MongoDB connection or response size errors")
    print("=" * 80) 