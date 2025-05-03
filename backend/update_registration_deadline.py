from pymongo import MongoClient
from datetime import datetime, timedelta
from bson.objectid import ObjectId

def main():
    try:
        # Connect directly to MongoDB
        client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
        db = client["cvsu_alumni"]
        events_collection = db["events"]
        
        # Get all events
        events = list(events_collection.find({}))
        
        if not events:
            print("No events found to update.")
            return
        
        # Current time plus 25 days (to make deadline before the event start)
        new_deadline = datetime.utcnow() + timedelta(days=25)
        print(f"Current time: {datetime.utcnow()}")
        print(f"Setting new registration deadline to: {new_deadline}")
        
        # Update each event's registration_deadline
        for event in events:
            event_id = event["_id"]
            title = event.get("title", "Unknown")
            
            print(f"Updating event: {title} (ID: {event_id})")
            print(f"  Old registration_deadline: {event.get('registration_deadline', 'Not set')}")
            
            # Update the registration deadline
            result = events_collection.update_one(
                {"_id": event_id},
                {"$set": {
                    "registration_deadline": new_deadline,
                    "updated_at": datetime.utcnow()
                }}
            )
            
            if result.modified_count > 0:
                print(f"  ✓ Successfully updated registration deadline")
            else:
                print(f"  ✗ Failed to update registration deadline")
                
        print("\nRegistration deadlines updated. Please refresh your browser to see updated events.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    main() 