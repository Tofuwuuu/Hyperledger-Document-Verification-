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
            
        # Current time plus 30 days to ensure it's in the future
        new_date = datetime.utcnow() + timedelta(days=30)
        print(f"Current time: {datetime.utcnow()}")
        print(f"Setting new event date to: {new_date}")
        
        # Update each event's start_date to be in the future
        for event in events:
            event_id = event["_id"]
            title = event.get("title", "Unknown")
            
            print(f"Updating event: {title} (ID: {event_id})")
            print(f"  Old start_date: {event.get('start_date')}")
            
            # Update the start date
            result = events_collection.update_one(
                {"_id": event_id},
                {"$set": {
                    "start_date": new_date,
                    "end_date": new_date + timedelta(days=2),  # Also update end date
                    "updated_at": datetime.utcnow()
                }}
            )
            
            if result.modified_count > 0:
                print(f"  ✓ Successfully updated event date")
            else:
                print(f"  ✗ Failed to update event date")
                
        print("\nEvent dates updated. Please refresh your browser to see updated events.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    main() 