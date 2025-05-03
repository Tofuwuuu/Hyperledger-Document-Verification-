"""
Hyperledger Fabric Wallet Management

This module handles identity management for Hyperledger Fabric networks.
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Optional, Any, Union
import base64

logger = logging.getLogger(__name__)

class FabricWallet:
    """Manages identities for Hyperledger Fabric."""
    
    def __init__(self, wallet_path: str):
        """
        Initialize the wallet manager.
        
        Args:
            wallet_path: Path to the wallet directory
        """
        self.wallet_path = wallet_path
        
        # Create wallet directory if it doesn't exist
        os.makedirs(wallet_path, exist_ok=True)
    
    def has_identity(self, identity_id: str) -> bool:
        """
        Check if an identity exists in the wallet.
        
        Args:
            identity_id: ID for the identity
            
        Returns:
            bool: True if identity exists in wallet
        """
        identity_path = os.path.join(self.wallet_path, identity_id)
        return os.path.exists(identity_path) and os.path.isdir(identity_path)
    
    def create_identity(
        self, 
        identity_id: str, 
        msp_id: str, 
        cert_path: str, 
        key_path: str
    ) -> bool:
        """
        Create a new identity in the wallet.
        
        Args:
            identity_id: ID for the identity
            msp_id: MSP ID for the organization
            cert_path: Path to the certificate file
            key_path: Path to the private key file
            
        Returns:
            bool: True if identity was created successfully
        """
        try:
            # Read certificate and key
            with open(cert_path, 'rb') as cert_file:
                cert = cert_file.read()
            
            with open(key_path, 'rb') as key_file:
                key = key_file.read()
            
            # Create identity directory
            identity_path = os.path.join(self.wallet_path, identity_id)
            os.makedirs(identity_path, exist_ok=True)
            
            # Store identity files
            identity_json = {
                "credentials": {
                    "certificate": cert.decode('utf-8') if isinstance(cert, bytes) else cert,
                    "privateKey": key.decode('utf-8') if isinstance(key, bytes) else key,
                },
                "mspId": msp_id,
                "type": "X.509",
                "version": 1
            }
            
            with open(os.path.join(identity_path, "identity.json"), 'w') as f:
                json.dump(identity_json, f)
            
            logger.info(f"Created identity {identity_id} in wallet at {self.wallet_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create identity {identity_id}: {str(e)}")
            return False
    
    def get_identity(self, identity_id: str) -> Optional[Dict[str, Any]]:
        """
        Get an identity from the wallet.
        
        Args:
            identity_id: ID for the identity
            
        Returns:
            Dict containing identity information or None if not found
        """
        if not self.has_identity(identity_id):
            logger.error(f"Identity {identity_id} not found in wallet")
            return None
        
        try:
            # Read identity JSON
            identity_path = os.path.join(self.wallet_path, identity_id, "identity.json")
            with open(identity_path, 'r') as f:
                identity = json.load(f)
            
            return identity
            
        except Exception as e:
            logger.error(f"Failed to read identity {identity_id}: {str(e)}")
            return None
    
    def get_all_identities(self) -> Dict[str, Dict[str, Any]]:
        """
        Get all identities from the wallet.
        
        Returns:
            Dict mapping identity IDs to identity information
        """
        identities = {}
        
        # List all directories in wallet path
        for identity_id in os.listdir(self.wallet_path):
            identity_path = os.path.join(self.wallet_path, identity_id)
            if os.path.isdir(identity_path) and os.path.exists(os.path.join(identity_path, "identity.json")):
                identity = self.get_identity(identity_id)
                if identity:
                    identities[identity_id] = identity
        
        return identities
    
    def delete_identity(self, identity_id: str) -> bool:
        """
        Delete an identity from the wallet.
        
        Args:
            identity_id: ID for the identity
            
        Returns:
            bool: True if identity was deleted successfully
        """
        if not self.has_identity(identity_id):
            logger.error(f"Identity {identity_id} not found in wallet")
            return False
        
        try:
            # Delete identity directory
            identity_path = os.path.join(self.wallet_path, identity_id)
            import shutil
            shutil.rmtree(identity_path)
            
            logger.info(f"Deleted identity {identity_id} from wallet")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete identity {identity_id}: {str(e)}")
            return False
    
    def get_certificate(self, identity_id: str) -> Optional[str]:
        """
        Get certificate for an identity.
        
        Args:
            identity_id: ID for the identity
            
        Returns:
            str: Certificate in PEM format or None if not found
        """
        identity = self.get_identity(identity_id)
        if not identity:
            return None
        
        return identity.get("credentials", {}).get("certificate")
    
    def get_private_key(self, identity_id: str) -> Optional[str]:
        """
        Get private key for an identity.
        
        Args:
            identity_id: ID for the identity
            
        Returns:
            str: Private key in PEM format or None if not found
        """
        identity = self.get_identity(identity_id)
        if not identity:
            return None
        
        return identity.get("credentials", {}).get("privateKey")
    
    def get_msp_id(self, identity_id: str) -> Optional[str]:
        """
        Get MSP ID for an identity.
        
        Args:
            identity_id: ID for the identity
            
        Returns:
            str: MSP ID or None if not found
        """
        identity = self.get_identity(identity_id)
        if not identity:
            return None
        
        return identity.get("mspId") 