import pymongo
import socket
import logging
import sys
import time
import os
import subprocess

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def is_port_open(host, port, timeout=5):
    """Check if the given port is open on the host."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        s.connect((host, port))
        s.shutdown(socket.SHUT_RDWR)
        return True
    except:
        return False
    finally:
        s.close()

def check_mongodb_connection():
    """Check if MongoDB is running and can be connected to."""
    # First check if the port is open
    mongodb_host = "localhost"
    mongodb_port = 27017
    
    logger.info(f"Checking if MongoDB port {mongodb_port} is open on {mongodb_host}...")
    if not is_port_open(mongodb_host, mongodb_port):
        logger.error(f"MongoDB port {mongodb_port} is not open on {mongodb_host}")
        return False
    
    # Try to connect to MongoDB
    mongodb_url = "mongodb://localhost:27017/"
    try:
        logger.info(f"Attempting to connect to MongoDB at {mongodb_url}...")
        client = pymongo.MongoClient(mongodb_url, serverSelectionTimeoutMS=5000)
        
        # The ismaster command is cheap and does not require auth.
        client.admin.command('ping')
        
        logger.info("MongoDB connection successful!")
        
        # Check databases
        databases = client.list_database_names()
        logger.info(f"Available databases: {', '.join(databases)}")
        
        # Check if our database exists
        db_name = "cvsu_alumni"
        if db_name in databases:
            logger.info(f"Database '{db_name}' exists.")
            
            # Check collections in our database
            collections = client[db_name].list_collection_names()
            logger.info(f"Collections in {db_name}: {', '.join(collections)}")
            
            # Check users collection
            if "users" in collections:
                users_count = client[db_name].users.count_documents({})
                logger.info(f"Found {users_count} documents in the users collection.")
                
                # Check for our specific user
                user = client[db_name].users.find_one({"email": "rodericksalise801@gmail.com"})
                if user:
                    logger.info(f"Found user with email rodericksalise801@gmail.com in the database.")
                else:
                    logger.warning(f"User with email rodericksalise801@gmail.com not found in the database.")
        else:
            logger.warning(f"Database '{db_name}' does not exist.")
        
        return True
    except pymongo.errors.ServerSelectionTimeoutError as e:
        logger.error(f"MongoDB server selection timeout: {e}")
        return False
    except pymongo.errors.ConnectionFailure as e:
        logger.error(f"MongoDB connection failure: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error connecting to MongoDB: {e}")
        return False

def check_mongodb_service():
    """Check if MongoDB service is running on Windows."""
    try:
        command = "sc query MongoDB"
        process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()
        output = stdout.decode('utf-8', errors='ignore')
        
        if "RUNNING" in output:
            logger.info("MongoDB service is running.")
            return True
        else:
            logger.warning("MongoDB service is not running.")
            return False
    except Exception as e:
        logger.error(f"Error checking MongoDB service: {e}")
        return False

def start_mongodb_service():
    """Attempt to start the MongoDB service."""
    try:
        command = "sc start MongoDB"
        process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()
        output = stdout.decode('utf-8', errors='ignore')
        
        if "START_PENDING" in output or "RUNNING" in output:
            logger.info("MongoDB service started successfully.")
            # Give it time to start up
            time.sleep(5)
            return True
        else:
            logger.error(f"Failed to start MongoDB service. Output: {output}")
            return False
    except Exception as e:
        logger.error(f"Error starting MongoDB service: {e}")
        return False

if __name__ == "__main__":
    logger.info("Checking MongoDB status...")
    
    # Check if MongoDB service is running
    service_running = check_mongodb_service()
    
    # If service is not running, try to start it
    if not service_running:
        logger.info("Attempting to start MongoDB service...")
        service_started = start_mongodb_service()
        if not service_started:
            logger.error("Failed to start MongoDB service. Please start it manually.")
            logger.info("You can start MongoDB with one of these methods:")
            logger.info("1. Run 'mongod' command in a terminal")
            logger.info("2. Run 'sc start MongoDB' in a Command Prompt with admin privileges")
            logger.info("3. Open Services (services.msc) and start the MongoDB service manually")
            sys.exit(1)
    
    # Check MongoDB connection
    connection_ok = check_mongodb_connection()
    
    if connection_ok:
        logger.info("MongoDB is running and available!")
        logger.info("""
IMPORTANT FIXES FOR YOUR APPLICATION:
1. We've fixed your backend code to not use transactions for registration
2. We've made your database connection code more reliable
3. We've manually added your user to the database

To make your app work correctly:
1. Make sure MongoDB is running whenever you start your backend
2. Restart your backend server with: cd backend && python run.py
3. Then try to log in with your frontend at http://localhost:5173/login
   - Email: rodericksalise801@gmail.com
   - Password: Dekdek812
        """)
    else:
        logger.error("MongoDB is not running or cannot be connected to.")
        logger.error("""
Please ensure MongoDB is installed and running on your machine:
1. Install MongoDB if not already installed
2. Start the MongoDB service
3. Make sure the MongoDB server is listening on localhost:27017
        """) 