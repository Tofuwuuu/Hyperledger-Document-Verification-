import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch
from bson import ObjectId

from app.services.hyperledger_service import HyperledgerService
from app.schemas.hyperledger import (
    HyperledgerNetworkCreate,
    HyperledgerNetworkUpdate,
    HyperledgerChannelCreate,
    HyperledgerChannelUpdate,
    HyperledgerChaincodeCreate,
    HyperledgerChaincodeUpdate,
    NetworkType,
    ChaincodeLanguage
)


@pytest.mark.unit
@pytest.mark.blockchain
class TestHyperledgerService:
    """Tests for the Hyperledger service."""
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database with collections."""
        db = MagicMock()
        
        # Network collection mocks
        db.hyperledger_networks = MagicMock()
        db.hyperledger_networks.find_one.return_value = {
            "_id": ObjectId("60d21b4667d0d8992e610c96"),
            "name": "Test Fabric Network",
            "network_type": "fabric",
            "version": "2.2.3",
            "connection_profile": {"name": "test-network"},
            "admin_username": "admin",
            "admin_cert_path": "/path/to/cert",
            "admin_key_path": "/path/to/key",
            "is_production": False,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "is_active": True
        }
        db.hyperledger_networks.insert_one.return_value = MagicMock(
            inserted_id=ObjectId("60d21b4667d0d8992e610c96")
        )
        db.hyperledger_networks.update_one.return_value = MagicMock(modified_count=1)
        db.hyperledger_networks.find.return_value = [{
            "_id": ObjectId("60d21b4667d0d8992e610c96"),
            "name": "Test Fabric Network",
            "network_type": "fabric",
            "version": "2.2.3",
            "connection_profile": {"name": "test-network"},
            "admin_username": "admin",
            "admin_cert_path": "/path/to/cert",
            "admin_key_path": "/path/to/key",
            "is_production": False,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "is_active": True
        }]
        
        # Channel collection mocks
        db.hyperledger_channels = MagicMock()
        db.hyperledger_channels.find_one.return_value = {
            "_id": ObjectId("60d21b4667d0d8992e610c97"),
            "name": "mychannel",
            "network_id": "60d21b4667d0d8992e610c96",
            "organizations": ["Org1MSP", "Org2MSP"],
            "config_path": "/path/to/config",
            "metadata": {"block_height": 150},
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "is_active": True
        }
        db.hyperledger_channels.insert_one.return_value = MagicMock(
            inserted_id=ObjectId("60d21b4667d0d8992e610c97")
        )
        db.hyperledger_channels.update_one.return_value = MagicMock(modified_count=1)
        db.hyperledger_channels.find.return_value = [{
            "_id": ObjectId("60d21b4667d0d8992e610c97"),
            "name": "mychannel",
            "network_id": "60d21b4667d0d8992e610c96",
            "organizations": ["Org1MSP", "Org2MSP"],
            "config_path": "/path/to/config",
            "metadata": {"block_height": 150},
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "is_active": True
        }]
        
        # Chaincode collection mocks
        db.hyperledger_chaincodes = MagicMock()
        db.hyperledger_chaincodes.find_one.return_value = {
            "_id": ObjectId("60d21b4667d0d8992e610c98"),
            "name": "asset-transfer",
            "version": "1.0.0",
            "channel_id": "60d21b4667d0d8992e610c97",
            "language": "golang",
            "path": "/path/to/chaincode",
            "init_required": False,
            "metadata": {"description": "Asset transfer chaincode"},
            "package_id": "asset-transfer:a808c14025ff5e3407x",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "is_active": True
        }
        db.hyperledger_chaincodes.insert_one.return_value = MagicMock(
            inserted_id=ObjectId("60d21b4667d0d8992e610c98")
        )
        db.hyperledger_chaincodes.update_one.return_value = MagicMock(modified_count=1)
        db.hyperledger_chaincodes.find.return_value = [{
            "_id": ObjectId("60d21b4667d0d8992e610c98"),
            "name": "asset-transfer",
            "version": "1.0.0",
            "channel_id": "60d21b4667d0d8992e610c97",
            "language": "golang",
            "path": "/path/to/chaincode",
            "init_required": False,
            "metadata": {"description": "Asset transfer chaincode"},
            "package_id": "asset-transfer:a808c14025ff5e3407x",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "is_active": True
        }]
        
        return db
    
    @pytest.fixture
    def service(self, mock_db):
        """Create a HyperledgerService instance with a mock database."""
        return HyperledgerService(db=mock_db)
    
    # Network tests
    
    @pytest.mark.asyncio
    async def test_create_network(self, service):
        """Test creating a Hyperledger network."""
        network_data = HyperledgerNetworkCreate(
            name="Fabric Test Network",
            network_type=NetworkType.FABRIC,
            version="2.2.3",
            connection_profile={"name": "test-network"},
            admin_username="admin",
            admin_cert_path="/path/to/cert",
            admin_key_path="/path/to/key",
            is_production=False
        )
        
        result = await service.create_network(network_data)
        
        assert result.name == "Test Fabric Network"
        assert result.network_type == NetworkType.FABRIC
        assert result.version == "2.2.3"
        assert result.connection_profile == {"name": "test-network"}
        assert result.admin_username == "admin"
        assert result.admin_cert_path == "/path/to/cert"
        assert result.admin_key_path == "/path/to/key"
        assert result.is_production is False
        assert result.is_active is True
    
    @pytest.mark.asyncio
    async def test_get_network(self, service):
        """Test getting a Hyperledger network by ID."""
        result = await service.get_network("60d21b4667d0d8992e610c96")
        
        assert result is not None
        assert result.id == "60d21b4667d0d8992e610c96"
        assert result.name == "Test Fabric Network"
        assert result.network_type == NetworkType.FABRIC
    
    @pytest.mark.asyncio
    async def test_update_network(self, service):
        """Test updating a Hyperledger network."""
        update_data = HyperledgerNetworkUpdate(
            name="Updated Network Name",
            admin_cert_path="/path/to/new/cert"
        )
        
        result = await service.update_network("60d21b4667d0d8992e610c96", update_data)
        
        assert result is not None
        assert result.id == "60d21b4667d0d8992e610c96"
        assert result.name == "Test Fabric Network"  # Mock returns the original data
    
    @pytest.mark.asyncio
    async def test_list_networks(self, service):
        """Test listing Hyperledger networks."""
        results = await service.list_networks()
        
        assert len(results) == 1
        assert results[0].id == "60d21b4667d0d8992e610c96"
        assert results[0].name == "Test Fabric Network"
    
    @pytest.mark.asyncio
    async def test_delete_network(self, service):
        """Test deleting (deactivating) a Hyperledger network."""
        result = await service.delete_network("60d21b4667d0d8992e610c96")
        
        assert result is True
    
    # Channel tests
    
    @pytest.mark.asyncio
    async def test_create_channel(self, service):
        """Test creating a Hyperledger channel."""
        channel_data = HyperledgerChannelCreate(
            name="mychannel",
            network_id="60d21b4667d0d8992e610c96",
            organizations=["Org1MSP", "Org2MSP"],
            config_path="/path/to/config",
            metadata={"block_height": 150},
            is_active=True
        )
        
        result = await service.create_channel(channel_data)
        
        assert result.name == "mychannel"
        assert result.network_id == "60d21b4667d0d8992e610c96"
        assert "Org1MSP" in result.organizations
        assert "Org2MSP" in result.organizations
        assert result.config_path == "/path/to/config"
        assert result.metadata["block_height"] == 150
        assert result.is_active is True
    
    @pytest.mark.asyncio
    async def test_get_channel(self, service):
        """Test getting a Hyperledger channel by ID."""
        result = await service.get_channel("60d21b4667d0d8992e610c97")
        
        assert result is not None
        assert result.id == "60d21b4667d0d8992e610c97"
        assert result.name == "mychannel"
        assert result.network_id == "60d21b4667d0d8992e610c96"
    
    @pytest.mark.asyncio
    async def test_update_channel(self, service):
        """Test updating a Hyperledger channel."""
        update_data = HyperledgerChannelUpdate(
            organizations=["Org1MSP", "Org2MSP", "Org3MSP"],
            metadata={"block_height": 200}
        )
        
        result = await service.update_channel("60d21b4667d0d8992e610c97", update_data)
        
        assert result is not None
        assert result.id == "60d21b4667d0d8992e610c97"
        assert result.name == "mychannel"  # Mock returns the original data
    
    @pytest.mark.asyncio
    async def test_list_channels(self, service):
        """Test listing Hyperledger channels for a network."""
        results = await service.list_channels("60d21b4667d0d8992e610c96")
        
        assert len(results) == 1
        assert results[0].id == "60d21b4667d0d8992e610c97"
        assert results[0].name == "mychannel"
    
    @pytest.mark.asyncio
    async def test_delete_channel(self, service):
        """Test deleting (deactivating) a Hyperledger channel."""
        result = await service.delete_channel("60d21b4667d0d8992e610c97")
        
        assert result is True
    
    # Chaincode tests
    
    @pytest.mark.asyncio
    async def test_create_chaincode(self, service):
        """Test creating a Hyperledger chaincode."""
        chaincode_data = HyperledgerChaincodeCreate(
            name="asset-transfer",
            version="1.0.0",
            channel_id="60d21b4667d0d8992e610c97",
            language=ChaincodeLanguage.GOLANG,
            path="/path/to/chaincode",
            init_required=False,
            metadata={"description": "Asset transfer chaincode"},
            package_id="asset-transfer:a808c14025ff5e3407x"
        )
        
        result = await service.create_chaincode(chaincode_data)
        
        assert result.name == "asset-transfer"
        assert result.version == "1.0.0"
        assert result.channel_id == "60d21b4667d0d8992e610c97"
        assert result.language == ChaincodeLanguage.GOLANG
        assert result.path == "/path/to/chaincode"
        assert result.init_required is False
        assert result.metadata["description"] == "Asset transfer chaincode"
        assert result.package_id == "asset-transfer:a808c14025ff5e3407x"
        assert result.is_active is True
    
    @pytest.mark.asyncio
    async def test_get_chaincode(self, service):
        """Test getting a Hyperledger chaincode by ID."""
        result = await service.get_chaincode("60d21b4667d0d8992e610c98")
        
        assert result is not None
        assert result.id == "60d21b4667d0d8992e610c98"
        assert result.name == "asset-transfer"
        assert result.channel_id == "60d21b4667d0d8992e610c97"
    
    @pytest.mark.asyncio
    async def test_update_chaincode(self, service):
        """Test updating a Hyperledger chaincode."""
        update_data = HyperledgerChaincodeUpdate(
            version="1.1.0",
            metadata={"description": "Updated asset transfer chaincode"}
        )
        
        result = await service.update_chaincode("60d21b4667d0d8992e610c98", update_data)
        
        assert result is not None
        assert result.id == "60d21b4667d0d8992e610c98"
        assert result.name == "asset-transfer"  # Mock returns the original data
    
    @pytest.mark.asyncio
    async def test_list_chaincodes(self, service):
        """Test listing Hyperledger chaincodes for a channel."""
        results = await service.list_chaincodes("60d21b4667d0d8992e610c97")
        
        assert len(results) == 1
        assert results[0].id == "60d21b4667d0d8992e610c98"
        assert results[0].name == "asset-transfer"
    
    @pytest.mark.asyncio
    async def test_delete_chaincode(self, service):
        """Test deleting (deactivating) a Hyperledger chaincode."""
        result = await service.delete_chaincode("60d21b4667d0d8992e610c98")
        
        assert result is True
    
    # Chaincode interaction tests
    
    @pytest.mark.asyncio
    async def test_invoke_chaincode(self, service):
        """Test invoking a chaincode function."""
        result = await service.invoke_chaincode(
            "60d21b4667d0d8992e610c96",
            "mychannel",
            "asset-transfer",
            "CreateAsset",
            ["1", "blue", "10", "john", "100"]
        )
        
        assert result["success"] is True
        assert "transaction_id" in result
        assert "timestamp" in result
        assert "result" in result
    
    @pytest.mark.asyncio
    async def test_query_chaincode(self, service):
        """Test querying a chaincode function."""
        result = await service.query_chaincode(
            "60d21b4667d0d8992e610c96",
            "mychannel",
            "asset-transfer",
            "ReadAsset",
            ["1"]
        )
        
        assert result["success"] is True
        assert "timestamp" in result
        assert "result" in result 