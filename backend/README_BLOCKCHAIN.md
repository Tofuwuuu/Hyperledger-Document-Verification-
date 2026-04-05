# Blockchain Integration for Document Verification

This guide explains how to set up and use the Hyperledger Fabric blockchain network for document verification in the Alumni System.

## Prerequisites

- Docker and Docker Compose
- Hyperledger Fabric binaries and samples (v2.2+)
- Python 3.8+ with pip
- Required Python packages (in requirements.txt)

## Setup Instructions

### 1. Install Hyperledger Fabric Prerequisites

Make sure you have Docker, Docker Compose, and Git installed on your system.

### 2. Download Fabric Samples and Binaries

If you don't already have the Fabric samples and binaries:

```bash
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.2.0 1.4.9
```

This will create a `fabric-samples` directory with all the necessary files.

### 3. Set Up the Network and Environment

#### On Windows:

Run the setup script from the backend directory:

```bash
cd backend
setup_fabric.bat
```

#### On Linux/Mac:

```bash
cd backend
chmod +x setup_fabric.sh
./setup_fabric.sh
```

This script will:
1. Start the Fabric test network
2. Create a channel named "alumni-channel"
3. Deploy the final-smart-contract chaincode (display name: Final Smart Contract)
4. Copy the connection profiles and certificates to the backend
5. Create a `.env` file with the appropriate configuration

### 4. Verify Setup

Run the test script to verify your setup:

```bash
cd backend
python test_blockchain.py
```

This should output a successful test of storing and verifying a document hash on the blockchain.

## Usage in the Application

The blockchain integration is used in the document verification flow. Here's how it works:

1. When a document is uploaded and verified by an admin, its hash is stored on the blockchain
2. The document ID and hash are stored in the blockchain ledger
3. Later, anyone can verify the authenticity of a document by comparing its hash with what's stored on the blockchain

### Key Functions

The following functions are available in `app/blockchain/fabric.py`:

- `initialize_fabric_client()`: Initializes the connection to the Fabric network
- `store_document_hash(document_id, document_hash, metadata)`: Stores a document hash on the blockchain
- `verify_document_hash(document_id, document_hash)`: Verifies if a document hash matches what's on the blockchain
- `generate_document_hash(file_content)`: Generates a SHA-256 hash for a document
- `get_document_history(document_id)`: Gets the history of a document (all transactions)

## Troubleshooting

### Connection Issues

- Ensure Docker is running
- Check if all containers are up with `docker ps`
- Verify that the network configuration paths in your `.env` file are correct

### Invalid Certificates

- Make sure the certificate paths in `network-config.yaml` are correct
- Check if the certificates were copied correctly during setup

### Chaincode Issues

- Verify the chaincode was deployed successfully
- Check Docker logs for any errors: `docker logs peer0.org1.example.com`

## Architecture

The system uses a standard Hyperledger Fabric network with:
- 1 organization (Org1)
- 1 peer (peer0.org1.example.com)
- 1 certificate authority (ca.org1.example.com)
- 1 channel (alumni-channel)
- 1 chaincode (`final-smart-contract`, Final Smart Contract)

The chaincode provides functions for storing and verifying document hashes, as well as tracking their history.

## Security Considerations

- The private keys and certificates should be kept secure
- In a production environment, use proper secrets management
- Consider using a multi-organization setup for increased security and decentralization

## Further Resources

- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)
- [Chaincode API Reference](https://hyperledger-fabric.readthedocs.io/en/release-2.2/chaincode.html)
- [Fabric SDK for Python](https://github.com/hyperledger/fabric-sdk-py) 