"""
Hyperledger Fabric Configuration Module.

This module provides configuration settings and utilities for Hyperledger Fabric.
"""

import os
import json
import logging
from typing import Dict, Optional, Any

logger = logging.getLogger(__name__)

# Default settings
DEFAULT_NETWORK = "mychannel-network"
DEFAULT_ORGANIZATION = "Org1"
DEFAULT_CHANNEL = "mychannel"
DEFAULT_CHAINCODE = "basic"

# Directory paths
CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "config", "fabric")
NETWORKS_DIR = os.path.join(CONFIG_DIR, "networks")
USERS_DIR = os.path.join(CONFIG_DIR, "users")

# Create directories if they don't exist
for directory in [CONFIG_DIR, NETWORKS_DIR, USERS_DIR]:
    if not os.path.exists(directory):
        os.makedirs(directory)
        logger.info(f"Created directory: {directory}")

def load_connection_profile(network_name: str = DEFAULT_NETWORK) -> Optional[Dict[str, Any]]:
    """
    Load a connection profile for a Fabric network.
    
    Args:
        network_name (str): Name of the network.
        
    Returns:
        Optional[Dict[str, Any]]: The connection profile as a dictionary, or None if not found.
    """
    try:
        profile_path = os.path.join(NETWORKS_DIR, f"{network_name}.json")
        
        if not os.path.exists(profile_path):
            logger.warning(f"Connection profile not found: {profile_path}")
            return None
        
        with open(profile_path, 'r') as file:
            profile = json.load(file)
            logger.debug(f"Loaded connection profile for {network_name}")
            return profile
            
    except Exception as e:
        logger.error(f"Failed to load connection profile for {network_name}: {e}")
        return None

def save_connection_profile(network_name: str, profile: Dict[str, Any]) -> bool:
    """
    Save a connection profile for a Fabric network.
    
    Args:
        network_name (str): Name of the network.
        profile (Dict[str, Any]): The connection profile as a dictionary.
        
    Returns:
        bool: True if the profile was saved successfully, False otherwise.
    """
    try:
        profile_path = os.path.join(NETWORKS_DIR, f"{network_name}.json")
        
        with open(profile_path, 'w') as file:
            json.dump(profile, file, indent=2)
            logger.info(f"Saved connection profile for {network_name}")
            return True
            
    except Exception as e:
        logger.error(f"Failed to save connection profile for {network_name}: {e}")
        return False

def get_admin_identity(org_name: str = DEFAULT_ORGANIZATION) -> Optional[Dict[str, str]]:
    """
    Get admin identity information for an organization.
    
    Args:
        org_name (str): Name of the organization.
        
    Returns:
        Optional[Dict[str, str]]: Dictionary with admin identity information,
                                 or None if not found.
    """
    try:
        admin_dir = os.path.join(USERS_DIR, org_name, "admin")
        
        if not os.path.exists(admin_dir):
            logger.warning(f"Admin directory not found: {admin_dir}")
            return None
        
        # Check for msp_id file
        msp_id_path = os.path.join(admin_dir, "msp_id")
        if not os.path.exists(msp_id_path):
            logger.warning(f"MSP ID file not found: {msp_id_path}")
            return None
        
        # Check for certificate
        cert_path = os.path.join(admin_dir, "cert.pem")
        if not os.path.exists(cert_path):
            logger.warning(f"Certificate file not found: {cert_path}")
            return None
        
        # Check for private key
        key_path = os.path.join(admin_dir, "key.pem")
        if not os.path.exists(key_path):
            logger.warning(f"Private key file not found: {key_path}")
            return None
        
        # Read MSP ID
        with open(msp_id_path, 'r') as file:
            msp_id = file.read().strip()
        
        return {
            "msp_id": msp_id,
            "cert_path": cert_path,
            "key_path": key_path
        }
        
    except Exception as e:
        logger.error(f"Failed to get admin identity for {org_name}: {e}")
        return None

def save_admin_identity(
    org_name: str, 
    msp_id: str, 
    certificate: str, 
    private_key: str
) -> bool:
    """
    Save admin identity information for an organization.
    
    Args:
        org_name (str): Name of the organization.
        msp_id (str): MSP ID for the organization.
        certificate (str): Admin certificate in PEM format.
        private_key (str): Admin private key in PEM format.
        
    Returns:
        bool: True if the identity was saved successfully, False otherwise.
    """
    try:
        admin_dir = os.path.join(USERS_DIR, org_name, "admin")
        
        # Create the admin directory if it doesn't exist
        if not os.path.exists(admin_dir):
            os.makedirs(admin_dir)
        
        # Save MSP ID
        msp_id_path = os.path.join(admin_dir, "msp_id")
        with open(msp_id_path, 'w') as file:
            file.write(msp_id)
        
        # Save certificate
        cert_path = os.path.join(admin_dir, "cert.pem")
        with open(cert_path, 'w') as file:
            file.write(certificate)
        
        # Save private key
        key_path = os.path.join(admin_dir, "key.pem")
        with open(key_path, 'w') as file:
            file.write(private_key)
        
        logger.info(f"Saved admin identity for {org_name}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to save admin identity for {org_name}: {e}")
        return False

def get_available_networks() -> Dict[str, Dict[str, Any]]:
    """
    Get a list of available Fabric networks.
    
    Returns:
        Dict[str, Dict[str, Any]]: Dictionary of network names to network info.
    """
    networks = {}
    
    try:
        for filename in os.listdir(NETWORKS_DIR):
            if filename.endswith('.json'):
                network_name = filename[:-5]  # Remove .json extension
                network_path = os.path.join(NETWORKS_DIR, filename)
                
                with open(network_path, 'r') as file:
                    profile = json.load(file)
                    
                    # Extract basic network info
                    network_info = {
                        "name": network_name,
                        "organizations": list(profile.get("organizations", {}).keys()),
                        "channels": list(profile.get("channels", {}).keys()),
                        "peers": list(profile.get("peers", {}).keys()),
                        "orderers": list(profile.get("orderers", {}).keys())
                    }
                    
                    networks[network_name] = network_info
        
        return networks
        
    except Exception as e:
        logger.error(f"Failed to get available networks: {e}")
        return {}

def get_available_organizations() -> Dict[str, Dict[str, Any]]:
    """
    Get a list of available organizations with admin identities.
    
    Returns:
        Dict[str, Dict[str, Any]]: Dictionary of organization names to org info.
    """
    organizations = {}
    
    try:
        if os.path.exists(USERS_DIR):
            for org_name in os.listdir(USERS_DIR):
                org_path = os.path.join(USERS_DIR, org_name)
                
                if os.path.isdir(org_path):
                    admin_path = os.path.join(org_path, "admin")
                    
                    # Check if admin identity exists
                    has_admin = (
                        os.path.exists(admin_path) and
                        os.path.exists(os.path.join(admin_path, "msp_id")) and
                        os.path.exists(os.path.join(admin_path, "cert.pem")) and
                        os.path.exists(os.path.join(admin_path, "key.pem"))
                    )
                    
                    # Read MSP ID if admin exists
                    msp_id = None
                    if has_admin:
                        with open(os.path.join(admin_path, "msp_id"), 'r') as file:
                            msp_id = file.read().strip()
                    
                    organizations[org_name] = {
                        "name": org_name,
                        "msp_id": msp_id,
                        "has_admin": has_admin
                    }
        
        return organizations
        
    except Exception as e:
        logger.error(f"Failed to get available organizations: {e}")
        return {} 