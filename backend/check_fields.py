from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB settings
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "cvsu_alumni")

def main():
    try:
        # Connect to MongoDB directly
        client = MongoClient(MONGODB_URL)
        db = client[MONGODB_DB]
        
        # Get one alumni record
        alumni = db.alumni.find_one()
        
        if alumni:
            print("Alumni record found with fields:")
            for key in alumni.keys():
                print(f"- {key}: {type(alumni[key])}")
                # Print the value if it's a simple type
                if isinstance(alumni[key], (str, int, bool, float)):
                    print(f"  Value: {alumni[key]}")
            
            # Check if important fields exist
            for field in ['full_name', 'student_id', 'course', 'graduation_year']:
                if field in alumni:
                    print(f"\nField '{field}' exists with value: {alumni.get(field)}")
                else:
                    print(f"\nField '{field}' does NOT exist in the document")
                    
            print("\nActual name field in alumni record:")
            for key in alumni.keys():
                if 'name' in key.lower():
                    print(f"- {key}: {alumni.get(key)}")
                    
        else:
            print("No alumni records found in the database.")
            
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        # Close the connection
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    main() 