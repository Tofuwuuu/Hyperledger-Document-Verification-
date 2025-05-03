#!/usr/bin/env python3
"""
Document Verification Chaincode Test Script

This script tests the document verification chaincode by connecting to the test network
and performing operations such as storing and verifying document hashes.
"""

import os
import sys
import json
import logging
import asyncio
import hashlib
import uuid

# Add the parent directory to the Python path so we can import from app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.clients.fabric_client import FabricClient
from app.config.fabric_config import load_connection_profile, get_admin_identity

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Function to calculate SHA-256 hash of a string
def calculate_hash(content):
    """Calculate SHA-256 hash of a string."""
    if isinstance(content, str):
        content = content.encode('utf-8')
    return hashlib.sha256(content).hexdigest()

async def test_store_document():
    """Test storing a document hash."""
    # Network and channel information
    network_name = "mychannel-network"
    channel_name = "mychannel"
    chaincode_name = "document-verification"
    
    # Load connection profile
    connection_profile = load_connection_profile(network_name)
    if not connection_profile:
        logger.error(f"Connection profile not found for network: {network_name}")
        return False
    
    connection_profile_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
        "app", "config", "fabric", "networks", f"{network_name}.json"
    )
    
    # Get admin identity
    admin_identity = get_admin_identity("Org1")
    if not admin_identity:
        logger.error("Admin identity not found for Org1")
        return False
    
    # Initialize Fabric client
    client = FabricClient(
        connection_profile_path=connection_profile_path,
        identity_type="admin",
        msp_id=admin_identity["msp_id"],
        cert_path=admin_identity["cert_path"],
        key_path=admin_identity["key_path"],
        channel_name=channel_name
    )
    
    # Connect to the network
    if not client.connect():
        logger.error("Failed to connect to the Fabric network")
        return False
    
    logger.info("Successfully connected to the Fabric network")
    
    # Create a test document with random ID
    doc_id = f"doc-{uuid.uuid4().hex[:8]}"
    doc_content = f"This is a test document with ID: {doc_id}"
    doc_hash = calculate_hash(doc_content)
    owner = "TestOwner"
    doc_type = "TestDocument"
    metadata = json.dumps({
        "description": "Test document for verification",
        "format": "text/plain",
        "createdAt": "2023-01-01T12:00:00Z"
    })
    
    # Store document hash
    logger.info(f"Storing document hash for document ID: {doc_id}")
    store_result = client.invoke_chaincode(
        chaincode_name, 
        "StoreDocument", 
        [doc_id, doc_hash, owner, doc_type, metadata]
    )
    
    if store_result["success"]:
        logger.info("Document hash stored successfully")
        logger.info(f"Result: {json.dumps(store_result, indent=2)}")
    else:
        logger.error(f"Failed to store document hash: {store_result.get('message', 'Unknown error')}")
        client.close()
        return False
    
    # Get document details
    logger.info(f"Retrieving document details for document ID: {doc_id}")
    get_result = client.query_chaincode(chaincode_name, "GetDocument", [doc_id])
    
    if get_result["success"]:
        logger.info("Document details retrieved successfully")
        logger.info(f"Document: {json.dumps(get_result, indent=2)}")
    else:
        logger.error(f"Failed to retrieve document: {get_result.get('message', 'Unknown error')}")
        client.close()
        return False
    
    # Verify document (correct hash)
    logger.info(f"Verifying document with correct hash")
    verify_result = client.query_chaincode(
        chaincode_name, 
        "VerifyDocument", 
        [doc_id, doc_hash, "TestVerifier"]
    )
    
    if verify_result["success"]:
        logger.info("Document verification query successful")
        verification_data = json.loads(verify_result.get("data", "{}"))
        if verification_data:
            logger.info(f"Verification result: {verification_data}")
        else:
            logger.warning("No verification data returned")
    else:
        logger.error(f"Document verification failed: {verify_result.get('message', 'Unknown error')}")
        client.close()
        return False
    
    # Verify document (incorrect hash)
    logger.info(f"Testing verification with incorrect hash")
    incorrect_hash = calculate_hash("This is not the original content")
    verify_incorrect_result = client.query_chaincode(
        chaincode_name, 
        "VerifyDocument", 
        [doc_id, incorrect_hash, "TestVerifier"]
    )
    
    if verify_incorrect_result["success"]:
        logger.info("Incorrect hash verification query successful")
        verification_data = json.loads(verify_incorrect_result.get("data", "{}"))
        if verification_data:
            logger.info(f"Verification result with incorrect hash: {verification_data}")
            # Should be false
            if verification_data == False or verification_data == "false" or verification_data == 0:
                logger.info("Verification correctly failed for incorrect hash")
            else:
                logger.warning("WARNING: Verification did not fail for incorrect hash")
        else:
            logger.warning("No verification data returned for incorrect hash")
    else:
        logger.error(f"Verification query failed: {verify_incorrect_result.get('message', 'Unknown error')}")
    
    # Get document history
    logger.info(f"Retrieving document history for document ID: {doc_id}")
    history_result = client.query_chaincode(chaincode_name, "GetDocumentHistory", [doc_id])
    
    if history_result["success"]:
        logger.info("Document history retrieved successfully")
        logger.info(f"History: {json.dumps(history_result, indent=2)}")
    else:
        logger.error(f"Failed to retrieve document history: {history_result.get('message', 'Unknown error')}")
    
    # Query documents by owner
    logger.info(f"Querying documents by owner: {owner}")
    query_result = client.query_chaincode(chaincode_name, "QueryDocumentsByOwner", [owner])
    
    if query_result["success"]:
        logger.info("Document query by owner successful")
        logger.info(f"Query result: {json.dumps(query_result, indent=2)}")
    else:
        logger.error(f"Failed to query documents by owner: {query_result.get('message', 'Unknown error')}")
    
    # Update document status
    new_status = "ARCHIVED"
    logger.info(f"Updating document status to: {new_status}")
    update_result = client.invoke_chaincode(
        chaincode_name, 
        "UpdateDocumentStatus", 
        [doc_id, new_status, "TestAdmin"]
    )
    
    if update_result["success"]:
        logger.info("Document status updated successfully")
        logger.info(f"Update result: {json.dumps(update_result, indent=2)}")
    else:
        logger.error(f"Failed to update document status: {update_result.get('message', 'Unknown error')}")
    
    # Close the client
    client.close()
    
    return True

async def main():
    """Run the test functions."""
    logger.info("=== Testing Document Verification Chaincode ===")
    
    success = await test_store_document()
    if success:
        logger.info("Document verification chaincode test passed")
        return 0
    else:
        logger.error("Document verification chaincode test failed")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code) 