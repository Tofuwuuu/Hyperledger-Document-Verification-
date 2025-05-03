#!/usr/bin/env python3
"""
Test script for blockchain document verification
"""

import os
import sys
import asyncio
import json
import hashlib
from app.blockchain.fabric import (
    initialize_fabric_client,
    store_document_hash,
    verify_document_hash,
    generate_document_hash,
    get_document_history
)
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv()

# Get absolute path to the JSON config file
current_dir = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(current_dir, "app", "blockchain", "network-config.json")

# Override environment variables for testing
os.environ["NETWORK_CONFIG_PATH"] = config_path
os.environ["USE_REAL_BLOCKCHAIN"] = "false"  # Use mock mode for testing

async def test_document_workflow():
    """Test the entire document verification workflow"""
    print("\n=== Testing Blockchain Document Verification ===\n")
    
    # Initialize fabric client
    print("Initializing Fabric client...")
    if not initialize_fabric_client():
        print("Failed to initialize Fabric client. Check your configuration.")
        return False
    
    # Test document data
    doc_id = f"DOC-{hashlib.md5(os.urandom(8)).hexdigest()}"
    doc_content = "This is a test document for blockchain verification."
    doc_hash = generate_document_hash(doc_content)
    metadata = json.dumps({
        "filename": "test_document.pdf",
        "document_type": "transcript",
        "issuer": "CVSU",
        "student_id": "2023001"
    })
    
    print(f"Generated document ID: {doc_id}")
    print(f"Document hash: {doc_hash}")
    
    # Store document hash
    print("\nStoring document hash on blockchain...")
    store_result = await store_document_hash(doc_id, doc_hash, metadata)
    
    if not store_result.get("success", False):
        print(f"Failed to store document hash: {store_result.get('message', 'Unknown error')}")
        return False
    
    print("Document hash stored successfully!")
    print(f"Transaction ID: {store_result.get('transaction_id', 'N/A')}")
    
    # Verify document with correct hash
    print("\nVerifying document with correct hash...")
    verify_result = await verify_document_hash(doc_id, doc_hash)
    
    if not verify_result.get("success", False):
        print(f"Verification request failed: {verify_result.get('message', 'Unknown error')}")
        return False
    
    if verify_result.get("verified", False):
        print("Document verified successfully! ✅")
    else:
        print("Document verification failed! ❌")
        return False
    
    # Test with incorrect hash
    incorrect_hash = generate_document_hash("This is modified content")
    print(f"\nTesting with incorrect hash: {incorrect_hash}")
    verify_result = await verify_document_hash(doc_id, incorrect_hash)
    
    if verify_result.get("verified", True):
        print("ERROR: Verification with incorrect hash succeeded when it should have failed!")
        return False
    else:
        print("Correctly rejected the incorrect document hash! ✅")
    
    # Get document history
    print("\nRetrieving document history...")
    history_result = await get_document_history(doc_id)
    
    if not history_result.get("success", False):
        print(f"Failed to get document history: {history_result.get('message', 'Unknown error')}")
        return False
    
    history = history_result.get("history", [])
    print(f"Document has {len(history)} historical records:")
    for idx, record in enumerate(history, 1):
        print(f"  Record {idx}:")
        print(f"    Transaction ID: {record.get('txId', 'N/A')}")
        print(f"    Status: {record.get('status', 'N/A')}")
        print(f"    Timestamp: {record.get('timestamp', 'N/A')}")
    
    print("\n=== Blockchain test completed successfully! ===")
    return True

if __name__ == "__main__":
    try:
        result = asyncio.run(test_document_workflow())
        sys.exit(0 if result else 1)
    except Exception as e:
        print(f"Error during test: {str(e)}")
        sys.exit(1) 