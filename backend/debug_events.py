from pymongo import MongoClient
from datetime import datetime
import json
import sys
from bson import ObjectId

# Custom JSON encoder to handle MongoDB ObjectId and datetime
class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super(JSONEncoder, self).default(obj)

def main():
    try:
        # Connect directly to MongoDB
        client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
        db = client["cvsu_alumni"]
        
        print("\n=== DETAILED EVENT ANALYSIS ===")
        
        # Get all events
        all_events = list(db["events"].find({}))
        print(f"Total events in database: {len(all_events)}")
        
        # Current time
        now = datetime.utcnow()
        print(f"Current UTC time: {now}")
        
        # Create a datetime for the start of today
        today_start = datetime(now.year, now.month, now.day, 0, 0, 0)
        print(f"Today's start: {today_start}")
        
        # Check if events are properly configured
        for event in all_events:
            print(f"\n==== Event: {event.get('title')} ====")
            print(f"ID: {event.get('_id')}")
            
            # Check start date format and value
            start_date = event.get('start_date')
            if start_date:
                print(f"Start date: {start_date} ({type(start_date).__name__})")
                if isinstance(start_date, datetime):
                    print(f"Is future date: {start_date > now}")
                    print(f"Is today or future: {start_date >= today_start}")
                else:
                    print(f"ERROR: start_date is not a datetime object")
            else:
                print("ERROR: Missing start_date")
            
            # Check is_active status
            is_active = event.get('is_active')
            print(f"Is active: {is_active}")
            
            # Check if this event would be returned by original upcoming events query
            would_show_original = isinstance(start_date, datetime) and start_date > now and is_active is True
            print(f"Would appear in original upcoming events: {would_show_original}")
            
            # Check if this event would be returned by updated upcoming events query
            would_show_updated = isinstance(start_date, datetime) and start_date >= today_start and is_active is True
            print(f"Would appear in updated upcoming events: {would_show_updated}")
            
            if not would_show_updated:
                print("Reasons why event is not showing up:")
                if not isinstance(start_date, datetime):
                    print("- start_date is not a proper datetime object")
                elif start_date < today_start:
                    print(f"- start_date ({start_date}) is before today's start ({today_start})")
                if is_active is not True:
                    print("- is_active is not set to True")
        
        # Try running the original upcoming events query
        print("\n=== ORIGINAL UPCOMING EVENTS QUERY RESULT ===")
        upcoming_events_original = list(db["events"].find({"start_date": {"$gte": now}, "is_active": True}))
        print(f"Found {len(upcoming_events_original)} upcoming events")
        
        if upcoming_events_original:
            for event in upcoming_events_original:
                print(f"\n- {event.get('title')} (starts: {event.get('start_date')})")
        
        # Try running the updated upcoming events query
        print("\n=== UPDATED UPCOMING EVENTS QUERY RESULT ===")
        upcoming_events_updated = list(db["events"].find({"start_date": {"$gte": today_start}, "is_active": True}))
        print(f"Found {len(upcoming_events_updated)} upcoming events")
        
        if upcoming_events_updated:
            for event in upcoming_events_updated:
                print(f"\n- {event.get('title')} (starts: {event.get('start_date')})")
        
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    main() 