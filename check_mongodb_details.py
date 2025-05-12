from pymongo import MongoClient
import sys

def test_mongodb():
    """Test the MongoDB connection with detailed diagnostics"""
    print("Running detailed MongoDB connection test...")
    
    # MongoDB connection settings
    mongo_uri = "mongodb://localhost:27017/"
    db_name = "cvsu_alumni"
    
    try:
        # Try to connect with increased diagnostic information
        print(f"Connecting to MongoDB at {mongo_uri}...")
        client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,  # 5 seconds
            connectTimeoutMS=10000,         # 10 seconds
            socketTimeoutMS=20000,          # 20 seconds
            directConnection=True           # Force direct connection
        )
        
        # Test the connection
        print("Testing connection...")
        server_info = client.server_info()
        print(f"✅ Connected to MongoDB version {server_info.get('version', 'unknown')}")
        
        # List databases
        print("Fetching database list...")
        databases = client.list_database_names()
        print(f"Available databases: {databases}")
        
        # Check if our database exists
        if db_name in databases:
            print(f"Database '{db_name}' exists!")
            
            # Access the database
            db = client[db_name]
            
            # List collections
            print("Fetching collection list...")
            collections = db.list_collection_names()
            print(f"Collections in {db_name}: {collections}")
            
            # Test reading from users collection if it exists
            if "users" in collections:
                try:
                    print("Testing read from users collection...")
                    users_count = db.users.count_documents({})
                    print(f"Found {users_count} users in the database")
                    
                    # Try to fetch first user (read test)
                    user = db.users.find_one({})
                    if user:
                        print(f"Sample user found with ID: {user.get('_id')}")
                        print(f"User email: {user.get('email', 'unknown')}")
                    else:
                        print("No users found in collection")
                except Exception as e:
                    print(f"❌ Error reading from users collection: {e}")
        else:
            print(f"❌ Database '{db_name}' does not exist!")
        
        # Test a write operation to verify permissions
        try:
            print("\nTesting write permissions with temporary collection...")
            test_collection = db.test_connection
            result = test_collection.insert_one({"test": "connection", "timestamp": "now"})
            print(f"✅ Write test successful. Document inserted with ID: {result.inserted_id}")
            
            # Cleanup
            test_collection.delete_one({"_id": result.inserted_id})
            print("Test document deleted")
        except Exception as e:
            print(f"❌ Write test failed: {e}")
        
        print("\n✅ MongoDB connection test completed successfully!")
        return True
    except Exception as e:
        print(f"\n❌ MongoDB connection failed: {e}")
        
        # Provide additional diagnostic information
        if "SocketTimeoutException" in str(e):
            print("The connection timed out. MongoDB might be running but not responding.")
        elif "ServerSelectionTimeoutError" in str(e):
            print("Could not select a MongoDB server. The MongoDB service might not be running.")
        elif "OperationFailure" in str(e) and "auth failed" in str(e).lower():
            print("Authentication failed. Check your MongoDB credentials.")
        elif "NetworkTimeout" in str(e):
            print("Network timeout. Check your MongoDB host and port.")
        
        return False
    finally:
        if 'client' in locals():
            print("Closing MongoDB connection...")
            client.close()

if __name__ == "__main__":
    print("\n=== MongoDB Detailed Connection Test ===\n")
    success = test_mongodb()
    
    if success:
        print("\nYour MongoDB is running correctly and accessible!")
        sys.exit(0)
    else:
        print("\nMongoDB connection failed. Please check the error messages above.")
        print("Make sure MongoDB is running with 'net start MongoDB' or through MongoDB Compass.")
        sys.exit(1) 