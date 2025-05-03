from typing import Dict, Any

from app.config.database import get_database
from app.repositories.document_repository import DocumentRepository

# Cache of repository instances
_repositories = {}

async def get_document_repository() -> DocumentRepository:
    """Get the document repository instance."""
    global _repositories
    
    if "documents" not in _repositories:
        db = get_database()
        _repositories["documents"] = DocumentRepository(db)
        # Ensure indexes are created
        await _repositories["documents"].ensure_indexes()
    
    return _repositories["documents"]

# Add more repository getters as needed:
# async def get_user_repository() -> UserRepository:
#     ...
# 
# async def get_alumni_repository() -> AlumniRepository:
#     ...
#
# etc. 