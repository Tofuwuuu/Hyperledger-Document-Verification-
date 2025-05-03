"""
Hyperledger Fabric Service

This service provides high-level operations for interacting with Hyperledger Fabric networks
by wrapping the FabricSDKClient.
"""

import os
import json
import logging
import asyncio
from typing import Dict, List, Optional, Any, Union
from pathlib import Path

from ..core.fabric_client import FabricSDKClient
from ..core.fabric_wallet import FileSystemWallet, Identity
from ..config.fabric_config import (
    load_connection_profile,
    get_admin_identity,
    DEFAULT_CHANNEL,
    DEFAULT_CHAINCODE
)

logger = logging.getLogger(__name__)

class FabricService:
    """
    Service for interacting with Hyperledger Fabric networks.
    """
    
    def __init__(self, wallet_path: Optional[str] = None):
        """
        Initialize the Fabric service.
        
        Args:
            wallet_path: Path to the wallet directory (optional)
        """
        self.wallet_path = wallet_path
        self.clients = {}  # Maps org_names to client instances
        self.wallet = None
        
        if wallet_path:
            self.wallet = FileSystemWallet(wallet_path)
            logger.info(f"Using wallet at {wallet_path}")
    
    async def initialize_client(self, 
                               connection_profile_path: str, 
                               org_name: str,
                               identity_name: str,
                               channel_name: Optional[str] = None) -> FabricSDKClient:
        """
        Initialize a client for an organization.
        
        Args:
            connection_profile_path: Path to the connection profile
            org_name: Name of the organization
            identity_name: Name of the identity to use
            channel_name: Default channel name (optional)
            
        Returns:
            Initialized FabricSDKClient
        """
        # Create a unique key for this client
        client_key = f"{org_name}:{identity_name}"
        
        # Check if we already have this client
        if client_key in self.clients:
            logger.info(f"Using existing client for {client_key}")
            return self.clients[client_key]
        
        # Create a new client
        client = FabricSDKClient.from_connection_profile(
            profile_path=connection_profile_path,
            org_name=org_name,
            wallet_path=self.wallet_path,
            channel_name=channel_name
        )
        
        # Set the user context if we have a wallet
        if self.wallet and self.wallet.exists(identity_name):
            identity = self.wallet.get(identity_name)
            if identity:
                client.set_user_context(identity)
                logger.info(f"Set user context to {identity_name} for {org_name}")
            else:
                logger.warning(f"Identity {identity_name} not found in wallet")
        else:
            logger.warning(f"No wallet available or identity {identity_name} not found")
        
        # Store and return the client
        self.clients[client_key] = client
        logger.info(f"Initialized new client for {client_key}")
        
        return client
    
    async def query_chaincode(self,
                             chaincode_id: str,
                             function_name: str,
                             args: List[str],
                             channel_name: Optional[str] = None,
                             org_name: Optional[str] = None,
                             identity_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Query a chaincode function (read-only transaction).
        
        Args:
            chaincode_id: ID of the chaincode to query
            function_name: Name of the function to call
            args: List of arguments for the function
            channel_name: Optional channel name (uses default if not provided)
            org_name: Optional organization name to use for query
            identity_name: Optional identity name to use for query
            
        Returns:
            Dict containing the query result
        """
        # Get the client to use
        client = await self._get_client_for_operation(org_name, identity_name)
        if not client:
            return {"success": False, "error": "No client available for operation"}
        
        try:
            # Query the chaincode
            result = await client.query_chaincode(
                chaincode_name=chaincode_id,
                channel_name=channel_name or client.channel_name,
                fcn=function_name,
                args=args
            )
            
            return {"success": True, "result": result}
        except Exception as e:
            logger.error(f"Error querying chaincode: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def invoke_chaincode(self,
                              chaincode_id: str,
                              function_name: str,
                              args: List[str],
                              channel_name: Optional[str] = None,
                              transient_data: Optional[Dict[str, bytes]] = None,
                              org_name: Optional[str] = None,
                              identity_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Invoke a chaincode function (write transaction).
        
        Args:
            chaincode_id: ID of the chaincode to invoke
            function_name: Name of the function to call
            args: List of arguments for the function
            channel_name: Optional channel name (uses default if not provided)
            transient_data: Optional transient data (private data)
            org_name: Optional organization name to use for invoke
            identity_name: Optional identity name to use for invoke
            
        Returns:
            Dict containing the invoke result
        """
        # Get the client to use
        client = await self._get_client_for_operation(org_name, identity_name)
        if not client:
            return {"success": False, "error": "No client available for operation"}
        
        try:
            # Invoke the chaincode
            result = await client.invoke_chaincode(
                chaincode_name=chaincode_id,
                channel_name=channel_name or client.channel_name,
                fcn=function_name,
                args=args,
                transient_map=transient_data
            )
            
            return {
                "success": True, 
                "transaction_id": result.get('transaction_id', ''),
                "status": result.get('status', '')
            }
        except Exception as e:
            logger.error(f"Error invoking chaincode: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def create_channel(self,
                            channel_name: str,
                            orderer_name: str,
                            channel_config_path: str,
                            org_name: Optional[str] = None,
                            identity_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new channel.
        
        Args:
            channel_name: Name of the channel to create
            orderer_name: Name of the orderer to use
            channel_config_path: Path to the channel configuration file
            org_name: Optional organization name to use for channel creation
            identity_name: Optional identity name to use for channel creation
            
        Returns:
            Dict containing the result of channel creation
        """
        # Get the client to use
        client = await self._get_client_for_operation(org_name, identity_name)
        if not client:
            return {"success": False, "error": "No client available for operation"}
        
        try:
            # Create the channel
            result = await client.create_channel(
                channel_name=channel_name,
                orderer_name=orderer_name,
                channel_config_path=channel_config_path
            )
            
            return {
                "success": result.get('status') == 'SUCCESS',
                "channel_name": channel_name,
                "status": result.get('status', 'UNKNOWN')
            }
        except Exception as e:
            logger.error(f"Error creating channel: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def join_channel(self,
                          channel_name: str,
                          peers: List[str],
                          org_name: Optional[str] = None,
                          identity_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Join peers to a channel.
        
        Args:
            channel_name: Name of the channel to join
            peers: List of peer names to join to the channel
            org_name: Optional organization name to use for channel join
            identity_name: Optional identity name to use for channel join
            
        Returns:
            Dict containing the result of channel join operation
        """
        # Get the client to use
        client = await self._get_client_for_operation(org_name, identity_name)
        if not client:
            return {"success": False, "error": "No client available for operation"}
        
        try:
            # Join the channel
            result = await client.join_channel(
                channel_name=channel_name,
                peers=peers
            )
            
            return {
                "success": result.get('status') in ['SUCCESS', 'PARTIAL'],
                "channel_name": channel_name,
                "joined_peers": result.get('joined_peers', []),
                "failed_peers": result.get('failed_peers', []),
                "status": result.get('status', 'UNKNOWN')
            }
        except Exception as e:
            logger.error(f"Error joining channel: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def install_chaincode(self,
                              cc_path: str,
                              cc_name: str,
                              cc_version: str,
                              peers: List[str],
                              org_name: Optional[str] = None,
                              identity_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Install chaincode on peers.
        
        Args:
            cc_path: Path to the chaincode directory
            cc_name: Name of the chaincode
            cc_version: Version of the chaincode
            peers: List of peer names to install the chaincode on
            org_name: Optional organization name to use for chaincode installation
            identity_name: Optional identity name to use for chaincode installation
            
        Returns:
            Dict containing the result of chaincode installation
        """
        # Get the client to use
        client = await self._get_client_for_operation(org_name, identity_name)
        if not client:
            return {"success": False, "error": "No client available for operation"}
        
        try:
            # Install the chaincode
            result = await client.install_chaincode(
                peers=peers,
                cc_path=cc_path,
                cc_name=cc_name,
                cc_version=cc_version
            )
            
            return {
                "success": result.get('status') in ['SUCCESS', 'PARTIAL'],
                "chaincode": {
                    "name": cc_name,
                    "version": cc_version
                },
                "successful_peers": result.get('successful_peers', []),
                "failed_peers": result.get('failed_peers', []),
                "status": result.get('status', 'UNKNOWN')
            }
        except Exception as e:
            logger.error(f"Error installing chaincode: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def instantiate_chaincode(self,
                                   channel_name: str,
                                   cc_name: str,
                                   cc_version: str,
                                   function_name: str = 'init',
                                   args: List[str] = None,
                                   cc_policy: Dict = None,
                                   org_name: Optional[str] = None,
                                   identity_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Instantiate chaincode on a channel.
        
        Args:
            channel_name: Name of the channel
            cc_name: Name of the chaincode
            cc_version: Version of the chaincode
            function_name: Name of the initialization function (default: 'init')
            args: List of arguments for the initialization function
            cc_policy: Endorsement policy
            org_name: Optional organization name to use for chaincode instantiation
            identity_name: Optional identity name to use for chaincode instantiation
            
        Returns:
            Dict containing the result of chaincode instantiation
        """
        # Get the client to use
        client = await self._get_client_for_operation(org_name, identity_name)
        if not client:
            return {"success": False, "error": "No client available for operation"}
        
        try:
            # Instantiate the chaincode
            result = await client.instantiate_chaincode(
                channel_name=channel_name,
                cc_name=cc_name,
                cc_version=cc_version,
                fcn=function_name,
                args=args or [],
                cc_policy=cc_policy
            )
            
            return {
                "success": result.get('status') == 'SUCCESS',
                "chaincode": {
                    "name": cc_name,
                    "version": cc_version,
                    "channel": channel_name
                },
                "status": result.get('status', 'UNKNOWN')
            }
        except Exception as e:
            logger.error(f"Error instantiating chaincode: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def upgrade_chaincode(self,
                              channel_name: str,
                              cc_name: str,
                              cc_version: str,
                              function_name: str = 'init',
                              args: List[str] = None,
                              cc_policy: Dict = None,
                              org_name: Optional[str] = None,
                              identity_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Upgrade chaincode on a channel.
        
        Args:
            channel_name: Name of the channel
            cc_name: Name of the chaincode
            cc_version: New version of the chaincode
            function_name: Name of the initialization function (default: 'init')
            args: List of arguments for the initialization function
            cc_policy: Endorsement policy
            org_name: Optional organization name to use for chaincode upgrade
            identity_name: Optional identity name to use for chaincode upgrade
            
        Returns:
            Dict containing the result of chaincode upgrade
        """
        # Get the client to use
        client = await self._get_client_for_operation(org_name, identity_name)
        if not client:
            return {"success": False, "error": "No client available for operation"}
        
        try:
            # Upgrade the chaincode
            result = await client.upgrade_chaincode(
                channel_name=channel_name,
                cc_name=cc_name,
                cc_version=cc_version,
                fcn=function_name,
                args=args or [],
                cc_policy=cc_policy
            )
            
            return {
                "success": result.get('status') == 'SUCCESS',
                "chaincode": {
                    "name": cc_name,
                    "version": cc_version,
                    "channel": channel_name
                },
                "status": result.get('status', 'UNKNOWN')
            }
        except Exception as e:
            logger.error(f"Error upgrading chaincode: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_channel_info(self,
                              channel_name: str,
                              org_name: Optional[str] = None,
                              identity_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Get information about a channel.
        
        Args:
            channel_name: Name of the channel
            org_name: Optional organization name to use for query
            identity_name: Optional identity name to use for query
            
        Returns:
            Dict containing channel information
        """
        # Get the client to use
        client = await self._get_client_for_operation(org_name, identity_name)
        if not client:
            return {"success": False, "error": "No client available for operation"}
        
        try:
            # Get channel information
            result = await client.get_channel_info(channel_name=channel_name)
            
            return {
                "success": result.get('status') == 'SUCCESS',
                "channel_name": channel_name,
                "height": result.get('height'),
                "current_block_hash": result.get('current_block_hash'),
                "previous_block_hash": result.get('previous_block_hash'),
                "status": result.get('status', 'UNKNOWN')
            }
        except Exception as e:
            logger.error(f"Error getting channel info: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_block(self,
                       channel_name: str,
                       block_identifier: Union[int, str],
                       org_name: Optional[str] = None,
                       identity_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Get information about a block.
        
        Args:
            channel_name: Name of the channel
            block_identifier: Block number (int) or block hash (str)
            org_name: Optional organization name to use for query
            identity_name: Optional identity name to use for query
            
        Returns:
            Dict containing block information
        """
        # Get the client to use
        client = await self._get_client_for_operation(org_name, identity_name)
        if not client:
            return {"success": False, "error": "No client available for operation"}
        
        try:
            # Get block information
            result = await client.get_block(
                channel_name=channel_name,
                block_number=block_identifier
            )
            
            return {
                "success": result.get('status') == 'SUCCESS',
                "channel_name": channel_name,
                "header": result.get('header'),
                "data": result.get('data'),
                "status": result.get('status', 'UNKNOWN')
            }
        except Exception as e:
            logger.error(f"Error getting block: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_transaction(self,
                             channel_name: str,
                             tx_id: str,
                             org_name: Optional[str] = None,
                             identity_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Get information about a transaction.
        
        Args:
            channel_name: Name of the channel
            tx_id: Transaction ID
            org_name: Optional organization name to use for query
            identity_name: Optional identity name to use for query
            
        Returns:
            Dict containing transaction information
        """
        # Get the client to use
        client = await self._get_client_for_operation(org_name, identity_name)
        if not client:
            return {"success": False, "error": "No client available for operation"}
        
        try:
            # Get transaction information
            result = await client.get_transaction(
                channel_name=channel_name,
                tx_id=tx_id
            )
            
            return {
                "success": result.get('status') == 'SUCCESS',
                "channel_name": channel_name,
                "transaction_id": tx_id,
                "channel_id": result.get('channel_id'),
                "timestamp": result.get('timestamp'),
                "type": result.get('type'),
                "status": result.get('status', 'UNKNOWN')
            }
        except Exception as e:
            logger.error(f"Error getting transaction: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def enroll_admin(self,
                          ca_url: str,
                          ca_name: str,
                          enrollment_id: str,
                          enrollment_secret: str,
                          msp_id: str,
                          ca_cert_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Enroll admin user with Fabric CA.
        
        Args:
            ca_url: URL of the CA server
            ca_name: Name of the CA
            enrollment_id: Enrollment ID (admin username)
            enrollment_secret: Enrollment secret (admin password)
            msp_id: MSP ID of the organization
            ca_cert_path: Path to the CA certificate file (optional)
            
        Returns:
            Dict containing the result of enrollment
        """
        try:
            # Import required modules
            from hfc.fabric_ca.caservice import CAClient, CAService
            
            # Initialize CA client
            ca_client = CAClient(
                url=ca_url,
                ca_name=ca_name,
                ca_certs_path=ca_cert_path
            )
            
            # Enroll admin
            enrollment = await ca_client.enroll(
                enrollment_id,
                enrollment_secret
            )
            
            # Extract certificate and private key
            cert = enrollment['certificate']
            key = enrollment['privateKey']
            
            # Create admin identity
            admin_identity = Identity(
                name=enrollment_id,
                msp_id=msp_id,
                certificate=cert,
                private_key=key
            )
            
            # Store admin identity in wallet
            if self.wallet:
                self.wallet.put(admin_identity)
                logger.info(f"Enrolled admin {enrollment_id} and stored in wallet")
            
            return {
                "success": True,
                "identity": {
                    "name": enrollment_id,
                    "msp_id": msp_id
                },
                "message": f"Admin {enrollment_id} enrolled successfully"
            }
        except Exception as e:
            logger.error(f"Error enrolling admin: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def register_user(self,
                           ca_url: str,
                           ca_name: str,
                           admin_identity_name: str,
                           user_id: str,
                           user_secret: str,
                           user_affiliation: str,
                           user_attrs: Optional[Dict[str, str]] = None,
                           ca_cert_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Register a new user with Fabric CA.
        
        Args:
            ca_url: URL of the CA server
            ca_name: Name of the CA
            admin_identity_name: Name of the admin identity to use for registration
            user_id: ID for the new user
            user_secret: Secret for the new user
            user_affiliation: Affiliation for the new user
            user_attrs: Optional attributes for the user
            ca_cert_path: Path to the CA certificate file (optional)
            
        Returns:
            Dict containing the result of registration
        """
        try:
            # Import required modules
            from hfc.fabric_ca.caservice import CAClient, CAService
            
            # Get admin identity from wallet
            if not self.wallet:
                return {"success": False, "error": "Wallet not available"}
            
            admin_identity = self.wallet.get(admin_identity_name)
            if not admin_identity:
                return {"success": False, "error": f"Admin identity {admin_identity_name} not found in wallet"}
            
            # Initialize CA client and service
            ca_client = CAClient(
                url=ca_url,
                ca_name=ca_name,
                ca_certs_path=ca_cert_path
            )
            
            ca_service = CAService(ca_client)
            
            # Create admin user from identity
            admin_user = create_user(
                name=admin_identity.name,
                org=admin_identity.msp_id,
                state_store=self.clients.get(f"{admin_identity.msp_id}:{admin_identity.name}").client.state_store if f"{admin_identity.msp_id}:{admin_identity.name}" in self.clients else None,
                msp_id=admin_identity.msp_id,
                cert=admin_identity.certificate,
                private_key=admin_identity.private_key
            )
            
            # Prepare attributes
            attrs = []
            if user_attrs:
                attrs = [{"name": k, "value": v, "ecert": True} for k, v in user_attrs.items()]
            
            # Register the user
            result = await ca_service.register(
                admin_user,
                user_id,
                user_secret,
                user_affiliation,
                member_type='client',
                attrs=attrs,
                max_enrollments=0  # 0 means unlimited enrollments
            )
            
            return {
                "success": True,
                "user_id": user_id,
                "message": f"User {user_id} registered successfully"
            }
        except Exception as e:
            logger.error(f"Error registering user: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def enroll_user(self,
                         ca_url: str,
                         ca_name: str,
                         enrollment_id: str,
                         enrollment_secret: str,
                         msp_id: str,
                         ca_cert_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Enroll a registered user with Fabric CA.
        
        Args:
            ca_url: URL of the CA server
            ca_name: Name of the CA
            enrollment_id: Enrollment ID (user ID)
            enrollment_secret: Enrollment secret (user secret)
            msp_id: MSP ID of the organization
            ca_cert_path: Path to the CA certificate file (optional)
            
        Returns:
            Dict containing the result of enrollment
        """
        try:
            # Import required modules
            from hfc.fabric_ca.caservice import CAClient
            
            # Initialize CA client
            ca_client = CAClient(
                url=ca_url,
                ca_name=ca_name,
                ca_certs_path=ca_cert_path
            )
            
            # Enroll user
            enrollment = await ca_client.enroll(
                enrollment_id,
                enrollment_secret
            )
            
            # Extract certificate and private key
            cert = enrollment['certificate']
            key = enrollment['privateKey']
            
            # Create user identity
            user_identity = Identity(
                name=enrollment_id,
                msp_id=msp_id,
                certificate=cert,
                private_key=key
            )
            
            # Store user identity in wallet
            if self.wallet:
                self.wallet.put(user_identity)
                logger.info(f"Enrolled user {enrollment_id} and stored in wallet")
            
            return {
                "success": True,
                "identity": {
                    "name": enrollment_id,
                    "msp_id": msp_id
                },
                "message": f"User {enrollment_id} enrolled successfully"
            }
        except Exception as e:
            logger.error(f"Error enrolling user: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def _get_client_for_operation(self, 
                                       org_name: Optional[str] = None, 
                                       identity_name: Optional[str] = None) -> Optional[FabricSDKClient]:
        """
        Get a client for a specific operation based on org and identity.
        
        Args:
            org_name: Optional organization name
            identity_name: Optional identity name
            
        Returns:
            FabricSDKClient instance or None if not available
        """
        # If we have no clients, we can't do anything
        if not self.clients:
            logger.error("No clients available. Please initialize a client first.")
            return None
        
        # If specific org and identity are provided, try to get that client
        if org_name and identity_name:
            client_key = f"{org_name}:{identity_name}"
            if client_key in self.clients:
                return self.clients[client_key]
            else:
                logger.error(f"No client found for {client_key}")
                return None
        
        # Otherwise, just return the first client
        return next(iter(self.clients.values()))
    
    def get_identities(self) -> List[Dict[str, Any]]:
        """
        Get all identities in the wallet.
        
        Returns:
            List of identities
        """
        if not self.wallet:
            return []
        
        identities = []
        for identity_name in self.wallet.list():
            identity = self.wallet.get(identity_name)
            if identity:
                identities.append({
                    "name": identity.name,
                    "msp_id": identity.msp_id
                })
        
        return identities 