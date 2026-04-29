from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel
from typing import List


class RoleCreateRequest(BaseModel):
    name: str
    description: str | None = None
    permissions: List[str] = []
    is_active: bool = True


class RoleUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    permissions: List[str] | None = None
    is_active: bool | None = None


class RoleResponse(BaseModel):
    id: str
    _id: str | None = None
    name: str
    description: str | None = None
    permissions: List[str]
    is_active: bool = True
    created_at: datetime | None = None
    updated_at: datetime | None = None
