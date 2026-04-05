#!/usr/bin/env python
"""
Check Hyperledger Fabric Configuration

This script checks if the necessary environment variables and configuration files
are in place for Hyperledger Fabric integration.
"""

import os
import sys
import json
from dotenv import load_dotenv
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
load_dotenv()

def check_environment_variables():
    """Check if necessary environment variables are set"""
    required_vars = {
        "NETWORK_CONFIG_PATH": os.getenv("NETWORK_CONFIG_PATH"),
        "ORG_NAME": os.getenv("ORG_NAME", "Org1"),
        "ORG_USER": os.getenv("ORG_USER", "Admin"),
        "CHANNEL_NAME": os.getenv("CHANNEL_NAME", "mychannel"),
        "CHAINCODE_NAME": os.getenv("CHAINCODE_NAME", "final-smart-contract")
    }
    
    missing_vars = []
    for var_name, var_value in required_vars.items():
        if not var_value:
            missing_vars.append(var_name)
        else:
            print(f"✓ {var_name}: {var_value}")
    
    if missing_vars:
        print("\n❌ Missing environment variables:")
        for var_name in missing_vars:
            print(f"  - {var_name}")
    
    return len(missing_vars) == 0

def check_connection_profile():
    """Check if connection profile exists and is valid"""
    network_config_path = os.getenv("NETWORK_CONFIG_PATH")
    
    if not network_config_path:
        print("\n❌ NETWORK_CONFIG_PATH environment variable not set")
        return False
    
    if not os.path.exists(network_config_path):
        print(f"\n❌ Connection profile not found at {network_config_path}")
        
        # Check common locations
        common_locations = [
            "app/config/fabric/connection-org1.json",
            "config/fabric/connection-org1.json",
            "../fabric-dev/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json"
        ]
        
        for location in common_locations:
            abs_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), location)
            if os.path.exists(abs_path):
                print(f"  📝 Found connection profile at: {abs_path}")
                print(f"  💡 Tip: Set NETWORK_CONFIG_PATH={abs_path} in your .env file")
        
        return False
    
    # Check if file is valid JSON
    try:
        with open(network_config_path, 'r') as f:
            config = json.load(f)
            
            # Check for required fields
            required_fields = ['name', 'version', 'organizations', 'peers']
            missing_fields = [field for field in required_fields if field not in config]
            
            if missing_fields:
                print(f"\n❌ Connection profile missing fields: {', '.join(missing_fields)}")
                return False
            
            # Print some basic info about the profile
            print(f"\n✓ Connection profile found and valid")
            print(f"  - Network name: {config.get('name', 'Unknown')}")
            print(f"  - Organizations: {', '.join(config.get('organizations', {}).keys())}")
            print(f"  - Peers: {', '.join(config.get('peers', {}).keys())}")
            
            # Check for organization
            org_name = os.getenv("ORG_NAME", "Org1")
            if org_name not in config.get('organizations', {}):
                print(f"\n⚠️ Warning: Organization '{org_name}' not found in connection profile")
            
            return True
            
    except json.JSONDecodeError:
        print(f"\n❌ Connection profile is not valid JSON")
        return False
    except Exception as e:
        print(f"\n❌ Error reading connection profile: {str(e)}")
        return False

def check_fabric_sdk():
    """Check if Fabric SDK is installed"""
    try:
        import hfc.fabric
        print(f"\n✓ Fabric SDK installed: hfc.fabric")
        return True
    except ImportError:
        print("\n❌ Fabric SDK not installed")
        print("  💡 Tip: Install with 'pip install fabric-sdk-py'")
        return False

def check_wallet_directory():
    """Check if wallet directory exists and has identities"""
    wallet_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app/config/fabric/wallet")
    
    if not os.path.exists(wallet_path):
        print(f"\n⚠️ Warning: Wallet directory not found at {wallet_path}")
        print("  💡 Tip: Create this directory for storing Fabric identities")
        os.makedirs(wallet_path, exist_ok=True)
        print(f"  📝 Created wallet directory: {wallet_path}")
    else:
        print(f"\n✓ Wallet directory found: {wallet_path}")
        
        # Check for identities
        identities = [f for f in os.listdir(wallet_path) if os.path.isdir(os.path.join(wallet_path, f))]
        if identities:
            print(f"  - Identities found: {', '.join(identities)}")
        else:
            print("  ⚠️ Warning: No identities found in wallet directory")
    
    return True

def main():
    """Main function"""
    print("=== Checking Hyperledger Fabric Configuration ===\n")
    
    env_vars_ok = check_environment_variables()
    connection_profile_ok = check_connection_profile()
    fabric_sdk_ok = check_fabric_sdk()
    wallet_ok = check_wallet_directory()
    
    # Summary
    print("\n=== Summary ===")
    print(f"Environment Variables: {'✓' if env_vars_ok else '❌'}")
    print(f"Connection Profile: {'✓' if connection_profile_ok else '❌'}")
    print(f"Fabric SDK: {'✓' if fabric_sdk_ok else '❌'}")
    print(f"Wallet Directory: {'✓' if wallet_ok else '⚠️'}")
    
    # Overall status
    if env_vars_ok and connection_profile_ok and fabric_sdk_ok:
        print("\n✅ Fabric configuration appears to be correct!")
        print("  📝 Run 'python backend/scripts/test_fabric_client.py' to test the connection")
        return 0
    else:
        print("\n❌ Some Fabric configuration issues need to be resolved")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 