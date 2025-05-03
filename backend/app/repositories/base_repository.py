from typing import Dict, List, Optional, Any, TypeVar, Generic
from datetime import datetime
from bson import ObjectId

T = TypeVar('T')

class BaseRepository(Generic[T]):
    """Base repository for common database operations."""
    
    def __init__(self, db, collection_name: str):
        """Initialize the repository with database connection and collection name."""
        self.db = db
        self.collection = db[collection_name]
        self.collection_name = collection_name
    
    async def find_by_id(self, id: str) -> Optional[Dict[str, Any]]:
        """Find a document by ID."""
        return await self.collection.find_one({"_id": id})
    
    async def find_one(self, filter: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Find a document by filter."""
        return await self.collection.find_one(filter)
    
    async def find_many(self, filter: Dict[str, Any], skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Find multiple documents by filter with pagination."""
        return await self.collection.find(filter).skip(skip).limit(limit).to_list(None)
    
    async def count(self, filter: Dict[str, Any]) -> int:
        """Count documents matching a filter."""
        return await self.collection.count_documents(filter)
    
    async def create(self, data: Dict[str, Any]) -> str:
        """Insert a new document."""
        if "_id" not in data:
            data["_id"] = str(ObjectId())
        
        # Add timestamps
        now = datetime.utcnow()
        data["created_at"] = now
        data["updated_at"] = now
        
        result = await self.collection.insert_one(data)
        return data["_id"]
    
    async def update(self, id: str, data: Dict[str, Any]) -> bool:
        """Update a document by ID."""
        # Remove None values
        update_data = {k: v for k, v in data.items() if v is not None}
        
        # Add updated timestamp
        update_data["updated_at"] = datetime.utcnow()
        
        result = await self.collection.update_one(
            {"_id": id},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
    
    async def delete(self, id: str) -> bool:
        """Delete a document by ID."""
        result = await self.collection.delete_one({"_id": id})
        return result.deleted_count > 0
    
    async def ensure_indexes(self):
        """Ensure indexes are created for this collection."""
        # To be implemented by subclasses
        pass 