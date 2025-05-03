from pymongo import MongoClient
import json
from datetime import datetime
from bson.objectid import ObjectId

class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return json.JSONEncoder.default(self, obj)

def main():
    try:
        # Connect directly to MongoDB
        client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
        db = client["cvsu_alumni"]
        
        # Get all events
        print("=== All Events ===")
        all_events = list(db["events"].find({}))
        
        if not all_events:
            print("No events found in the database.")
        else:
            print(f"Found {len(all_events)} events:")
            for event in all_events:
                print(f"\nEvent: {event.get('title')}")
                print(f"- _id: {event.get('_id')}")
                print(f"- start_date: {event.get('start_date')}")
                print(f"- is_active: {event.get('is_active', False)}")
                
        # Get upcoming events
        print("\n=== Upcoming Events ===")
        now = datetime.utcnow()
        print(f"Current time: {now}")
        
        # Get upcoming events (start_date >= now and is_active=True)
        upcoming_events = list(db["events"].find({"start_date": {"$gte": now}, "is_active": True}))
        
        if not upcoming_events:
            print("No upcoming events found.")
            
            # Check if there are events but they don't meet the criteria
            if all_events:
                print("\nAnalyzing why events are not showing up:")
                for event in all_events:
                    start_date = event.get('start_date')
                    is_active = event.get('is_active', False)
                    
                    print(f"\nEvent: {event.get('title')}")
                    print(f"- start_date: {start_date}")
                    print(f"- is in future: {start_date > now if start_date else 'N/A'}")
                    print(f"- is_active: {is_active}")
                    
                    if not start_date:
                        print("  Issue: Missing start_date")
                    elif start_date <= now:
                        print("  Issue: Event date is in the past")
                    if not is_active:
                        print("  Issue: Event is not active")
        else:
            print(f"Found {len(upcoming_events)} upcoming events:")
            for event in upcoming_events:
                print(f"\n{json.dumps(event, indent=2, cls=JSONEncoder)}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    main() 