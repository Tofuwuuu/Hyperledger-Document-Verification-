"""
Diagnostic script to check event registrations and show the MongoDB data
"""
import asyncio
import sys
import os
import json
from bson import ObjectId
from pprint import pprint

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config.database import get_database_async
from app.utils.json_utils import JSONEncoder

async def check_registrations():
    print("\n==== CHECKING EVENT REGISTRATION DATA ====\n")
    
    try:
        db = await get_database_async()
        print("Connected to database successfully")
        
        # Check events collection
        events = await db["events"].find({}).to_list(length=None)
        print(f"Found {len(events)} events in database")
        
        for i, event in enumerate(events):
            print(f"\nEvent {i+1}: {event.get('title', 'Unknown')}")
            print(f"  ID: {event.get('_id')}")
            print(f"  Registration Count: {event.get('registration_count', 0)}")
            
            # Find registrations for this event
            registrations = await db["event_registrations"].find({"event_id": event["_id"]}).to_list(length=None)
            print(f"  Actual Registrations Found: {len(registrations)}")
            
            if len(registrations) != event.get('registration_count', 0):
                print(f"  ⚠️  MISMATCH: DB has {len(registrations)} registrations but event.registration_count = {event.get('registration_count', 0)}")
            
            # Print registrations
            if registrations:
                print("\n  Registration details:")
                for reg in registrations:
                    # Get user info
                    user = await db["users"].find_one({"_id": reg["user_id"]})
                    user_name = f"{user.get('first_name', '')} {user.get('last_name', '')}" if user else "Unknown"
                    
                    print(f"    - {user_name} (Status: {reg.get('status', 'unknown')})")
                    print(f"      Registration ID: {reg.get('_id')}")
                    print(f"      User ID: {reg.get('user_id')}")
            
        print("\n==== RAW REGISTRATION DATA ====\n")
        all_regs = await db["event_registrations"].find({}).to_list(length=None)
        print(f"Total registrations in database: {len(all_regs)}")
        for reg in all_regs:
            print("\nRegistration:")
            print(json.dumps(reg, cls=JSONEncoder, indent=2))
        
    except Exception as e:
        print(f"Error: {str(e)}")

async def main():
    try:
        await check_registrations()
    finally:
        # Close connections
        db = await get_database_async()
        if hasattr(db, 'client') and db.client:
            db.client.close()

if __name__ == "__main__":
    asyncio.run(main()) 