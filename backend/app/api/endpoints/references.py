from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/references/courses")
async def get_reference_courses() -> dict:
    courses = [
        {"id": "bsit", "code": "BSIT", "name": "Bachelor of Science in Information Technology"},
        {"id": "bscs", "code": "BSCS", "name": "Bachelor of Science in Computer Science"},
        {"id": "bscpe", "code": "BSCpE", "name": "Bachelor of Science in Computer Engineering"},
        {"id": "bsba", "code": "BSBA", "name": "Bachelor of Science in Business Administration"},
        {"id": "bsed", "code": "BSED", "name": "Bachelor of Secondary Education"},
    ]
    return {"items": courses, "total": len(courses)}
