from typing import Dict, List, Optional, Any
from app.repositories.base_repository import BaseRepository
from app.schemas.document import VerificationStatus, DocumentType

class DocumentRepository(BaseRepository):
    """Repository for document operations."""
    
    def __init__(self, db):
        """Initialize with database connection."""
        super().__init__(db, "documents")
    
    async def ensure_indexes(self):
        """Create indexes for document collection."""
        await self.collection.create_index("alumni_id")
        await self.collection.create_index("file_hash")
        await self.collection.create_index("verification_status")
        await self.collection.create_index([("alumni_id", 1), ("document_type", 1)])
    
    async def find_by_alumni_id(self, alumni_id: str) -> List[Dict[str, Any]]:
        """Find all documents for an alumni."""
        return await self.find_many({"alumni_id": alumni_id})
    
    async def find_by_file_hash(self, file_hash: str) -> Optional[Dict[str, Any]]:
        """Find a document by its file hash."""
        return await self.find_one({"file_hash": file_hash})
    
    async def find_pending_documents(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Find pending documents awaiting verification."""
        return await self.find_many(
            {"verification_status": VerificationStatus.PENDING.value},
            limit=limit
        )
    
    async def update_verification_status(self, document_id: str, status: VerificationStatus, 
                                         admin_id: str, admin_notes: Optional[str] = None,
                                         blockchain_tx_id: Optional[str] = None) -> bool:
        """Update the verification status of a document."""
        from datetime import datetime
        
        update_data = {
            "verification_status": status.value,
            "verified_by": admin_id,
            "verification_date": datetime.utcnow(),
            "admin_notes": admin_notes
        }
        
        if blockchain_tx_id:
            update_data["blockchain_tx_id"] = blockchain_tx_id
        
        return await self.update(document_id, update_data)
    
    async def search_documents(self, alumni_id: Optional[str] = None, 
                              document_type: Optional[DocumentType] = None,
                              verification_status: Optional[VerificationStatus] = None,
                              skip: int = 0, limit: int = 10) -> Dict[str, Any]:
        """Search documents with filters and pagination."""
        # Build query
        query = {}
        
        if alumni_id:
            query["alumni_id"] = alumni_id
        
        if document_type:
            query["document_type"] = document_type.value
        
        if verification_status:
            query["verification_status"] = verification_status.value
        
        # Get total count for pagination
        total = await self.count(query)
        
        # Get documents with pagination
        documents = await self.find_many(query, skip=skip, limit=limit)
        
        return {
            "results": documents,
            "total": total,
            "limit": limit,
            "offset": skip
        } 