import os
import json
import logging
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from bson import ObjectId

from app.config.database import get_database
from app.clients.fabric_client import FabricClient
from app.config.fabric_config import (
    load_connection_profile,
    get_admin_identity,
    DEFAULT_CHANNEL
)
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

# Set up logging
logger = logging.getLogger(__name__)


class HyperledgerService:
    """Service for interacting with Hyperledger networks."""
    
    def __init__(self, db=None):
        """Initialize the service with database instance."""
        self.db = db
        self.fabric_clients = {}  # Cache for Fabric clients
    
    async def init_db(self):
        """Initialize database if it wasn't provided at instantiation."""
        if not self.db:
            db_generator = get_database()
            self.db = await db_generator.__anext__()
    
    # Network Management
    
    async def create_network(self, network: HyperledgerNetworkCreate) -> HyperledgerNetworkOut:
        """Create a new Hyperledger network configuration."""
        await self.init_db()
        
        # Convert to dictionary and add timestamps
        network_dict = network.dict()
        now = datetime.utcnow().isoformat()
        network_dict["created_at"] = now
        network_dict["updated_at"] = now
        network_dict["is_active"] = True
        
        # Insert into database
        result = await self.db.hyperledger_networks.insert_one(network_dict)
        
        # Get the created network
        created_network = await self.db.hyperledger_networks.find_one({"_id": result.inserted_id})
        
        # Convert ObjectId to string in _id field
        created_network["_id"] = str(created_network["_id"])
        
        return HyperledgerNetworkOut(**created_network)
    
    async def get_network(self, network_id: str) -> Optional[HyperledgerNetworkOut]:
        """Get a Hyperledger network by ID."""
        await self.init_db()
        
        # Convert string ID to ObjectId
        oid = ObjectId(network_id)
        
        # Find network
        network = await self.db.hyperledger_networks.find_one({"_id": oid})
        
        if network:
            # Convert ObjectId to string
            network["_id"] = str(network["_id"])
            return HyperledgerNetworkOut(**network)
        
        return None
    
    async def update_network(self, network_id: str, update_data: HyperledgerNetworkUpdate) -> Optional[HyperledgerNetworkOut]:
        """Update a Hyperledger network configuration."""
        await self.init_db()
        
        # Convert string ID to ObjectId
        oid = ObjectId(network_id)
        
        # Convert to dictionary, remove None values, and add updated timestamp
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        update_dict["updated_at"] = datetime.utcnow().isoformat()
        
        # Update in database
        result = await self.db.hyperledger_networks.update_one(
            {"_id": oid},
            {"$set": update_dict}
        )
        
        if result.modified_count:
            # Get the updated network
            updated_network = await self.db.hyperledger_networks.find_one({"_id": oid})
            
            # Convert ObjectId to string
            updated_network["_id"] = str(updated_network["_id"])
            
            return HyperledgerNetworkOut(**updated_network)
        
        return None
    
    async def list_networks(self, active_only: bool = True, network_type: Optional[NetworkType] = None) -> List[HyperledgerNetworkOut]:
        """List all Hyperledger networks, optionally filtered."""
        await self.init_db()
        
        # Build filter
        filter_dict = {}
        if active_only:
            filter_dict["is_active"] = True
        if network_type:
            filter_dict["network_type"] = network_type.value
        
        # Get networks
        networks = []
        async for network in self.db.hyperledger_networks.find(filter_dict):
            # Convert ObjectId to string
            network["_id"] = str(network["_id"])
            networks.append(HyperledgerNetworkOut(**network))
        
        return networks
    
    async def delete_network(self, network_id: str) -> bool:
        """Soft delete a Hyperledger network by setting is_active to False."""
        await self.init_db()
        
        # Convert string ID to ObjectId
        oid = ObjectId(network_id)
        
        # Update is_active flag and updated_at timestamp
        result = await self.db.hyperledger_networks.update_one(
            {"_id": oid},
            {
                "$set": {
                    "is_active": False,
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )
        
        return result.modified_count > 0
    
    # Channel Management
    
    async def create_channel(self, channel: HyperledgerChannelCreate) -> HyperledgerChannelOut:
        """Create a new Hyperledger channel configuration."""
        await self.init_db()
        
        # Convert to dictionary and add timestamps
        channel_dict = channel.dict()
        now = datetime.utcnow().isoformat()
        channel_dict["created_at"] = now
        channel_dict["updated_at"] = now
        
        # Insert into database
        result = await self.db.hyperledger_channels.insert_one(channel_dict)
        
        # Get the created channel
        created_channel = await self.db.hyperledger_channels.find_one({"_id": result.inserted_id})
        
        # Convert ObjectId to string
        created_channel["_id"] = str(created_channel["_id"])
        
        return HyperledgerChannelOut(**created_channel)
    
    async def get_channel(self, channel_id: str) -> Optional[HyperledgerChannelOut]:
        """Get a Hyperledger channel by ID."""
        await self.init_db()
        
        # Convert string ID to ObjectId
        oid = ObjectId(channel_id)
        
        # Find channel
        channel = await self.db.hyperledger_channels.find_one({"_id": oid})
        
        if channel:
            # Convert ObjectId to string
            channel["_id"] = str(channel["_id"])
            return HyperledgerChannelOut(**channel)
        
        return None
    
    async def update_channel(self, channel_id: str, update_data: HyperledgerChannelUpdate) -> Optional[HyperledgerChannelOut]:
        """Update a Hyperledger channel configuration."""
        await self.init_db()
        
        # Convert string ID to ObjectId
        oid = ObjectId(channel_id)
        
        # Convert to dictionary, remove None values, and add updated timestamp
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        update_dict["updated_at"] = datetime.utcnow().isoformat()
        
        # Update in database
        result = await self.db.hyperledger_channels.update_one(
            {"_id": oid},
            {"$set": update_dict}
        )
        
        if result.modified_count:
            # Get the updated channel
            updated_channel = await self.db.hyperledger_channels.find_one({"_id": oid})
            
            # Convert ObjectId to string
            updated_channel["_id"] = str(updated_channel["_id"])
            
            return HyperledgerChannelOut(**updated_channel)
        
        return None
    
    async def list_channels(self, network_id: str, active_only: bool = True) -> List[HyperledgerChannelOut]:
        """List all channels for a specific network."""
        await self.init_db()
        
        # Build filter
        filter_dict = {"network_id": network_id}
        if active_only:
            filter_dict["is_active"] = True
        
        # Get channels
        channels = []
        async for channel in self.db.hyperledger_channels.find(filter_dict):
            # Convert ObjectId to string
            channel["_id"] = str(channel["_id"])
            channels.append(HyperledgerChannelOut(**channel))
        
        return channels
    
    async def delete_channel(self, channel_id: str) -> bool:
        """Soft delete a Hyperledger channel by setting is_active to False."""
        await self.init_db()
        
        # Convert string ID to ObjectId
        oid = ObjectId(channel_id)
        
        # Update is_active flag and updated_at timestamp
        result = await self.db.hyperledger_channels.update_one(
            {"_id": oid},
            {
                "$set": {
                    "is_active": False,
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )
        
        return result.modified_count > 0
    
    # Chaincode Management
    
    async def create_chaincode(self, chaincode: HyperledgerChaincodeCreate) -> HyperledgerChaincodeOut:
        """Create a new Hyperledger chaincode configuration."""
        await self.init_db()
        
        # Convert to dictionary and add timestamps
        chaincode_dict = chaincode.dict()
        now = datetime.utcnow().isoformat()
        chaincode_dict["created_at"] = now
        chaincode_dict["updated_at"] = now
        chaincode_dict["is_active"] = True
        
        # Insert into database
        result = await self.db.hyperledger_chaincodes.insert_one(chaincode_dict)
        
        # Get the created chaincode
        created_chaincode = await self.db.hyperledger_chaincodes.find_one({"_id": result.inserted_id})
        
        # Convert ObjectId to string
        created_chaincode["_id"] = str(created_chaincode["_id"])
        
        return HyperledgerChaincodeOut(**created_chaincode)
    
    async def get_chaincode(self, chaincode_id: str) -> Optional[HyperledgerChaincodeOut]:
        """Get a Hyperledger chaincode by ID."""
        await self.init_db()
        
        # Convert string ID to ObjectId
        oid = ObjectId(chaincode_id)
        
        # Find chaincode
        chaincode = await self.db.hyperledger_chaincodes.find_one({"_id": oid})
        
        if chaincode:
            # Convert ObjectId to string
            chaincode["_id"] = str(chaincode["_id"])
            return HyperledgerChaincodeOut(**chaincode)
        
        return None
    
    async def update_chaincode(self, chaincode_id: str, update_data: HyperledgerChaincodeUpdate) -> Optional[HyperledgerChaincodeOut]:
        """Update a Hyperledger chaincode configuration."""
        await self.init_db()
        
        # Convert string ID to ObjectId
        oid = ObjectId(chaincode_id)
        
        # Convert to dictionary, remove None values, and add updated timestamp
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        update_dict["updated_at"] = datetime.utcnow().isoformat()
        
        # Update in database
        result = await self.db.hyperledger_chaincodes.update_one(
            {"_id": oid},
            {"$set": update_dict}
        )
        
        if result.modified_count:
            # Get the updated chaincode
            updated_chaincode = await self.db.hyperledger_chaincodes.find_one({"_id": oid})
            
            # Convert ObjectId to string
            updated_chaincode["_id"] = str(updated_chaincode["_id"])
            
            return HyperledgerChaincodeOut(**updated_chaincode)
        
        return None
    
    async def list_chaincodes(self, channel_id: str, active_only: bool = True) -> List[HyperledgerChaincodeOut]:
        """List all chaincodes for a specific channel."""
        await self.init_db()
        
        # Build filter
        filter_dict = {"channel_id": channel_id}
        if active_only:
            filter_dict["is_active"] = True
        
        # Get chaincodes
        chaincodes = []
        async for chaincode in self.db.hyperledger_chaincodes.find(filter_dict):
            # Convert ObjectId to string
            chaincode["_id"] = str(chaincode["_id"])
            chaincodes.append(HyperledgerChaincodeOut(**chaincode))
        
        return chaincodes
    
    async def delete_chaincode(self, chaincode_id: str) -> bool:
        """Soft delete a Hyperledger chaincode by setting is_active to False."""
        await self.init_db()
        
        # Convert string ID to ObjectId
        oid = ObjectId(chaincode_id)
        
        # Update is_active flag and updated_at timestamp
        result = await self.db.hyperledger_chaincodes.update_one(
            {"_id": oid},
            {
                "$set": {
                    "is_active": False,
                    "updated_at": datetime.utcnow().isoformat()
                }
            }
        )
        
        return result.modified_count > 0
    
    # Hyperledger Fabric Operations
    
    def _get_fabric_client(self, network_id: str) -> FabricClient:
        """
        Get or create a Fabric client for the specified network.
        
        Args:
            network_id: ID of the network to connect to
            
        Returns:
            FabricClient instance
        """
        # Check if we already have a client for this network
        if network_id in self.fabric_clients:
            return self.fabric_clients[network_id]
        
        # For now, we'll use the default connection profile
        connection_profile = load_connection_profile()
        if not connection_profile:
            raise ValueError("No connection profile configured")
        
        # Get admin identity
        identity = get_admin_identity()
        if not identity:
            raise ValueError("No admin identity configured")
        
        # Create a new client
        client = FabricClient(
            connection_profile_path=connection_profile,
            identity_type="admin",
            msp_id=identity.get("msp_id"),
            cert_path=identity.get("cert_path"),
            key_path=identity.get("key_path"),
            channel_name=DEFAULT_CHANNEL
        )
        
        # Connect to the network
        success = client.connect()
        if not success:
            raise ValueError("Failed to connect to Fabric network")
        
        # Cache the client
        self.fabric_clients[network_id] = client
        
        return client
    
    async def invoke_chaincode(
        self, 
        network_id: str, 
        channel_name: str, 
        chaincode_name: str, 
        function_name: str, 
        args: List[str]
    ) -> Dict[str, Any]:
        """Invoke a chaincode function on a Hyperledger Fabric network."""
        # Get network configuration
        network = await self.get_network(network_id)
        if not network or network.network_type != NetworkType.FABRIC:
            raise ValueError("Invalid network ID or network is not a Fabric network")
        
        try:
            # Get a Fabric client
            client = self._get_fabric_client(network_id)
            
            # Invoke the chaincode
            result = client.invoke_chaincode(
                chaincode_id=chaincode_name,
                function_name=function_name,
                args=args,
                channel_name=channel_name
            )
            
            # Add timestamp and transaction info
            result["timestamp"] = datetime.utcnow().isoformat()
            
            # Store transaction in database if successful
            if result.get("success", False) and "transactionId" in result:
                # Record the transaction
                transaction = {
                    "network_id": network_id,
                    "channel_name": channel_name,
                    "chaincode_name": chaincode_name,
                    "function_name": function_name,
                    "args": args,
                    "transaction_id": result["transactionId"],
                    "timestamp": result["timestamp"],
                    "status": "SUBMITTED"  # Initial status
                }
                
                await self.init_db()
                await self.db.hyperledger_transactions.insert_one(transaction)
            
            return result
        
        except Exception as e:
            logger.error(f"Error invoking chaincode: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def query_chaincode(
        self, 
        network_id: str, 
        channel_name: str, 
        chaincode_name: str, 
        function_name: str, 
        args: List[str]
    ) -> Dict[str, Any]:
        """Query a chaincode function on a Hyperledger Fabric network."""
        # Get network configuration
        network = await self.get_network(network_id)
        if not network or network.network_type != NetworkType.FABRIC:
            raise ValueError("Invalid network ID or network is not a Fabric network")
        
        try:
            # Get a Fabric client
            client = self._get_fabric_client(network_id)
            
            # Query the chaincode
            result = client.query_chaincode(
                chaincode_id=chaincode_name,
                function_name=function_name,
                args=args,
                channel_name=channel_name
            )
            
            # Add timestamp
            result["timestamp"] = datetime.utcnow().isoformat()
            
            return result
        
        except Exception as e:
            logger.error(f"Error querying chaincode: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    def close_connections(self):
        """Close all Fabric client connections."""
        for client in self.fabric_clients.values():
            client.close()
        self.fabric_clients = {}


# Create a singleton instance
hyperledger_service = HyperledgerService() 