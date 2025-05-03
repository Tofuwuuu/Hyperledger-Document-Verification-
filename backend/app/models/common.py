from typing import Any, Optional
from pydantic import BaseModel, Field
from bson import ObjectId
from bson.errors import InvalidId

class PyObjectId(ObjectId):
    """Custom type for handling MongoDB ObjectIDs with Pydantic."""
    
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if v is None:
            return None
            
        if isinstance(v, ObjectId):
            return v
            
        if isinstance(v, str):
            try:
                return ObjectId(v)
            except (InvalidId, TypeError):
                raise ValueError(f'"{v}" is not a valid ObjectId')
                
        if isinstance(v, PyObjectId):
            return v
            
        raise TypeError('ObjectId required')
    
    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")
    
    # Basic string conversion
    def __str__(self):
        return str(super().__str__())
    
    # Representation for debugging
    def __repr__(self):
        return f"PyObjectId({super().__repr__()})"
    
    # Allow compatibility with dict handling
    def __eq__(self, other):
        if isinstance(other, (ObjectId, PyObjectId, str)):
            return str(self) == str(other)
        return False
    
    # For JSON serialization
    def __hash__(self):
        return hash(str(self))
    
    # For Pydantic serialization
    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")
    
    # For JSON encoding
    def json(self):
        return str(self)
    
    # For dictionary conversion
    def dict(self):
        return str(self)
