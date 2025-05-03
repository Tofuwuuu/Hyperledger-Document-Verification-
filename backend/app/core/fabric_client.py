"""
Hyperledger Fabric Client implementation using the fabric-sdk-py package.

This module provides a client for interacting with a Hyperledger Fabric network.
"""

import os
import json
import logging
import asyncio
import base64
from typing import Dict, List, Optional, Any, Union, Tuple, cast
from pathlib import Path
import tempfile

import hfc
from hfc.fabric import Client as HLFClient
from hfc.fabric.peer import Peer
from hfc.fabric.orderer import Orderer
from hfc.fabric.user import User, create_user
# Modify the ecies import to handle missing module
try:
    from hfc.util.crypto import ecies
except ImportError:
    # Create a mock ecies class/module if needed
    class MockEcies:
        def __init__(self):
            pass
            
        # Add any required methods with mock implementations
        # For example:
        def encrypt(self, *args, **kwargs):
            logger.warning("Using mock encrypt method")
            return b"mock_encrypted_data"
            
        def decrypt(self, *args, **kwargs):
            logger.warning("Using mock decrypt method")
            return b"mock_decrypted_data"
    
    ecies = MockEcies()
    logging.warning("Using mock implementation of ecies module")

from hfc.fabric.transaction.tx_context import create_tx_context, TXContext
from hfc.fabric.transaction.tx_proposal_request import create_tx_prop_req, CC_TYPE_GOLANG, CC_INSTANTIATE, CC_UPGRADE, TXProposalRequest
from hfc.util.utils import build_tx_req, send_transaction

from .fabric_wallet import FileSystemWallet, Identity, identity_to_user
from ..config.fabric_config import (
    CONFIG_DIR,
    NETWORKS_DIR,
    USERS_DIR,
    DEFAULT_CHANNEL
)

logger = logging.getLogger(__name__)

class FabricSDKClient:
    """
    A client for interacting with Hyperledger Fabric networks using the hfc library.
    """
    
    def __init__(self, 
                 org_name: str,
                 wallet_path: str = None,
                 channel_name: Optional[str] = None):
        """
        Initialize the Fabric client.
        
        Args:
            org_name: The organization name to use for this client
            wallet_path: Path to the wallet directory (optional)
            channel_name: Default channel name (optional)
        """
        # Initialize the Hyperledger Fabric SDK client
        self.client = HLFClient()
        self.org_name = org_name
        self.channel_name = channel_name
        
        # Set up a wallet if provided
        if wallet_path:
            self.wallet = FileSystemWallet(wallet_path)
        else:
            temp_dir = tempfile.mkdtemp()
            self.wallet = FileSystemWallet(temp_dir)
            logger.info(f"Created temporary wallet at {temp_dir}")
            
        # Maintain a temp directory list for cleanup
        self._temp_files = []
    
    def __del__(self):
        """Cleanup temporary files when the client is destroyed."""
        for temp_file in self._temp_files:
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                    logger.debug(f"Removed temporary file: {temp_file}")
                except Exception as e:
                    logger.error(f"Failed to remove temporary file {temp_file}: {e}")
    
    @staticmethod
    def from_connection_profile(profile_path: str, 
                               org_name: str,
                               wallet_path: Optional[str] = None,
                               channel_name: Optional[str] = None) -> 'FabricSDKClient':
        """
        Create a client from a connection profile.
        
        Args:
            profile_path: Path to the connection profile JSON file
            org_name: Organization name to use
            wallet_path: Path to the wallet directory (optional)
            channel_name: Default channel name (optional)
            
        Returns:
            A configured FabricSDKClient instance
        """
        client = FabricSDKClient(org_name, wallet_path, channel_name)
        
        with open(profile_path, 'r') as f:
            network_profile = json.load(f)
        
        client.set_network_config(network_profile)
        return client
    
    def set_network_config(self, network_config: Dict) -> None:
        """
        Configure the client with a network configuration.
        
        Args:
            network_config: Network configuration dictionary
        """
        # Create a temporary file for the network config
        fd, path = tempfile.mkstemp(suffix='.json')
        self._temp_files.append(path)
        
        with os.fdopen(fd, 'w') as f:
            json.dump(network_config, f)
        
        # Set the network configuration in the client
        self.client.network_info.load_from_config(path)
        logger.info(f"Loaded network configuration for {self.org_name}")
    
    def set_user_context(self, identity: Identity) -> None:
        """
        Set the user context for the client.
        
        Args:
            identity: The identity to use
        """
        user = create_user(
            name=identity.name,
            org=self.org_name,
            state_store=self.client.state_store,
            msp_id=identity.msp_id,
            cert=identity.certificate,
            private_key=identity.private_key
        )
        
        self.client.user_context = user
        logger.info(f"Set user context to {identity.name}")
    
    async def query_installed_chaincodes(self, peer_name: str) -> Dict:
        """
        Query for installed chaincodes on a peer.
        
        Args:
            peer_name: The name of the peer to query
            
        Returns:
            Dictionary containing installed chaincodes
        """
        responses = await self.client.query_installed_chaincodes(
            requestor=self.client.user_context,
            peers=[peer_name],
        )
        
        if not responses or not responses[0].response:
            logger.error(f"Failed to query installed chaincodes on peer {peer_name}")
            return {}
            
        return responses[0].response
    
    async def query_instantiated_chaincodes(self, channel_name: Optional[str] = None) -> Dict:
        """
        Query for instantiated chaincodes on a channel.
        
        Args:
            channel_name: Channel name (uses default if not specified)
            
        Returns:
            Dictionary containing instantiated chaincodes
        """
        channel = channel_name or self.channel_name
        if not channel:
            raise ValueError("Channel name must be provided")
            
        responses = await self.client.query_instantiated_chaincodes(
            requestor=self.client.user_context,
            channel_name=channel,
        )
        
        if not responses or not responses.response:
            logger.error(f"Failed to query instantiated chaincodes on channel {channel}")
            return {}
            
        return responses.response
    
    async def invoke_chaincode(self, 
                              chaincode_name: str, 
                              channel_name: Optional[str], 
                              fcn: str, 
                              args: List[str],
                              transient_map: Optional[Dict] = None) -> Dict:
        """
        Invoke a chaincode function.
        
        Args:
            chaincode_name: Name of the chaincode
            channel_name: Channel name (uses default if not specified)
            fcn: Function name to invoke
            args: List of arguments for the function
            transient_map: Transient data (optional)
            
        Returns:
            Response from the chaincode invocation
        """
        channel = channel_name or self.channel_name
        if not channel:
            raise ValueError("Channel name must be provided")
            
        # Convert string args to bytes if needed
        byte_args = [arg.encode() if isinstance(arg, str) else arg for arg in args]
            
        responses = await self.client.chaincode_invoke(
            requestor=self.client.user_context,
            channel_name=channel,
            peers=['peer0.org1.example.com'],  # TODO: Make configurable
            args=byte_args,
            cc_name=chaincode_name,
            fcn=fcn,
            transient_map=transient_map,
            wait_for_event=True
        )
        
        return {
            'transaction_id': responses[0],
            'status': 'SUCCESS'
        }
    
    async def query_chaincode(self, 
                             chaincode_name: str, 
                             channel_name: Optional[str], 
                             fcn: str, 
                             args: List[str],
                             transient_map: Optional[Dict] = None) -> Dict:
        """
        Query a chaincode function.
        
        Args:
            chaincode_name: Name of the chaincode
            channel_name: Channel name (uses default if not specified)
            fcn: Function name to query
            args: List of arguments for the function
            transient_map: Transient data (optional)
            
        Returns:
            Response from the chaincode query
        """
        channel = channel_name or self.channel_name
        if not channel:
            raise ValueError("Channel name must be provided")
            
        # Convert string args to bytes if needed
        byte_args = [arg.encode() if isinstance(arg, str) else arg for arg in args]
            
        responses = await self.client.chaincode_query(
            requestor=self.client.user_context,
            channel_name=channel,
            peers=['peer0.org1.example.com'],  # TODO: Make configurable
            args=byte_args,
            cc_name=chaincode_name,
            fcn=fcn,
            transient_map=transient_map
        )
        
        # Parse the response
        if isinstance(responses, bytes):
            try:
                return json.loads(responses.decode('utf-8'))
            except json.JSONDecodeError:
                return {'result': responses.decode('utf-8')}
        
        return {'result': responses}
    
    async def create_channel(self, 
                            channel_name: str, 
                            orderer_name: str,
                            channel_config_path: str) -> Dict:
        """
        Create a new channel.
        
        Args:
            channel_name: Name of the channel to create
            orderer_name: Name of the orderer to use
            channel_config_path: Path to the channel configuration file
            
        Returns:
            Response from the create channel operation
        """
        response = await self.client.channel_create(
            orderer=orderer_name,
            channel_name=channel_name,
            requestor=self.client.user_context,
            config_yaml=channel_config_path,
            channel_profile='TwoOrgsChannel'  # TODO: Make configurable
        )
        
        if response:
            logger.info(f"Channel {channel_name} created successfully")
            return {'status': 'SUCCESS', 'channel_name': channel_name}
        else:
            logger.error(f"Failed to create channel {channel_name}")
            return {'status': 'FAILURE', 'channel_name': channel_name}
    
    async def join_channel(self, 
                          channel_name: str, 
                          peers: List[str]) -> Dict:
        """
        Join peers to a channel.
        
        Args:
            channel_name: Name of the channel to join
            peers: List of peer names to join the channel
            
        Returns:
            Response from the join channel operation
        """
        responses = await self.client.channel_join(
            requestor=self.client.user_context,
            channel_name=channel_name,
            peers=peers,
            orderer='orderer.example.com'  # TODO: Make configurable
        )
        
        success_peers = []
        failed_peers = []
        
        for peer_name, response in zip(peers, responses):
            if response:
                success_peers.append(peer_name)
            else:
                failed_peers.append(peer_name)
                
        return {
            'status': 'SUCCESS' if not failed_peers else 'PARTIAL',
            'joined_peers': success_peers,
            'failed_peers': failed_peers
        }
    
    async def install_chaincode(self,
                                peers: List[str],
                                cc_path: str,
                                cc_name: str,
                                cc_version: str) -> Dict:
        """
        Install chaincode on peers.
        
        Args:
            peers: List of peer names to install the chaincode on
            cc_path: Path to the chaincode directory
            cc_name: Name of the chaincode
            cc_version: Version of the chaincode
            
        Returns:
            Response from the install chaincode operation
        """
        responses = await self.client.chaincode_install(
            requestor=self.client.user_context,
            peers=peers,
            cc_path=cc_path,
            cc_name=cc_name,
            cc_version=cc_version
        )
        
        success_peers = []
        failed_peers = []
        
        for peer_name, response in zip(peers, responses):
            if response[0].response and response[0].response.status == 200:
                success_peers.append(peer_name)
            else:
                failed_peers.append(peer_name)
                
        return {
            'status': 'SUCCESS' if not failed_peers else 'PARTIAL',
            'chaincode': {
                'name': cc_name,
                'version': cc_version,
            },
            'successful_peers': success_peers,
            'failed_peers': failed_peers
        }
    
    async def instantiate_chaincode(self,
                                    channel_name: str,
                                    cc_name: str,
                                    cc_version: str,
                                    fcn: str = 'init',
                                    args: List[str] = None,
                                    cc_policy: Dict = None) -> Dict:
        """
        Instantiate chaincode on a channel.
        
        Args:
            channel_name: Channel name
            cc_name: Name of the chaincode
            cc_version: Version of the chaincode
            fcn: Initialization function (default 'init')
            args: List of arguments for the function
            cc_policy: Endorsement policy
            
        Returns:
            Response from the instantiate chaincode operation
        """
        args = args or []
        byte_args = [arg.encode() if isinstance(arg, str) else arg for arg in args]
        
        policy = cc_policy or {'identities': [
                {'role': {'name': 'member', 'mspId': 'Org1MSP'}},
                {'role': {'name': 'member', 'mspId': 'Org2MSP'}}
            ], 
            'policy': {'1-of': [{'signed-by': 0}, {'signed-by': 1}]}}
            
        response = await self.client.chaincode_instantiate(
            requestor=self.client.user_context,
            channel_name=channel_name,
            peers=['peer0.org1.example.com'],  # TODO: Make configurable
            cc_name=cc_name,
            cc_version=cc_version,
            fcn=fcn,
            args=byte_args,
            cc_endorsement_policy=policy
        )
        
        if response and response[0].response and response[0].response.status == 200:
            logger.info(f"Chaincode {cc_name} instantiated successfully on channel {channel_name}")
            return {
                'status': 'SUCCESS',
                'chaincode': {
                    'name': cc_name,
                    'version': cc_version,
                    'channel': channel_name
                }
            }
        else:
            logger.error(f"Failed to instantiate chaincode {cc_name} on channel {channel_name}")
            return {
                'status': 'FAILURE',
                'chaincode': {
                    'name': cc_name,
                    'version': cc_version,
                    'channel': channel_name
                }
            }
    
    async def upgrade_chaincode(self,
                               channel_name: str,
                               cc_name: str,
                               cc_version: str,
                               fcn: str = 'init',
                               args: List[str] = None,
                               cc_policy: Dict = None) -> Dict:
        """
        Upgrade chaincode on a channel.
        
        Args:
            channel_name: Channel name
            cc_name: Name of the chaincode
            cc_version: New version of the chaincode
            fcn: Initialization function (default 'init')
            args: List of arguments for the function
            cc_policy: Endorsement policy
            
        Returns:
            Response from the upgrade chaincode operation
        """
        args = args or []
        byte_args = [arg.encode() if isinstance(arg, str) else arg for arg in args]
        
        policy = cc_policy or {'identities': [
                {'role': {'name': 'member', 'mspId': 'Org1MSP'}},
                {'role': {'name': 'member', 'mspId': 'Org2MSP'}}
            ], 
            'policy': {'1-of': [{'signed-by': 0}, {'signed-by': 1}]}}
            
        response = await self.client.chaincode_upgrade(
            requestor=self.client.user_context,
            channel_name=channel_name,
            peers=['peer0.org1.example.com'],  # TODO: Make configurable
            cc_name=cc_name,
            cc_version=cc_version,
            fcn=fcn,
            args=byte_args,
            cc_endorsement_policy=policy
        )
        
        if response and response[0].response and response[0].response.status == 200:
            logger.info(f"Chaincode {cc_name} upgraded successfully to version {cc_version} on channel {channel_name}")
            return {
                'status': 'SUCCESS',
                'chaincode': {
                    'name': cc_name,
                    'version': cc_version,
                    'channel': channel_name
                }
            }
        else:
            logger.error(f"Failed to upgrade chaincode {cc_name} to version {cc_version} on channel {channel_name}")
            return {
                'status': 'FAILURE',
                'chaincode': {
                    'name': cc_name,
                    'version': cc_version,
                    'channel': channel_name
                }
            }

    async def get_channel_info(self, channel_name: str) -> Dict:
        """
        Get channel information.
        
        Args:
            channel_name: Channel name
            
        Returns:
            Channel information
        """
        try:
            info = await self.client.query_info(
                requestor=self.client.user_context,
                channel_name=channel_name,
                peers=['peer0.org1.example.com'],  # TODO: Make configurable
            )
            
            return {
                'status': 'SUCCESS',
                'height': info.height,
                'current_block_hash': info.currentBlockHash.hex(),
                'previous_block_hash': info.previousBlockHash.hex()
            }
        except Exception as e:
            logger.error(f"Failed to get channel info for {channel_name}: {str(e)}")
            return {
                'status': 'FAILURE',
                'error': str(e)
            }
    
    async def get_block(self, channel_name: str, block_number: Union[int, str]) -> Dict:
        """
        Get block information.
        
        Args:
            channel_name: Channel name
            block_number: Block number or hash
            
        Returns:
            Block information
        """
        try:
            if isinstance(block_number, int):
                block = await self.client.query_block_by_number(
                    requestor=self.client.user_context,
                    channel_name=channel_name,
                    peers=['peer0.org1.example.com'],  # TODO: Make configurable
                    block_number=block_number
                )
            else:
                block_hash = bytes.fromhex(block_number)
                block = await self.client.query_block_by_hash(
                    requestor=self.client.user_context,
                    channel_name=channel_name,
                    peers=['peer0.org1.example.com'],  # TODO: Make configurable
                    block_hash=block_hash
                )
                
            # Convert block to a serializable format
            result = {
                'status': 'SUCCESS',
                'header': {
                    'number': block.header.number,
                    'previous_hash': block.header.previous_hash.hex(),
                    'data_hash': block.header.data_hash.hex()
                },
                'data': {
                    'transactions': []
                }
            }
            
            # Extract transaction information
            for tx_envelope in block.data.data:
                tx_id = tx_envelope.payload.header.channel_header.tx_id
                timestamp = tx_envelope.payload.header.channel_header.timestamp
                
                result['data']['transactions'].append({
                    'tx_id': tx_id,
                    'timestamp': str(timestamp),
                    'type': tx_envelope.payload.header.channel_header.type
                })
                
            return result
            
        except Exception as e:
            logger.error(f"Failed to get block for {channel_name}: {str(e)}")
            return {
                'status': 'FAILURE',
                'error': str(e)
            }
    
    async def get_transaction(self, channel_name: str, tx_id: str) -> Dict:
        """
        Get transaction information.
        
        Args:
            channel_name: Channel name
            tx_id: Transaction ID
            
        Returns:
            Transaction information
        """
        try:
            tx = await self.client.query_transaction(
                requestor=self.client.user_context,
                channel_name=channel_name,
                peers=['peer0.org1.example.com'],  # TODO: Make configurable
                tx_id=tx_id
            )
            
            # Convert to a serializable format
            result = {
                'status': 'SUCCESS',
                'transaction_id': tx_id,
                'channel_id': tx.payload.header.channel_header.channel_id,
                'timestamp': str(tx.payload.header.channel_header.timestamp),
                'type': tx.payload.header.channel_header.type
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to get transaction {tx_id} for {channel_name}: {str(e)}")
            return {
                'status': 'FAILURE',
                'error': str(e)
            } 