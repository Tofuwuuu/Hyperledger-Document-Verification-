import asyncio
from datetime import datetime
from app.config.database import connect_to_mongo, get_database

# Define default permissions
DEFAULT_PERMISSIONS = [
    {
        "name": "View Users",
        "description": "Can view user accounts",
        "resource": "users",
        "action": "read"
    },
    {
        "name": "Manage Users",
        "description": "Can create, update, and delete user accounts",
        "resource": "users",
        "action": "write"
    },
    {
        "name": "View Alumni",
        "description": "Can view alumni profiles",
        "resource": "alumni",
        "action": "read"
    },
    {
        "name": "Manage Alumni",
        "description": "Can create, update, and delete alumni profiles",
        "resource": "alumni",
        "action": "write"
    },
    {
        "name": "View Documents",
        "description": "Can view documents",
        "resource": "documents",
        "action": "read"
    },
    {
        "name": "Manage Documents",
        "description": "Can create, update, and delete documents",
        "resource": "documents",
        "action": "write"
    },
    {
        "name": "Verify Documents",
        "description": "Can verify or reject documents",
        "resource": "documents",
        "action": "verify"
    },
    {
        "name": "View Roles",
        "description": "Can view roles and permissions",
        "resource": "roles",
        "action": "read"
    },
    {
        "name": "Manage Roles",
        "description": "Can create, update, and delete roles",
        "resource": "roles",
        "action": "write"
    }
]

# Define default roles
DEFAULT_ROLES = [
    {
        "name": "Administrator",
        "description": "Full system access",
        "is_active": True,
        "permissions": ["View Users", "Manage Users", "View Alumni", "Manage Alumni", 
                       "View Documents", "Manage Documents", "Verify Documents", 
                       "View Roles", "Manage Roles"]
    },
    {
        "name": "User Manager",
        "description": "Can manage user accounts",
        "is_active": True,
        "permissions": ["View Users", "Manage Users"]
    },
    {
        "name": "Document Manager",
        "description": "Can manage and verify documents",
        "is_active": True,
        "permissions": ["View Documents", "Manage Documents", "Verify Documents"]
    },
    {
        "name": "Read Only",
        "description": "View only access to the system",
        "is_active": True,
        "permissions": ["View Users", "View Alumni", "View Documents", "View Roles"]
    }
]

async def init_permissions():
    """Initialize default permissions and roles in the database."""
    try:
        # Connect to MongoDB
        await connect_to_mongo()
        db = get_database()
        
        # Create indexes for roles and permissions collections
        await db.roles.create_index("name", unique=True)
        await db.permissions.create_index("name", unique=True)
        
        # Insert default permissions
        permission_mapping = {}  # To store name -> _id mapping
        now = datetime.utcnow()
        
        for perm in DEFAULT_PERMISSIONS:
            # Check if permission already exists
            existing = await db.permissions.find_one({"name": perm["name"]})
            if existing:
                permission_mapping[perm["name"]] = existing["_id"]
                print(f"Permission '{perm['name']}' already exists")
                continue
            
            # Add timestamps
            perm["created_at"] = now
            perm["updated_at"] = now
            
            # Insert permission
            result = await db.permissions.insert_one(perm)
            permission_mapping[perm["name"]] = result.inserted_id
            print(f"Created permission: {perm['name']}")
        
        # Insert default roles
        for role in DEFAULT_ROLES:
            # Check if role already exists
            existing = await db.roles.find_one({"name": role["name"]})
            if existing:
                print(f"Role '{role['name']}' already exists")
                continue
            
            # Replace permission names with IDs
            perm_names = role["permissions"]
            perm_ids = []
            for name in perm_names:
                if name in permission_mapping:
                    perm_ids.append(str(permission_mapping[name]))
            
            # Create role dictionary
            role_dict = {
                "name": role["name"],
                "description": role["description"],
                "is_active": role["is_active"],
                "permissions": perm_ids,
                "created_at": now,
                "updated_at": now
            }
            
            # Insert role
            await db.roles.insert_one(role_dict)
            print(f"Created role: {role['name']}")
        
        print("Permission and role initialization completed")
    except Exception as e:
        print(f"Error initializing permissions and roles: {e}")

if __name__ == "__main__":
    asyncio.run(init_permissions()) 