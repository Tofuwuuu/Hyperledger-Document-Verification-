"""
Mock Fabric wallet implementation for managing identities.
This is a simulation that doesn't require hfc.
"""

import os
import json
import logging
from pathlib import Path
import base64
from dataclasses import dataclass
from typing import Dict, List, Optional, Union, Any

logger = logging.getLogger(__name__)
logger.warning("Using mock Fabric wallet implementation")

@dataclass
class Identity:
    """
    Represents a mock Hyperledger Fabric identity with certificate and private key.
    """
    name: str
    msp_id: str
    certificate: str
    private_key: str

    def to_dict(self) -> Dict:
        """Convert Identity to a dictionary representation."""
        return {
            'name': self.name,
            'mspId': self.msp_id,
            'certificate': self.certificate,
            'privateKey': self.private_key
        }

    @classmethod
    def from_dict(cls, data: Dict) -> 'Identity':
        """Create an Identity from a dictionary representation."""
        return cls(
            name=data.get('name', ''),
            msp_id=data.get('mspId', ''),
            certificate=data.get('certificate', ''),
            private_key=data.get('privateKey', '')
        )

    def get_user_context(self):
        """
        Returns a mock user context object.
        """
        logger.warning(f"Using mock user context for {self.name}")
        return {"name": self.name, "msp_id": self.msp_id}


class FileSystemWallet:
    """
    A mock file system implementation of a wallet to store Hyperledger Fabric identities.
    """
    
    def __init__(self, wallet_path: str):
        """
        Initialize the mock wallet with a path to store identities.
        
        Args:
            wallet_path: Directory path where identities will be stored
        """
        self.path = Path(wallet_path)
        self.path.mkdir(parents=True, exist_ok=True)
        self.identities = {}
        logger.info(f"Initialized mock wallet at {wallet_path}")
    
    def put(self, identity: Identity) -> None:
        """
        Store an identity in the mock wallet.
        
        Args:
            identity: The identity to store
        """
        logger.info(f"Mock wallet: Storing identity {identity.name}")
        self.identities[identity.name] = identity
    
    def get(self, identity_name: str) -> Optional[Identity]:
        """
        Retrieve an identity from the mock wallet.
        
        Args:
            identity_name: Name of the identity to retrieve
            
        Returns:
            The identity if found, None otherwise
        """
        logger.info(f"Mock wallet: Retrieving identity {identity_name}")
        return self.identities.get(identity_name)
    
    def remove(self, identity_name: str) -> bool:
        """
        Remove an identity from the mock wallet.
        
        Args:
            identity_name: Name of the identity to remove
            
        Returns:
            True if identity was removed, False if it didn't exist
        """
        logger.info(f"Mock wallet: Removing identity {identity_name}")
        if identity_name in self.identities:
            del self.identities[identity_name]
            return True
        return False
    
    def exists(self, identity_name: str) -> bool:
        """
        Check if an identity exists in the mock wallet.
        
        Args:
            identity_name: Name of the identity to check
            
        Returns:
            True if identity exists, False otherwise
        """
        exists = identity_name in self.identities
        logger.info(f"Mock wallet: Checking if identity {identity_name} exists: {exists}")
        return exists
    
    def list(self) -> List[str]:
        """
        List all identities in the mock wallet.
        
        Returns:
            List of identity names
        """
        identities = list(self.identities.keys())
        logger.info(f"Mock wallet: Listing identities: {identities}")
        return identities
    
    def import_identity(self, 
                        name: str, 
                        msp_id: str, 
                        certificate_path: str, 
                        private_key_path: str) -> Identity:
        """
        Import an identity from certificate and private key files.
        
        Args:
            name: Name for the identity
            msp_id: MSP ID for the organization
            certificate_path: Path to the certificate file
            private_key_path: Path to the private key file
            
        Returns:
            The imported mock identity
        """
        logger.info(f"Mock wallet: Importing identity {name} from {certificate_path} and {private_key_path}")
        
        # Create mock identity
        identity = Identity(
            name=name,
            msp_id=msp_id,
            certificate="MOCK_CERTIFICATE",
            private_key="MOCK_PRIVATE_KEY"
        )
        
        # Store in wallet
        self.put(identity)
        
        return identity


class CryptoHelper:
    """Mock helper class for cryptographic operations."""
    
    @staticmethod
    def import_private_key(pem_data: str) -> bytes:
        """Mock convert PEM-encoded private key to bytes.

        Args:
            pem_data: PEM-encoded private key data

        Returns:
            Mock private key in bytes format
        """
        logger.info("Mock: import_private_key called")
        return b"mock_private_key_bytes"

    @staticmethod
    def import_certificate(pem_data: str) -> bytes:
        """Mock convert PEM-encoded certificate to bytes.

        Args:
            pem_data: PEM-encoded certificate data

        Returns:
            Mock certificate in bytes format
        """
        logger.info("Mock: import_certificate called")
        return b"mock_certificate_bytes"

    @classmethod
    def create_identity_from_files(cls, 
                                  name: str, 
                                  msp_id: str, 
                                  cert_path: Union[str, Path], 
                                  key_path: Union[str, Path]) -> Identity:
        """Mock create an identity from certificate and private key files.

        Args:
            name: Name for the identity
            msp_id: MSP ID for the organization
            cert_path: Path to the certificate file
            key_path: Path to the private key file

        Returns:
            Mock identity
        """
        logger.info(f"Mock: create_identity_from_files called for {name}")
        return Identity(
            name=name,
            msp_id=msp_id,
            certificate="MOCK_CERTIFICATE",
            private_key="MOCK_PRIVATE_KEY"
        )


class FabricCAClient:
    """Mock client for Hyperledger Fabric CA operations."""
    
    def __init__(
        self, 
        ca_url: str, 
        ca_name: str, 
        ca_cert_path: Optional[str] = None
    ):
        """
        Initialize a mock Fabric CA client.
        
        Args:
            ca_url: URL of the Fabric CA server
            ca_name: Name of the CA
            ca_cert_path: Path to the CA certificate file (optional)
        """
        logger.info(f"Mock: Initialized FabricCAClient for {ca_url}, {ca_name}")
        self.ca_url = ca_url
        self.ca_name = ca_name
        self.ca_cert_path = ca_cert_path
    
    async def enroll(
        self, 
        enrollment_id: str, 
        enrollment_secret: str, 
        msp_id: str
    ) -> Identity:
        """
        Mock enroll with the Fabric CA using provided credentials.
        
        Args:
            enrollment_id: Enrollment ID (username)
            enrollment_secret: Enrollment secret (password)
            msp_id: MSP ID for the organization
            
        Returns:
            Mock identity from enrollment
        """
        logger.info(f"Mock: Enrolling {enrollment_id} with CA {self.ca_name}")
        
        # Create mock identity
        identity = Identity(
            name=enrollment_id,
            msp_id=msp_id,
            certificate="MOCK_CERTIFICATE_FROM_ENROLLMENT",
            private_key="MOCK_PRIVATE_KEY_FROM_ENROLLMENT"
        )
        
        return identity
    
    async def register(
        self, 
        registrar_identity: Identity, 
        user_id: str, 
        user_secret: str, 
        user_affiliation: str, 
        user_type: str = "client", 
        user_attrs: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Mock register a new user with the Fabric CA.
        
        Args:
            registrar_identity: Identity of the registrar
            user_id: ID for the new user
            user_secret: Secret for the new user
            user_affiliation: Affiliation for the new user
            user_type: Type of user (default: "client")
            user_attrs: Additional attributes (optional)
            
        Returns:
            True indicating success
        """
        logger.info(f"Mock: Registering user {user_id} with CA {self.ca_name}")
        return True


def identity_to_user(identity: Identity) -> Dict[str, Any]:
    """
    Mock convert an Identity to a User object.
    
    Args:
        identity: The identity to convert
        
    Returns:
        Mock user dictionary
    """
    logger.info(f"Mock: Converting identity {identity.name} to user")
    return {
        "name": identity.name,
        "mspid": identity.msp_id,
        "cert": identity.certificate,
        "private_key": identity.private_key
    }


def generate_private_key() -> str:
    """
    Mock generate a new EC private key.
    
    Returns:
        PEM encoded private key string
    """
    logger.info("Mock: Generating private key")
    return "-----BEGIN PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END PRIVATE KEY-----" 