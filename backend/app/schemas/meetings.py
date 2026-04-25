from __future__ import annotations

from pydantic import BaseModel
from typing import List


class MeetingCreateRequest(BaseModel):
    event_id: str | None = None
    title: str
    description: str | None = None
    starts_at: str
    ends_at: str | None = None
    location: str | None = None
    capacity: int | None = None


class MeetingResponse(BaseModel):
    id: str
    event_id: str | None
    title: str
    description: str | None
    starts_at: str
    ends_at: str | None
    location: str | None
    capacity: int | None
    created_at: str | None
