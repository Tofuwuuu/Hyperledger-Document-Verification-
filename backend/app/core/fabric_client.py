"""
Mock Hyperledger Fabric Client implementation.

This module provides a mock client for when the fabric-sdk-py package is unavailable.
"""

import os
import json
import logging
import asyncio
import base64
from typing import Dict, List, Optional, Any, Union, Tuple, cast
from pathlib import Path
import tempfile

# Create a mock implementation instead of importing hfc
logger = logging.getLogger(__name__)
logger.warning("Using mock Fabric client implementation")

class MockFileSystemWallet:
    """Mock implementation of wallet"""
    def __init__(self, path: str):
        self.path = path
        logger.info(f"Initialized mock wallet at {path}")

    async def exists(self, identity_name: str) -> bool:
        """Check if identity exists"""
        return False

    async def get(self, identity_name: str) -> Optional[Dict]:
        """Get identity"""
        return None

    async def put(self, identity_name: str, identity: Dict) -> None:
        """Store identity"""
        pass

class Identity:
    """Mock identity implementation"""
    def __init__(self, name: str, msp_id: str, certificate: str, private_key: str):
        self.name = name
        self.msp_id = msp_id
        self.certificate = certificate
        self.private_key = private_key

def identity_to_user(identity: Identity) -> Dict:
    """Convert identity to user dict"""
    return {
        "name": identity.name,
        "mspid": identity.msp_id,
        "cert": identity.certificate,
        "private_key": identity.private_key
    }

class FabricSDKClient:
    """
    A mock client for interacting with Hyperledger Fabric networks when SDK is unavailable.
    """
    
    def __init__(self, 
                 org_name: str,
                 wallet_path: str = None,
                 channel_name: Optional[str] = None):
        """
        Initialize the mock Fabric client.
        
        Args:
            org_name: The organization name to use for this client
            wallet_path: Path to the wallet directory (optional)
            channel_name: Default channel name (optional)
        """
        # Initialize the mock client
        logger.warning("Using mock Fabric client - no actual blockchain operations will be performed")
        self.org_name = org_name
        self.channel_name = channel_name
        
        # Set up a mock wallet
        if wallet_path:
            self.wallet = MockFileSystemWallet(wallet_path)
        else:
            temp_dir = tempfile.mkdtemp()
            self.wallet = MockFileSystemWallet(temp_dir)
            logger.info(f"Created temporary mock wallet at {temp_dir}")
    
    @staticmethod
    def from_connection_profile(profile_path: str, 
                               org_name: str,
                               wallet_path: Optional[str] = None,
                               channel_name: Optional[str] = None) -> 'FabricSDKClient':
        """
        Create a mock client from a connection profile.
        
        Args:
            profile_path: Path to the connection profile JSON file
            org_name: Organization name to use
            wallet_path: Path to the wallet directory (optional)
            channel_name: Default channel name (optional)
            
        Returns:
            A mock FabricSDKClient instance
        """
        client = FabricSDKClient(org_name, wallet_path, channel_name)
        logger.info(f"Created mock Fabric client from profile {profile_path}")
        return client
    
    def set_network_config(self, network_config: Dict) -> None:
        """
        Configure the mock client with a network configuration.
        
        Args:
            network_config: Network configuration dictionary
        """
        logger.info(f"Mock: Set network configuration for {self.org_name}")
    
    def set_user_context(self, identity: Identity) -> None:
        """
        Set the user context for the mock client.
        
        Args:
            identity: The identity to use
        """
        logger.info(f"Mock: Set user context to {identity.name}")
    
    async def query_installed_chaincodes(self, peer_name: str) -> Dict:
        """
        Mock query for installed chaincodes on a peer.
        
        Args:
            peer_name: The name of the peer to query
            
        Returns:
            Empty dictionary for mock implementation
        """
        logger.info(f"Mock: Query installed chaincodes on peer {peer_name}")
        return {"chaincodes": []}
    
    async def query_instantiated_chaincodes(self, channel_name: Optional[str] = None) -> Dict:
        """
        Mock query for instantiated chaincodes on a channel.
        
        Args:
            channel_name: Channel name (uses default if not specified)
            
        Returns:
            Empty dictionary for mock implementation
        """
        channel = channel_name or self.channel_name
        logger.info(f"Mock: Query instantiated chaincodes on channel {channel}")
        return {"chaincodes": []}
    
    async def invoke_chaincode(self, 
                              chaincode_name: str, 
                              channel_name: Optional[str], 
                              fcn: str, 
                              args: List[str],
                              transient_map: Optional[Dict] = None) -> Dict:
        """
        Mock invoke a chaincode function.
        
        Args:
            chaincode_name: Name of the chaincode
            channel_name: Channel name (uses default if not specified)
            fcn: Function name to invoke
            args: List of arguments for the function
            transient_map: Transient data (optional)
            
        Returns:
            Mock success response
        """
        channel = channel_name or self.channel_name
        if not channel:
            raise ValueError("Channel name must be provided")
            
        logger.info(f"Mock: Invoke chaincode {chaincode_name} on channel {channel}, function {fcn} with args {args}")
        
        return {
            'transaction_id': f"mock_tx_{chaincode_name}_{fcn}",
            'status': 'SUCCESS'
        }
    
    async def query_chaincode(self, 
                             chaincode_name: str, 
                             channel_name: Optional[str], 
                             fcn: str, 
                             args: List[str],
                             transient_map: Optional[Dict] = None) -> Dict:
        """
        Mock query a chaincode function.
        
        Args:
            chaincode_name: Name of the chaincode
            channel_name: Channel name (uses default if not specified)
            fcn: Function name to query
            args: List of arguments for the function
            transient_map: Transient data (optional)
            
        Returns:
            Mock query response
        """
        channel = channel_name or self.channel_name
        if not channel:
            raise ValueError("Channel name must be provided")
            
        logger.info(f"Mock: Query chaincode {chaincode_name} on channel {channel}, function {fcn} with args {args}")
        
        # Return a mock response based on the function name
        if fcn == "GetDocumentByID":
            doc_id = args[0] if args else "unknown"
            return {
                "id": doc_id,
                "type": "certificate",
                "owner": "mock_owner",
                "status": "verified",
                "timestamp": "2023-01-01T00:00:00Z",
                "hash": "mock_hash_value"
            }
        elif fcn == "QueryDocuments":
            return {
                "documents": [
                    {
                        "id": "mock_doc_1",
                        "type": "certificate",
                        "owner": "mock_owner",
                        "status": "verified",
                        "timestamp": "2023-01-01T00:00:00Z"
                    }
                ]
            }
        else:
            return {"result": "mock_response"}

    async def create_channel(self, 
                            channel_name: str, 
                            orderer_name: str,
                            channel_config_path: str) -> Dict:
        """
        Mock create a new channel.
        
        Args:
            channel_name: Name of the channel to create
            orderer_name: Name of the orderer to use
            channel_config_path: Path to the channel configuration file
            
        Returns:
            Mock success response
        """
        logger.info(f"Mock: Create channel {channel_name} using orderer {orderer_name}")
        return {"status": "SUCCESS", "info": "Mock channel creation"}

    async def join_channel(self, 
                          channel_name: str, 
                          peers: List[str]) -> Dict:
        """
        Mock join peers to a channel.
        
        Args:
            channel_name: Name of the channel to join
            peers: List of peers to join the channel
            
        Returns:
            Mock success response
        """
        logger.info(f"Mock: Join peers {peers} to channel {channel_name}")
        return {"status": "SUCCESS", "info": "Mock channel join"}

    async def install_chaincode(self,
                                peers: List[str],
                                cc_path: str,
                                cc_name: str,
                                cc_version: str) -> Dict:
        """
        Mock install chaincode on peers.
        
        Args:
            peers: List of peers to install the chaincode on
            cc_path: Path to the chaincode
            cc_name: Name of the chaincode
            cc_version: Version of the chaincode
            
        Returns:
            Mock success response
        """
        logger.info(f"Mock: Install chaincode {cc_name} v{cc_version} on peers {peers}")
        return {"status": "SUCCESS", "info": "Mock chaincode installation"}

    async def instantiate_chaincode(self,
                                    channel_name: str,
                                    cc_name: str,
                                    cc_version: str,
                                    fcn: str = 'init',
                                    args: List[str] = None,
                                    cc_policy: Dict = None) -> Dict:
        """
        Mock instantiate chaincode on a channel.
        
        Args:
            channel_name: Name of the channel
            cc_name: Name of the chaincode
            cc_version: Version of the chaincode
            fcn: Function to call for initialization
            args: Arguments for the initialization function
            cc_policy: Endorsement policy
            
        Returns:
            Mock success response
        """
        logger.info(f"Mock: Instantiate chaincode {cc_name} v{cc_version} on channel {channel_name}")
        return {"status": "SUCCESS", "info": "Mock chaincode instantiation"}

    async def upgrade_chaincode(self,
                               channel_name: str,
                               cc_name: str,
                               cc_version: str,
                               fcn: str = 'init',
                               args: List[str] = None,
                               cc_policy: Dict = None) -> Dict:
        """
        Mock upgrade chaincode on a channel.
        
        Args:
            channel_name: Name of the channel
            cc_name: Name of the chaincode
            cc_version: Version of the chaincode
            fcn: Function to call for initialization
            args: Arguments for the initialization function
            cc_policy: Endorsement policy
            
        Returns:
            Mock success response
        """
        logger.info(f"Mock: Upgrade chaincode {cc_name} to v{cc_version} on channel {channel_name}")
        return {"status": "SUCCESS", "info": "Mock chaincode upgrade"}

    async def get_channel_info(self, channel_name: str) -> Dict:
        """
        Mock get information about a channel.
        
        Args:
            channel_name: Name of the channel
            
        Returns:
            Mock channel information
        """
        logger.info(f"Mock: Get channel info for {channel_name}")
        return {
            "height": 10,
            "currentBlockHash": "mock_hash",
            "previousBlockHash": "mock_prev_hash"
        }

    async def get_block(self, channel_name: str, block_number: Union[int, str]) -> Dict:
        """
        Mock get a block from the channel.
        
        Args:
            channel_name: Name of the channel
            block_number: Block number to retrieve
            
        Returns:
            Mock block data
        """
        logger.info(f"Mock: Get block {block_number} from channel {channel_name}")
        return {
            "header": {
                "number": str(block_number),
                "previous_hash": "mock_prev_hash",
                "data_hash": "mock_data_hash"
            },
            "data": {
                "data": ["mock_transaction_1", "mock_transaction_2"]
            },
            "metadata": {
                "metadata": ["mock_metadata_1", "mock_metadata_2"]
            }
        }

    async def get_transaction(self, channel_name: str, tx_id: str) -> Dict:
        """
        Mock get a transaction from the channel.
        
        Args:
            channel_name: Name of the channel
            tx_id: Transaction ID to retrieve
            
        Returns:
            Mock transaction data
        """
        logger.info(f"Mock: Get transaction {tx_id} from channel {channel_name}")
        return {
            "transaction_id": tx_id,
            "timestamp": "2023-01-01T00:00:00Z",
            "channel_id": channel_name,
            "type": "TRANSACTION",
            "status": "VALID"
        } 