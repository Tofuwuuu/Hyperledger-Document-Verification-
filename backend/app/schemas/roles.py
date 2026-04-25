from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel
from typing import List


class RoleCreateRequest(BaseModel):
    name: str
    description: str | None = None
    permissions: List[str] = []


class RoleUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    permissions: List[str] | None = None


class RoleResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    permissions: List[str]
    created_at: datetime | None = None
    updated_at: datetime | None = None
