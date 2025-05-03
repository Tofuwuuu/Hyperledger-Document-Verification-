"""
Unit tests for Fabric network client.
"""

import os
import json
import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock, mock_open
from pathlib import Path
import tempfile

from hfc.fabric.peer import Peer
from hfc.fabric.orderer import Orderer
from hfc.fabric.user import User

from app.core.fabric_client import FabricNetworkClient, FabricSDKClient
from app.core.fabric_wallet import FileSystemWallet, Identity

# Sample connection profile for testing
MOCK_CONNECTION_PROFILE = {
    "name": "test-network",
    "version": "1.0.0",
    "peers": {
        "peer0.org1.example.com": {
            "url": "grpcs://peer0.org1.example.com:7051",
            "tlsCACerts": {
                "pem": "-----BEGIN CERTIFICATE-----\nMIICAjCCAaigAwIBAgIUBEVwsSx0TmqdbzNwleNBBzoIT0wwCgYIKoZIzj0EAwIw\n-----END CERTIFICATE-----\n"
            },
            "grpcOptions": {
                "ssl-target-name-override": "peer0.org1.example.com"
            }
        }
    },
    "orderers": {
        "orderer.example.com": {
            "url": "grpcs://orderer.example.com:7050",
            "tlsCACerts": {
                "pem": "-----BEGIN CERTIFICATE-----\nMIICAjCCAaigAwIBAgIUBEVwsSx0TmqdbzNwleNBBzoIT0wwCgYIKoZIzj0EAwIw\n-----END CERTIFICATE-----\n"
            },
            "grpcOptions": {
                "ssl-target-name-override": "orderer.example.com"
            }
        }
    }
}

# Mock identity for testing
MOCK_IDENTITY = Identity(
    name="admin",
    msp_id="Org1MSP",
    certificate="-----BEGIN CERTIFICATE-----\nMIICKjCCAc+gAwIBAgIUBEVwsSx0TmqdbzNwleNBBzoIT0wwCgYIKoZIzj0EAwIw\n-----END CERTIFICATE-----\n",
    private_key="-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgRgQr347ij6cjwX7m\n-----END PRIVATE KEY-----\n"
)

# Sample test data
SAMPLE_NETWORK_PROFILE = {
    "name": "test-network",
    "version": "1.0.0",
    "organizations": {
        "Org1": {
            "mspid": "Org1MSP",
            "peers": ["peer0.org1.example.com"]
        }
    },
    "peers": {
        "peer0.org1.example.com": {
            "url": "grpcs://peer0.org1.example.com:7051",
            "tlsCACerts": {
                "pem": "-----BEGIN CERTIFICATE-----\nMIICQjCCAeigAwIBAgIRAJzAJXgvJlZM8Y1gI4jH...-----END CERTIFICATE-----"
            }
        }
    },
    "orderers": {
        "orderer.example.com": {
            "url": "grpcs://orderer.example.com:7050",
            "tlsCACerts": {
                "pem": "-----BEGIN CERTIFICATE-----\nMIICPDCCAeOgAwIBAgIRAJrEXGOLAJVK...-----END CERTIFICATE-----"
            }
        }
    }
}

SAMPLE_IDENTITY = Identity(
    name="admin",
    msp_id="Org1MSP",
    certificate="-----BEGIN CERTIFICATE-----\nMIICGDCCAb+gAwIBAgIQE...-----END CERTIFICATE-----",
    private_key="-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEG...-----END PRIVATE KEY-----"
)

@pytest.fixture
def mock_connection_profile():
    return {
        "name": "test-network",
        "version": "1.0.0",
        "client": {
            "organization": "Org1"
        },
        "organizations": {
            "Org1": {
                "mspid": "Org1MSP",
                "peers": ["peer0.org1.example.com"]
            }
        },
        "peers": {
            "peer0.org1.example.com": {
                "url": "grpcs://peer0.org1.example.com:7051",
                "tlsCACerts": {
                    "pem": "-----BEGIN CERTIFICATE-----\nMIICJzCCAc2gAwIBAgIUMv3TBJ...\n-----END CERTIFICATE-----\n"
                }
            }
        },
        "orderers": {
            "orderer.example.com": {
                "url": "grpcs://orderer.example.com:7050",
                "tlsCACerts": {
                    "pem": "-----BEGIN CERTIFICATE-----\nMIICJzCCAc2gAwIBAgIUMv3TBJ...\n-----END CERTIFICATE-----\n"
                }
            }
        }
    }


@pytest.fixture
def mock_connection_profile_path(tmp_path, mock_connection_profile):
    profile_path = tmp_path / "connection-profile.json"
    with open(profile_path, 'w') as f:
        json.dump(mock_connection_profile, f)
    return str(profile_path)


@pytest.fixture
def mock_wallet_path(tmp_path):
    wallet_path = tmp_path / "wallet"
    wallet_path.mkdir()
    return str(wallet_path)


@pytest.fixture
def mock_fabric_client():
    with patch('app.core.fabric_client.FabricClient') as mock_client:
        mock_instance = mock_client.return_value
        
        # Mock a peer
        mock_peer = MagicMock(spec=Peer)
        mock_peer.name = "peer0.org1.example.com"
        
        # Mock an orderer
        mock_orderer = MagicMock(spec=Orderer)
        mock_orderer.name = "orderer.example.com"
        
        # Mock client methods
        mock_instance.get_peer.return_value = mock_peer
        mock_instance.get_orderer.return_value = mock_orderer
        
        # Mock query responses
        mock_instance.query_installed_chaincodes = AsyncMock(return_value={
            'chaincodes': [
                {'name': 'mycc', 'version': '1.0', 'path': 'github.com/mycc'}
            ]
        })
        
        mock_instance.query_instantiated_chaincodes = AsyncMock(return_value={
            'chaincodes': [
                {'name': 'mycc', 'version': '1.0', 'path': 'github.com/mycc'}
            ]
        })
        
        mock_instance.query_channels = AsyncMock(return_value={
            'channels': [
                {'channel_id': 'mychannel'}
            ]
        })
        
        mock_instance.channel_create = AsyncMock(return_value="tx123456")
        mock_instance.channel_join = AsyncMock(return_value=[True])
        
        mock_instance.chaincode_install = AsyncMock()
        mock_status = MagicMock()
        mock_status.status = 200
        mock_status.message = "OK"
        mock_instance.chaincode_install.return_value = [mock_status]
        
        mock_instance.chaincode_instantiate = AsyncMock(return_value="tx234567")
        mock_instance.chaincode_invoke = AsyncMock(return_value="tx345678")
        mock_instance.chaincode_query = AsyncMock(return_value=b'{"key": "value"}')
        
        mock_instance.query_transaction = AsyncMock(return_value={"txid": "tx345678"})
        mock_instance.query_block = AsyncMock(return_value={"block_num": 1})
        
        mock_info_response = MagicMock()
        mock_info_response.height = 10
        mock_info_response.currentBlockHash = bytes.fromhex("cafebabe")
        mock_info_response.previousBlockHash = bytes.fromhex("deadbeef")
        mock_instance.query_info = AsyncMock(return_value=mock_info_response)
        
        mock_instance.get_channel_config = AsyncMock(return_value={"config": {}})
        
        yield mock_instance


@pytest.fixture
def fabric_client(mock_connection_profile_path, mock_wallet_path, mock_fabric_client):
    # Create a real client with mocked dependencies
    client = FabricNetworkClient(
        connection_profile_path=mock_connection_profile_path,
        channel_name="mychannel",
        org_name="Org1",
        wallet_path=mock_wallet_path
    )
    
    # Replace the real client with our mock
    client.client = mock_fabric_client
    
    return client


@pytest.fixture
def mock_identity():
    return Identity(
        name="user1",
        msp_id="Org1MSP",
        certificate="-----BEGIN CERTIFICATE-----\nMIICJzCCAc2gAwIBAgIUMv3TBJ...\n-----END CERTIFICATE-----\n",
        private_key="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQ...\n-----END PRIVATE KEY-----\n"
    )


@pytest.fixture
def mock_wallet(mock_wallet_path, mock_identity):
    wallet = FileSystemWallet(mock_wallet_path)
    
    # Mock the get method
    wallet.get = MagicMock(return_value=mock_identity)
    wallet.exists = MagicMock(return_value=True)
    
    return wallet


@pytest.mark.asyncio
async def test_set_user_context(fabric_client, mock_wallet, mock_identity):
    """Test setting user context from an identity in the wallet."""
    # Replace the wallet with our mock
    fabric_client.wallet = mock_wallet
    
    # Call set_user_context
    result = await fabric_client.set_user_context("user1")
    
    # Check results
    assert result is True
    mock_wallet.get.assert_called_once_with("user1")
    fabric_client.client.set_user.assert_called_once()


@pytest.mark.asyncio
async def test_query_installed_chaincodes(fabric_client):
    """Test querying installed chaincodes."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Call method
    result = await fabric_client.query_installed_chaincodes("peer0.org1.example.com")
    
    # Check results
    assert result["success"] is True
    assert "chaincodes" in result
    assert len(result["chaincodes"]) == 1
    assert result["chaincodes"][0]["name"] == "mycc"
    
    # Verify client method was called with correct args
    fabric_client.client.query_installed_chaincodes.assert_called_once_with(
        requestor=fabric_client.current_user,
        peer=fabric_client.client.get_peer.return_value,
        decode=True
    )


@pytest.mark.asyncio
async def test_query_instantiated_chaincodes(fabric_client):
    """Test querying instantiated chaincodes on a channel."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Call method
    result = await fabric_client.query_instantiated_chaincodes("peer0.org1.example.com")
    
    # Check results
    assert result["success"] is True
    assert "chaincodes" in result
    assert len(result["chaincodes"]) == 1
    assert result["chaincodes"][0]["name"] == "mycc"
    
    # Verify client method was called with correct args
    fabric_client.client.query_instantiated_chaincodes.assert_called_once_with(
        requestor=fabric_client.current_user,
        peer=fabric_client.client.get_peer.return_value,
        channel_name=fabric_client.channel_name,
        decode=True
    )


@pytest.mark.asyncio
async def test_query_channels(fabric_client):
    """Test querying channels a peer has joined."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Call method
    result = await fabric_client.query_channels("peer0.org1.example.com")
    
    # Check results
    assert result["success"] is True
    assert "channels" in result
    assert len(result["channels"]) == 1
    assert result["channels"][0]["channel_id"] == "mychannel"
    
    # Verify client method was called with correct args
    fabric_client.client.query_channels.assert_called_once_with(
        requestor=fabric_client.current_user,
        peer=fabric_client.client.get_peer.return_value,
        decode=True
    )


@pytest.mark.asyncio
async def test_create_channel(fabric_client):
    """Test creating a new channel."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Call method
    result = await fabric_client.create_channel(
        channel_name="newchannel",
        orderer_name="orderer.example.com",
        channel_config_path="/path/to/channel.tx"
    )
    
    # Check results
    assert result["success"] is True
    assert result["txid"] == "tx123456"
    
    # Verify client method was called with correct args
    fabric_client.client.channel_create.assert_called_once_with(
        orderer=fabric_client.client.get_orderer.return_value,
        channel_name="newchannel",
        requestor=fabric_client.current_user,
        config_yaml="/path/to/channel.tx",
        channel_profile=fabric_client.org_name
    )


@pytest.mark.asyncio
async def test_join_channel(fabric_client):
    """Test joining peers to a channel."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Call method
    result = await fabric_client.join_channel(
        channel_name="mychannel",
        orderer_name="orderer.example.com",
        peer_names=["peer0.org1.example.com"]
    )
    
    # Check results
    assert result["success"] is True
    assert "results" in result
    assert result["results"]["peer0.org1.example.com"] == "Success"
    
    # Verify client method was called with correct args
    fabric_client.client.channel_join.assert_called_once_with(
        requestor=fabric_client.current_user,
        channel_name="mychannel",
        peers=[fabric_client.client.get_peer.return_value],
        orderer=fabric_client.client.get_orderer.return_value
    )


@pytest.mark.asyncio
async def test_install_chaincode(fabric_client):
    """Test installing chaincode on peers."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Call method
    result = await fabric_client.install_chaincode(
        chaincode_id="mycc",
        chaincode_version="1.0",
        chaincode_path="/path/to/chaincode",
        peer_names=["peer0.org1.example.com"]
    )
    
    # Check results
    assert result["success"] is True
    assert "results" in result
    assert result["results"]["peer0.org1.example.com"] == "Success"
    
    # Verify client method was called with correct args
    fabric_client.client.chaincode_install.assert_called_once_with(
        requestor=fabric_client.current_user,
        peers=[fabric_client.client.get_peer.return_value],
        cc_path="/path/to/chaincode",
        cc_name="mycc",
        cc_version="1.0"
    )


@pytest.mark.asyncio
async def test_instantiate_chaincode(fabric_client):
    """Test instantiating chaincode on a channel."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Call method
    result = await fabric_client.instantiate_chaincode(
        chaincode_id="mycc",
        chaincode_version="1.0",
        peer_name="peer0.org1.example.com",
        args=["init", "a", "100", "b", "200"]
    )
    
    # Check results
    assert result["success"] is True
    assert result["txid"] == "tx234567"
    
    # Verify client method was called with correct args
    fabric_client.client.chaincode_instantiate.assert_called_once_with(
        requestor=fabric_client.current_user,
        channel_name=fabric_client.channel_name,
        peers=[fabric_client.client.get_peer.return_value],
        args=["init", "a", "100", "b", "200"],
        cc_name="mycc",
        cc_version="1.0",
        cc_endorsement_policy=None,
        collections_config=None
    )


@pytest.mark.asyncio
async def test_invoke_chaincode(fabric_client):
    """Test invoking a chaincode function."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Call method
    result = await fabric_client.invoke_chaincode(
        chaincode_id="mycc",
        fcn="move",
        args=["a", "b", "10"],
        peer_names=["peer0.org1.example.com"]
    )
    
    # Check results
    assert result["success"] is True
    assert result["txid"] == "tx345678"
    
    # Verify client method was called with correct args
    fabric_client.client.chaincode_invoke.assert_called_once_with(
        requestor=fabric_client.current_user,
        channel_name=fabric_client.channel_name,
        peers=[fabric_client.client.get_peer.return_value],
        args=["move", "a", "b", "10"],
        cc_name="mycc",
        wait_for_event=True
    )


@pytest.mark.asyncio
async def test_query_chaincode(fabric_client):
    """Test querying a chaincode function."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Call method
    result = await fabric_client.query_chaincode(
        chaincode_id="mycc",
        fcn="query",
        args=["a"],
        peer_name="peer0.org1.example.com"
    )
    
    # Check results
    assert result["success"] is True
    assert result["result"] == {"key": "value"}
    
    # Verify client method was called with correct args
    fabric_client.client.chaincode_query.assert_called_once_with(
        requestor=fabric_client.current_user,
        channel_name=fabric_client.channel_name,
        peers=[fabric_client.client.get_peer.return_value],
        args=["query", "a"],
        cc_name="mycc"
    )


@pytest.mark.asyncio
async def test_get_transaction_by_id(fabric_client):
    """Test getting transaction by ID."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Call method
    result = await fabric_client.get_transaction_by_id(
        tx_id="tx345678",
        peer_name="peer0.org1.example.com"
    )
    
    # Check results
    assert result["success"] is True
    assert result["transaction"]["txid"] == "tx345678"
    
    # Verify client method was called with correct args
    fabric_client.client.query_transaction.assert_called_once_with(
        requestor=fabric_client.current_user,
        channel_name=fabric_client.channel_name,
        peer=fabric_client.client.get_peer.return_value,
        tx_id="tx345678",
        decode=True
    )


@pytest.mark.asyncio
async def test_get_block_by_number(fabric_client):
    """Test getting block by number."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Call method
    result = await fabric_client.get_block_by_number(
        block_number=1,
        peer_name="peer0.org1.example.com"
    )
    
    # Check results
    assert result["success"] is True
    assert result["block"]["block_num"] == 1
    
    # Verify client method was called with correct args
    fabric_client.client.query_block.assert_called_once_with(
        requestor=fabric_client.current_user,
        channel_name=fabric_client.channel_name,
        peer=fabric_client.client.get_peer.return_value,
        block_number=1,
        decode=True
    )


@pytest.mark.asyncio
async def test_get_channel_info(fabric_client):
    """Test getting channel information."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Call method
    result = await fabric_client.get_channel_info(
        peer_name="peer0.org1.example.com"
    )
    
    # Check results
    assert result["success"] is True
    assert result["info"]["height"] == 10
    assert result["info"]["currentBlockHash"] == "cafebabe"
    assert result["info"]["previousBlockHash"] == "deadbeef"
    
    # Verify client method was called with correct args
    fabric_client.client.query_info.assert_called_once_with(
        requestor=fabric_client.current_user,
        channel_name=fabric_client.channel_name,
        peer=fabric_client.client.get_peer.return_value,
        decode=True
    )


@pytest.mark.asyncio
async def test_get_channel_config(fabric_client):
    """Test getting channel configuration."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Call method
    result = await fabric_client.get_channel_config(
        peer_name="peer0.org1.example.com"
    )
    
    # Check results
    assert result["success"] is True
    assert "config" in result
    
    # Verify client method was called with correct args
    fabric_client.client.get_channel_config.assert_called_once_with(
        requestor=fabric_client.current_user,
        channel_name=fabric_client.channel_name,
        peer=fabric_client.client.get_peer.return_value,
        decode=True
    )


@pytest.mark.asyncio
async def test_peer_not_found(fabric_client):
    """Test error handling when peer is not found."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Mock peer not found
    fabric_client.client.get_peer.return_value = None
    
    # Call method
    result = await fabric_client.query_installed_chaincodes("nonexistent_peer")
    
    # Check results
    assert result["success"] is False
    assert "error" in result
    assert "not found" in result["error"]
    
    # Verify the query method was not called
    fabric_client.client.query_installed_chaincodes.assert_not_called()


@pytest.mark.asyncio
async def test_orderer_not_found(fabric_client):
    """Test error handling when orderer is not found."""
    # Setup mock user
    fabric_client.current_user = MagicMock(spec=User)
    
    # Mock orderer not found
    fabric_client.client.get_orderer.return_value = None
    
    # Call method
    result = await fabric_client.create_channel(
        channel_name="newchannel",
        orderer_name="nonexistent_orderer",
        channel_config_path="/path/to/channel.tx"
    )
    
    # Check results
    assert result["success"] is False
    assert "error" in result
    assert "not found" in result["error"]
    
    # Verify the create method was not called
    fabric_client.client.channel_create.assert_not_called()


@pytest.fixture
def mock_wallet():
    wallet = MagicMock(spec=FileSystemWallet)
    wallet.exists.return_value = True
    wallet.get.return_value = SAMPLE_IDENTITY
    return wallet


@pytest.fixture
def mock_fabric_client():
    with patch('app.core.fabric_client.FabricClient') as mock_client:
        # Setup mock responses
        client_instance = mock_client.return_value
        client_instance.new_peer.return_value = None
        client_instance.new_orderer.return_value = None
        client_instance.peers = {"peer0.org1.example.com": MagicMock()}
        client_instance.orderers = {"orderer.example.com": MagicMock()}
        client_instance.channels = {}
        client_instance.new_channel.return_value = MagicMock()
        
        # Return the mocked client
        yield client_instance


@pytest.mark.asyncio
async def test_client_initialization(mock_wallet, mock_fabric_client):
    """Test that the client is initialized correctly with network profile."""
    client = FabricSDKClient(SAMPLE_NETWORK_PROFILE, mock_wallet, "admin")
    
    # Verify peer was added
    mock_fabric_client.new_peer.assert_called_with(
        name="peer0.org1.example.com",
        url="grpcs://peer0.org1.example.com:7051",
        tls_ca_cert_file="-----BEGIN CERTIFICATE-----\nMIICQjCCAeigAwIBAgIRAJzAJXgvJlZM8Y1gI4jH...-----END CERTIFICATE-----",
        org_name="Org1"
    )
    
    # Verify orderer was added
    mock_fabric_client.new_orderer.assert_called_with(
        name="orderer.example.com",
        url="grpcs://orderer.example.com:7050",
        tls_ca_cert_file="-----BEGIN CERTIFICATE-----\nMIICPDCCAeOgAwIBAgIRAJrEXGOLAJVK...-----END CERTIFICATE-----"
    )


@pytest.mark.asyncio
async def test_query_installed_chaincodes(mock_wallet, mock_fabric_client):
    """Test query installed chaincodes functionality."""
    # Setup mock response
    mock_response = {
        "chaincodes": [
            {
                "name": "mycc",
                "version": "1.0",
                "path": "github.com/hyperledger/fabric-samples/chaincode/abac/go"
            }
        ]
    }
    mock_fabric_client.query_installed_chaincodes.return_value = mock_response
    
    # Create client and execute query
    client = FabricSDKClient(SAMPLE_NETWORK_PROFILE, mock_wallet, "admin")
    result = await client.query_installed_chaincodes("peer0.org1.example.com")
    
    # Verify result
    assert result == mock_response
    mock_fabric_client.query_installed_chaincodes.assert_called_once()


@pytest.mark.asyncio
async def test_query_instantiated_chaincodes(mock_wallet, mock_fabric_client):
    """Test query instantiated chaincodes functionality."""
    # Setup mock response
    mock_response = {
        "chaincodes": [
            {
                "name": "mycc",
                "version": "1.0",
                "path": "github.com/hyperledger/fabric-samples/chaincode/abac/go"
            }
        ]
    }
    mock_fabric_client.query_instantiated_chaincodes.return_value = mock_response
    
    # Create client and execute query
    client = FabricSDKClient(SAMPLE_NETWORK_PROFILE, mock_wallet, "admin")
    result = await client.query_instantiated_chaincodes("mychannel", "peer0.org1.example.com")
    
    # Verify result
    assert result == mock_response
    mock_fabric_client.query_instantiated_chaincodes.assert_called_once()


@pytest.mark.asyncio
async def test_invoke_chaincode(mock_wallet, mock_fabric_client):
    """Test invoke chaincode functionality."""
    # Setup mock response
    mock_response = "tx-id-123456"
    mock_fabric_client.chaincode_invoke.return_value = mock_response
    
    # Create client and execute invoke
    client = FabricSDKClient(SAMPLE_NETWORK_PROFILE, mock_wallet, "admin")
    result = await client.invoke_chaincode(
        "mychannel", 
        "mycc", 
        "invoke", 
        ["a", "b", "10"], 
        ["peer0.org1.example.com"]
    )
    
    # Verify result
    assert result["response"] == mock_response
    assert "transaction_id" in result
    mock_fabric_client.chaincode_invoke.assert_called_once()


@pytest.mark.asyncio
async def test_query_chaincode(mock_wallet, mock_fabric_client):
    """Test query chaincode functionality."""
    # Setup mock response
    mock_response = b'{"key":"value"}'
    mock_fabric_client.chaincode_query.return_value = mock_response
    
    # Create client and execute query
    client = FabricSDKClient(SAMPLE_NETWORK_PROFILE, mock_wallet, "admin")
    result = await client.query_chaincode(
        "mychannel", 
        "mycc", 
        "query", 
        ["a"], 
        ["peer0.org1.example.com"]
    )
    
    # Verify result
    assert result["response"] == {"key": "value"}
    mock_fabric_client.chaincode_query.assert_called_once()


@pytest.mark.asyncio
async def test_create_channel(mock_wallet, mock_fabric_client):
    """Test create channel functionality."""
    # Setup mock response
    mock_response = "channel-creation-tx-id"
    mock_fabric_client.create_channel.return_value = mock_response
    
    # Create client and execute create channel
    client = FabricSDKClient(SAMPLE_NETWORK_PROFILE, mock_wallet, "admin")
    result = await client.create_channel(
        "mychannel", 
        "orderer.example.com", 
        "/path/to/channel/config.yaml"
    )
    
    # Verify result
    assert result["status"] == "SUCCESS"
    assert result["response"] == mock_response
    mock_fabric_client.create_channel.assert_called_once()


@pytest.mark.asyncio
async def test_join_channel(mock_wallet, mock_fabric_client):
    """Test join channel functionality."""
    # Setup mock response
    mock_response = [True]  # One peer successfully joined
    mock_fabric_client.join_channel.return_value = mock_response
    
    # Create client and execute join channel
    client = FabricSDKClient(SAMPLE_NETWORK_PROFILE, mock_wallet, "admin")
    result = await client.join_channel(
        "mychannel", 
        ["peer0.org1.example.com"], 
        "orderer.example.com"
    )
    
    # Verify result
    assert result["status"] == "SUCCESS"
    assert result["response"] == mock_response
    mock_fabric_client.join_channel.assert_called_once()


@pytest.mark.asyncio
async def test_connection_profile_loader():
    """Test loading client from connection profile file."""
    # Mock file operations
    with patch('builtins.open', MagicMock()), \
         patch('json.load', return_value=SAMPLE_NETWORK_PROFILE), \
         patch('pathlib.Path.exists', return_value=True), \
         patch('app.core.fabric_client.FabricSDKClient.__init__', return_value=None) as mock_init:
        
        wallet = MagicMock(spec=FileSystemWallet)
        client = FabricSDKClient.from_connection_profile("/path/to/connection/profile.json", wallet, "admin")
        
        # Verify client initialization was called with correct args
        mock_init.assert_called_once_with(SAMPLE_NETWORK_PROFILE, wallet, "admin")

# Test network profile
TEST_NETWORK_PROFILE = {
    "name": "test-network",
    "version": "1.0.0",
    "client": {
        "organization": "Org1MSP",
        "credentialStore": {
            "path": "/tmp/fabric-client-kv-org1",
            "cryptoStore": {
                "path": "/tmp/fabric-client-kv-org1"
            }
        }
    },
    "channels": {
        "mychannel": {
            "orderers": ["orderer.example.com"],
            "peers": {
                "peer0.org1.example.com": {
                    "endorsingPeer": True,
                    "chaincodeQuery": True,
                    "ledgerQuery": True,
                    "eventSource": True
                }
            }
        }
    },
    "organizations": {
        "Org1MSP": {
            "mspid": "Org1MSP",
            "peers": ["peer0.org1.example.com"],
            "certificateAuthorities": ["ca.org1.example.com"]
        }
    },
    "orderers": {
        "orderer.example.com": {
            "url": "grpcs://localhost:7050",
            "tlsCACerts": {
                "path": "/path/to/orderer/tls/ca.crt"
            }
        }
    },
    "peers": {
        "peer0.org1.example.com": {
            "url": "grpcs://localhost:7051",
            "tlsCACerts": {
                "path": "/path/to/peer/tls/ca.crt"
            }
        }
    },
    "certificateAuthorities": {
        "ca.org1.example.com": {
            "url": "https://localhost:7054",
            "caName": "ca.org1.example.com",
            "tlsCACerts": {
                "path": "/path/to/ca/tls/ca.crt"
            }
        }
    }
}

# Sample identity for testing
TEST_IDENTITY = Identity(
    name="admin",
    msp_id="Org1MSP",
    certificate="-----BEGIN CERTIFICATE-----\nMIICGTCCAb+gAwIBAgIQKKKdQSzsDoUYn/LPAuRWGTAKBggqhkjOPQQDAjBzMQsw\nCQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEWMBQGA1UEBxMNU2FuIEZy\nYW5jaXNjbzEZMBcGA1UEChMQb3JnMS5leGFtcGxlLmNvbTEcMBoGA1UEAxMTY2Eu\nb3JnMS5leGFtcGxlLmNvbTAeFw0xNzA2MjMxMjMzMTlaFw0yNzA2MjExMjMzMTla\nMFsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpDYWxpZm9ybmlhMRYwFAYDVQQHEw1T\nYW4gRnJhbmNpc2NvMR8wHQYDVQQDExZwZWVyMC5vcmcxLmV4YW1wbGUuY29tMFkw\nEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEzS9k2gCKHcat8Wj4T2nB1uyC8R2Fm8NE\nBUJA3f7Y6QbRzRuJ4CzTr2rcvvAMNDQpInEkxZ4wUzN6JBfgnHv2mKNNMEswDgYD\nVR0PAQH/BAQDAgeAMAwGA1UdEwEB/wQCMAAwKwYDVR0jBCQwIoAgcecTOxTes6RF\n-----END CERTIFICATE-----",
    private_key="-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQghnA7rdgbZi/wndus\niXjyf0KgE6OKZjQ+5INjwelRAC6hRANCAASi0V17HSSPjjP8/2Ag7P7PIBceiJdA\nj81qX+t6gLLwZnZ9FXaOgXwHpKUMXkro9k9hRzdhUZKIL4EiBUmjL6zk\n-----END PRIVATE KEY-----"
)

class TestFabricSDKClient:
    """
    Test suite for the FabricSDKClient class.
    """
    
    @pytest.fixture
    def client(self):
        """Create a client fixture for testing."""
        return FabricSDKClient(TEST_NETWORK_PROFILE, TEST_IDENTITY)
    
    @pytest.fixture
    def mock_hfc_client(self):
        """Create a mock for the hfc.fabric.Client."""
        with patch('hfc.fabric.Client') as mock_client:
            instance = mock_client.return_value
            instance.query_installed_chaincodes.return_value = {"chaincodes": [{"name": "mycc", "version": "1.0"}]}
            instance.query_instantiated_chaincodes.return_value = {"chaincodes": [{"name": "mycc", "version": "1.0", "path": "github.com/chaincode"}]}
            instance.chaincode_invoke.return_value = {"txid": "mock-txid"}
            instance.chaincode_query.return_value = {"result": "success"}
            instance.channel_create.return_value = {"status": "SUCCESS"}
            instance.channel_join.return_value = {"status": "SUCCESS"}
            instance.chaincode_install.return_value = {"status": "SUCCESS"}
            instance.chaincode_instantiate.return_value = {"status": "SUCCESS"}
            instance.chaincode_upgrade.return_value = {"status": "SUCCESS"}
            yield instance
    
    @patch('tempfile.mkstemp')
    @patch('os.fdopen')
    def test_initialize_client(self, mock_fdopen, mock_mkstemp, client, mock_hfc_client):
        """Test client initialization."""
        # Mock temp file creation
        mock_mkstemp.return_value = (0, '/tmp/mockfile.json')
        
        # Initialize client
        client._initialize_client()
        
        # Check correct calls
        mock_mkstemp.assert_called_once()
        mock_fdopen.assert_called_once()
        
    @patch('hfc.fabric.Client')
    def test_set_user_context(self, mock_client_class, client):
        """Test setting user context."""
        # Mock client
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        client._client = mock_client
        
        # Call method
        client.set_user_context(TEST_IDENTITY)
        
        # Check identity was set
        assert client.identity == TEST_IDENTITY
        mock_client.set_user_context.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_query_installed_chaincodes(self, client, mock_hfc_client):
        """Test querying installed chaincodes."""
        with patch.object(client, '_initialize_client'):
            client._client = mock_hfc_client
            
            result = await client.query_installed_chaincodes("peer0.org1.example.com")
            
            mock_hfc_client.query_installed_chaincodes.assert_called_once()
            assert result == {"chaincodes": [{"name": "mycc", "version": "1.0"}]}
    
    @pytest.mark.asyncio
    async def test_query_instantiated_chaincodes(self, client, mock_hfc_client):
        """Test querying instantiated chaincodes."""
        with patch.object(client, '_initialize_client'):
            client._client = mock_hfc_client
            
            result = await client.query_instantiated_chaincodes("mychannel", "peer0.org1.example.com")
            
            mock_hfc_client.query_instantiated_chaincodes.assert_called_once()
            assert result == {"chaincodes": [{"name": "mycc", "version": "1.0", "path": "github.com/chaincode"}]}
    
    @pytest.mark.asyncio
    async def test_invoke_chaincode(self, client, mock_hfc_client):
        """Test invoking chaincode."""
        with patch.object(client, '_initialize_client'):
            client._client = mock_hfc_client
            
            result = await client.invoke_chaincode(
                "mychannel", 
                "mycc", 
                "invoke", 
                ["arg1", "arg2"], 
                ["peer0.org1.example.com"]
            )
            
            mock_hfc_client.chaincode_invoke.assert_called_once()
            assert result == {"txid": "mock-txid"}
    
    @pytest.mark.asyncio
    async def test_query_chaincode(self, client, mock_hfc_client):
        """Test querying chaincode."""
        with patch.object(client, '_initialize_client'):
            client._client = mock_hfc_client
            
            result = await client.query_chaincode(
                "mychannel", 
                "mycc", 
                "query", 
                ["arg1"], 
                "peer0.org1.example.com"
            )
            
            mock_hfc_client.chaincode_query.assert_called_once()
            assert result == {"result": "success"}
    
    @pytest.mark.asyncio
    async def test_create_channel(self, client, mock_hfc_client):
        """Test creating a channel."""
        with patch.object(client, '_initialize_client'):
            client._client = mock_hfc_client
            
            result = await client.create_channel(
                "mychannel", 
                "orderer.example.com", 
                "/path/to/channel/config.yaml"
            )
            
            mock_hfc_client.channel_create.assert_called_once()
            assert result == {"status": "SUCCESS"}
    
    @pytest.mark.asyncio
    async def test_join_channel(self, client, mock_hfc_client):
        """Test joining a channel."""
        with patch.object(client, '_initialize_client'):
            client._client = mock_hfc_client
            
            result = await client.join_channel(
                "mychannel", 
                ["peer0.org1.example.com"], 
                "orderer.example.com"
            )
            
            mock_hfc_client.channel_join.assert_called_once()
            assert result == {"status": "SUCCESS"}
    
    @pytest.mark.asyncio
    async def test_install_chaincode(self, client, mock_hfc_client):
        """Test installing chaincode."""
        with patch.object(client, '_initialize_client'):
            client._client = mock_hfc_client
            
            result = await client.install_chaincode(
                ["peer0.org1.example.com"], 
                "/path/to/chaincode", 
                "mycc", 
                "1.0"
            )
            
            mock_hfc_client.chaincode_install.assert_called_once()
            assert result == {"status": "SUCCESS"}
    
    @pytest.mark.asyncio
    async def test_instantiate_chaincode(self, client, mock_hfc_client):
        """Test instantiating chaincode."""
        with patch.object(client, '_initialize_client'):
            client._client = mock_hfc_client
            
            result = await client.instantiate_chaincode(
                "mychannel", 
                ["peer0.org1.example.com"], 
                "mycc", 
                "1.0", 
                "init", 
                ["a", "100", "b", "200"]
            )
            
            mock_hfc_client.chaincode_instantiate.assert_called_once()
            assert result == {"status": "SUCCESS"}
    
    @pytest.mark.asyncio
    async def test_upgrade_chaincode(self, client, mock_hfc_client):
        """Test upgrading chaincode."""
        with patch.object(client, '_initialize_client'):
            client._client = mock_hfc_client
            
            result = await client.upgrade_chaincode(
                "mychannel", 
                ["peer0.org1.example.com"], 
                "mycc", 
                "2.0", 
                "init", 
                ["a", "100", "b", "200"]
            )
            
            mock_hfc_client.chaincode_upgrade.assert_called_once()
            assert result == {"status": "SUCCESS"}
    
    @patch('builtins.open', new_callable=mock_open, read_data=json.dumps(TEST_NETWORK_PROFILE))
    def test_from_connection_profile(self, mock_file):
        """Test creating client from connection profile."""
        # Create mock wallet
        mock_wallet = MagicMock(spec=FileSystemWallet)
        mock_wallet.get.return_value = TEST_IDENTITY
        
        # Create client from profile
        client = FabricSDKClient.from_connection_profile(
            "/path/to/connection/profile.json",
            mock_wallet,
            "admin"
        )
        
        # Check client was created with correct params
        assert isinstance(client, FabricSDKClient)
        assert client.identity == TEST_IDENTITY
        mock_wallet.get.assert_called_once_with("admin")

# Mock for the hfc modules
class MockResponse:
    def __init__(self, status=200, payload=None):
        self.response = MagicMock()
        self.response.status = status
        self.response.payload = payload

class MockChannelHeader:
    def __init__(self, tx_id="mock_tx_id", channel_id="mock_channel", timestamp="2023-01-01T00:00:00Z", type=1):
        self.tx_id = tx_id
        self.channel_id = channel_id
        self.timestamp = timestamp
        self.type = type

class MockHeader:
    def __init__(self):
        self.channel_header = MockChannelHeader()

class MockPayload:
    def __init__(self):
        self.header = MockHeader()

class MockTransactionEnvelope:
    def __init__(self):
        self.payload = MockPayload()

class MockBlockData:
    def __init__(self, tx_count=1):
        self.data = [MockTransactionEnvelope() for _ in range(tx_count)]

class MockBlockHeader:
    def __init__(self, number=1):
        self.number = number
        self.previous_hash = b'mock_prev_hash'
        self.data_hash = b'mock_data_hash'

class MockBlock:
    def __init__(self, number=1, tx_count=1):
        self.header = MockBlockHeader(number)
        self.data = MockBlockData(tx_count)

class MockChannelInfo:
    def __init__(self):
        self.height = 10
        self.currentBlockHash = b'current_hash'
        self.previousBlockHash = b'previous_hash'

class MockTransaction:
    def __init__(self):
        self.payload = MockPayload()


@pytest.fixture
def mock_client():
    with patch('backend.app.core.fabric_client.HLFClient') as mock_client:
        instance = mock_client.return_value
        instance.network_info = MagicMock()
        instance.network_info.load_from_config = MagicMock()
        instance.state_store = MagicMock()
        yield instance

@pytest.fixture
def mock_wallet():
    with patch('backend.app.core.fabric_client.FileSystemWallet') as mock_wallet:
        instance = mock_wallet.return_value
        yield instance

@pytest.fixture
def mock_create_user():
    with patch('backend.app.core.fabric_client.create_user') as mock_create:
        mock_user = MagicMock()
        mock_create.return_value = mock_user
        yield mock_create


@pytest.fixture
def fabric_client(mock_client, mock_wallet):
    client = FabricSDKClient(org_name="Org1MSP", wallet_path="/tmp/wallet")
    client._temp_files = []  # Ensure we don't try to delete files during tests
    return client


class TestFabricSDKClient:
    
    def test_init(self, mock_client, mock_wallet):
        client = FabricSDKClient(org_name="Org1MSP", wallet_path="/tmp/wallet")
        assert client.org_name == "Org1MSP"
        assert client.channel_name is None
        assert client._temp_files == []

    def test_init_with_temp_wallet(self, mock_client, mock_wallet, monkeypatch):
        monkeypatch.setattr(tempfile, 'mkdtemp', lambda: '/tmp/tempwallet')
        client = FabricSDKClient(org_name="Org1MSP")
        mock_wallet.assert_called_with('/tmp/tempwallet')

    def test_from_connection_profile(self, mock_client, mock_wallet, monkeypatch):
        # Create a temporary connection profile
        profile = {"name": "test-network", "version": "1.0.0"}
        
        # Mock open to return our profile
        mock_open = MagicMock()
        mock_file = MagicMock()
        mock_file.__enter__.return_value = mock_file
        mock_file.read.return_value = json.dumps(profile)
        mock_open.return_value = mock_file
        
        monkeypatch.setattr('builtins.open', mock_open)
        
        client = FabricSDKClient.from_connection_profile(
            profile_path="/tmp/connection-profile.json",
            org_name="Org1MSP",
            wallet_path="/tmp/wallet"
        )
        
        assert client.org_name == "Org1MSP"
        assert isinstance(client, FabricSDKClient)
        
    def test_set_network_config(self, fabric_client, monkeypatch):
        # Mock tempfile functions
        mock_fd, mock_path = 10, '/tmp/temp_config.json'
        monkeypatch.setattr(tempfile, 'mkstemp', lambda suffix=None: (mock_fd, mock_path))
        
        # Mock os.fdopen
        mock_file = MagicMock()
        mock_fdopen = MagicMock(return_value=mock_file)
        monkeypatch.setattr(os, 'fdopen', mock_fdopen)
        
        network_config = {"name": "test-network", "version": "1.0.0"}
        fabric_client.set_network_config(network_config)
        
        # Check if temp file was created and added to list
        assert mock_path in fabric_client._temp_files
        
        # Check if network_info.load_from_config was called
        fabric_client.client.network_info.load_from_config.assert_called_with(mock_path)
        
    def test_set_user_context(self, fabric_client, mock_create_user):
        identity = Identity(
            name="admin",
            msp_id="Org1MSP",
            certificate="-----BEGIN CERTIFICATE-----\nMIIB8TCCAZsCCQDzlCcO5kpK\n-----END CERTIFICATE-----",
            private_key="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0B\n-----END PRIVATE KEY-----"
        )
        
        fabric_client.set_user_context(identity)
        
        # Check if create_user was called with correct arguments
        mock_create_user.assert_called_with(
            name=identity.name,
            org=fabric_client.org_name,
            state_store=fabric_client.client.state_store,
            msp_id=identity.msp_id,
            cert=identity.certificate,
            private_key=identity.private_key
        )
        
        # Check if user context was set
        assert fabric_client.client.user_context == mock_create_user.return_value

    @pytest.mark.asyncio
    async def test_query_installed_chaincodes(self, fabric_client):
        # Mock response
        mock_response = MagicMock()
        mock_response.response = {"chaincodes": [{"name": "mycc", "version": "1.0"}]}
        
        # Set up the client's query_installed_chaincodes to return our mock response
        fabric_client.client.query_installed_chaincodes = AsyncMock(return_value=[mock_response])
        
        # Call the method
        response = await fabric_client.query_installed_chaincodes("peer0.org1.example.com")
        
        # Check if client method was called correctly
        fabric_client.client.query_installed_chaincodes.assert_called_with(
            requestor=fabric_client.client.user_context,
            peers=["peer0.org1.example.com"],
        )
        
        # Check the response
        assert response == {"chaincodes": [{"name": "mycc", "version": "1.0"}]}

    @pytest.mark.asyncio
    async def test_query_instantiated_chaincodes(self, fabric_client):
        # Mock response
        mock_response = MagicMock()
        mock_response.response = {"chaincodes": [{"name": "mycc", "version": "1.0", "path": "path"}]}
        
        # Set up the client's query_instantiated_chaincodes to return our mock response
        fabric_client.client.query_instantiated_chaincodes = AsyncMock(return_value=mock_response)
        
        # Call the method
        response = await fabric_client.query_instantiated_chaincodes("mychannel")
        
        # Check if client method was called correctly
        fabric_client.client.query_instantiated_chaincodes.assert_called_with(
            requestor=fabric_client.client.user_context,
            channel_name="mychannel",
        )
        
        # Check the response
        assert response == {"chaincodes": [{"name": "mycc", "version": "1.0", "path": "path"}]}

    @pytest.mark.asyncio
    async def test_invoke_chaincode(self, fabric_client):
        # Mock response
        fabric_client.client.chaincode_invoke = AsyncMock(return_value=["tx_id_123"])
        
        # Call the method
        response = await fabric_client.invoke_chaincode(
            chaincode_name="mycc",
            channel_name="mychannel",
            fcn="invoke",
            args=["a", "b", "10"]
        )
        
        # Check if client method was called correctly
        fabric_client.client.chaincode_invoke.assert_called_with(
            requestor=fabric_client.client.user_context,
            channel_name="mychannel",
            peers=['peer0.org1.example.com'],
            args=[b"a", b"b", b"10"],
            cc_name="mycc",
            fcn="invoke",
            transient_map=None,
            wait_for_event=True
        )
        
        # Check the response
        assert response == {'transaction_id': 'tx_id_123', 'status': 'SUCCESS'}

    @pytest.mark.asyncio
    async def test_query_chaincode_with_json_response(self, fabric_client):
        # Mock JSON response
        json_response = json.dumps({"key": "value"}).encode()
        fabric_client.client.chaincode_query = AsyncMock(return_value=json_response)
        
        # Call the method
        response = await fabric_client.query_chaincode(
            chaincode_name="mycc",
            channel_name="mychannel",
            fcn="query",
            args=["a"]
        )
        
        # Check if client method was called correctly
        fabric_client.client.chaincode_query.assert_called_with(
            requestor=fabric_client.client.user_context,
            channel_name="mychannel",
            peers=['peer0.org1.example.com'],
            args=[b"a"],
            cc_name="mycc",
            fcn="query",
            transient_map=None
        )
        
        # Check the response
        assert response == {"key": "value"}

    @pytest.mark.asyncio
    async def test_query_chaincode_with_string_response(self, fabric_client):
        # Mock string response
        string_response = "Hello World".encode()
        fabric_client.client.chaincode_query = AsyncMock(return_value=string_response)
        
        # Call the method
        response = await fabric_client.query_chaincode(
            chaincode_name="mycc",
            channel_name="mychannel",
            fcn="query",
            args=["a"]
        )
        
        # Check the response
        assert response == {"result": "Hello World"}

    @pytest.mark.asyncio
    async def test_create_channel(self, fabric_client):
        # Mock response
        fabric_client.client.channel_create = AsyncMock(return_value=True)
        
        # Call the method
        response = await fabric_client.create_channel(
            channel_name="mychannel",
            orderer_name="orderer.example.com",
            channel_config_path="/path/to/channel.tx"
        )
        
        # Check if client method was called correctly
        fabric_client.client.channel_create.assert_called_with(
            orderer="orderer.example.com",
            channel_name="mychannel",
            requestor=fabric_client.client.user_context,
            config_yaml="/path/to/channel.tx",
            channel_profile='TwoOrgsChannel'
        )
        
        # Check the response
        assert response == {'status': 'SUCCESS', 'channel_name': 'mychannel'}

    @pytest.mark.asyncio
    async def test_join_channel(self, fabric_client):
        # Mock response - all peers joined successfully
        fabric_client.client.channel_join = AsyncMock(return_value=[True, True])
        
        # Call the method
        response = await fabric_client.join_channel(
            channel_name="mychannel",
            peers=["peer0.org1.example.com", "peer1.org1.example.com"]
        )
        
        # Check if client method was called correctly
        fabric_client.client.channel_join.assert_called_with(
            requestor=fabric_client.client.user_context,
            channel_name="mychannel",
            peers=["peer0.org1.example.com", "peer1.org1.example.com"],
            orderer='orderer.example.com'
        )
        
        # Check the response
        assert response == {
            'status': 'SUCCESS',
            'joined_peers': ["peer0.org1.example.com", "peer1.org1.example.com"],
            'failed_peers': []
        }

    @pytest.mark.asyncio
    async def test_install_chaincode(self, fabric_client):
        # Mock response
        mock_response1 = [MockResponse(status=200)]
        mock_response2 = [MockResponse(status=500)]  # One peer failed
        
        fabric_client.client.chaincode_install = AsyncMock(
            return_value=[mock_response1, mock_response2]
        )
        
        # Call the method
        response = await fabric_client.install_chaincode(
            peers=["peer0.org1.example.com", "peer1.org1.example.com"],
            cc_path="/path/to/chaincode",
            cc_name="mycc",
            cc_version="1.0"
        )
        
        # Check if client method was called correctly
        fabric_client.client.chaincode_install.assert_called_with(
            requestor=fabric_client.client.user_context,
            peers=["peer0.org1.example.com", "peer1.org1.example.com"],
            cc_path="/path/to/chaincode",
            cc_name="mycc",
            cc_version="1.0"
        )
        
        # Check the response
        assert response['status'] == 'PARTIAL'
        assert response['successful_peers'] == ["peer0.org1.example.com"]
        assert response['failed_peers'] == ["peer1.org1.example.com"]

    @pytest.mark.asyncio
    async def test_instantiate_chaincode(self, fabric_client):
        # Mock response
        mock_response = [MockResponse(status=200)]
        fabric_client.client.chaincode_instantiate = AsyncMock(return_value=mock_response)
        
        # Call the method
        response = await fabric_client.instantiate_chaincode(
            channel_name="mychannel",
            cc_name="mycc",
            cc_version="1.0",
            args=["init", "a", "100", "b", "200"]
        )
        
        # Check if client method was called correctly
        fabric_client.client.chaincode_instantiate.assert_called_with(
            requestor=fabric_client.client.user_context,
            channel_name="mychannel",
            peers=['peer0.org1.example.com'],
            cc_name="mycc",
            cc_version="1.0",
            fcn="init",
            args=[b"init", b"a", b"100", b"b", b"200"],
            cc_endorsement_policy={'identities': [
                {'role': {'name': 'member', 'mspId': 'Org1MSP'}},
                {'role': {'name': 'member', 'mspId': 'Org2MSP'}}
            ], 'policy': {'1-of': [{'signed-by': 0}, {'signed-by': 1}]}}
        )
        
        # Check the response
        assert response == {
            'status': 'SUCCESS',
            'chaincode': {
                'name': 'mycc',
                'version': '1.0',
                'channel': 'mychannel'
            }
        }

    @pytest.mark.asyncio
    async def test_upgrade_chaincode(self, fabric_client):
        # Mock response
        mock_response = [MockResponse(status=200)]
        fabric_client.client.chaincode_upgrade = AsyncMock(return_value=mock_response)
        
        # Call the method
        response = await fabric_client.upgrade_chaincode(
            channel_name="mychannel",
            cc_name="mycc",
            cc_version="2.0",
            args=["init", "a", "100", "b", "200"]
        )
        
        # Check if client method was called correctly
        fabric_client.client.chaincode_upgrade.assert_called_with(
            requestor=fabric_client.client.user_context,
            channel_name="mychannel",
            peers=['peer0.org1.example.com'],
            cc_name="mycc",
            cc_version="2.0",
            fcn="init",
            args=[b"init", b"a", b"100", b"b", b"200"],
            cc_endorsement_policy={'identities': [
                {'role': {'name': 'member', 'mspId': 'Org1MSP'}},
                {'role': {'name': 'member', 'mspId': 'Org2MSP'}}
            ], 'policy': {'1-of': [{'signed-by': 0}, {'signed-by': 1}]}}
        )
        
        # Check the response
        assert response == {
            'status': 'SUCCESS',
            'chaincode': {
                'name': 'mycc',
                'version': '2.0',
                'channel': 'mychannel'
            }
        }

    @pytest.mark.asyncio
    async def test_get_channel_info(self, fabric_client):
        # Mock response
        mock_info = MockChannelInfo()
        fabric_client.client.query_info = AsyncMock(return_value=mock_info)
        
        # Call the method
        response = await fabric_client.get_channel_info("mychannel")
        
        # Check if client method was called correctly
        fabric_client.client.query_info.assert_called_with(
            requestor=fabric_client.client.user_context,
            channel_name="mychannel",
            peers=['peer0.org1.example.com']
        )
        
        # Check the response
        assert response == {
            'status': 'SUCCESS',
            'height': 10,
            'current_block_hash': 'current_hash'.encode().hex(),
            'previous_block_hash': 'previous_hash'.encode().hex()
        }

    @pytest.mark.asyncio
    async def test_get_block_by_number(self, fabric_client):
        # Mock response
        mock_block = MockBlock(number=5, tx_count=2)
        fabric_client.client.query_block_by_number = AsyncMock(return_value=mock_block)
        
        # Call the method
        response = await fabric_client.get_block("mychannel", 5)
        
        # Check if client method was called correctly
        fabric_client.client.query_block_by_number.assert_called_with(
            requestor=fabric_client.client.user_context,
            channel_name="mychannel",
            peers=['peer0.org1.example.com'],
            block_number=5
        )
        
        # Check the response structure
        assert response['status'] == 'SUCCESS'
        assert response['header']['number'] == 5
        assert 'transactions' in response['data']
        assert len(response['data']['transactions']) == 2

    @pytest.mark.asyncio
    async def test_get_block_by_hash(self, fabric_client):
        # Mock response
        mock_block = MockBlock(number=5, tx_count=1)
        fabric_client.client.query_block_by_hash = AsyncMock(return_value=mock_block)
        
        # Call the method with a block hash
        block_hash = "deadbeef"  # Hex string
        response = await fabric_client.get_block("mychannel", block_hash)
        
        # Check if client method was called correctly
        fabric_client.client.query_block_by_hash.assert_called_with(
            requestor=fabric_client.client.user_context,
            channel_name="mychannel",
            peers=['peer0.org1.example.com'],
            block_hash=bytes.fromhex(block_hash)
        )
        
        # Check the response structure
        assert response['status'] == 'SUCCESS'
        assert 'transactions' in response['data']

    @pytest.mark.asyncio
    async def test_get_transaction(self, fabric_client):
        # Mock response
        mock_tx = MockTransaction()
        fabric_client.client.query_transaction = AsyncMock(return_value=mock_tx)
        
        # Call the method
        tx_id = "tx_id_123"
        response = await fabric_client.get_transaction("mychannel", tx_id)
        
        # Check if client method was called correctly
        fabric_client.client.query_transaction.assert_called_with(
            requestor=fabric_client.client.user_context,
            channel_name="mychannel",
            peers=['peer0.org1.example.com'],
            tx_id=tx_id
        )
        
        # Check the response
        assert response['status'] == 'SUCCESS'
        assert response['transaction_id'] == tx_id
        assert response['channel_id'] == 'mock_channel' 