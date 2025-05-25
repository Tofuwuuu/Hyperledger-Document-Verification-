# Re-export job schemas from job.py for backwards compatibility
from app.schemas.job import (
    JobBase,
    JobCreate,
    JobUpdate,
    JobInDB,
    JobResponse,
    JobStatus,
    JobSkill,
    JobApplicantBase,
    JobApplicantCreate,
    JobApplicantUpdate,
    JobApplicantInDB,
    JobApplicantResponse
) 