import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from app.db.session import get_motor_client
from app.db.collections import roles_collection
from app.schemas.roles import RoleCreateRequest, RoleResponse, RoleUpdateRequest
from app.api.register import _require_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/admin/roles/{role_id}")
async def get_role(role_id: str, current_user: dict = Depends(_require_admin_user)) -> Any:
    client = get_motor_client()
    col = roles_collection(client)
    role = await col.find_one({"_id": ObjectId(role_id)})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return RoleResponse(
        id=str(role.get("_id")),
        name=role.get("name"),
        description=role.get("description"),
        permissions=role.get("permissions", []),
        created_at=role.get("created_at"),
        updated_at=role.get("updated_at"),
    )


@router.post("/admin/roles")
async def create_role(payload: RoleCreateRequest, current_user: dict = Depends(_require_admin_user)) -> Any:
    client = get_motor_client()
    col = roles_collection(client)
    now = datetime.utcnow()
    doc = {"name": payload.name, "description": payload.description, "permissions": payload.permissions, "created_at": now, "updated_at": now}
    existing = await col.find_one({"name": payload.name})
    if existing:
        raise HTTPException(status_code=422, detail="Role with that name already exists")
    result = await col.insert_one(doc)
    return RoleResponse(id=str(result.inserted_id), name=payload.name, description=payload.description, permissions=payload.permissions, created_at=now, updated_at=now)


@router.put("/admin/roles/{role_id}")
async def update_role(role_id: str, payload: RoleUpdateRequest, current_user: dict = Depends(_require_admin_user)) -> Any:
    client = get_motor_client()
    col = roles_collection(client)
    role = await col.find_one({"_id": ObjectId(role_id)})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    update = {"updated_at": datetime.utcnow()}
    if payload.name is not None:
        update["name"] = payload.name
    if payload.description is not None:
        update["description"] = payload.description
    if payload.permissions is not None:
        update["permissions"] = payload.permissions
    await col.update_one({"_id": role["_id"]}, {"$set": update})
    updated = await col.find_one({"_id": role["_id"]})
    return RoleResponse(id=str(updated.get("_id")), name=updated.get("name"), description=updated.get("description"), permissions=updated.get("permissions", []), created_at=updated.get("created_at"), updated_at=updated.get("updated_at"))


@router.delete("/admin/roles/{role_id}")
async def delete_role(role_id: str, current_user: dict = Depends(_require_admin_user)) -> Any:
    client = get_motor_client()
    col = roles_collection(client)
    role = await col.find_one({"_id": ObjectId(role_id)})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    await col.delete_one({"_id": role["_id"]})
    return {"success": True, "deleted": str(role["_id"])}


@router.post("/admin/roles/{role_id}/permissions")
async def add_permissions(role_id: str, payload: dict, current_user: dict = Depends(_require_admin_user)) -> Any:
    perms = payload.get("permissions")
    if not isinstance(perms, list):
        raise HTTPException(status_code=422, detail="permissions must be a list")
    client = get_motor_client()
    col = roles_collection(client)
    role = await col.find_one({"_id": ObjectId(role_id)})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    new_perms = list(dict.fromkeys((role.get("permissions", []) or []) + perms))
    await col.update_one({"_id": role["_id"]}, {"$set": {"permissions": new_perms, "updated_at": datetime.utcnow()}})
    updated = await col.find_one({"_id": role["_id"]})
    return {"success": True, "role": {"id": str(updated.get("_id")), "permissions": updated.get("permissions", [])}}


@router.delete("/admin/roles/{role_id}/permissions/{permission_id}")
async def remove_permission(role_id: str, permission_id: str, current_user: dict = Depends(_require_admin_user)) -> Any:
    client = get_motor_client()
    col = roles_collection(client)
    role = await col.find_one({"_id": ObjectId(role_id)})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    perms = [p for p in (role.get("permissions") or []) if p != permission_id]
    await col.update_one({"_id": role["_id"]}, {"$set": {"permissions": perms, "updated_at": datetime.utcnow()}})
    updated = await col.find_one({"_id": role["_id"]})
    return {"success": True, "role": {"id": str(updated.get("_id")), "permissions": updated.get("permissions", [])}}
