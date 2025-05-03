import asyncio
import aiohttp
import json
import sys

# Configuration
API_URL = "http://localhost:8000/api/v1"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "Admin123!"

async def test_roles_api():
    """Test the roles API endpoints"""
    async with aiohttp.ClientSession() as session:
        print("Testing roles API...")
        
        # Step 1: Login to get a token
        print("\n1. Logging in as admin...")
        login_data = {
            "username": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        async with session.post(f"{API_URL}/auth/login", data=login_data) as response:
            if response.status != 200:
                print(f"Login failed: {response.status}")
                print(await response.text())
                return
            
            login_result = await response.json()
            token = login_result["access_token"]
            print("Login successful, got token")
            
            # Set headers for authorized requests
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        
        # Step 2: Get all permissions
        print("\n2. Getting all permissions...")
        async with session.get(f"{API_URL}/admin/permissions", headers=headers) as response:
            if response.status != 200:
                print(f"Failed to get permissions: {response.status}")
                print(await response.text())
                return
            
            permissions = await response.json()
            print(f"Got {len(permissions)} permissions")
            for i, perm in enumerate(permissions[:3]):  # Show first 3 permissions
                print(f"  - {perm['name']}: {perm['description']}")
            if len(permissions) > 3:
                print(f"  - ... and {len(permissions) - 3} more")
        
        # Step 3: Get all roles
        print("\n3. Getting all roles...")
        async with session.get(f"{API_URL}/admin/roles", headers=headers) as response:
            if response.status != 200:
                print(f"Failed to get roles: {response.status}")
                print(await response.text())
                return
            
            roles_data = await response.json()
            roles = roles_data["items"]
            print(f"Got {len(roles)} roles")
            for i, role in enumerate(roles[:3]):  # Show first 3 roles
                print(f"  - {role['name']}: {role['description']} ({len(role['permissions'])} permissions)")
            if len(roles) > 3:
                print(f"  - ... and {len(roles) - 3} more")
        
        # Step 4: Create a new role
        print("\n4. Creating a new role...")
        new_role = {
            "name": "Test Role",
            "description": "Test role created by API test script",
            "is_active": True
        }
        async with session.post(f"{API_URL}/admin/roles", headers=headers, json=new_role) as response:
            if response.status != 201:
                print(f"Failed to create role: {response.status}")
                print(await response.text())
                return
            
            created_role = await response.json()
            role_id = created_role["id"]
            print(f"Created role with id: {role_id}")
        
        # Step 5: Get the new role
        print("\n5. Getting the new role...")
        async with session.get(f"{API_URL}/admin/roles/{role_id}", headers=headers) as response:
            if response.status != 200:
                print(f"Failed to get role: {response.status}")
                print(await response.text())
                return
            
            role = await response.json()
            print(f"Got role: {role['name']} ({role['id']})")
        
        # Step 6: Update the role
        print("\n6. Updating the role...")
        update_data = {
            "description": "Updated test role description"
        }
        async with session.put(f"{API_URL}/admin/roles/{role_id}", headers=headers, json=update_data) as response:
            if response.status != 200:
                print(f"Failed to update role: {response.status}")
                print(await response.text())
                return
            
            updated_role = await response.json()
            print(f"Updated role description: {updated_role['description']}")
        
        # Step 7: Assign a permission to the role
        if permissions:
            print("\n7. Assigning a permission to the role...")
            permission_id = permissions[0]["id"]
            permission_data = {
                "permission_id": permission_id
            }
            async with session.post(f"{API_URL}/admin/roles/{role_id}/permissions", headers=headers, json=permission_data) as response:
                if response.status != 200:
                    print(f"Failed to assign permission: {response.status}")
                    print(await response.text())
                else:
                    updated_role = await response.json()
                    print(f"Assigned permission. Role now has {len(updated_role['permissions'])} permissions")
        
        # Step 8: Delete the role
        print("\n8. Deleting the role...")
        async with session.delete(f"{API_URL}/admin/roles/{role_id}", headers=headers) as response:
            if response.status != 204:
                print(f"Failed to delete role: {response.status}")
                print(await response.text())
                return
            
            print(f"Successfully deleted role")
        
        print("\nAll tests completed successfully!")

if __name__ == "__main__":
    asyncio.run(test_roles_api()) 