# Hyperledger Fabric Client Implementation

This directory contains client implementations for interacting with Hyperledger Fabric networks. We provide two client options:

1. **Direct SDK Client** (`fabric_client.py`): Connects directly to a Fabric network using the Fabric SDK.
2. **HTTP REST Client** (`fabric_client_http.py`): Connects to a Fabric network through a REST API gateway.

## Usage Examples

### Direct SDK Client

This client provides direct access to the Fabric network through the SDK.

```python
from app.clients.fabric_client import FabricClient
from app.config.fabric_config import get_connection_profile, get_admin_identity

# Create client
client = FabricClient(
    connection_profile_path=get_connection_profile(),
    identity_type="admin",
    msp_id=get_admin_identity().get("msp_id"),
    cert_path=get_admin_identity().get("cert_path"),
    key_path=get_admin_identity().get("key_path"),
    channel_name="mychannel"
)

# Connect to network
success = client.connect()
if not success:
    print("Failed to connect")
    exit(1)

# Query chaincode
result = client.query_chaincode(
    chaincode_id="basic",
    function_name="ReadAsset",
    args=["asset1"],
    channel_name="mychannel"
)
print(f"Query result: {result}")

# Invoke chaincode
result = client.invoke_chaincode(
    chaincode_id="basic",
    function_name="TransferAsset",
    args=["asset1", "NewOwner"],
    channel_name="mychannel"
)
print(f"Invoke result: {result}")

# Don't forget to close the connection when done
client.close()
```

### HTTP REST Client

This client connects to a Fabric network through a REST API gateway.

```python
import asyncio
from app.clients.fabric_client_http import FabricClientHTTP

async def main():
    # Create client
    client = FabricClientHTTP(
        api_url="https://fabric-api.example.com",
        api_key="your-api-key",  # Optional
        organization="org1",
        channel="mychannel"
    )
    
    # Test connection
    connection_result = await client.connect()
    if not connection_result.get("success", False):
        print(f"Failed to connect: {connection_result.get('error')}")
        return
    
    # Query chaincode
    query_result = await client.query_chaincode(
        chaincode_id="basic",
        function_name="ReadAsset",
        args=["asset1"]
    )
    print(f"Query result: {query_result}")
    
    # Invoke chaincode
    invoke_result = await client.invoke_chaincode(
        chaincode_id="basic",
        function_name="TransferAsset",
        args=["asset1", "NewOwner"]
    )
    print(f"Invoke result: {invoke_result}")
    
    # Close the connection
    await client.close()

# Run the async function
asyncio.run(main())
```

### Factory Function

We also provide a factory function to get the appropriate client based on configuration:

```python
import asyncio
from app.clients.fabric_client_http import get_fabric_client

async def main():
    # Get the appropriate client (SDK or HTTP) based on configuration
    use_http = True  # Set to False to use SDK client
    
    client_config = {
        # Common parameters
        "channel_name": "mychannel",
        
        # HTTP-specific parameters (used if use_http=True)
        "api_url": "https://fabric-api.example.com",
        "api_key": "your-api-key",
        
        # SDK-specific parameters (used if use_http=False)
        "connection_profile_path": "/path/to/connection/profile.json",
        "identity_type": "admin",
        "msp_id": "Org1MSP",
        "cert_path": "/path/to/cert.pem",
        "key_path": "/path/to/key.pem"
    }
    
    client = await get_fabric_client(use_http=use_http, **client_config)
    
    # Rest of your code...

# Run the async function
asyncio.run(main())
```

## Configuration

Both clients can be configured through the `fabric_config.py` module. This module provides:

- Connection profile paths for different organizations
- Identity configurations (certificates and keys)
- Default channel and chaincode settings
- Environment-specific settings (development, test, production)

## Implementation Status

### Direct SDK Client

The Direct SDK Client is currently a placeholder implementation. To fully implement it, you would need to:

1. Add actual SDK integration code to the placeholder methods
2. Implement proper certificate and key handling
3. Add transaction event listeners for monitoring transaction status

### HTTP REST Client

The HTTP REST Client is fully implemented and ready to use with API gateways that expose Fabric functionality through a REST interface.

## Which Client to Use?

- **HTTP REST Client**: Best for systems that use a managed blockchain service or an existing API gateway.
- **Direct SDK Client**: Best for systems that need direct access to the blockchain for maximum flexibility.

Both clients implement the same interface, so you can switch between them with minimal code changes. 