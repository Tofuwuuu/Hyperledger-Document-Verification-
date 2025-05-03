#!/usr/bin/env python3
"""
Hyperledger Fabric Development Environment Setup Script

This script automates the setup of the Hyperledger Fabric development environment
for the application. It performs the following tasks:
1. Starts the test network
2. Creates a channel
3. Deploys chaincode
4. Copies connection profiles and certificates to the correct locations
5. Sets up the configuration files
"""

import os
import sys
import subprocess
import shutil
import json
import argparse
from pathlib import Path

# Set up argument parser
parser = argparse.ArgumentParser(description='Setup Hyperledger Fabric development environment')
parser.add_argument('--skip-network', action='store_true', help='Skip network startup (use existing network)')
parser.add_argument('--channel', default='mychannel', help='Channel name (default: mychannel)')
parser.add_argument('--chaincode', default='basic', help='Chaincode name (default: basic)')
parser.add_argument('--deploy-document-verification', action='store_true', help='Deploy document verification chaincode')
args = parser.parse_args()

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
FABRIC_SAMPLES_DIR = os.path.join(SCRIPT_DIR, 'fabric-samples')
TEST_NETWORK_DIR = os.path.join(FABRIC_SAMPLES_DIR, 'test-network')
BACKEND_CONFIG_DIR = os.path.join(PROJECT_ROOT, 'backend', 'app', 'config', 'fabric')
DOCUMENT_CHAINCODE_DIR = os.path.join(FABRIC_SAMPLES_DIR, 'chaincode', 'document-verification')

# Create backend config directories
os.makedirs(os.path.join(BACKEND_CONFIG_DIR, 'networks'), exist_ok=True)
os.makedirs(os.path.join(BACKEND_CONFIG_DIR, 'users', 'Org1', 'admin'), exist_ok=True)
os.makedirs(os.path.join(BACKEND_CONFIG_DIR, 'users', 'Org2', 'admin'), exist_ok=True)

print("=== Hyperledger Fabric Development Environment Setup ===")

# Check if Docker is running
try:
    subprocess.run(['docker', 'ps'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    print("✅ Docker is running")
except (subprocess.CalledProcessError, FileNotFoundError):
    print("❌ Docker is not running. Please start Docker Desktop and try again.")
    sys.exit(1)

# Check for fabric-samples directory
if not os.path.exists(FABRIC_SAMPLES_DIR):
    print("❌ fabric-samples directory not found. Please extract fabric-samples.zip first.")
    sys.exit(1)

# Start test network if not skipped
if not args.skip_network:
    print("\n=== Starting Test Network ===")
    
    # Navigate to test-network directory
    os.chdir(TEST_NETWORK_DIR)
    
    # Bring down any running networks
    print("Bringing down any running networks...")
    subprocess.run(['./network.sh', 'down'], check=True)
    
    # Start a new network
    print("Starting a new network...")
    subprocess.run(['./network.sh', 'up'], check=True)
    
    # Create a channel
    print(f"Creating channel: {args.channel}...")
    subprocess.run(['./network.sh', 'createChannel', '-c', args.channel], check=True)
    
    # Deploy the main chaincode
    print(f"Deploying chaincode: {args.chaincode}...")
    subprocess.run([
        './network.sh', 'deployCC', 
        '-c', args.channel, 
        '-ccn', args.chaincode, 
        '-ccp', f'../asset-transfer-basic/chaincode-go', 
        '-ccl', 'go'
    ], check=True)
    
    # Optionally deploy document verification chaincode
    if args.deploy_document_verification:
        print("\n=== Deploying Document Verification Chaincode ===")
        
        # Check if document verification chaincode exists
        if not os.path.exists(DOCUMENT_CHAINCODE_DIR):
            print("❌ Document verification chaincode directory not found.")
            print("Please make sure the chaincode is in the correct location.")
        else:
            print("Deploying document-verification chaincode...")
            subprocess.run([
                './network.sh', 'deployCC', 
                '-c', args.channel, 
                '-ccn', 'document-verification', 
                '-ccp', '../chaincode/document-verification/go', 
                '-ccl', 'go'
            ], check=True)
            print("✅ Document verification chaincode deployed")

# Copy connection profiles and certificates to backend config
print("\n=== Copying Connection Profiles and Certificates ===")

# Copy connection profiles
org1_connection_profile = os.path.join(
    TEST_NETWORK_DIR,
    'organizations/peerOrganizations/org1.example.com/connection-org1.json'
)
org2_connection_profile = os.path.join(
    TEST_NETWORK_DIR,
    'organizations/peerOrganizations/org2.example.com/connection-org2.json'
)

if os.path.exists(org1_connection_profile):
    # Copy and rename
    network_name = f"{args.channel}-network"
    destination = os.path.join(BACKEND_CONFIG_DIR, 'networks', f"{network_name}.json")
    shutil.copy(org1_connection_profile, destination)
    print(f"✅ Copied Org1 connection profile to {destination}")
else:
    print(f"❌ Org1 connection profile not found at {org1_connection_profile}")
    print("   This may indicate that the network didn't start correctly.")

if os.path.exists(org2_connection_profile):
    destination = os.path.join(BACKEND_CONFIG_DIR, 'networks', "org2-network.json")
    shutil.copy(org2_connection_profile, destination)
    print(f"✅ Copied Org2 connection profile to {destination}")

# Copy admin certificates and keys
org1_cert_dir = os.path.join(
    TEST_NETWORK_DIR,
    'organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts'
)
org1_key_dir = os.path.join(
    TEST_NETWORK_DIR,
    'organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore'
)

# Find the actual certificate and key files
try:
    org1_cert_file = next(Path(org1_cert_dir).glob('*.pem'))
    org1_key_file = next(Path(org1_key_dir).glob('*_sk'))

    # Copy certificate
    with open(org1_cert_file, 'r') as f:
        org1_cert_content = f.read()
    
    with open(os.path.join(BACKEND_CONFIG_DIR, 'users', 'Org1', 'admin', 'cert.pem'), 'w') as f:
        f.write(org1_cert_content)
    
    # Copy private key
    with open(org1_key_file, 'r') as f:
        org1_key_content = f.read()
    
    with open(os.path.join(BACKEND_CONFIG_DIR, 'users', 'Org1', 'admin', 'key.pem'), 'w') as f:
        f.write(org1_key_content)
    
    # Create MSP ID file
    with open(os.path.join(BACKEND_CONFIG_DIR, 'users', 'Org1', 'admin', 'msp_id'), 'w') as f:
        f.write('Org1MSP')
    
    print("✅ Copied Org1 admin certificates and keys")
except StopIteration:
    print("❌ Could not find Org1 admin certificates or keys")

# Do the same for Org2 if needed

print("\n=== Development Environment Setup Complete ===")
print(f"Network: {args.channel}-network")
print(f"Channel: {args.channel}")
print(f"Main Chaincode: {args.chaincode}")
if args.deploy_document_verification:
    print(f"Document Verification Chaincode: document-verification")

print("\nYou can now use the FabricClient to interact with the network.")
print("Example:")
print("```python")
print("from app.clients.fabric_client import FabricClient")
print(f"from app.config.fabric_config import load_connection_profile, get_admin_identity")
print("")
print(f"# Get connection profile and admin identity")
print(f"connection_profile = load_connection_profile('{args.channel}-network')")
print(f"admin_identity = get_admin_identity('Org1')")
print("")
print("# Create client")
print("client = FabricClient(")
print("    connection_profile_path=connection_profile,")
print("    identity_type='admin',")
print("    msp_id=admin_identity['msp_id'],")
print("    cert_path=admin_identity['cert_path'],")
print("    key_path=admin_identity['key_path'],")
print(f"    channel_name='{args.channel}'")
print(")")
print("")
print("# Connect to network")
print("client.connect()")
print("")
print("# Query chaincode")
print(f"result = client.query_chaincode('{args.chaincode}', 'GetAllAssets', [])")
print("print(result)")
print("```")

if args.deploy_document_verification:
    print("\nDocument Verification Chaincode Example:")
    print("```python")
    print("# Store a document hash")
    print("doc_id = 'doc123'")
    print("doc_hash = '0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'  # SHA-256 of 'test'")
    print("result = client.invoke_chaincode('document-verification', 'StoreDocument', [doc_id, doc_hash, 'owner1', 'diploma', '{}'])")
    print("print(result)")
    print("")
    print("# Verify a document")
    print("verify_result = client.query_chaincode('document-verification', 'VerifyDocument', [doc_id, doc_hash, 'verifier1'])")
    print("print(verify_result)")
    print("")
    print("# Get document history")
    print("history_result = client.query_chaincode('document-verification', 'GetDocumentHistory', [doc_id])")
    print("print(history_result)")
    print("```") 