from fastapi import APIRouter, HTTPException, status
from typing import List

router = APIRouter(
    prefix="/references",
    tags=["references"]
)

# List of CVSU courses
CVSU_COURSES = [
    "Bachelor of Science in Information Technology",
    "Bachelor of Science in Computer Science",
    "Bachelor of Science in Accountancy",
    "Bachelor of Science in Accounting Information System",
    "Bachelor of Science in Management Accounting",
    "Bachelor of Science in Business Administration",
    "Bachelor of Science in Business Management",
    "Bachelor of Science in Entrepreneurship",
    "Bachelor of Secondary Education",
    "Bachelor of Elementary Education",
    "Bachelor of Technology and Livelihood Education",
    "Bachelor of Science in Hospitality Management",
    "Bachelor of Science in Tourism Management",
    "Bachelor of Science in Psychology",
    "Bachelor of Arts in Communication",
    "Bachelor of Industrial Technology",
    "Bachelor of Technical-Vocational Teacher Education",
    "Bachelor of Science in Agriculture",
    "Bachelor of Science in Development Communication",
    "Bachelor of Science in Agricultural and Biosystems Engineering",
    "Bachelor of Science in Environmental Science",
    "Bachelor of Science in Nursing",
    "Bachelor of Science in Criminology"
]

@router.get("/courses", response_model=List[str])
async def get_cvsu_courses():
    """
    Get a list of all courses offered at Cavite State University
    """
    return CVSU_COURSES 