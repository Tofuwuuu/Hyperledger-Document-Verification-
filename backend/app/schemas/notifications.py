from __future__ import annotations

from pydantic import BaseModel
from typing import Any, Dict


class NotificationCreateRequest(BaseModel):
    user_id: str | None = None
    title: str
    body: str
    type: str | None = None
    metadata: Dict[str, Any] | None = None


class NotificationResponse(BaseModel):
    id: str
    user_id: str | None
    title: str
    body: str
    type: str | None = None
    read: bool = False
    created_at: str | None = None
