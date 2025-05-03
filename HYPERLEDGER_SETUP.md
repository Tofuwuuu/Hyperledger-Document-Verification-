# Hyperledger Fabric Development Environment Setup

This guide will walk you through setting up a Hyperledger Fabric development environment for this project. The setup includes starting a test network, deploying chaincode, and configuring the application to connect to the network.

## Prerequisites

1. **Windows 10/11 (64-bit)**
2. **Docker Desktop for Windows**
   - Download from [Docker Hub](https://hub.docker.com/editions/community/docker-ce-desktop-windows)
   - Ensure WSL 2 backend is enabled
   - Make sure virtualization is enabled in BIOS
   - Docker requires at least 4GB of memory

3. **Git for Windows**
   - Download from [Git SCM](https://git-scm.com/download/win)

4. **Python 3.8+**
   - Download from [Python.org](https://www.python.org/downloads/)

5. **Required Python Packages**
   - Install with: `pip install hfc-py fabric-sdk-py`

## Setup Steps

### 1. Extract Fabric Samples

The project already includes the necessary Fabric samples and binaries:

1. Navigate to the `fabric-dev` directory:
   ```
   cd fabric-dev
   ```

2. Extract the Fabric samples:
   ```
   tar -xf fabric-samples.zip
   ```

### 2. Run the Setup Script

We've created a Python script that automates the setup process:

1. Make the script executable (if on Linux/Mac):
   ```
   chmod +x fabric-dev/setup.py
   ```

2. Run the setup script:
   ```
   python fabric-dev/setup.py
   ```

The script will:
- Start the Fabric test network
- Create a channel named "mychannel"
- Deploy the "basic" chaincode
- Copy connection profiles and certificates to the backend configuration directory
- Set up the necessary directory structure

### 3. Verify the Setup

To verify that the setup was successful:

1. Check that Docker containers are running:
   ```
   docker ps
   ```
   You should see containers for peers, orderer, and CAs.

2. Run the test script:
   ```
   python backend/scripts/test_fabric_client.py
   ```
   This script will connect to the network, query the chaincode, and perform a transaction.

## Understanding the Implementation

The Hyperledger Fabric integration consists of several key components:

1. **FabricClient** (`backend/app/clients/fabric_client.py`):
   - Provides a wrapper around the Hyperledger Fabric SDK
   - Handles connecting to networks, querying and invoking chaincode

2. **FabricWallet** (`backend/app/clients/fabric_wallet.py`):
   - Manages Fabric identities (certificates and private keys)
   - Provides storage and retrieval of identities

3. **Configuration** (`backend/app/config/fabric_config.py`):
   - Defines configuration settings for Fabric networks
   - Provides utility functions for loading connection profiles and identities

4. **Hyperledger Service** (`backend/app/services/hyperledger_service.py`):
   - Implements higher-level service methods for interacting with Hyperledger networks
   - Manages network, channel, and chaincode metadata in the database

5. **API Endpoints** (`backend/app/api/endpoints/hyperledger.py`):
   - Provides RESTful API endpoints for interacting with Hyperledger networks
   - Exposes operations for networks, channels, and chaincodes

## Next Steps

After setting up the development environment, you can:

1. **Explore the Asset-Transfer-Basic Chaincode**:
   - Located in `fabric-dev/fabric-samples/asset-transfer-basic/chaincode-go`
   - This is the sample chaincode deployed in the test network

2. **Test the FabricClient**:
   - Modify `backend/scripts/test_fabric_client.py` to test additional chaincode functions

3. **Develop Frontend Integration**:
   - Use the frontend service at `frontend/src/services/hyperledger.js` to interact with the backend API

4. **Customize Chaincode**:
   - Develop custom chaincodes for your specific requirements
   - Deploy them to the test network

## Troubleshooting

### Docker Issues

1. **Docker Desktop not starting**
   - Ensure virtualization is enabled in BIOS
   - Check Windows Features to make sure necessary components are enabled
   - Restart your computer

2. **Permission issues**
   - Run PowerShell/cmd as Administrator

3. **Network errors**
   - Check firewall settings
   - Ensure Docker has proper network access

### Fabric Network Issues

1. **Network startup failures**
   - Check Docker logs: `docker logs <container_name>`
   - Ensure all Docker containers are running
   - Check if ports are already in use

2. **Chaincode deployment failures**
   - Verify Go is installed correctly (for Go chaincode)
   - Check chaincode logs for syntax errors

### Connection Issues

1. **Connection profile not found**
   - Ensure the setup script completed successfully
   - Check that connection profiles exist in `backend/app/config/fabric/networks`

2. **Identity issues**
   - Verify that certificates and keys are in the correct location
   - Check that MSP IDs match between the connection profile and identity

3. **SDK not available**
   - Ensure the Fabric SDK dependencies are installed: `pip install hfc-py fabric-sdk-py`
   - If SDK still can't be imported, the client will use a mock implementation 