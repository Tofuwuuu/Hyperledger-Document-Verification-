import os
import json
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from pathlib import Path

from backend.app.services.fabric_service import FabricService
from backend.app.core.fabric_client import FabricSDKClient
from backend.app.core.fabric_wallet import Identity, FileSystemWallet

# Test data
TEST_MSP_ID = "Org1MSP"
TEST_CHANNEL = "mychannel"
TEST_CHAINCODE = "basic"
TEST_CONNECTION_PROFILE = {
    "name": "test-network",
    "version": "1.0.0",
    "client": {
        "organization": "Org1MSP"
    },
    "organizations": {
        "Org1MSP": {
            "mspid": "Org1MSP"
        }
    },
    "channels": {
        "mychannel": {}
    }
}
TEST_IDENTITY = Identity(
    name="admin",
    msp_id=TEST_MSP_ID,
    certificate="-----BEGIN CERTIFICATE-----\nMIIB8TCCAZsCCQDzlCcO5kpK\n-----END CERTIFICATE-----",
    private_key="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0B\n-----END PRIVATE KEY-----"
)

@pytest.fixture
def mock_fabric_sdk_client():
    """Create a mock FabricSDKClient"""
    with patch('backend.app.services.fabric_service.FabricSDKClient') as mock_client_class:
        # Create instance methods as AsyncMocks
        instance = mock_client_class.from_connection_profile.return_value
        instance.query_chaincode = AsyncMock()
        instance.invoke_chaincode = AsyncMock()
        instance.create_channel = AsyncMock()
        instance.join_channel = AsyncMock()
        instance.install_chaincode = AsyncMock()
        instance.instantiate_chaincode = AsyncMock()
        instance.upgrade_chaincode = AsyncMock()
        instance.get_channel_info = AsyncMock()
        instance.get_block = AsyncMock()
        instance.get_transaction = AsyncMock()
        instance.set_user_context = MagicMock()
        instance.channel_name = TEST_CHANNEL
        instance.org_name = TEST_MSP_ID
        
        yield instance

@pytest.fixture
def mock_wallet():
    """Create a mock FileSystemWallet"""
    with patch('backend.app.services.fabric_service.FileSystemWallet') as mock_wallet_class:
        instance = mock_wallet_class.return_value
        instance.get = MagicMock(return_value=TEST_IDENTITY)
        instance.exists = MagicMock(return_value=True)
        instance.put = MagicMock()
        instance.list = MagicMock(return_value=["admin"])
        
        yield instance

@pytest.fixture
def mock_ca_client():
    """Create a mock CAClient"""
    with patch('hfc.fabric_ca.caservice.CAClient') as mock_ca_class:
        instance = mock_ca_class.return_value
        instance.enroll = AsyncMock(return_value={
            'certificate': '-----BEGIN CERTIFICATE-----\nMIIBCCCCAZsCCQDzlCcO5kpK\n-----END CERTIFICATE-----',
            'privateKey': '-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0B\n-----END PRIVATE KEY-----'
        })
        
        yield instance

@pytest.fixture
def mock_ca_service():
    """Create a mock CAService"""
    with patch('hfc.fabric_ca.caservice.CAService') as mock_service_class:
        instance = mock_service_class.return_value
        instance.register = AsyncMock(return_value="registration-successful")
        
        yield instance

@pytest.fixture
def fabric_service(mock_wallet):
    """Create a FabricService with mocked dependencies"""
    service = FabricService(wallet_path="/tmp/test-wallet")
    return service

class TestFabricService:
    
    def test_init(self, mock_wallet):
        """Test initialization of FabricService"""
        service = FabricService(wallet_path="/tmp/test-wallet")
        assert service.wallet_path == "/tmp/test-wallet"
        assert service.clients == {}
        assert service.wallet is not None
    
    @pytest.mark.asyncio
    async def test_initialize_client(self, fabric_service, mock_fabric_sdk_client):
        """Test initializing a client"""
        # Mock the open function
        with patch("builtins.open", MagicMock()):
            client = await fabric_service.initialize_client(
                connection_profile_path="/tmp/connection-profile.json",
                org_name=TEST_MSP_ID,
                identity_name="admin",
                channel_name=TEST_CHANNEL
            )
            
            # Check client initialization
            assert client is mock_fabric_sdk_client
            
            # Check if the client was stored
            assert f"{TEST_MSP_ID}:admin" in fabric_service.clients
    
    @pytest.mark.asyncio
    async def test_query_chaincode(self, fabric_service, mock_fabric_sdk_client):
        """Test querying chaincode"""
        # Setup mock return value
        mock_fabric_sdk_client.query_chaincode.return_value = {"key": "value"}
        
        # Add client to service
        fabric_service.clients[f"{TEST_MSP_ID}:admin"] = mock_fabric_sdk_client
        
        # Call method
        result = await fabric_service.query_chaincode(
            chaincode_id=TEST_CHAINCODE,
            function_name="query",
            args=["a"],
            channel_name=TEST_CHANNEL,
            org_name=TEST_MSP_ID,
            identity_name="admin"
        )
        
        # Check result
        assert result["success"] is True
        assert result["result"] == {"key": "value"}
        
        # Verify method was called
        mock_fabric_sdk_client.query_chaincode.assert_called_with(
            chaincode_name=TEST_CHAINCODE,
            channel_name=TEST_CHANNEL,
            fcn="query",
            args=["a"]
        )
    
    @pytest.mark.asyncio
    async def test_invoke_chaincode(self, fabric_service, mock_fabric_sdk_client):
        """Test invoking chaincode"""
        # Setup mock return value
        mock_fabric_sdk_client.invoke_chaincode.return_value = {
            "transaction_id": "tx123",
            "status": "SUCCESS"
        }
        
        # Add client to service
        fabric_service.clients[f"{TEST_MSP_ID}:admin"] = mock_fabric_sdk_client
        
        # Call method
        result = await fabric_service.invoke_chaincode(
            chaincode_id=TEST_CHAINCODE,
            function_name="invoke",
            args=["a", "b", "10"],
            channel_name=TEST_CHANNEL,
            org_name=TEST_MSP_ID,
            identity_name="admin"
        )
        
        # Check result
        assert result["success"] is True
        assert result["transaction_id"] == "tx123"
        assert result["status"] == "SUCCESS"
        
        # Verify method was called
        mock_fabric_sdk_client.invoke_chaincode.assert_called_with(
            chaincode_name=TEST_CHAINCODE,
            channel_name=TEST_CHANNEL,
            fcn="invoke",
            args=["a", "b", "10"],
            transient_map=None
        )
    
    @pytest.mark.asyncio
    async def test_create_channel(self, fabric_service, mock_fabric_sdk_client):
        """Test creating a channel"""
        # Setup mock return value
        mock_fabric_sdk_client.create_channel.return_value = {
            "status": "SUCCESS",
            "channel_name": TEST_CHANNEL
        }
        
        # Add client to service
        fabric_service.clients[f"{TEST_MSP_ID}:admin"] = mock_fabric_sdk_client
        
        # Call method
        result = await fabric_service.create_channel(
            channel_name=TEST_CHANNEL,
            orderer_name="orderer.example.com",
            channel_config_path="/path/to/channel.tx",
            org_name=TEST_MSP_ID,
            identity_name="admin"
        )
        
        # Check result
        assert result["success"] is True
        assert result["channel_name"] == TEST_CHANNEL
        assert result["status"] == "SUCCESS"
        
        # Verify method was called
        mock_fabric_sdk_client.create_channel.assert_called_with(
            channel_name=TEST_CHANNEL,
            orderer_name="orderer.example.com",
            channel_config_path="/path/to/channel.tx"
        )
    
    @pytest.mark.asyncio
    async def test_join_channel(self, fabric_service, mock_fabric_sdk_client):
        """Test joining a channel"""
        # Setup mock return value
        mock_fabric_sdk_client.join_channel.return_value = {
            "status": "SUCCESS",
            "joined_peers": ["peer0.org1.example.com"],
            "failed_peers": []
        }
        
        # Add client to service
        fabric_service.clients[f"{TEST_MSP_ID}:admin"] = mock_fabric_sdk_client
        
        # Call method
        result = await fabric_service.join_channel(
            channel_name=TEST_CHANNEL,
            peers=["peer0.org1.example.com"],
            org_name=TEST_MSP_ID,
            identity_name="admin"
        )
        
        # Check result
        assert result["success"] is True
        assert result["channel_name"] == TEST_CHANNEL
        assert result["joined_peers"] == ["peer0.org1.example.com"]
        assert result["failed_peers"] == []
        assert result["status"] == "SUCCESS"
        
        # Verify method was called
        mock_fabric_sdk_client.join_channel.assert_called_with(
            channel_name=TEST_CHANNEL,
            peers=["peer0.org1.example.com"]
        )
    
    @pytest.mark.asyncio
    async def test_install_chaincode(self, fabric_service, mock_fabric_sdk_client):
        """Test installing chaincode"""
        # Setup mock return value
        mock_fabric_sdk_client.install_chaincode.return_value = {
            "status": "SUCCESS",
            "successful_peers": ["peer0.org1.example.com"],
            "failed_peers": []
        }
        
        # Add client to service
        fabric_service.clients[f"{TEST_MSP_ID}:admin"] = mock_fabric_sdk_client
        
        # Call method
        result = await fabric_service.install_chaincode(
            cc_path="/path/to/chaincode",
            cc_name=TEST_CHAINCODE,
            cc_version="1.0",
            peers=["peer0.org1.example.com"],
            org_name=TEST_MSP_ID,
            identity_name="admin"
        )
        
        # Check result
        assert result["success"] is True
        assert result["chaincode"]["name"] == TEST_CHAINCODE
        assert result["chaincode"]["version"] == "1.0"
        assert result["successful_peers"] == ["peer0.org1.example.com"]
        assert result["failed_peers"] == []
        assert result["status"] == "SUCCESS"
        
        # Verify method was called
        mock_fabric_sdk_client.install_chaincode.assert_called_with(
            peers=["peer0.org1.example.com"],
            cc_path="/path/to/chaincode",
            cc_name=TEST_CHAINCODE,
            cc_version="1.0"
        )
    
    @pytest.mark.asyncio
    async def test_instantiate_chaincode(self, fabric_service, mock_fabric_sdk_client):
        """Test instantiating chaincode"""
        # Setup mock return value
        mock_fabric_sdk_client.instantiate_chaincode.return_value = {
            "status": "SUCCESS",
            "chaincode": {
                "name": TEST_CHAINCODE,
                "version": "1.0",
                "channel": TEST_CHANNEL
            }
        }
        
        # Add client to service
        fabric_service.clients[f"{TEST_MSP_ID}:admin"] = mock_fabric_sdk_client
        
        # Call method
        result = await fabric_service.instantiate_chaincode(
            channel_name=TEST_CHANNEL,
            cc_name=TEST_CHAINCODE,
            cc_version="1.0",
            function_name="init",
            args=["a", "100", "b", "200"],
            org_name=TEST_MSP_ID,
            identity_name="admin"
        )
        
        # Check result
        assert result["success"] is True
        assert result["chaincode"]["name"] == TEST_CHAINCODE
        assert result["chaincode"]["version"] == "1.0"
        assert result["chaincode"]["channel"] == TEST_CHANNEL
        assert result["status"] == "SUCCESS"
        
        # Verify method was called
        mock_fabric_sdk_client.instantiate_chaincode.assert_called_with(
            channel_name=TEST_CHANNEL,
            cc_name=TEST_CHAINCODE,
            cc_version="1.0",
            fcn="init",
            args=["a", "100", "b", "200"],
            cc_policy=None
        )
    
    @pytest.mark.asyncio
    async def test_upgrade_chaincode(self, fabric_service, mock_fabric_sdk_client):
        """Test upgrading chaincode"""
        # Setup mock return value
        mock_fabric_sdk_client.upgrade_chaincode.return_value = {
            "status": "SUCCESS",
            "chaincode": {
                "name": TEST_CHAINCODE,
                "version": "2.0",
                "channel": TEST_CHANNEL
            }
        }
        
        # Add client to service
        fabric_service.clients[f"{TEST_MSP_ID}:admin"] = mock_fabric_sdk_client
        
        # Call method
        result = await fabric_service.upgrade_chaincode(
            channel_name=TEST_CHANNEL,
            cc_name=TEST_CHAINCODE,
            cc_version="2.0",
            function_name="init",
            args=["a", "100", "b", "200"],
            org_name=TEST_MSP_ID,
            identity_name="admin"
        )
        
        # Check result
        assert result["success"] is True
        assert result["chaincode"]["name"] == TEST_CHAINCODE
        assert result["chaincode"]["version"] == "2.0"
        assert result["chaincode"]["channel"] == TEST_CHANNEL
        assert result["status"] == "SUCCESS"
        
        # Verify method was called
        mock_fabric_sdk_client.upgrade_chaincode.assert_called_with(
            channel_name=TEST_CHANNEL,
            cc_name=TEST_CHAINCODE,
            cc_version="2.0",
            fcn="init",
            args=["a", "100", "b", "200"],
            cc_policy=None
        )
    
    @pytest.mark.asyncio
    async def test_get_channel_info(self, fabric_service, mock_fabric_sdk_client):
        """Test getting channel info"""
        # Setup mock return value
        mock_fabric_sdk_client.get_channel_info.return_value = {
            "status": "SUCCESS",
            "height": 10,
            "current_block_hash": "abcd1234",
            "previous_block_hash": "wxyz5678"
        }
        
        # Add client to service
        fabric_service.clients[f"{TEST_MSP_ID}:admin"] = mock_fabric_sdk_client
        
        # Call method
        result = await fabric_service.get_channel_info(
            channel_name=TEST_CHANNEL,
            org_name=TEST_MSP_ID,
            identity_name="admin"
        )
        
        # Check result
        assert result["success"] is True
        assert result["channel_name"] == TEST_CHANNEL
        assert result["height"] == 10
        assert result["current_block_hash"] == "abcd1234"
        assert result["previous_block_hash"] == "wxyz5678"
        assert result["status"] == "SUCCESS"
        
        # Verify method was called
        mock_fabric_sdk_client.get_channel_info.assert_called_with(
            channel_name=TEST_CHANNEL
        )
    
    @pytest.mark.asyncio
    async def test_get_block_by_number(self, fabric_service, mock_fabric_sdk_client):
        """Test getting a block by number"""
        # Setup mock return value
        mock_fabric_sdk_client.get_block.return_value = {
            "status": "SUCCESS",
            "header": {
                "number": 5,
                "previous_hash": "wxyz5678",
                "data_hash": "data1234"
            },
            "data": {
                "transactions": [
                    {"tx_id": "tx123", "timestamp": "2023-01-01T00:00:00Z", "type": 1}
                ]
            }
        }
        
        # Add client to service
        fabric_service.clients[f"{TEST_MSP_ID}:admin"] = mock_fabric_sdk_client
        
        # Call method
        result = await fabric_service.get_block(
            channel_name=TEST_CHANNEL,
            block_identifier=5,
            org_name=TEST_MSP_ID,
            identity_name="admin"
        )
        
        # Check result
        assert result["success"] is True
        assert result["channel_name"] == TEST_CHANNEL
        assert result["header"]["number"] == 5
        assert "transactions" in result["data"]
        assert result["status"] == "SUCCESS"
        
        # Verify method was called
        mock_fabric_sdk_client.get_block.assert_called_with(
            channel_name=TEST_CHANNEL,
            block_number=5
        )
    
    @pytest.mark.asyncio
    async def test_get_transaction(self, fabric_service, mock_fabric_sdk_client):
        """Test getting a transaction"""
        # Setup mock return value
        mock_fabric_sdk_client.get_transaction.return_value = {
            "status": "SUCCESS",
            "transaction_id": "tx123",
            "channel_id": TEST_CHANNEL,
            "timestamp": "2023-01-01T00:00:00Z",
            "type": 1
        }
        
        # Add client to service
        fabric_service.clients[f"{TEST_MSP_ID}:admin"] = mock_fabric_sdk_client
        
        # Call method
        result = await fabric_service.get_transaction(
            channel_name=TEST_CHANNEL,
            tx_id="tx123",
            org_name=TEST_MSP_ID,
            identity_name="admin"
        )
        
        # Check result
        assert result["success"] is True
        assert result["channel_name"] == TEST_CHANNEL
        assert result["transaction_id"] == "tx123"
        assert result["channel_id"] == TEST_CHANNEL
        assert result["timestamp"] == "2023-01-01T00:00:00Z"
        assert result["status"] == "SUCCESS"
        
        # Verify method was called
        mock_fabric_sdk_client.get_transaction.assert_called_with(
            channel_name=TEST_CHANNEL,
            tx_id="tx123"
        )
    
    @pytest.mark.asyncio
    async def test_enroll_admin(self, fabric_service, mock_ca_client):
        """Test enrolling an admin"""
        # Call method
        result = await fabric_service.enroll_admin(
            ca_url="https://ca.org1.example.com:7054",
            ca_name="ca.org1.example.com",
            enrollment_id="admin",
            enrollment_secret="adminpw",
            msp_id=TEST_MSP_ID
        )
        
        # Check result
        assert result["success"] is True
        assert result["identity"]["name"] == "admin"
        assert result["identity"]["msp_id"] == TEST_MSP_ID
        
        # Verify method was called
        mock_ca_client.enroll.assert_called_with("admin", "adminpw")
        
        # Verify identity was stored in wallet
        assert fabric_service.wallet.put.called
    
    @pytest.mark.asyncio
    async def test_register_user(self, fabric_service, mock_ca_service, mock_create_user):
        """Test registering a user"""
        # Setup method to use
        with patch('backend.app.services.fabric_service.create_user') as mock_create_user:
            mock_user = MagicMock()
            mock_create_user.return_value = mock_user
            
            # Call method
            result = await fabric_service.register_user(
                ca_url="https://ca.org1.example.com:7054",
                ca_name="ca.org1.example.com",
                admin_identity_name="admin",
                user_id="user1",
                user_secret="user1pw",
                user_affiliation="org1.department1"
            )
            
            # Check result
            assert result["success"] is True
            assert result["user_id"] == "user1"
            
            # Verify the CA service register was called
            mock_ca_service.register.assert_called_with(
                mock_user,
                "user1",
                "user1pw",
                "org1.department1",
                member_type='client',
                attrs=[],
                max_enrollments=0
            )
    
    @pytest.mark.asyncio
    async def test_enroll_user(self, fabric_service, mock_ca_client):
        """Test enrolling a user"""
        # Call method
        result = await fabric_service.enroll_user(
            ca_url="https://ca.org1.example.com:7054",
            ca_name="ca.org1.example.com",
            enrollment_id="user1",
            enrollment_secret="user1pw",
            msp_id=TEST_MSP_ID
        )
        
        # Check result
        assert result["success"] is True
        assert result["identity"]["name"] == "user1"
        assert result["identity"]["msp_id"] == TEST_MSP_ID
        
        # Verify method was called
        mock_ca_client.enroll.assert_called_with("user1", "user1pw")
        
        # Verify identity was stored in wallet
        assert fabric_service.wallet.put.called
    
    def test_get_identities(self, fabric_service):
        """Test getting all identities"""
        # Call method
        identities = fabric_service.get_identities()
        
        # Check result
        assert len(identities) == 1
        assert identities[0]["name"] == "admin"
        assert identities[0]["msp_id"] == TEST_MSP_ID
    
    @pytest.mark.asyncio
    async def test_no_client_available_for_operation(self, fabric_service):
        """Test behavior when no client is available"""
        # Call method with no clients initialized
        result = await fabric_service.query_chaincode(
            chaincode_id=TEST_CHAINCODE,
            function_name="query",
            args=["a"]
        )
        
        # Check result
        assert result["success"] is False
        assert "No client available for operation" in result["error"]
    
    @pytest.mark.asyncio
    async def test_client_by_org_and_identity(self, fabric_service, mock_fabric_sdk_client):
        """Test getting a client by org and identity"""
        # Add multiple clients
        fabric_service.clients[f"{TEST_MSP_ID}:admin"] = mock_fabric_sdk_client
        fabric_service.clients["Org2MSP:admin"] = MagicMock()
        
        # Get a specific client
        client = await fabric_service._get_client_for_operation(TEST_MSP_ID, "admin")
        
        # Check result
        assert client is mock_fabric_sdk_client 