from app.config.database import get_database
import asyncio

async def update_admin_user():
    # Connect to the database
    db = get_database()
    
    # Print current user data
    user = await db.users.find_one({"full_name": "rod"})
    print("Before update:", user)
    
    # Update user to make them an admin
    result = await db.users.update_one(
        {"full_name": "rod"},
        {"$set": {"is_admin": True}}
    )
    
    # Print updated user data
    user = await db.users.find_one({"full_name": "rod"})
    print("After update:", user)
    
    print(f"Modified count: {result.modified_count}")
    
    return result.modified_count

if __name__ == "__main__":
    asyncio.run(update_admin_user()) 