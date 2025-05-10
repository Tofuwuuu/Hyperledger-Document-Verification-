from enum import Enum
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, validator, root_validator
import re
from datetime import datetime
from bson import ObjectId


class NetworkType(str, Enum):
    """Hyperledger network types."""
    FABRIC = "fabric"
    BESU = "besu"
    SAWTOOTH = "sawtooth"
    IROHA = "iroha"


class ChaincodeLanguage(str, Enum):
    """Chaincode programming languages."""
    GOLANG = "golang"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    JAVA = "java"


class HyperledgerNetworkBase(BaseModel):
    """Base model for Hyperledger networks."""
    name: str = Field(..., min_length=1, max_length=100)
    network_type: NetworkType
    version: str = Field(..., min_length=1, max_length=20)
    connection_profile: Dict[str, Any]
    admin_username: str = Field(..., min_length=1, max_length=50)
    admin_cert_path: Optional[str] = None
    admin_key_path: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    
    @validator('version')
    def validate_version(cls, v):
        """Validate semantic version format."""
        pattern = r'^\d+\.\d+(\.\d+)?$'
        if not re.match(pattern, v):
            raise ValueError('Version must be in semantic versioning format (e.g., 2.2.0)')
        return v
    
    @validator('connection_profile')
    def validate_connection_profile(cls, v):
        """Validate connection profile is a dictionary."""
        if not isinstance(v, dict):
            raise ValueError('Connection profile must be a dictionary')
        return v
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "validate_assignment": True,
        "json_encoders": {
            ObjectId: str
        }
    }


class HyperledgerNetworkCreate(HyperledgerNetworkBase):
    """Model for creating a new Hyperledger network."""
    is_production: bool = False


class HyperledgerNetworkUpdate(BaseModel):
    """Model for updating a Hyperledger network."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    connection_profile: Optional[Dict[str, Any]] = None
    admin_username: Optional[str] = Field(None, min_length=1, max_length=50)
    admin_cert_path: Optional[str] = None
    admin_key_path: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    is_production: Optional[bool] = None
    
    @validator('connection_profile')
    def validate_connection_profile(cls, v):
        """Validate connection profile is a dictionary."""
        if v is not None and not isinstance(v, dict):
            raise ValueError('Connection profile must be a dictionary')
        return v
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "validate_assignment": True,
        "json_encoders": {
            ObjectId: str
        },
        "extra": "forbid"  # Forbid extra fields that would be ignored
    }


class HyperledgerNetworkOut(HyperledgerNetworkBase):
    """Model for Hyperledger network output/response."""
    _id: str
    is_production: bool = False
    created_at: str
    updated_at: str
    is_active: bool = True
    
    @property
    def id(self) -> str:
        """Alias for _id."""
        return self._id
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "validate_assignment": True,
        "json_encoders": {
            ObjectId: str
        }
    }


class HyperledgerChannelBase(BaseModel):
    """Base model for Hyperledger channels."""
    name: str = Field(..., min_length=1, max_length=64)
    network_id: str
    organizations: List[str] = Field(..., min_items=1)
    config_path: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    
    @validator('network_id')
    def validate_network_id(cls, v):
        """Validate network_id is a valid ObjectId."""
        if not ObjectId.is_valid(v):
            raise ValueError('Invalid network_id format')
        return v
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "validate_assignment": True,
        "json_encoders": {
            ObjectId: str
        }
    }


class HyperledgerChannelCreate(HyperledgerChannelBase):
    """Model for creating a new Hyperledger channel."""
    is_active: bool = True


class HyperledgerChannelUpdate(BaseModel):
    """Model for updating a Hyperledger channel."""
    organizations: Optional[List[str]] = Field(None, min_items=1)
    config_path: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "validate_assignment": True,
        "json_encoders": {
            ObjectId: str
        },
        "extra": "forbid"  # Forbid extra fields that would be ignored
    }


class HyperledgerChannelOut(HyperledgerChannelBase):
    """Model for Hyperledger channel output/response."""
    _id: str
    created_at: str
    updated_at: str
    is_active: bool = True
    
    @property
    def id(self) -> str:
        """Alias for _id."""
        return self._id
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "validate_assignment": True,
        "json_encoders": {
            ObjectId: str
        }
    }


class HyperledgerChaincodeBase(BaseModel):
    """Base model for Hyperledger chaincode."""
    name: str = Field(..., min_length=1, max_length=100)
    version: str = Field(..., min_length=1, max_length=20)
    channel_id: str
    language: ChaincodeLanguage
    path: Optional[str] = None
    init_required: bool = False
    metadata: Optional[Dict[str, Any]] = None
    
    @validator('version')
    def validate_version(cls, v):
        """Validate semantic version format."""
        pattern = r'^\d+\.\d+(\.\d+)?$'
        if not re.match(pattern, v):
            raise ValueError('Version must be in semantic versioning format (e.g., 1.0.0)')
        return v
    
    @validator('channel_id')
    def validate_channel_id(cls, v):
        """Validate channel_id is a valid ObjectId."""
        if not ObjectId.is_valid(v):
            raise ValueError('Invalid channel_id format')
        return v
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "validate_assignment": True,
        "json_encoders": {
            ObjectId: str
        }
    }


class HyperledgerChaincodeCreate(HyperledgerChaincodeBase):
    """Model for creating a new Hyperledger chaincode."""
    package_id: Optional[str] = None


class HyperledgerChaincodeUpdate(BaseModel):
    """Model for updating a Hyperledger chaincode."""
    version: Optional[str] = Field(None, min_length=1, max_length=20)
    path: Optional[str] = None
    init_required: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None
    package_id: Optional[str] = None
    
    @validator('version')
    def validate_version(cls, v):
        """Validate semantic version format."""
        if v is not None:
            pattern = r'^\d+\.\d+(\.\d+)?$'
            if not re.match(pattern, v):
                raise ValueError('Version must be in semantic versioning format (e.g., 1.0.0)')
        return v
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "validate_assignment": True,
        "json_encoders": {
            ObjectId: str
        },
        "extra": "forbid"  # Forbid extra fields that would be ignored
    }


class HyperledgerChaincodeOut(HyperledgerChaincodeBase):
    """Model for Hyperledger chaincode output/response."""
    _id: str
    package_id: Optional[str] = None
    created_at: str
    updated_at: str
    is_active: bool = True
    
    @property
    def id(self) -> str:
        """Alias for _id."""
        return self._id
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "validate_assignment": True,
        "json_encoders": {
            ObjectId: str
        }
    } 