from app.config.database import connect_to_mongo, get_database
import asyncio
import logging
from bson import ObjectId

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def check_admin_notifications():
    await connect_to_mongo()
    db = get_database()
    
    # Check admin users
    admin_users = await db.users.find({"role": "admin"}).to_list(None)
    print(f"Found {len(admin_users)} admin users:")
    for admin in admin_users:
        print(f" - {admin.get('email', 'unknown')} (ID: {admin['_id']})")
    
    # Check notifications for admin users
    if admin_users:
        for admin in admin_users:
            admin_id = str(admin["_id"])
            notifications = await db.notifications.find({"user_id": admin_id}).to_list(None)
            print(f"\nAdmin {admin.get('email', admin_id)} has {len(notifications)} notifications")
            for notif in notifications:
                print(f" - {notif.get('type')}: {notif.get('message')}")
    
    # Check document requests
    requests = await db.document_requests.find({}).to_list(None)
    print(f"\nFound {len(requests)} document requests")

# Run the async function
if __name__ == "__main__":
    asyncio.run(check_admin_notifications()) 