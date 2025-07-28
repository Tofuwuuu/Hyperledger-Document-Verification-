import os
import json
import hashlib
from dotenv import load_dotenv
import asyncio
import uuid
from datetime import datetime

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

class LocalSimulationFabricClient:
    """
    Local simulation implementation of Fabric client for testing and development
    This provides similar functionality to a real Fabric client but stores data locally
    """
    
    def __init__(self):
        self.document_store = {}  # In-memory document store
    
    async def store_document(self, document_id, document_hash, metadata):
        """Store document hash in local simulation storage"""
        try:
            # Store the document hash with timestamp
            timestamp = datetime.now().isoformat()
            tx_id = f"local_sim_{hashlib.md5(f'{document_id}_{timestamp}'.encode()).hexdigest()}"
            
            self.document_store[document_id] = {
                'hash': document_hash,
                'metadata': metadata,
                'timestamp': timestamp,
                'tx_id': tx_id
            }
            
            return {
                "success": True, 
                "transaction_id": tx_id,
                "message": "Document stored in local simulation storage"
            }
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    async def verify_document(self, document_id, document_hash):
        """Verify document hash against local simulation storage"""
        try:
            if document_id in self.document_store:
                stored_doc = self.document_store[document_id]
                verified = stored_doc['hash'] == document_hash
                
                return {
                    "success": True, 
                    "verified": verified,
                    "data": "true" if verified else "false"
                }
            else:
                return {
                    "success": True, 
                    "verified": False,
                    "data": "Document not found in local simulation storage"
                }
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    async def get_document_history(self, document_id):
        """Get document history from local simulation storage"""
        try:
            if document_id in self.document_store:
                stored_doc = self.document_store[document_id]
                
                # Create a history entry
                history = [{
                    'timestamp': stored_doc['timestamp'],
                    'hash': stored_doc['hash'],
                    'tx_id': stored_doc['tx_id'],
                    'metadata': stored_doc['metadata']
                }]
                
                return {"success": True, "history": history}
            else:
                return {"success": True, "history": []}
        except Exception as e:
            return {"success": False, "message": str(e)}

# Global client instances
fabric_client = None
local_simulation_client = LocalSimulationFabricClient()

def initialize_fabric_client():
    """Initialize blockchain client (real or mock)"""
    global fabric_client, local_simulation_client
    
    # Check if we should use the real blockchain
    use_real = os.getenv("USE_REAL_BLOCKCHAIN", "false").lower() == "true"
    
    if not use_real or not FABRIC_SDK_AVAILABLE:
        print("Using local simulation implementation")
        return True
        
    try:
        # Check if network config exists
        if not NETWORK_CONFIG_PATH or not os.path.exists(NETWORK_CONFIG_PATH):
            print(f"Network config not found at {NETWORK_CONFIG_PATH}")
            print("Using local simulation implementation")
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
            print("Using local simulation implementation")
            return True
        
        print(f"Hyperledger Fabric client initialized successfully (Channel: {CHANNEL_NAME}, Chaincode: {CHAINCODE_NAME})")
        return True
    except Exception as e:
        print(f"Error initializing Fabric client: {str(e)}")
        print("Using local simulation implementation")
        return True

async def store_document_hash(document_id, document_hash, metadata):
    """Store document hash in blockchain"""
    global fabric_client, local_simulation_client
    
    if not fabric_client:
        if not initialize_fabric_client():
            return {"success": False, "message": "Failed to initialize blockchain client"}
    
    try:
        # Check if we're using the mock implementation
        use_real = os.getenv("USE_REAL_BLOCKCHAIN", "false").lower() == "true"
        
        if not use_real or not FABRIC_SDK_AVAILABLE:
            # Use local simulation implementation
            return await local_simulation_client.store_document(document_id, document_hash, metadata)
        
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
    global fabric_client, local_simulation_client
    
    if not fabric_client:
        if not initialize_fabric_client():
            return {"success": False, "message": "Failed to initialize blockchain client"}
    
    try:
        # Check if we're using the mock implementation
        use_real = os.getenv("USE_REAL_BLOCKCHAIN", "false").lower() == "true"
        
        if not use_real or not FABRIC_SDK_AVAILABLE:
            # Use local simulation implementation
            return await local_simulation_client.verify_document(document_id, document_hash)
        
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
    global fabric_client, local_simulation_client
    
    if not fabric_client:
        if not initialize_fabric_client():
            return {"success": False, "message": "Failed to initialize blockchain client"}
    
    try:
        # Check if we're using the mock implementation
        use_real = os.getenv("USE_REAL_BLOCKCHAIN", "false").lower() == "true"
        
        if not use_real or not FABRIC_SDK_AVAILABLE:
            # Use local simulation implementation
            return await local_simulation_client.get_document_history(document_id)
        
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