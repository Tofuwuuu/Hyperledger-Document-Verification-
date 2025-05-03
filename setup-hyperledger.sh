#!/bin/bash
# Hyperledger Fabric Setup Script for Ubuntu WSL
# This script sets up a complete Hyperledger Fabric network

# Exit on error
set -e

echo '=== Setting up Hyperledger Fabric ==='

# Set variables
export FABRIC_SAMPLES_DIR=~/fabric-samples
export CHANNEL_NAME=mychannel
export CHAINCODE_NAME=document-verification

echo '=== Making sure we are in the fabric-samples directory ==='
cd $FABRIC_SAMPLES_DIR

echo '=== Shutting down any running networks ==='
cd test-network
./network.sh down

echo '=== Creating cryptogen configuration ==='
mkdir -p organizations/cryptogen
# Create Org1 config
cat > organizations/cryptogen/crypto-config-org1.yaml << 'EOF'
PeerOrgs:
  - Name: Org1
    Domain: org1.example.com
    EnableNodeOUs: true
    Template:
      Count: 1
    Users:
      Count: 1
EOF
# Create Org2 config
cat > organizations/cryptogen/crypto-config-org2.yaml << 'EOF'
PeerOrgs:
  - Name: Org2
    Domain: org2.example.com
    EnableNodeOUs: true
    Template:
      Count: 1
    Users:
      Count: 1
EOF
# Create Orderer config
cat > organizations/cryptogen/crypto-config-orderer.yaml << 'EOF'
OrdererOrgs:
  - Name: Orderer
    Domain: example.com
    EnableNodeOUs: true
    Specs:
      - Hostname: orderer
EOF

echo '=== Starting the test network with cryptogen ==='
./network.sh up createChannel -c $CHANNEL_NAME

echo '=== Creating directories for document verification chaincode ==='
mkdir -p ../chaincode/document-verification/go/
cd ../chaincode/document-verification/go/

echo '=== Creating document verification chaincode ==='
cat > main.go << 'EOF'
package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for document verification
type SmartContract struct {
	contractapi.Contract
}

// Document describes the structure of a document record
type Document struct {
	ID        string    `json:"id"`
	Hash      string    `json:"hash"`
	Owner     string    `json:"owner"`
	DocType   string    `json:"docType"`
	Metadata  string    `json:"metadata"`
	Timestamp time.Time `json:"timestamp"`
}

// VerificationRecord describes a verification event
type VerificationRecord struct {
	DocID     string    `json:"docId"`
	Hash      string    `json:"hash"`
	Verifier  string    `json:"verifier"`
	Verified  bool      `json:"verified"`
	Timestamp time.Time `json:"timestamp"`
}

// InitLedger adds a base set of documents to the ledger
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	return nil
}

// StoreDocument adds a new document to the world state with given details
func (s *SmartContract) StoreDocument(ctx contractapi.TransactionContextInterface, documentID string, documentHash string, owner string, docType string, metadata string) error {
	exists, err := s.DocumentExists(ctx, documentID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("document %s already exists", documentID)
	}

	document := Document{
		ID:        documentID,
		Hash:      documentHash,
		Owner:     owner,
		DocType:   docType,
		Metadata:  metadata,
		Timestamp: time.Now(),
	}

	documentJSON, err := json.Marshal(document)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(documentID, documentJSON)
}

// VerifyDocument verifies a document hash matches what is stored in the blockchain
func (s *SmartContract) VerifyDocument(ctx contractapi.TransactionContextInterface, documentID string, documentHash string, verifier string) (bool, error) {
	documentJSON, err := ctx.GetStub().GetState(documentID)
	if err != nil {
		return false, fmt.Errorf("failed to read document: %v", err)
	}
	if documentJSON == nil {
		return false, fmt.Errorf("document %s does not exist", documentID)
	}

	var document Document
	err = json.Unmarshal(documentJSON, &document)
	if err != nil {
		return false, err
	}

	verified := document.Hash == documentHash

	// Store verification record
	verificationRecord := VerificationRecord{
		DocID:     documentID,
		Hash:      documentHash,
		Verifier:  verifier,
		Verified:  verified,
		Timestamp: time.Now(),
	}

	verificationKey := fmt.Sprintf("verify_%s_%s_%s", documentID, verifier, time.Now().Format("20060102150405"))
	verificationJSON, err := json.Marshal(verificationRecord)
	if err != nil {
		return verified, err
	}

	err = ctx.GetStub().PutState(verificationKey, verificationJSON)
	if err != nil {
		return verified, err
	}

	return verified, nil
}

// GetDocument returns a document from the world state
func (s *SmartContract) GetDocument(ctx contractapi.TransactionContextInterface, documentID string) (*Document, error) {
	documentJSON, err := ctx.GetStub().GetState(documentID)
	if err != nil {
		return nil, fmt.Errorf("failed to read document: %v", err)
	}
	if documentJSON == nil {
		return nil, fmt.Errorf("document %s does not exist", documentID)
	}

	var document Document
	err = json.Unmarshal(documentJSON, &document)
	if err != nil {
		return nil, err
	}

	return &document, nil
}

// DocumentExists returns true when a document with the given ID exists in world state
func (s *SmartContract) DocumentExists(ctx contractapi.TransactionContextInterface, documentID string) (bool, error) {
	documentJSON, err := ctx.GetStub().GetState(documentID)
	if err != nil {
		return false, fmt.Errorf("failed to read document: %v", err)
	}

	return documentJSON != nil, nil
}

// GetDocumentHistory returns the history of a document
func (s *SmartContract) GetDocumentHistory(ctx contractapi.TransactionContextInterface, documentID string) ([]Document, error) {
	resultsIterator, err := ctx.GetStub().GetHistoryForKey(documentID)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var documents []Document
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var document Document
		if len(response.Value) > 0 {
			err = json.Unmarshal(response.Value, &document)
			if err != nil {
				return nil, err
			}
			documents = append(documents, document)
		}
	}

	return documents, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		fmt.Printf("Error creating document verification chaincode: %v", err)
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting document verification chaincode: %v", err)
	}
}
EOF

cat > go.mod << 'EOF'
module document-verification

go 1.18

require github.com/hyperledger/fabric-contract-api-go v1.2.1
EOF

echo '=== Deploying document verification chaincode ==='
cd $FABRIC_SAMPLES_DIR/test-network
./network.sh deployCC -c $CHANNEL_NAME -ccn $CHAINCODE_NAME -ccp ../chaincode/document-verification/go -ccl go

echo '=== Setting up connection profiles and certificates ==='
# Create backend config directories
mkdir -p /mnt/f/Project/FINAL/backend/app/config/fabric/networks
mkdir -p /mnt/f/Project/FINAL/backend/app/config/fabric/users/Org1/admin
mkdir -p /mnt/f/Project/FINAL/backend/app/config/fabric/users/Org2/admin

# Copy connection profiles
cp $FABRIC_SAMPLES_DIR/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json /mnt/f/Project/FINAL/backend/app/config/fabric/networks/mychannel-network.json
cp $FABRIC_SAMPLES_DIR/test-network/organizations/peerOrganizations/org2.example.com/connection-org2.json /mnt/f/Project/FINAL/backend/app/config/fabric/networks/org2-network.json

# Copy certificates and keys for Org1
ORG1_CERT=$(find $FABRIC_SAMPLES_DIR/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts -name '*.pem')
ORG1_KEY=$(find $FABRIC_SAMPLES_DIR/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore -name '*_sk')

if [ -f "$ORG1_CERT" ]; then
  cp "$ORG1_CERT" /mnt/f/Project/FINAL/backend/app/config/fabric/users/Org1/admin/cert.pem
  echo 'Copied Org1 admin certificate'
else
  echo 'Failed to find Org1 admin certificate'
fi

if [ -f "$ORG1_KEY" ]; then
  cp "$ORG1_KEY" /mnt/f/Project/FINAL/backend/app/config/fabric/users/Org1/admin/key.pem
  echo 'Copied Org1 admin key'
else
  echo 'Failed to find Org1 admin key'
fi

echo '=== Creating MSP ID file ==='
echo 'Org1MSP' > /mnt/f/Project/FINAL/backend/app/config/fabric/users/Org1/admin/msp_id

echo '=== Create environment file for backend ==='
cat > /mnt/f/Project/FINAL/backend/.env << 'EOF'
# Blockchain configuration
NETWORK_CONFIG_PATH=./app/config/fabric/networks/mychannel-network.json
ORG_NAME=Org1MSP
ORG_USER=Admin
CHANNEL_NAME=mychannel
CHAINCODE_NAME=document-verification
USE_REAL_BLOCKCHAIN=false
EOF

echo '=== Hyperledger Fabric Setup Complete ==='
echo 'Network is running with the following containers:'
docker ps
echo ''
echo 'Backend configuration has been updated, but using mock blockchain mode.'
echo 'To use the real blockchain, update the following in backend/.env:'
echo 'USE_REAL_BLOCKCHAIN=true'
