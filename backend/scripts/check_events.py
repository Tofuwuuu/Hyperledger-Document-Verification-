import asyncio
import sys
import os
import json
from datetime import datetime
from bson.objectid import ObjectId

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config.database import get_database

class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return json.JSONEncoder.default(self, obj)

async def get_all_events():
    db = get_database()
    events = []
    
    cursor = db["events"].find({})
    
    async for event in cursor:
        events.append(event)
    
    return events

async def get_upcoming_events():
    db = get_database()
    now = datetime.utcnow()
    print(f"Current time: {now}")
    
    # Get upcoming events (start_date >= now and is_active=True)
    query = {"start_date": {"$gte": now}, "is_active": True}
    upcoming_events = []
    
    cursor = db["events"].find(query)
    
    async for event in cursor:
        upcoming_events.append(event)
    
    return upcoming_events

async def main():
    # Get all events
    print("=== All Events ===")
    all_events = await get_all_events()
    
    if not all_events:
        print("No events found in the database.")
    else:
        print(f"Found {len(all_events)} events:")
        for event in all_events:
            print(f"\n{json.dumps(event, indent=2, cls=JSONEncoder)}")
    
    # Get upcoming events
    print("\n=== Upcoming Events ===")
    upcoming_events = await get_upcoming_events()
    
    if not upcoming_events:
        print("No upcoming events found.")
        
        # Check if there are events but they don't meet the criteria
        if all_events:
            print("\nAnalyzing why events are not showing up:")
            for event in all_events:
                start_date = event.get('start_date')
                is_active = event.get('is_active', False)
                
                print(f"\nEvent: {event.get('title')}")
                print(f"- start_date: {start_date} (is future date: {start_date > datetime.utcnow() if start_date else 'N/A'})")
                print(f"- is_active: {is_active}")
                
                if not start_date:
                    print("  Issue: Missing start_date")
                elif start_date <= datetime.utcnow():
                    print("  Issue: Event date is in the past")
                if not is_active:
                    print("  Issue: Event is not active")
    else:
        print(f"Found {len(upcoming_events)} upcoming events:")
        for event in upcoming_events:
            print(f"\n{json.dumps(event, indent=2, cls=JSONEncoder)}")

if __name__ == "__main__":
    asyncio.run(main()) 