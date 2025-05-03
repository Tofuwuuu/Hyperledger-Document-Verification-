"""
Fabric wallet implementation for managing identities.
"""

import os
import json
import logging
from pathlib import Path
import base64
from dataclasses import dataclass
from typing import Dict, List, Optional, Union
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from hfc.fabric_ca.caservice import CAClient, CAService
from hfc.fabric.user import User, create_user
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption
from cryptography import x509
from cryptography.x509.oid import NameOID

logger = logging.getLogger(__name__)


@dataclass
class Identity:
    """
    Represents a Hyperledger Fabric identity with certificate and private key.
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
        Returns a user context object compatible with the Fabric SDK.
        This method can be implemented to create a user object for the SDK.
        """
        try:
            from hfc.fabric.user import create_user
            return create_user(
                name=self.name,
                org=self.msp_id,
                msp_id=self.msp_id,
                cert=self.certificate,
                private_key=self.private_key
            )
        except ImportError:
            logger.error("Could not import hfc.fabric.user module. Make sure fabric-sdk-py is installed.")
            raise


class FileSystemWallet:
    """
    A file system implementation of a wallet to store Hyperledger Fabric identities.
    """
    
    def __init__(self, wallet_path: str):
        """
        Initialize the wallet with a path to store identities.
        
        Args:
            wallet_path: Directory path where identities will be stored
        """
        self.path = Path(wallet_path)
        self.path.mkdir(parents=True, exist_ok=True)
    
    def put(self, identity: Identity) -> None:
        """
        Store an identity in the wallet.
        
        Args:
            identity: The identity to store
        """
        # Create identity directory
        identity_path = self.path / identity.name
        identity_path.mkdir(exist_ok=True)
        
        # Create identity.json file
        identity_file = identity_path / "identity.json"
        identity_data = {
            "name": identity.name,
            "mspId": identity.msp_id,
            "type": "X.509",
            "credentials": {
                "certificate": identity.certificate,
                "privateKey": identity.private_key
            }
        }
        
        with open(identity_file, 'w') as f:
            json.dump(identity_data, f, indent=2)
    
    def get(self, identity_name: str) -> Optional[Identity]:
        """
        Retrieve an identity from the wallet.
        
        Args:
            identity_name: Name of the identity to retrieve
            
        Returns:
            The identity if found, None otherwise
        """
        identity_path = self.path / identity_name
        identity_file = identity_path / "identity.json"
        
        if not identity_file.exists():
            return None
        
        with open(identity_file, 'r') as f:
            identity_data = json.load(f)
        
        return Identity(
            name=identity_data["name"],
            msp_id=identity_data["mspId"],
            certificate=identity_data["credentials"]["certificate"],
            private_key=identity_data["credentials"]["privateKey"]
        )
    
    def remove(self, identity_name: str) -> bool:
        """
        Remove an identity from the wallet.
        
        Args:
            identity_name: Name of the identity to remove
            
        Returns:
            True if identity was removed, False if it didn't exist
        """
        identity_path = self.path / identity_name
        
        if not identity_path.exists():
            return False
        
        identity_file = identity_path / "identity.json"
        if identity_file.exists():
            identity_file.unlink()
        
        # Remove directory
        identity_path.rmdir()
        return True
    
    def exists(self, identity_name: str) -> bool:
        """
        Check if an identity exists in the wallet.
        
        Args:
            identity_name: Name of the identity to check
            
        Returns:
            True if identity exists, False otherwise
        """
        identity_path = self.path / identity_name
        identity_file = identity_path / "identity.json"
        return identity_file.exists()
    
    def list(self) -> List[str]:
        """
        List all identities in the wallet.
        
        Returns:
            List of identity names
        """
        result = []
        
        if self.path.exists():
            for item in self.path.iterdir():
                if item.is_dir():
                    identity_file = item / "identity.json"
                    if identity_file.exists():
                        result.append(item.name)
        
        return result
    
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
            The imported identity
        """
        # Read certificate
        with open(certificate_path, 'r') as f:
            certificate = f.read()
        
        # Read private key
        with open(private_key_path, 'r') as f:
            private_key = f.read()
        
        # Create identity
        identity = Identity(
            name=name,
            msp_id=msp_id,
            certificate=certificate,
            private_key=private_key
        )
        
        # Store in wallet
        self.put(identity)
        
        return identity


class CryptoHelper:
    """Helper class for cryptographic operations."""
    
    @staticmethod
    def import_private_key(pem_data: str) -> bytes:
        """Convert PEM-encoded private key to bytes.

        Args:
            pem_data: PEM-encoded private key data

        Returns:
            Private key in bytes format
        """
        try:
            private_key = load_pem_private_key(
                pem_data.encode(),
                password=None,
                backend=default_backend()
            )
            
            return private_key.private_bytes(
                encoding=Encoding.PEM,
                format=PrivateFormat.PKCS8,
                encryption_algorithm=NoEncryption()
            )
        except Exception as e:
            logger.error(f"Error importing private key: {str(e)}")
            raise ValueError(f"Invalid private key format: {str(e)}")
    
    @staticmethod
    def import_certificate(pem_data: str) -> bytes:
        """Convert PEM-encoded certificate to bytes.

        Args:
            pem_data: PEM-encoded certificate data

        Returns:
            Certificate in bytes format
        """
        try:
            return pem_data.encode()
        except Exception as e:
            logger.error(f"Error importing certificate: {str(e)}")
            raise ValueError(f"Invalid certificate format: {str(e)}")
    
    @classmethod
    def create_identity_from_files(cls, 
                                  name: str, 
                                  msp_id: str, 
                                  cert_path: Union[str, Path], 
                                  key_path: Union[str, Path]) -> Identity:
        """Create an identity from certificate and key files.

        Args:
            name: Name for the identity
            msp_id: MSP ID for the identity
            cert_path: Path to the certificate file
            key_path: Path to the private key file

        Returns:
            An Identity object
        """
        cert_path = Path(cert_path)
        key_path = Path(key_path)
        
        if not cert_path.exists():
            raise FileNotFoundError(f"Certificate file not found: {cert_path}")
        
        if not key_path.exists():
            raise FileNotFoundError(f"Private key file not found: {key_path}")
        
        with open(cert_path, 'r') as f:
            cert_data = f.read()
        
        with open(key_path, 'r') as f:
            key_data = f.read()
        
        return Identity(
            name=name,
            msp_id=msp_id,
            certificate=cert_data,
            private_key=key_data
        )


class FabricCAClient:
    """Client for interacting with Hyperledger Fabric CA."""
    
    def __init__(
        self, 
        ca_url: str, 
        ca_name: str, 
        ca_cert_path: Optional[str] = None
    ):
        """
        Initialize a new Fabric CA client.
        
        Args:
            ca_url: URL of the Fabric CA server (e.g., https://ca.org1.example.com:7054)
            ca_name: Name of the CA server (e.g., ca.org1.example.com)
            ca_cert_path: Path to CA certificate file (optional)
        """
        self.ca_url = ca_url
        self.ca_name = ca_name
        self.ca_cert_path = ca_cert_path
        
        # Initialize CA client
        self.ca_client = CAClient(
            url=ca_url,
            ca_name=ca_name,
            ca_certs_path=ca_cert_path
        )
    
    async def enroll(
        self, 
        enrollment_id: str, 
        enrollment_secret: str, 
        msp_id: str
    ) -> Identity:
        """
        Enroll with the Fabric CA and get back credentials.
        
        Args:
            enrollment_id: Enrollment ID (username)
            enrollment_secret: Enrollment secret (password)
            msp_id: MSP ID (e.g., Org1MSP)
            
        Returns:
            Identity with certificate and private key
        """
        # Enroll user
        resp = await self.ca_client.enroll(enrollment_id, enrollment_secret)
        
        # Extract certificate and private key
        private_key = resp.get('private_key')
        certificate = resp.get('certificate')
        
        # Convert private key to PEM format if it's not already
        if not isinstance(private_key, str):
            private_key = private_key.decode('utf-8')
        
        # Convert certificate to PEM format if it's not already
        if not isinstance(certificate, str):
            certificate = certificate.decode('utf-8')
        
        # Create and return identity
        return Identity(
            name=enrollment_id,
            msp_id=msp_id,
            certificate=certificate,
            private_key=private_key
        )
    
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
        Register a new user with the Fabric CA.
        
        Args:
            registrar_identity: Identity of the registrar with sufficient privileges
            user_id: ID for the new user
            user_secret: Enrollment secret for the new user
            user_affiliation: Affiliation for the new user (e.g., org1.department1)
            user_type: Type of user (default: client)
            user_attrs: Optional attributes for the user
            
        Returns:
            True if registration succeeded, False otherwise
        """
        # Create a registrar user
        registrar = create_user(
            name=registrar_identity.name,
            org=registrar_identity.msp_id,
            state_store=None,
            msp_id=registrar_identity.msp_id,
            cert=registrar_identity.certificate,
            private_key=registrar_identity.private_key
        )
        
        # Initialize CA service with registrar
        ca_service = CAService(self.ca_client)
        
        # Prepare attributes
        attrs = []
        if user_attrs:
            attrs = [{"name": k, "value": v, "ecert": True} for k, v in user_attrs.items()]
        
        # Register the user
        try:
            await ca_service.register(
                registrar,
                user_id,
                user_secret,
                user_affiliation,
                user_type,
                attrs,
                max_enrollments=0  # 0 means unlimited enrollments
            )
            return True
        except Exception as e:
            print(f"Error registering user: {e}")
            return False


def identity_to_user(identity: Identity) -> User:
    """
    Convert an Identity to a Fabric User object.
    
    Args:
        identity: The identity to convert
        
    Returns:
        A Fabric User object
    """
    return create_user(
        name=identity.name,
        org=identity.msp_id,
        state_store=None,
        msp_id=identity.msp_id,
        cert=identity.certificate,
        private_key=identity.private_key
    )


def generate_private_key() -> str:
    """
    Generate a new EC private key in PEM format.
    
    Returns:
        PEM-encoded private key as string
    """
    # Generate private key
    private_key = ec.generate_private_key(
        ec.SECP256R1(),
        default_backend()
    )
    
    # Convert to PEM format
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    return pem.decode('utf-8') 