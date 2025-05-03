from typing import List, Dict, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
from pydantic import BaseModel, Field

from ...services.fabric_service import FabricService
from ...core.fabric_wallet import Identity
from ...config.database import get_database
from ...core.config import settings
from ..deps import get_fabric_service

router = APIRouter()

# Schema models for request/response validation
class ConnectionProfileModel(BaseModel):
    path: str = Field(..., description="Path to the connection profile JSON file")
    organization: str = Field(..., description="Organization name to use")
    identity: str = Field(..., description="Identity name to use")
    channel: Optional[str] = Field(None, description="Default channel name")

class QueryChaincodeRequest(BaseModel):
    chaincode_id: str = Field(..., description="ID of the chaincode to query")
    function_name: str = Field(..., description="Name of the function to call")
    args: List[str] = Field(default=[], description="Arguments for the function")
    channel_name: Optional[str] = Field(None, description="Channel name (uses default if not provided)")
    org_name: Optional[str] = Field(None, description="Organization name to use")
    identity_name: Optional[str] = Field(None, description="Identity name to use")

class InvokeChaincodeRequest(BaseModel):
    chaincode_id: str = Field(..., description="ID of the chaincode to invoke")
    function_name: str = Field(..., description="Name of the function to call")
    args: List[str] = Field(default=[], description="Arguments for the function")
    channel_name: Optional[str] = Field(None, description="Channel name (uses default if not provided)")
    transient_data: Optional[Dict[str, str]] = Field(None, description="Transient data (private data)")
    org_name: Optional[str] = Field(None, description="Organization name to use")
    identity_name: Optional[str] = Field(None, description="Identity name to use")

class ChannelOperationRequest(BaseModel):
    channel_name: str = Field(..., description="Name of the channel")
    orderer_name: str = Field(..., description="Name of the orderer to use")
    config_path: str = Field(..., description="Path to the channel configuration file")
    org_name: Optional[str] = Field(None, description="Organization name to use")
    identity_name: Optional[str] = Field(None, description="Identity name to use")

class JoinChannelRequest(BaseModel):
    channel_name: str = Field(..., description="Name of the channel to join")
    peers: List[str] = Field(..., description="List of peer names to join to the channel")
    org_name: Optional[str] = Field(None, description="Organization name to use")
    identity_name: Optional[str] = Field(None, description="Identity name to use")

class InstallChaincodeRequest(BaseModel):
    cc_path: str = Field(..., description="Path to the chaincode directory")
    cc_name: str = Field(..., description="Name of the chaincode")
    cc_version: str = Field(..., description="Version of the chaincode")
    peers: List[str] = Field(..., description="List of peer names to install the chaincode on")
    org_name: Optional[str] = Field(None, description="Organization name to use")
    identity_name: Optional[str] = Field(None, description="Identity name to use")

class ChaincodePolicyModel(BaseModel):
    identities: List[Dict[str, Any]] = Field(..., description="Identity list for the policy")
    policy: Dict[str, Any] = Field(..., description="Policy definition")

class InstantiateChaincodeRequest(BaseModel):
    channel_name: str = Field(..., description="Name of the channel")
    cc_name: str = Field(..., description="Name of the chaincode")
    cc_version: str = Field(..., description="Version of the chaincode")
    function_name: str = Field(default="init", description="Name of the initialization function")
    args: List[str] = Field(default=[], description="Arguments for the initialization function")
    cc_policy: Optional[ChaincodePolicyModel] = Field(None, description="Endorsement policy")
    org_name: Optional[str] = Field(None, description="Organization name to use")
    identity_name: Optional[str] = Field(None, description="Identity name to use")

class EnrollRequest(BaseModel):
    ca_url: str = Field(..., description="URL of the CA server")
    ca_name: str = Field(..., description="Name of the CA")
    enrollment_id: str = Field(..., description="Enrollment ID")
    enrollment_secret: str = Field(..., description="Enrollment secret")
    msp_id: str = Field(..., description="MSP ID of the organization")
    ca_cert_path: Optional[str] = Field(None, description="Path to the CA certificate file")

class RegisterUserRequest(BaseModel):
    ca_url: str = Field(..., description="URL of the CA server")
    ca_name: str = Field(..., description="Name of the CA")
    admin_identity_name: str = Field(..., description="Name of the admin identity to use for registration")
    user_id: str = Field(..., description="ID for the new user")
    user_secret: str = Field(..., description="Secret for the new user")
    user_affiliation: str = Field(..., description="Affiliation for the new user")
    user_attrs: Optional[Dict[str, str]] = Field(None, description="Optional attributes for the user")
    ca_cert_path: Optional[str] = Field(None, description="Path to the CA certificate file")

class IdentityModel(BaseModel):
    name: str
    msp_id: str

class ApiResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

@router.post("/initialize", response_model=ApiResponse)
async def initialize_fabric_client(
    connection_profile: ConnectionProfileModel,
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Initialize a Fabric client with a connection profile.
    """
    try:
        client = await fabric_service.initialize_client(
            connection_profile_path=connection_profile.path,
            org_name=connection_profile.organization,
            identity_name=connection_profile.identity,
            channel_name=connection_profile.channel
        )
        
        return {
            "success": True,
            "message": f"Client initialized for {connection_profile.organization}:{connection_profile.identity}",
            "data": {
                "organization": connection_profile.organization,
                "identity": connection_profile.identity,
                "channel": connection_profile.channel
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize client: {str(e)}"
        )

@router.post("/query", response_model=ApiResponse)
async def query_chaincode(
    request: QueryChaincodeRequest,
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Query a chaincode function (read-only transaction).
    """
    result = await fabric_service.query_chaincode(
        chaincode_id=request.chaincode_id,
        function_name=request.function_name,
        args=request.args,
        channel_name=request.channel_name,
        org_name=request.org_name,
        identity_name=request.identity_name
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to query chaincode")
        )
    
    return {
        "success": True,
        "data": {
            "result": result.get("result", {})
        }
    }

@router.post("/invoke", response_model=ApiResponse)
async def invoke_chaincode(
    request: InvokeChaincodeRequest,
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Invoke a chaincode function (write transaction).
    """
    # Convert string transient data to bytes if provided
    transient_bytes = None
    if request.transient_data:
        transient_bytes = {k: v.encode() for k, v in request.transient_data.items()}
    
    result = await fabric_service.invoke_chaincode(
        chaincode_id=request.chaincode_id,
        function_name=request.function_name,
        args=request.args,
        channel_name=request.channel_name,
        transient_data=transient_bytes,
        org_name=request.org_name,
        identity_name=request.identity_name
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to invoke chaincode")
        )
    
    return {
        "success": True,
        "data": {
            "transaction_id": result.get("transaction_id", ""),
            "status": result.get("status", "")
        }
    }

@router.post("/channels", response_model=ApiResponse)
async def create_channel(
    request: ChannelOperationRequest,
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Create a new channel.
    """
    result = await fabric_service.create_channel(
        channel_name=request.channel_name,
        orderer_name=request.orderer_name,
        channel_config_path=request.config_path,
        org_name=request.org_name,
        identity_name=request.identity_name
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to create channel")
        )
    
    return {
        "success": True,
        "message": f"Channel {request.channel_name} created successfully",
        "data": {
            "channel_name": request.channel_name,
            "status": result.get("status", "")
        }
    }

@router.post("/channels/join", response_model=ApiResponse)
async def join_channel(
    request: JoinChannelRequest,
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Join peers to a channel.
    """
    result = await fabric_service.join_channel(
        channel_name=request.channel_name,
        peers=request.peers,
        org_name=request.org_name,
        identity_name=request.identity_name
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to join channel")
        )
    
    return {
        "success": True,
        "message": f"Joined channel {request.channel_name}",
        "data": {
            "channel_name": request.channel_name,
            "joined_peers": result.get("joined_peers", []),
            "failed_peers": result.get("failed_peers", []),
            "status": result.get("status", "")
        }
    }

@router.post("/chaincodes/install", response_model=ApiResponse)
async def install_chaincode(
    request: InstallChaincodeRequest,
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Install chaincode on peers.
    """
    result = await fabric_service.install_chaincode(
        cc_path=request.cc_path,
        cc_name=request.cc_name,
        cc_version=request.cc_version,
        peers=request.peers,
        org_name=request.org_name,
        identity_name=request.identity_name
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to install chaincode")
        )
    
    return {
        "success": True,
        "message": f"Chaincode {request.cc_name} v{request.cc_version} installed",
        "data": {
            "chaincode": {
                "name": request.cc_name,
                "version": request.cc_version
            },
            "successful_peers": result.get("successful_peers", []),
            "failed_peers": result.get("failed_peers", []),
            "status": result.get("status", "")
        }
    }

@router.post("/chaincodes/instantiate", response_model=ApiResponse)
async def instantiate_chaincode(
    request: InstantiateChaincodeRequest,
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Instantiate chaincode on a channel.
    """
    result = await fabric_service.instantiate_chaincode(
        channel_name=request.channel_name,
        cc_name=request.cc_name,
        cc_version=request.cc_version,
        function_name=request.function_name,
        args=request.args,
        cc_policy=request.cc_policy.dict() if request.cc_policy else None,
        org_name=request.org_name,
        identity_name=request.identity_name
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to instantiate chaincode")
        )
    
    return {
        "success": True,
        "message": f"Chaincode {request.cc_name} v{request.cc_version} instantiated on channel {request.channel_name}",
        "data": {
            "chaincode": result.get("chaincode", {}),
            "status": result.get("status", "")
        }
    }

@router.post("/chaincodes/upgrade", response_model=ApiResponse)
async def upgrade_chaincode(
    request: InstantiateChaincodeRequest,
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Upgrade chaincode on a channel.
    """
    result = await fabric_service.upgrade_chaincode(
        channel_name=request.channel_name,
        cc_name=request.cc_name,
        cc_version=request.cc_version,
        function_name=request.function_name,
        args=request.args,
        cc_policy=request.cc_policy.dict() if request.cc_policy else None,
        org_name=request.org_name,
        identity_name=request.identity_name
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to upgrade chaincode")
        )
    
    return {
        "success": True,
        "message": f"Chaincode {request.cc_name} upgraded to v{request.cc_version} on channel {request.channel_name}",
        "data": {
            "chaincode": result.get("chaincode", {}),
            "status": result.get("status", "")
        }
    }

@router.get("/channels/{channel_name}", response_model=ApiResponse)
async def get_channel_info(
    channel_name: str = Path(..., description="Name of the channel"),
    org_name: Optional[str] = Query(None, description="Organization name to use"),
    identity_name: Optional[str] = Query(None, description="Identity name to use"),
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Get information about a channel.
    """
    result = await fabric_service.get_channel_info(
        channel_name=channel_name,
        org_name=org_name,
        identity_name=identity_name
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to get channel info")
        )
    
    return {
        "success": True,
        "data": {
            "channel_name": channel_name,
            "height": result.get("height"),
            "current_block_hash": result.get("current_block_hash"),
            "previous_block_hash": result.get("previous_block_hash")
        }
    }

@router.get("/channels/{channel_name}/blocks/{block_id}", response_model=ApiResponse)
async def get_block(
    channel_name: str = Path(..., description="Name of the channel"),
    block_id: str = Path(..., description="Block number or hash"),
    org_name: Optional[str] = Query(None, description="Organization name to use"),
    identity_name: Optional[str] = Query(None, description="Identity name to use"),
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Get information about a block.
    """
    # Convert block_id to int if it's a number
    try:
        block_identifier = int(block_id)
    except ValueError:
        block_identifier = block_id
    
    result = await fabric_service.get_block(
        channel_name=channel_name,
        block_identifier=block_identifier,
        org_name=org_name,
        identity_name=identity_name
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to get block")
        )
    
    return {
        "success": True,
        "data": {
            "channel_name": channel_name,
            "header": result.get("header", {}),
            "data": result.get("data", {})
        }
    }

@router.get("/channels/{channel_name}/transactions/{tx_id}", response_model=ApiResponse)
async def get_transaction(
    channel_name: str = Path(..., description="Name of the channel"),
    tx_id: str = Path(..., description="Transaction ID"),
    org_name: Optional[str] = Query(None, description="Organization name to use"),
    identity_name: Optional[str] = Query(None, description="Identity name to use"),
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Get information about a transaction.
    """
    result = await fabric_service.get_transaction(
        channel_name=channel_name,
        tx_id=tx_id,
        org_name=org_name,
        identity_name=identity_name
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to get transaction")
        )
    
    return {
        "success": True,
        "data": {
            "channel_name": channel_name,
            "transaction_id": tx_id,
            "channel_id": result.get("channel_id"),
            "timestamp": result.get("timestamp"),
            "type": result.get("type")
        }
    }

@router.post("/enroll/admin", response_model=ApiResponse)
async def enroll_admin(
    request: EnrollRequest,
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Enroll admin user with Fabric CA.
    """
    result = await fabric_service.enroll_admin(
        ca_url=request.ca_url,
        ca_name=request.ca_name,
        enrollment_id=request.enrollment_id,
        enrollment_secret=request.enrollment_secret,
        msp_id=request.msp_id,
        ca_cert_path=request.ca_cert_path
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to enroll admin")
        )
    
    return {
        "success": True,
        "message": f"Admin {request.enrollment_id} enrolled successfully",
        "data": {
            "identity": result.get("identity", {})
        }
    }

@router.post("/register/user", response_model=ApiResponse)
async def register_user(
    request: RegisterUserRequest,
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Register a new user with Fabric CA.
    """
    result = await fabric_service.register_user(
        ca_url=request.ca_url,
        ca_name=request.ca_name,
        admin_identity_name=request.admin_identity_name,
        user_id=request.user_id,
        user_secret=request.user_secret,
        user_affiliation=request.user_affiliation,
        user_attrs=request.user_attrs,
        ca_cert_path=request.ca_cert_path
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to register user")
        )
    
    return {
        "success": True,
        "message": f"User {request.user_id} registered successfully",
        "data": {
            "user_id": request.user_id
        }
    }

@router.post("/enroll/user", response_model=ApiResponse)
async def enroll_user(
    request: EnrollRequest,
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Enroll a registered user with Fabric CA.
    """
    result = await fabric_service.enroll_user(
        ca_url=request.ca_url,
        ca_name=request.ca_name,
        enrollment_id=request.enrollment_id,
        enrollment_secret=request.enrollment_secret,
        msp_id=request.msp_id,
        ca_cert_path=request.ca_cert_path
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to enroll user")
        )
    
    return {
        "success": True,
        "message": f"User {request.enrollment_id} enrolled successfully",
        "data": {
            "identity": result.get("identity", {})
        }
    }

@router.get("/identities", response_model=ApiResponse)
async def get_identities(
    fabric_service: FabricService = Depends(get_fabric_service)
):
    """
    Get all identities in the wallet.
    """
    identities = fabric_service.get_identities()
    
    return {
        "success": True,
        "data": {
            "identities": identities
        }
    } 