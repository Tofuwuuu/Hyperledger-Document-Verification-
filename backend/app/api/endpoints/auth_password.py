from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
import bcrypt

from app.schemas.auth import ChangePasswordRequest, ChangePasswordResponse
from app.db.session import get_motor_client
from app.db.collections import users_collection
from app.api.register import get_current_user
from app.utils.mongo_ids import find_one_by_id

router = APIRouter()


@router.post("/auth/change-password")
async def change_password(payload: ChangePasswordRequest, current_user: dict = Depends(get_current_user)) -> ChangePasswordResponse:
    client = get_motor_client()
    col = users_collection(client)
    user_id = current_user.get("sub")
    user = await find_one_by_id(col, str(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    stored = user.get("password_hash") or user.get("hashed_password")
    if not stored:
        raise HTTPException(status_code=403, detail="Account password is not set.")
    try:
        if not bcrypt.checkpw(payload.current_password.encode("utf-8"), str(stored).encode("utf-8")):
            raise HTTPException(status_code=403, detail="Incorrect current password")
    except ValueError:
        raise HTTPException(status_code=403, detail="Incorrect current password")
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=422, detail="Passwords do not match")
    new_hash = bcrypt.hashpw(payload.new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    await col.update_one({"_id": user["_id"]}, {"$set": {"password_hash": new_hash, "updated_at": datetime.utcnow()}})
    return {"success": True, "message": "Password changed"}
