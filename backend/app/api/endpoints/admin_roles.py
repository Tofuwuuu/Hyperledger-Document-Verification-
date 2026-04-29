import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from app.db.session import get_motor_client
from app.db.collections import roles_collection
from app.schemas.roles import RoleCreateRequest, RoleResponse, RoleUpdateRequest
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


async def _require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _role_object_id_or_404(role_id: str) -> ObjectId:
    try:
        return ObjectId(role_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Invalid role ID") from exc


def _serialize_role(role: dict[str, Any]) -> RoleResponse:
    object_id = str(role.get("_id"))
    permissions = role.get("permissions", []) or []
    normalized_permissions = [
        item.get("id") if isinstance(item, dict) else item
        for item in permissions
    ]
    normalized_permissions = [item for item in normalized_permissions if item]

    return RoleResponse(
        id=object_id,
        _id=object_id,
        name=role.get("name"),
        description=role.get("description"),
        permissions=normalized_permissions,
        is_active=bool(role.get("is_active", True)),
        created_at=role.get("created_at"),
        updated_at=role.get("updated_at"),
    )


@router.get("/admin/roles/{role_id}")
async def get_role(role_id: str, current_user: dict = Depends(_require_admin)) -> Any:
    client = get_motor_client()
    col = roles_collection(client)
    role = await col.find_one({"_id": _role_object_id_or_404(role_id)})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return _serialize_role(role)


@router.post("/admin/roles")
async def create_role(payload: RoleCreateRequest, current_user: dict = Depends(_require_admin)) -> Any:
    client = get_motor_client()
    col = roles_collection(client)
    now = datetime.utcnow()
    doc = {
        "name": payload.name,
        "description": payload.description,
        "permissions": payload.permissions,
        "is_active": bool(payload.is_active),
        "created_at": now,
        "updated_at": now,
    }
    existing = await col.find_one({"name": payload.name})
    if existing:
        raise HTTPException(status_code=422, detail="Role with that name already exists")
    result = await col.insert_one(doc)
    return _serialize_role({**doc, "_id": result.inserted_id})


@router.put("/admin/roles/{role_id}")
async def update_role(role_id: str, payload: RoleUpdateRequest, current_user: dict = Depends(_require_admin)) -> Any:
    client = get_motor_client()
    col = roles_collection(client)
    object_id = _role_object_id_or_404(role_id)
    role = await col.find_one({"_id": object_id})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    update = {"updated_at": datetime.utcnow()}
    if payload.name is not None:
        update["name"] = payload.name
    if payload.description is not None:
        update["description"] = payload.description
    if payload.permissions is not None:
        update["permissions"] = payload.permissions
    if payload.is_active is not None:
        update["is_active"] = bool(payload.is_active)
    await col.update_one({"_id": role["_id"]}, {"$set": update})
    updated = await col.find_one({"_id": role["_id"]})
    return _serialize_role(updated)


@router.delete("/admin/roles/{role_id}")
async def delete_role(role_id: str, current_user: dict = Depends(_require_admin)) -> Any:
    client = get_motor_client()
    col = roles_collection(client)
    role = await col.find_one({"_id": _role_object_id_or_404(role_id)})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    await col.delete_one({"_id": role["_id"]})
    return {"success": True, "deleted": str(role["_id"])}


@router.post("/admin/roles/{role_id}/permissions")
async def add_permissions(role_id: str, payload: dict, current_user: dict = Depends(_require_admin)) -> Any:
    raw_permissions = payload.get("permissions")
    if raw_permissions is None and payload.get("permission_id"):
        raw_permissions = [payload.get("permission_id")]
    if not isinstance(raw_permissions, list):
        raise HTTPException(status_code=422, detail="permissions must be a list")
    client = get_motor_client()
    col = roles_collection(client)
    role = await col.find_one({"_id": _role_object_id_or_404(role_id)})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    existing_permissions = role.get("permissions", []) or []
    existing_permissions = [
        item.get("id") if isinstance(item, dict) else item
        for item in existing_permissions
    ]
    new_perms = list(dict.fromkeys(existing_permissions + raw_permissions))
    await col.update_one({"_id": role["_id"]}, {"$set": {"permissions": new_perms, "updated_at": datetime.utcnow()}})
    updated = await col.find_one({"_id": role["_id"]})
    return {"success": True, "role": {"id": str(updated.get("_id")), "permissions": updated.get("permissions", [])}}


@router.delete("/admin/roles/{role_id}/permissions/{permission_id}")
async def remove_permission(role_id: str, permission_id: str, current_user: dict = Depends(_require_admin)) -> Any:
    client = get_motor_client()
    col = roles_collection(client)
    role = await col.find_one({"_id": _role_object_id_or_404(role_id)})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    perms = []
    for item in (role.get("permissions") or []):
        value = item.get("id") if isinstance(item, dict) else item
        if value != permission_id:
            perms.append(value)
    await col.update_one({"_id": role["_id"]}, {"$set": {"permissions": perms, "updated_at": datetime.utcnow()}})
    updated = await col.find_one({"_id": role["_id"]})
    return {"success": True, "role": {"id": str(updated.get("_id")), "permissions": updated.get("permissions", [])}}
