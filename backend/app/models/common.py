from typing import Any, Optional, ClassVar
from typing_extensions import Annotated
from pydantic import BaseModel, Field, GetJsonSchemaHandler
from bson import ObjectId
from bson.errors import InvalidId
import json
from pydantic_core import core_schema

class PyObjectId(ObjectId):
    """Custom type for handling MongoDB ObjectIDs with Pydantic."""
    
    # For Pydantic v2 compatibility
    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        return core_schema.union_schema([
            core_schema.is_instance_schema(ObjectId),
            core_schema.chain_schema([
                core_schema.str_schema(),
                core_schema.no_info_plain_validator_function(cls.validate),
            ]),
            core_schema.is_instance_schema(cls),
        ])
    
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
    
    # For JSON schema generation
    @classmethod
    def __get_pydantic_json_schema__(cls, schema, field):
        schema.update(type="string")
        return schema
    
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
    
    # For JSON encoding
    def json(self):
        return str(self)
    
    # For dictionary conversion
    def dict(self):
        return str(self)
