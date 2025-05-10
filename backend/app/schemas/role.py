from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime
from bson import ObjectId

class PermissionBase(BaseModel):
    name: str = Field(..., description="Permission name", min_length=2, max_length=100)
    description: Optional[str] = Field(None, description="Permission description")
    resource: str = Field(..., description="Resource this permission applies to")
    action: str = Field(..., description="Action allowed on the resource (e.g., read, write, delete)")
    
    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Permission name cannot be empty')
        return v.strip()

class PermissionCreate(PermissionBase):
    pass

class PermissionInDB(PermissionBase):
    id: str = Field(..., alias="_id", description="Permission ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        populate_by_name = True

class PermissionOut(PermissionBase):
    id: str = Field(..., description="Permission ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

class RoleBase(BaseModel):
    name: str = Field(..., description="Role name", min_length=2, max_length=100)
    description: Optional[str] = Field(None, description="Role description")
    is_active: bool = Field(True, description="Whether the role is active")
    
    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Role name cannot be empty')
        return v.strip()

class RoleCreate(RoleBase):
    pass

class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Role name", min_length=2, max_length=100)
    description: Optional[str] = Field(None, description="Role description")
    is_active: Optional[bool] = Field(None, description="Whether the role is active")
    
    @validator('name')
    def validate_name(cls, v):
        if v is None:
            return v
        if not v or not v.strip():
            raise ValueError('Role name cannot be empty')
        return v.strip()

class RoleInDB(RoleBase):
    id: str = Field(..., alias="_id", description="Role ID")
    permissions: List[str] = Field(default=[], description="List of permission IDs assigned to this role")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        populate_by_name = True

class RoleOut(RoleBase):
    id: str = Field(..., description="Role ID")
    permissions: List[Dict[str, Any]] = Field(default=[], description="List of permissions assigned to this role")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

class AssignPermissionRequest(BaseModel):
    permission_id: str = Field(..., description="Permission ID to assign")

class RolePaginatedResponse(BaseModel):
    items: List[RoleOut] = Field(..., description="List of roles")
    meta: Dict[str, Any] = Field(..., description="Pagination metadata") 