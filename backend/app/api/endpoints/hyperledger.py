from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from fastapi.responses import JSONResponse

from app.services.hyperledger_service import hyperledger_service
from app.schemas.hyperledger import (
    HyperledgerNetworkCreate,
    HyperledgerNetworkUpdate,
    HyperledgerNetworkOut,
    HyperledgerChannelCreate,
    HyperledgerChannelUpdate,
    HyperledgerChannelOut,
    HyperledgerChaincodeCreate,
    HyperledgerChaincodeUpdate,
    HyperledgerChaincodeOut,
    NetworkType
)
from app.utils.auth import get_admin_user

# Create router
router = APIRouter(
    prefix="/hyperledger",
    tags=["hyperledger"],
    responses={404: {"description": "Not found"}}
)

# Network endpoints

@router.post("/networks", response_model=HyperledgerNetworkOut, status_code=201)
async def create_network(
    network: HyperledgerNetworkCreate,
    admin=Depends(get_admin_user)
):
    """
    Create a new Hyperledger network configuration.
    
    Admin access required.
    """
    try:
        created_network = await hyperledger_service.create_network(network)
        return created_network
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/networks", response_model=List[HyperledgerNetworkOut])
async def list_networks(
    active_only: bool = True,
    network_type: Optional[NetworkType] = None
):
    """
    List all Hyperledger networks with optional filtering.
    """
    networks = await hyperledger_service.list_networks(active_only, network_type)
    return networks

@router.get("/networks/{network_id}", response_model=HyperledgerNetworkOut)
async def get_network(
    network_id: str = Path(..., title="The ID of the network to get")
):
    """
    Get a specific Hyperledger network by ID.
    """
    network = await hyperledger_service.get_network(network_id)
    if not network:
        raise HTTPException(status_code=404, detail="Network not found")
    return network

@router.put("/networks/{network_id}", response_model=HyperledgerNetworkOut)
async def update_network(
    update_data: HyperledgerNetworkUpdate,
    network_id: str = Path(..., title="The ID of the network to update"),
    admin=Depends(get_admin_user)
):
    """
    Update a Hyperledger network configuration.
    
    Admin access required.
    """
    updated_network = await hyperledger_service.update_network(network_id, update_data)
    if not updated_network:
        raise HTTPException(status_code=404, detail="Network not found")
    return updated_network

@router.delete("/networks/{network_id}", response_model=dict)
async def delete_network(
    network_id: str = Path(..., title="The ID of the network to delete"),
    admin=Depends(get_admin_user)
):
    """
    Delete (deactivate) a Hyperledger network.
    
    Admin access required.
    """
    success = await hyperledger_service.delete_network(network_id)
    if not success:
        raise HTTPException(status_code=404, detail="Network not found")
    return {"success": True, "message": "Network deleted successfully"}

# Channel endpoints

@router.post("/channels", response_model=HyperledgerChannelOut, status_code=201)
async def create_channel(
    channel: HyperledgerChannelCreate,
    admin=Depends(get_admin_user)
):
    """
    Create a new Hyperledger channel configuration.
    
    Admin access required.
    """
    try:
        # Verify the network exists
        network = await hyperledger_service.get_network(channel.network_id)
        if not network:
            raise HTTPException(status_code=404, detail="Network not found")
        
        created_channel = await hyperledger_service.create_channel(channel)
        return created_channel
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/channels", response_model=List[HyperledgerChannelOut])
async def list_channels(
    network_id: str = Query(..., title="ID of the network to list channels for"),
    active_only: bool = True
):
    """
    List all channels for a specific network.
    """
    # Verify the network exists
    network = await hyperledger_service.get_network(network_id)
    if not network:
        raise HTTPException(status_code=404, detail="Network not found")
    
    channels = await hyperledger_service.list_channels(network_id, active_only)
    return channels

@router.get("/channels/{channel_id}", response_model=HyperledgerChannelOut)
async def get_channel(
    channel_id: str = Path(..., title="The ID of the channel to get")
):
    """
    Get a specific Hyperledger channel by ID.
    """
    channel = await hyperledger_service.get_channel(channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    return channel

@router.put("/channels/{channel_id}", response_model=HyperledgerChannelOut)
async def update_channel(
    update_data: HyperledgerChannelUpdate,
    channel_id: str = Path(..., title="The ID of the channel to update"),
    admin=Depends(get_admin_user)
):
    """
    Update a Hyperledger channel configuration.
    
    Admin access required.
    """
    updated_channel = await hyperledger_service.update_channel(channel_id, update_data)
    if not updated_channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    return updated_channel

@router.delete("/channels/{channel_id}", response_model=dict)
async def delete_channel(
    channel_id: str = Path(..., title="The ID of the channel to delete"),
    admin=Depends(get_admin_user)
):
    """
    Delete (deactivate) a Hyperledger channel.
    
    Admin access required.
    """
    success = await hyperledger_service.delete_channel(channel_id)
    if not success:
        raise HTTPException(status_code=404, detail="Channel not found")
    return {"success": True, "message": "Channel deleted successfully"}

# Chaincode endpoints

@router.post("/chaincodes", response_model=HyperledgerChaincodeOut, status_code=201)
async def create_chaincode(
    chaincode: HyperledgerChaincodeCreate,
    admin=Depends(get_admin_user)
):
    """
    Create a new Hyperledger chaincode configuration.
    
    Admin access required.
    """
    try:
        # Verify the channel exists
        channel = await hyperledger_service.get_channel(chaincode.channel_id)
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")
        
        created_chaincode = await hyperledger_service.create_chaincode(chaincode)
        return created_chaincode
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/chaincodes", response_model=List[HyperledgerChaincodeOut])
async def list_chaincodes(
    channel_id: str = Query(..., title="ID of the channel to list chaincodes for"),
    active_only: bool = True
):
    """
    List all chaincodes for a specific channel.
    """
    # Verify the channel exists
    channel = await hyperledger_service.get_channel(channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    chaincodes = await hyperledger_service.list_chaincodes(channel_id, active_only)
    return chaincodes

@router.get("/chaincodes/{chaincode_id}", response_model=HyperledgerChaincodeOut)
async def get_chaincode(
    chaincode_id: str = Path(..., title="The ID of the chaincode to get")
):
    """
    Get a specific Hyperledger chaincode by ID.
    """
    chaincode = await hyperledger_service.get_chaincode(chaincode_id)
    if not chaincode:
        raise HTTPException(status_code=404, detail="Chaincode not found")
    return chaincode

@router.put("/chaincodes/{chaincode_id}", response_model=HyperledgerChaincodeOut)
async def update_chaincode(
    update_data: HyperledgerChaincodeUpdate,
    chaincode_id: str = Path(..., title="The ID of the chaincode to update"),
    admin=Depends(get_admin_user)
):
    """
    Update a Hyperledger chaincode configuration.
    
    Admin access required.
    """
    updated_chaincode = await hyperledger_service.update_chaincode(chaincode_id, update_data)
    if not updated_chaincode:
        raise HTTPException(status_code=404, detail="Chaincode not found")
    return updated_chaincode

@router.delete("/chaincodes/{chaincode_id}", response_model=dict)
async def delete_chaincode(
    chaincode_id: str = Path(..., title="The ID of the chaincode to delete"),
    admin=Depends(get_admin_user)
):
    """
    Delete (deactivate) a Hyperledger chaincode.
    
    Admin access required.
    """
    success = await hyperledger_service.delete_chaincode(chaincode_id)
    if not success:
        raise HTTPException(status_code=404, detail="Chaincode not found")
    return {"success": True, "message": "Chaincode deleted successfully"}

# Chaincode interaction endpoints

@router.post("/invoke", response_model=dict)
async def invoke_chaincode(
    network_id: str,
    channel_name: str,
    chaincode_name: str,
    function_name: str,
    args: List[str],
    admin=Depends(get_admin_user)
):
    """
    Invoke a function on a chaincode in a Hyperledger Fabric network.
    
    This endpoint submits a transaction that will update the ledger.
    Admin access required.
    """
    try:
        result = await hyperledger_service.invoke_chaincode(
            network_id,
            channel_name,
            chaincode_name,
            function_name,
            args
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chaincode invocation failed: {str(e)}")

@router.post("/query", response_model=dict)
async def query_chaincode(
    network_id: str,
    channel_name: str,
    chaincode_name: str,
    function_name: str,
    args: List[str]
):
    """
    Query a function on a chaincode in a Hyperledger Fabric network.
    
    This endpoint performs a read-only operation and does not update the ledger.
    """
    try:
        result = await hyperledger_service.query_chaincode(
            network_id,
            channel_name,
            chaincode_name,
            function_name,
            args
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chaincode query failed: {str(e)}") 