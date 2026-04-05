#!/bin/bash

# Exit on error
set -e

# Variables
FABRIC_DIR="$(pwd)/../fabric-dev/fabric-samples"
TEST_NET_DIR="$FABRIC_DIR/test-network"
CC_SRC_PATH="$(pwd)/../fabric-network/chaincode/final-smart-contract/javascript"
CC_NAME="final-smart-contract"
CHANNEL_NAME="alumni-channel"

echo "Setting up Hyperledger Fabric test network..."

# Navigate to test network directory
cd $TEST_NET_DIR

# Bring down any existing network
echo "Bringing down any existing network..."
./network.sh down

# Start network with CA
echo "Starting the test network with Certificate Authorities..."
./network.sh up createChannel -ca -c $CHANNEL_NAME

# Install chaincode
echo "Installing and deploying chaincode..."
./network.sh deployCC -ccn $CC_NAME -ccp $CC_SRC_PATH -ccl node

# Generate connection profiles
echo "Generating connection profiles..."
./organizations/ccp-generate.sh

# Create backend config directories if they don't exist
BACKEND_CONFIG_DIR="../../../backend/app/blockchain/config"
mkdir -p $BACKEND_CONFIG_DIR

# Copy connection profiles and certificates to backend
echo "Copying connection profiles and certificates to backend..."
cp organizations/peerOrganizations/org1.example.com/connection-org1.json $BACKEND_CONFIG_DIR/
cp organizations/peerOrganizations/org1.example.com/connection-org1.yaml $BACKEND_CONFIG_DIR/

# Copy certificates
mkdir -p $BACKEND_CONFIG_DIR/crypto-config/peerOrganizations/org1.example.com/
cp -r organizations/peerOrganizations/org1.example.com/peers $BACKEND_CONFIG_DIR/crypto-config/peerOrganizations/org1.example.com/
cp -r organizations/peerOrganizations/org1.example.com/users $BACKEND_CONFIG_DIR/crypto-config/peerOrganizations/org1.example.com/
cp -r organizations/peerOrganizations/org1.example.com/ca $BACKEND_CONFIG_DIR/crypto-config/peerOrganizations/org1.example.com/

# Update backend .env file
ENV_FILE="../../../backend/.env"

cat > $ENV_FILE << EOL
# Blockchain configuration
NETWORK_CONFIG_PATH=./app/blockchain/config/connection-org1.yaml
ORG_NAME=Org1MSP
ORG_USER=Admin
CHANNEL_NAME=$CHANNEL_NAME
CHAINCODE_NAME=$CC_NAME
CONTRACT_NAME=DocumentVerificationContract

# Path to organization crypto material (relative paths inside the app)
CRYPTO_PATH=./app/blockchain/config/crypto-config
EOL

echo "Setup complete. Fabric network is running with final-smart-contract chaincode deployed."
echo "Backend configuration has been updated." 