"""
Blockchain Manager

This service provides a unified interface for blockchain operations,
with the ability to use either mock blockchain functionality or real
Hyperledger Fabric integration based on configuration.
"""

import os
import json
import hashlib
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional

# Local blockchain settings
from app.blockchain.fabric import (
    initialize_fabric_client, 
    store_document_hash, 
    verify_document_hash,
    get_document_history
)

# Import FabricClient when needed
try:
    from app.clients.fabric_client import FabricClient
    FABRIC_CLIENT_AVAILABLE = True
except ImportError:
    FABRIC_CLIENT_AVAILABLE = False

# Set up logging
logger = logging.getLogger(__name__)

# Configuration
USE_REAL_BLOCKCHAIN = os.getenv("USE_REAL_BLOCKCHAIN", "false").lower() == "true"
NETWORK_CONFIG_PATH = os.getenv("NETWORK_CONFIG_PATH", "app/config/fabric/connection-profile.json")
ORG_NAME = os.getenv("ORG_NAME", "Org1MSP")
CHANNEL_NAME = os.getenv("CHANNEL_NAME", "alumni-channel")
CHAINCODE_NAME = os.getenv("CHAINCODE_NAME", "document-verification")

# Initialize cache
document_cache = {}

class BlockchainManager:
    """
    Blockchain Manager for document verification
    
    This class provides a unified interface for blockchain operations,
    with the ability to switch between local simulation and real implementations.
    """
    
    def __init__(self):
        """Initialize blockchain manager"""
        self.use_real_blockchain = USE_REAL_BLOCKCHAIN
        self.client = None
        
        # Print initialization mode
        if self.use_real_blockchain:
            logger.info("BlockchainManager initialized in REAL BLOCKCHAIN mode")
            logger.info(f"Network Config: {NETWORK_CONFIG_PATH}")
            logger.info(f"Channel: {CHANNEL_NAME}")
            logger.info(f"Chaincode: {CHAINCODE_NAME}")
        else:
            logger.info("BlockchainManager initialized in LOCAL SIMULATION mode")
        
        # Initialize client if using real blockchain
        if self.use_real_blockchain and FABRIC_CLIENT_AVAILABLE:
            # Note: Real client initialization happens on demand
            pass
        elif self.use_real_blockchain and not FABRIC_CLIENT_AVAILABLE:
            logger.warning("Real blockchain requested but FabricClient not available. Using local simulation implementation.")
            self.use_real_blockchain = False
    
    async def _get_real_client(self) -> bool:
        """Get or initialize real blockchain client"""
        if not self.client:
            # Initialize the local simulation client first in case real initialization fails
            initialize_fabric_client()
            
            if FABRIC_CLIENT_AVAILABLE:
                try:
                    # Create real client
                    if os.path.exists(NETWORK_CONFIG_PATH):
                        self.client = FabricClient(
                            connection_profile_path=NETWORK_CONFIG_PATH,
                            channel_name=CHANNEL_NAME
                        )
                        connected = self.client.connect()
                        if not connected:
                            logger.error("Failed to connect to Fabric network. Falling back to local simulation implementation.")
                            self.use_real_blockchain = False
                            return False
                        return True
                    else:
                        logger.error(f"Connection profile not found at {NETWORK_CONFIG_PATH}")
                        self.use_real_blockchain = False
                        return False
                except Exception as e:
                    logger.error(f"Error initializing Fabric client: {str(e)}")
                    self.use_real_blockchain = False
                    return False
        return True
    
    async def store_document(self, document_id: str, document_hash: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Store document hash on blockchain
        
        Args:
            document_id: Unique document identifier
            document_hash: SHA-256 hash of the document
            metadata: Additional metadata about the document
        
        Returns:
            Dictionary with result information
        """
        try:
            # Convert metadata to string
            metadata_str = json.dumps(metadata)
            
            if self.use_real_blockchain:
                # Initialize real client if needed
                client_ready = await self._get_real_client()
                
                if client_ready and self.client:
                    # Use real client
                    logger.info(f"Storing document {document_id} on real blockchain")
                    
                    result = await self.client.invoke_chaincode(
                        CHAINCODE_NAME,
                        "StoreDocument",
                        [document_id, document_hash, metadata_str]
                    )
                    
                    if result.get("success"):
                        tx_id = result.get("transaction_id", "unknown")
                        return {
                            "success": True,
                            "transaction_id": tx_id,
                            "document_id": document_id,
                            "hash": document_hash,
                            "timestamp": datetime.now().isoformat()
                        }
                    else:
                        logger.error(f"Failed to store document on blockchain: {result.get('message')}")
                        return {
                            "success": False,
                            "message": result.get("message", "Unknown error"),
                            "document_id": document_id
                        }
                else:
                    # Fall back to local simulation implementation
                    logger.warning("Real blockchain client not available. Using local simulation implementation.")
            
            # Use local simulation implementation
            result = await store_document_hash(document_id, document_hash, metadata)
            
            if result.get("success"):
                # Cache document for faster verification
                document_cache[document_id] = {
                    "hash": document_hash,
                    "metadata": metadata,
                    "transaction_id": result.get("transaction_id", "unknown"),
                    "timestamp": datetime.now().isoformat()
                }
                
                return {
                    "success": True,
                    "transaction_id": result.get("transaction_id", "local_simulation_tx_id"),
                    "document_id": document_id,
                    "hash": document_hash,
                    "timestamp": datetime.now().isoformat()
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Unknown error"),
                    "document_id": document_id
                }
        except Exception as e:
            logger.error(f"Error storing document on blockchain: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "document_id": document_id
            }
    
    async def verify_document(self, document_id: str, document_hash: str) -> Dict[str, Any]:
        """
        Verify document against blockchain
        
        Args:
            document_id: Unique document identifier
            document_hash: SHA-256 hash of the document to verify
        
        Returns:
            Dictionary with verification result
        """
        try:
            if self.use_real_blockchain:
                # Initialize real client if needed
                client_ready = await self._get_real_client()
                
                if client_ready and self.client:
                    # Use real client
                    logger.info(f"Verifying document {document_id} on real blockchain")
                    
                    result = await self.client.query_chaincode(
                        CHAINCODE_NAME,
                        "VerifyDocument",
                        [document_id, document_hash]
                    )
                    
                    if result.get("success"):
                        verified = result.get("data", "false").lower() == "true"
                        return {
                            "success": True,
                            "verified": verified,
                            "document_id": document_id,
                            "hash": document_hash
                        }
                    else:
                        logger.error(f"Failed to verify document on blockchain: {result.get('message')}")
                        return {
                            "success": False,
                            "message": result.get("message", "Unknown error"),
                            "document_id": document_id
                        }
                else:
                    # Fall back to local simulation implementation
                    logger.warning("Real blockchain client not available. Using local simulation implementation.")
            
            # Use local simulation implementation
            result = await verify_document_hash(document_id, document_hash)
            
            if result.get("success"):
                verified = result.get("verified", False) 
                
                return {
                    "success": True,
                    "verified": verified,
                    "document_id": document_id,
                    "hash": document_hash
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Unknown error"),
                    "document_id": document_id
                }
        except Exception as e:
            logger.error(f"Error verifying document on blockchain: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "document_id": document_id
            }
    
    async def get_document_history(self, document_id: str) -> Dict[str, Any]:
        """
        Get document history from blockchain
        
        Args:
            document_id: Unique document identifier
        
        Returns:
            Dictionary with document history
        """
        try:
            if self.use_real_blockchain:
                # Initialize real client if needed
                client_ready = await self._get_real_client()
                
                if client_ready and self.client:
                    # Use real client
                    logger.info(f"Getting history for document {document_id} from real blockchain")
                    
                    result = await self.client.query_chaincode(
                        CHAINCODE_NAME,
                        "GetDocumentHistory",
                        [document_id]
                    )
                    
                    if result.get("success"):
                        history_data = result.get("data", "[]")
                        try:
                            history = json.loads(history_data)
                        except json.JSONDecodeError:
                            logger.error(f"Failed to parse document history: {history_data}")
                            history = []
                        
                        return {
                            "success": True,
                            "history": history,
                            "document_id": document_id
                        }
                    else:
                        logger.error(f"Failed to get document history: {result.get('message')}")
                        return {
                            "success": False,
                            "message": result.get("message", "Unknown error"),
                            "document_id": document_id
                        }
                else:
                    # Fall back to local simulation implementation
                    logger.warning("Real blockchain client not available. Using local simulation implementation.")
            
            # Use local simulation implementation
            result = await get_document_history(document_id)
            
            if result.get("success"):
                history = result.get("history", [])
                
                return {
                    "success": True,
                    "history": history,
                    "document_id": document_id
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Unknown error"),
                    "document_id": document_id
                }
        except Exception as e:
            logger.error(f"Error getting document history from blockchain: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "document_id": document_id
            }
    
    @staticmethod
    def calculate_document_hash(file_content: bytes) -> str:
        """
        Calculate SHA-256 hash for a document
        
        Args:
            file_content: Document content as bytes
        
        Returns:
            SHA-256 hash as hex string
        """
        hash_object = hashlib.sha256(file_content)
        return hash_object.hexdigest()

# Create singleton instance
blockchain_manager = BlockchainManager()

def get_blockchain_manager() -> BlockchainManager:
    """Get blockchain manager singleton instance"""
    return blockchain_manager 