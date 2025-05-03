from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from typing import List, Dict, Any, Optional
from datetime import datetime
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.utils.auth import get_admin_user
from app.config.database import get_database
from app.schemas import (
    RoleCreate, 
    RoleUpdate, 
    RoleOut, 
    PermissionOut,
    AssignPermissionRequest,
    RolePaginatedResponse
)

router = APIRouter()

# Helper function to convert ObjectId to string
def serialize_id(item):
    if "_id" in item:
        item["id"] = str(item["_id"])
        del item["_id"]
    return item

# Helper function to get a role by ID
async def get_role_by_id(role_id: str):
    db = get_database()
    try:
        role = await db.roles.find_one({"_id": ObjectId(role_id)})
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role with ID {role_id} not found"
            )
        return role
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role ID format or database error: {str(e)}"
        )

# Helper function to get a permission by ID
async def get_permission_by_id(permission_id: str):
    db = get_database()
    try:
        permission = await db.permissions.find_one({"_id": ObjectId(permission_id)})
        if not permission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Permission with ID {permission_id} not found"
            )
        return permission
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permission ID format or database error: {str(e)}"
        )

@router.get("/roles", response_model=RolePaginatedResponse)
async def get_all_roles(
    admin_user: Dict[str, Any] = Depends(get_admin_user),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page")
):
    """
    Get a paginated list of all roles
    """
    db = get_database()
    
    # Calculate skip value for pagination
    skip = (page - 1) * limit
    
    # Get total count
    total = await db.roles.count_documents({})
    
    # Get roles with pagination
    cursor = db.roles.find({}).sort("name", 1).skip(skip).limit(limit)
    
    roles = []
    async for role in cursor:
        # Serialize the role
        role = serialize_id(role)
        
        # Get permissions for this role
        role_permissions = []
        if "permissions" in role and role["permissions"]:
            for perm_id in role["permissions"]:
                try:
                    permission = await db.permissions.find_one({"_id": ObjectId(perm_id)})
                    if permission:
                        permission = serialize_id(permission)
                        role_permissions.append(permission)
                except:
                    # Skip invalid permission IDs
                    pass
        
        role["permissions"] = role_permissions
        roles.append(role)
    
    # Calculate total pages
    total_pages = (total + limit - 1) // limit
    
    return {
        "items": roles,
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": total_pages
        }
    }

@router.get("/roles/{role_id}", response_model=RoleOut)
async def get_role(
    role_id: str = Path(..., description="The ID of the role to get"),
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Get a role by ID with its permissions
    """
    db = get_database()
    
    # Get the role
    role = await get_role_by_id(role_id)
    role = serialize_id(role)
    
    # Get permissions for this role
    role_permissions = []
    if "permissions" in role and role["permissions"]:
        for perm_id in role["permissions"]:
            try:
                permission = await db.permissions.find_one({"_id": ObjectId(perm_id)})
                if permission:
                    permission = serialize_id(permission)
                    role_permissions.append(permission)
            except:
                # Skip invalid permission IDs
                pass
    
    role["permissions"] = role_permissions
    
    return role

@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_data: RoleCreate,
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Create a new role
    """
    db = get_database()
    
    # Check if role with same name already exists
    existing_role = await db.roles.find_one({"name": role_data.name})
    if existing_role:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Role with name '{role_data.name}' already exists"
        )
    
    # Prepare role data
    now = datetime.utcnow()
    role_dict = role_data.dict()
    role_dict["permissions"] = []
    role_dict["created_at"] = now
    role_dict["updated_at"] = now
    
    try:
        # Insert role
        result = await db.roles.insert_one(role_dict)
        
        # Get created role
        created_role = await get_role_by_id(str(result.inserted_id))
        created_role = serialize_id(created_role)
        created_role["permissions"] = []
        
        return created_role
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Role with name '{role_data.name}' already exists"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create role: {str(e)}"
        )

@router.put("/roles/{role_id}", response_model=RoleOut)
async def update_role(
    role_data: RoleUpdate,
    role_id: str = Path(..., description="The ID of the role to update"),
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Update an existing role
    """
    db = get_database()
    
    # Check if role exists
    role = await get_role_by_id(role_id)
    
    # Prepare update data
    update_data = {k: v for k, v in role_data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields to update"
        )
    
    # Check if name update would conflict
    if "name" in update_data and update_data["name"] != role["name"]:
        existing_role = await db.roles.find_one({"name": update_data["name"]})
        if existing_role:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Role with name '{update_data['name']}' already exists"
            )
    
    # Add updated timestamp
    update_data["updated_at"] = datetime.utcnow()
    
    try:
        # Update role
        await db.roles.update_one(
            {"_id": ObjectId(role_id)},
            {"$set": update_data}
        )
        
        # Get updated role
        updated_role = await get_role_by_id(role_id)
        updated_role = serialize_id(updated_role)
        
        # Get permissions for this role
        role_permissions = []
        if "permissions" in updated_role and updated_role["permissions"]:
            for perm_id in updated_role["permissions"]:
                try:
                    permission = await db.permissions.find_one({"_id": ObjectId(perm_id)})
                    if permission:
                        permission = serialize_id(permission)
                        role_permissions.append(permission)
                except:
                    # Skip invalid permission IDs
                    pass
        
        updated_role["permissions"] = role_permissions
        
        return updated_role
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Update would cause a conflict with an existing role"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update role: {str(e)}"
        )

@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: str = Path(..., description="The ID of the role to delete"),
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Delete a role
    """
    db = get_database()
    
    # Check if role exists
    await get_role_by_id(role_id)
    
    # Check if any users have this role
    users_with_role = await db.users.count_documents({"role_id": role_id})
    if users_with_role > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete role: {users_with_role} users are assigned to this role"
        )
    
    # Delete role
    result = await db.roles.delete_one({"_id": ObjectId(role_id)})
    
    if result.deleted_count != 1:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete role"
        )

@router.get("/permissions", response_model=List[PermissionOut])
async def get_permissions(
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Get all available permissions
    """
    db = get_database()
    
    # Get all permissions
    cursor = db.permissions.find({}).sort("name", 1)
    
    permissions = []
    async for permission in cursor:
        permissions.append(serialize_id(permission))
    
    return permissions

@router.post("/roles/{role_id}/permissions", response_model=RoleOut)
async def assign_permission(
    permission_data: AssignPermissionRequest,
    role_id: str = Path(..., description="The ID of the role"),
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Assign a permission to a role
    """
    db = get_database()
    
    # Check if role exists
    role = await get_role_by_id(role_id)
    
    # Check if permission exists
    permission = await get_permission_by_id(permission_data.permission_id)
    
    # Check if permission is already assigned
    if "permissions" in role and permission_data.permission_id in role["permissions"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Permission is already assigned to this role"
        )
    
    # Add permission to role
    try:
        await db.roles.update_one(
            {"_id": ObjectId(role_id)},
            {
                "$push": {"permissions": permission_data.permission_id},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        # Get updated role
        updated_role = await get_role_by_id(role_id)
        updated_role = serialize_id(updated_role)
        
        # Get permissions for this role
        role_permissions = []
        if "permissions" in updated_role and updated_role["permissions"]:
            for perm_id in updated_role["permissions"]:
                try:
                    perm = await db.permissions.find_one({"_id": ObjectId(perm_id)})
                    if perm:
                        perm = serialize_id(perm)
                        role_permissions.append(perm)
                except:
                    # Skip invalid permission IDs
                    pass
        
        updated_role["permissions"] = role_permissions
        
        return updated_role
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign permission: {str(e)}"
        )

@router.delete("/roles/{role_id}/permissions/{permission_id}", response_model=RoleOut)
async def remove_permission(
    role_id: str = Path(..., description="The ID of the role"),
    permission_id: str = Path(..., description="The ID of the permission to remove"),
    admin_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    Remove a permission from a role
    """
    db = get_database()
    
    # Check if role exists
    role = await get_role_by_id(role_id)
    
    # Check if permission is assigned
    if "permissions" not in role or permission_id not in role["permissions"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Permission is not assigned to this role"
        )
    
    # Remove permission from role
    try:
        await db.roles.update_one(
            {"_id": ObjectId(role_id)},
            {
                "$pull": {"permissions": permission_id},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        # Get updated role
        updated_role = await get_role_by_id(role_id)
        updated_role = serialize_id(updated_role)
        
        # Get permissions for this role
        role_permissions = []
        if "permissions" in updated_role and updated_role["permissions"]:
            for perm_id in updated_role["permissions"]:
                try:
                    perm = await db.permissions.find_one({"_id": ObjectId(perm_id)})
                    if perm:
                        perm = serialize_id(perm)
                        role_permissions.append(perm)
                except:
                    # Skip invalid permission IDs
                    pass
        
        updated_role["permissions"] = role_permissions
        
        return updated_role
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove permission: {str(e)}"
        ) 