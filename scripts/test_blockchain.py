#!/usr/bin/env python3
"""
Test Blockchain Integration

This script tests the blockchain integration by storing and verifying a document.
It uses the BlockchainManager to interact with either the real blockchain or the mock implementation.
"""

import os
import sys
import asyncio
import json
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import our services
from app.services.blockchain_manager import get_blockchain_manager

async def test_blockchain_integration():
    """Test blockchain integration by storing and verifying a document"""
    print("=== Blockchain Integration Test ===")
    
    # Get blockchain manager
    blockchain_mgr = get_blockchain_manager()
    
    # Test document
    document_id = f"test-doc-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    document_hash = "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"  # SHA-256 hash of 'test'
    metadata = {
        "owner": "Test User",
        "document_type": "Test Document",
        "created_at": datetime.now().isoformat()
    }
    
    # 1. Store document
    print(f"\n1. Storing document {document_id}...")
    store_result = await blockchain_mgr.store_document(document_id, document_hash, metadata)
    print(f"Store Result: {json.dumps(store_result, indent=2)}")
    
    if not store_result.get("success"):
        print(f"❌ Failed to store document: {store_result.get('message', 'Unknown error')}")
        return
    
    print(f"✅ Document stored successfully with transaction ID: {store_result.get('transaction_id')}")
    
    # 2. Verify document (correct hash)
    print(f"\n2. Verifying document {document_id} (correct hash)...")
    verify_result = await blockchain_mgr.verify_document(document_id, document_hash)
    print(f"Verify Result: {json.dumps(verify_result, indent=2)}")
    
    if not verify_result.get("success"):
        print(f"❌ Verification failed: {verify_result.get('message', 'Unknown error')}")
    else:
        verified = verify_result.get("verified", False)
        print(f"{'✅' if verified else '❌'} Document verification {'successful' if verified else 'failed'}")
    
    # 3. Verify document (incorrect hash)
    print(f"\n3. Verifying document {document_id} (incorrect hash)...")
    wrong_hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    verify_wrong_result = await blockchain_mgr.verify_document(document_id, wrong_hash)
    print(f"Verify Result (wrong hash): {json.dumps(verify_wrong_result, indent=2)}")
    
    if not verify_wrong_result.get("success"):
        print(f"❌ Verification failed: {verify_wrong_result.get('message', 'Unknown error')}")
    else:
        verified = verify_wrong_result.get("verified", False)
        # This should be false
        print(f"{'✅' if not verified else '❌'} Document verification {'correctly failed' if not verified else 'incorrectly succeeded'}")
    
    # 4. Get document history
    print(f"\n4. Getting document history for {document_id}...")
    history_result = await blockchain_mgr.get_document_history(document_id)
    print(f"History Result: {json.dumps(history_result, indent=2)}")
    
    if not history_result.get("success"):
        print(f"❌ Failed to get document history: {history_result.get('message', 'Unknown error')}")
    else:
        history = history_result.get("history", [])
        print(f"✅ Found {len(history)} history entries")
    
    # 5. Test document hash calculation
    print(f"\n5. Testing document hash calculation...")
    test_content = b"test"
    calculated_hash = blockchain_mgr.calculate_document_hash(test_content)
    expected_hash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    
    print(f"Calculated Hash: {calculated_hash}")
    print(f"Expected Hash:   {expected_hash}")
    print(f"{'✅' if calculated_hash == expected_hash else '❌'} Hash calculation {'matched' if calculated_hash == expected_hash else 'did not match'}")
    
    # Summary
    print("\n=== Test Summary ===")
    print(f"✅ All tests completed")

if __name__ == "__main__":
    asyncio.run(test_blockchain_integration()) 