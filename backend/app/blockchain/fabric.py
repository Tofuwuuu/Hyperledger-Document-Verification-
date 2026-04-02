import os
import json
import hashlib
from dotenv import load_dotenv
import asyncio
import uuid
from datetime import datetime

# Prefer HTTP Fabric Gateway in dev/runtime when enabled
from app.core.config import settings
from app.blockchain import fabric_gateway as gateway

# Import Fabric SDK if available
try:
    # Uncomment actual Fabric imports
    from hfc.fabric import Client
    from hfc.fabric.peer import Peer
    from hfc.fabric.transaction.tx_context import create_tx_context
    from hfc.fabric.transaction.tx_proposal_request import create_tx_prop_req, TXProposalRequest
    from hfc.util.crypto.crypto import ecies
    FABRIC_SDK_AVAILABLE = True
except ImportError:
    FABRIC_SDK_AVAILABLE = False

load_dotenv()

# Hyperledger Fabric configuration
NETWORK_CONFIG_PATH = os.getenv("NETWORK_CONFIG_PATH")
ORG_NAME = os.getenv("ORG_NAME", "Org1")
ORG_USER = os.getenv("ORG_USER", "Admin")
CHANNEL_NAME = os.getenv("CHANNEL_NAME", "mychannel")
CHAINCODE_NAME = os.getenv("CHAINCODE_NAME", "document-verification")
CONTRACT_NAME = os.getenv("CONTRACT_NAME", "")

# Mock storage for testing
mock_storage = {}

# Create a MockFabricClient for testing
class MockFabricClient:
    def __init__(self):
        self.storage = {}
        print("MockFabricClient initialized")
    
    async def store_document(self, document_id, document_hash, metadata):
        """Store document hash in mock blockchain"""
        transaction_id = f"mock_tx_{uuid.uuid4().hex[:8]}"
        timestamp = datetime.now().isoformat()
        
        # Store document in mock storage
        self.storage[document_id] = {
            "hash": document_hash,
            "metadata": metadata,
            "transaction_id": transaction_id,
            "timestamp": timestamp
        }
        
        print(f"[MOCK] Stored document {document_id} with hash {document_hash[:8]}...")
        
        return {
            "success": True,
            "transaction_id": transaction_id,
            "document_id": document_id,
            "hash": document_hash,
            "timestamp": timestamp
        }
    
    async def verify_document(self, document_id, document_hash):
        """Verify document hash against mock blockchain"""
        if document_id not in self.storage:
            return {
                "success": True,
                "verified": False,
                "message": "Document not found in blockchain"
            }
        
        stored_doc = self.storage[document_id]
        verified = stored_doc["hash"] == document_hash
        
        print(f"[MOCK] Verifying document {document_id}")
        print(f"[MOCK] Stored hash: {stored_doc['hash'][:8]}...")
        print(f"[MOCK] Provided hash: {document_hash[:8]}...")
        print(f"[MOCK] Match: {verified}")
        
        return {
            "success": True,
            "verified": verified,
            "document_id": document_id
        }
    
    async def get_document_history(self, document_id):
        """Get document history from mock blockchain"""
        if document_id not in self.storage:
            return {
                "success": True,
                "history": [],
                "message": "Document not found in blockchain"
            }
        
        # In a real blockchain, this would return multiple versions
        # For mock, we'll just return the current version
        doc = self.storage[document_id]
        
        history = [{
            "txId": doc["transaction_id"],
            "hash": doc["hash"],
            "metadata": doc["metadata"],
            "timestamp": doc["timestamp"]
        }]
        
        return {
            "success": True,
            "history": history,
            "document_id": document_id
        }

# Global client instances
fabric_client = None
mock_client = MockFabricClient()

def initialize_fabric_client():
    """Initialize blockchain client (real or mock)"""
    global fabric_client, mock_client
    
    # Check if we should use the real blockchain
    use_real = os.getenv("USE_REAL_BLOCKCHAIN", "false").lower() == "true"
    
    if not use_real or not FABRIC_SDK_AVAILABLE:
        print("Using mock blockchain implementation")
        return True
        
    try:
        # Check if network config exists
        if not NETWORK_CONFIG_PATH or not os.path.exists(NETWORK_CONFIG_PATH):
            print(f"Network config not found at {NETWORK_CONFIG_PATH}")
            print("Using mock blockchain implementation")
            return True
            
        # Determine file format based on extension
        if NETWORK_CONFIG_PATH.endswith('.json'):
            # Create client with JSON config
            with open(NETWORK_CONFIG_PATH, 'r') as f:
                network_config = json.load(f)
            fabric_client = Client(net_profile=network_config)
        else:
            # Create client with YAML config
            fabric_client = Client(net_profile=NETWORK_CONFIG_PATH)
        
        # Get admin user context
        admin = fabric_client.get_user(org_name=ORG_NAME, name=ORG_USER)
        
        # Check if admin user exists
        if not admin:
            print(f"Admin user {ORG_USER} not found in organization {ORG_NAME}")
            print("Using mock blockchain implementation")
            return True
        
        print(f"Hyperledger Fabric client initialized successfully (Channel: {CHANNEL_NAME}, Chaincode: {CHAINCODE_NAME})")
        return True
    except Exception as e:
        print(f"Error initializing Fabric client: {str(e)}")
        print("Using mock blockchain implementation")
        return True

async def store_document_hash(document_id, document_hash, metadata):
    """Store document hash in blockchain"""
    if settings.BLOCKCHAIN_ENABLED and gateway.is_gateway_enabled():
        return await gateway.store_document_hash(str(document_id), str(document_hash), metadata if isinstance(metadata, dict) else {"metadata": metadata})
    global fabric_client, mock_client
    
    if not fabric_client:
        if not initialize_fabric_client():
            return {"success": False, "message": "Failed to initialize blockchain client"}
    
    try:
        # Check if we're using the mock implementation
        use_real = os.getenv("USE_REAL_BLOCKCHAIN", "false").lower() == "true"
        
        if not use_real or not FABRIC_SDK_AVAILABLE:
            # Use mock implementation
            return await mock_client.store_document(document_id, document_hash, metadata)
        
        # Convert metadata to string if it's a dict
        if isinstance(metadata, dict):
            metadata = json.dumps(metadata)
        
        # Create a transaction proposal
        tx_context = create_tx_context(
            fabric_client.get_user(org_name=ORG_NAME, name=ORG_USER),
            ecies(),
            fabric_client.tx_id()
        )
        
        # Prepare args - all args must be strings
        args = [document_id, document_hash, metadata]
        args = [str(arg) for arg in args]
        
        # Create transaction proposal request
        tx_prop_req = create_tx_prop_req(
            prop_type=TXProposalRequest.ENDORSER_TRANSACTION,
            cc_name=CHAINCODE_NAME,
            cc_version=None,
            fcn='StoreDocument',
            args=args,
            cc_type=None
        )
        
        # Send transaction proposal
        responses, proposal, header = await fabric_client.channel.send_tx_proposal(tx_prop_req, tx_context)
        
        # Check responses from endorsers
        for response in responses:
            if response.response.status != 200:
                return {
                    "success": False, 
                    "message": f"Endorsement failed: {response.response.message}"
                }
        
        # Send transaction to orderer
        tx_context_tx = create_tx_context(
            fabric_client.get_user(org_name=ORG_NAME, name=ORG_USER),
            ecies(),
            fabric_client.tx_id()
        )
        
        response = await fabric_client.channel.send_transaction(responses, header, tx_context_tx)
        
        # Check orderer response
        if response.status != 200:
            return {
                "success": False, 
                "message": f"Transaction commit failed: {response.message}"
            }
        
        tx_id = tx_context.tx_id
        return {"success": True, "transaction_id": tx_id}
    
    except Exception as e:
        print(f"Error storing document hash: {str(e)}")
        return {"success": False, "message": str(e)}

async def verify_document_hash(document_id, document_hash):
    """Verify document hash from blockchain"""
    if settings.BLOCKCHAIN_ENABLED and gateway.is_gateway_enabled():
        return await gateway.verify_document_hash(str(document_id), str(document_hash))
    global fabric_client, mock_client
    
    if not fabric_client:
        if not initialize_fabric_client():
            return {"success": False, "message": "Failed to initialize blockchain client"}
    
    try:
        # Check if we're using the mock implementation
        use_real = os.getenv("USE_REAL_BLOCKCHAIN", "false").lower() == "true"
        
        if not use_real or not FABRIC_SDK_AVAILABLE:
            # Use mock implementation
            return await mock_client.verify_document(document_id, document_hash)
        
        # Create args - all args must be strings
        args = [document_id, document_hash]
        args = [str(arg) for arg in args]
        
        # Query chaincode
        response = await fabric_client.channel.query_instantiated_chaincodes(
            requestor=fabric_client.get_user(org_name=ORG_NAME, name=ORG_USER),
            channel_name=CHANNEL_NAME,
            transaction_id=fabric_client.tx_id(),
            peers=[],  # Empty list means using all peers in the channel
            decode=True
        )
        
        # Check if chaincode is instantiated
        chaincode_found = False
        for chaincode in response.chaincodes:
            if chaincode.name == CHAINCODE_NAME:
                chaincode_found = True
                break
                
        if not chaincode_found:
            return {
                "success": False, 
                "message": f"Chaincode {CHAINCODE_NAME} not found on channel {CHANNEL_NAME}"
            }
        
        # Query the chaincode
        response = await fabric_client.channel.query(
            requestor=fabric_client.get_user(org_name=ORG_NAME, name=ORG_USER),
            channel_name=CHANNEL_NAME,
            peers=[],  # Empty list means using all peers in the channel
            args=args,
            fcn="VerifyDocument",
            cc_name=CHAINCODE_NAME
        )
        
        # Parse response
        if not response:
            return {"success": True, "verified": False, "data": "Document not found"}
        
        # Response should be "true" or "false"
        result = response.decode('utf-8').strip()
        verified = result.lower() == "true"
        
        return {"success": True, "verified": verified, "data": result}
        
    except Exception as e:
        print(f"Error verifying document hash: {str(e)}")
        return {"success": False, "message": str(e)}

def generate_document_hash(file_content):
    """Generate SHA-256 hash for document"""
    if isinstance(file_content, str):
        file_content = file_content.encode('utf-8')
    return hashlib.sha256(file_content).hexdigest()

async def get_document_history(document_id):
    """Get document history from blockchain"""
    if settings.BLOCKCHAIN_ENABLED and gateway.is_gateway_enabled():
        return await gateway.get_document_history(str(document_id))
    global fabric_client, mock_client
    
    if not fabric_client:
        if not initialize_fabric_client():
            return {"success": False, "message": "Failed to initialize blockchain client"}
    
    try:
        # Check if we're using the mock implementation
        use_real = os.getenv("USE_REAL_BLOCKCHAIN", "false").lower() == "true"
        
        if not use_real or not FABRIC_SDK_AVAILABLE:
            # Use mock implementation
            return await mock_client.get_document_history(document_id)
        
        # Create args
        args = [document_id]
        
        # Query the chaincode
        response = await fabric_client.channel.query(
            requestor=fabric_client.get_user(org_name=ORG_NAME, name=ORG_USER),
            channel_name=CHANNEL_NAME,
            peers=[],  # Empty list means using all peers in the channel
            args=args,
            fcn="GetDocumentHistory",
            cc_name=CHAINCODE_NAME
        )
        
        # Parse response
        if not response:
            return {"success": True, "history": []}
            
        # Expecting a JSON array of history entries
        history_json = response.decode('utf-8')
        try:
            history = json.loads(history_json)
        except json.JSONDecodeError:
            return {"success": False, "message": "Failed to parse history response"}
        
        return {"success": True, "history": history}
        
    except Exception as e:
        print(f"Error getting document history: {str(e)}")
        return {"success": False, "message": str(e)} 