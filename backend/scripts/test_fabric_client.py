#!/usr/bin/env python3
"""
Hyperledger Fabric Client Test Script

This script tests the FabricClient by connecting to the test network
and performing basic operations like querying and invoking chaincode.
"""

import os
import sys
import json
import logging
import asyncio

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

async def test_query():
    """Test querying chaincode."""
    # Network and channel information
    network_name = "mychannel-network"
    channel_name = "mychannel"
    chaincode_name = "basic"
    
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
    
    # Query chaincode
    logger.info(f"Querying chaincode: {chaincode_name}")
    result = client.query_chaincode(chaincode_name, "GetAllAssets", [])
    
    if result["success"]:
        logger.info("Query successful")
        logger.info(f"Result: {json.dumps(result, indent=2)}")
    else:
        logger.error(f"Query failed: {result.get('message', 'Unknown error')}")
    
    # Close the client
    client.close()
    
    return result["success"]

async def test_invoke():
    """Test invoking chaincode."""
    # Network and channel information
    network_name = "mychannel-network"
    channel_name = "mychannel"
    chaincode_name = "basic"
    
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
    
    # Create a new asset
    asset_id = "asset-test"
    args = [
        asset_id,             # ID
        "TestAsset",          # Color
        "5",                  # Size
        "Test Owner",         # Owner
        "100",                # Value
    ]
    
    logger.info(f"Invoking chaincode: {chaincode_name} - CreateAsset")
    result = client.invoke_chaincode(chaincode_name, "CreateAsset", args)
    
    if result["success"]:
        logger.info("Invoke successful")
        logger.info(f"Result: {json.dumps(result, indent=2)}")
        
        # Query the newly created asset
        logger.info(f"Querying asset: {asset_id}")
        query_result = client.query_chaincode(chaincode_name, "ReadAsset", [asset_id])
        
        if query_result["success"]:
            logger.info("Query successful")
            logger.info(f"Asset data: {json.dumps(query_result, indent=2)}")
        else:
            logger.error(f"Query failed: {query_result.get('message', 'Unknown error')}")
    else:
        logger.error(f"Invoke failed: {result.get('message', 'Unknown error')}")
    
    # Close the client
    client.close()
    
    return result["success"]

async def main():
    """Run the test functions."""
    logger.info("=== Testing Hyperledger Fabric Client ===")
    
    query_success = await test_query()
    if query_success:
        logger.info("Query test passed")
    else:
        logger.error("Query test failed")
    
    invoke_success = await test_invoke()
    if invoke_success:
        logger.info("Invoke test passed")
    else:
        logger.error("Invoke test failed")
    
    if query_success and invoke_success:
        logger.info("All tests passed!")
        return 0
    else:
        logger.error("Some tests failed")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code) 