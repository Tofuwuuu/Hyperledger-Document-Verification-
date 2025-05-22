from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr, validator
from app.models.common import PyObjectId
from bson import ObjectId

class UserBase(BaseModel):
    """Base model with common user fields."""
    email: EmailStr
    first_name: str
    last_name: str
    is_active: bool = True

class TokenPayload(BaseModel):
    """Token payload model."""
    sub: str
    exp: int
    
class User(UserBase):
    """Model representing a user in the database."""
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    hashed_password: str
    is_admin: bool = False
    is_verified: bool = False
    has_completed_questionnaire: bool = False
    student_id: Optional[str] = None
    year_graduated: Optional[int] = None
    department: Optional[str] = None
    course: Optional[str] = None
    profile_picture: Optional[str] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, PyObjectId: str}
        
    def dict(self, **kwargs):
        """Custom dict method that handles ObjectIds properly."""
        exclude_none = kwargs.get('exclude_none', False)
        by_alias = kwargs.get('by_alias', False)
        
        # Get dictionary from parent method
        doc = super().dict(**kwargs)
        
        # Convert _id to string if it exists
        if "_id" in doc and doc["_id"] is not None:
            doc["_id"] = str(doc["_id"])
            
        # Also convert id to string if it exists
        if "id" in doc and doc["id"] is not None:
            doc["id"] = str(doc["id"])
            
        # Filter out None values if exclude_none is True
        if exclude_none:
            return {k: v for k, v in doc.items() if v is not None}
            
        return doc

class UserCreate(UserBase):
    """Model for creating a new user."""
    password: str
    student_id: Optional[str] = None
    year_graduated: Optional[int] = None
    department: Optional[str] = None
    course: Optional[str] = None
    profile_picture: Optional[str] = None

class UserUpdate(BaseModel):
    """Model for updating an existing user."""
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    student_id: Optional[str] = None
    year_graduated: Optional[int] = None
    department: Optional[str] = None
    course: Optional[str] = None
    profile_picture: Optional[str] = None

class UserInDB(User):
    """User model with hashed password."""
    is_admin: bool = False
    is_verified: bool = False
    verification_token: Optional[str] = None
    reset_token: Optional[str] = None
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, PyObjectId: str}

class Token(BaseModel):
    """Token model."""
    access_token: str
    token_type: str
    
class TokenData(BaseModel):
    """Token data model."""
    user_id: str

class UserResponse(BaseModel):
    """Model for returning user data in API responses."""
    id: str
    email: EmailStr
    first_name: str
    last_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    profile_picture: Optional[str] = None
    
    class Config:
        orm_mode = True
        json_encoders = {ObjectId: str, PyObjectId: str}
    
    @classmethod
    def from_mongo(cls, data: dict) -> "UserResponse":
        """
        Convert MongoDB document to UserResponse model.
        Handles ObjectId to string conversion explicitly.
        """
        if not data:
            return None
            
        data_copy = dict(data)
        # Convert _id to id string
        if "_id" in data_copy:
            data_copy["id"] = str(data_copy.pop("_id"))
            
        return cls(**data_copy) 