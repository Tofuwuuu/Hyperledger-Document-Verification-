import pytest
from pydantic import ValidationError
from bson import ObjectId

from app.schemas.hyperledger import (
    HyperledgerNetworkBase,
    HyperledgerNetworkCreate,
    HyperledgerNetworkUpdate,
    HyperledgerNetworkOut,
    HyperledgerChannelBase,
    HyperledgerChannelCreate,
    HyperledgerChannelUpdate,
    HyperledgerChannelOut,
    HyperledgerChaincodeBase,
    HyperledgerChaincodeCreate,
    HyperledgerChaincodeUpdate,
    HyperledgerChaincodeOut,
    NetworkType,
    ChaincodeLanguage
)


@pytest.mark.unit
@pytest.mark.schema
@pytest.mark.blockchain
class TestHyperledgerNetworkSchemas:
    """Tests for Hyperledger network schemas validation."""
    
    def test_network_base_valid(self):
        """Test valid HyperledgerNetworkBase schema."""
        network = HyperledgerNetworkBase(
            name="Fabric Test Network",
            network_type=NetworkType.FABRIC,
            version="2.2.3",
            connection_profile={
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
                        "tlsCACerts": {"path": "/path/to/cert"}
                    }
                }
            },
            admin_username="admin",
            admin_cert_path="/path/to/admin/cert",
            admin_key_path="/path/to/admin/key",
            metadata={
                "consortium": "SampleConsortium",
                "orderer_url": "grpcs://orderer.example.com:7050"
            }
        )
        
        assert network.name == "Fabric Test Network"
        assert network.network_type == NetworkType.FABRIC
        assert network.version == "2.2.3"
        assert "organizations" in network.connection_profile
        assert "Org1" in network.connection_profile["organizations"]
        assert network.admin_username == "admin"
        assert network.admin_cert_path == "/path/to/admin/cert"
        assert network.admin_key_path == "/path/to/admin/key"
        assert network.metadata["consortium"] == "SampleConsortium"
    
    def test_network_base_minimal(self):
        """Test HyperledgerNetworkBase with only required fields."""
        network = HyperledgerNetworkBase(
            name="Minimal Fabric Network",
            network_type=NetworkType.FABRIC,
            version="2.2.0",
            connection_profile={"name": "minimal-network"},
            admin_username="admin"
        )
        
        assert network.name == "Minimal Fabric Network"
        assert network.network_type == NetworkType.FABRIC
        assert network.version == "2.2.0"
        assert network.connection_profile == {"name": "minimal-network"}
        assert network.admin_username == "admin"
        assert network.admin_cert_path is None
        assert network.admin_key_path is None
        assert network.metadata is None
    
    def test_network_base_invalid_version(self):
        """Test HyperledgerNetworkBase with invalid version format."""
        with pytest.raises(ValidationError) as exc_info:
            HyperledgerNetworkBase(
                name="Invalid Version Network",
                network_type=NetworkType.FABRIC,
                version="invalid.version",  # Invalid version format
                connection_profile={"name": "test"},
                admin_username="admin"
            )
        errors = exc_info.value.errors()
        assert any("version" in str(error["loc"]) for error in errors)
    
    def test_network_base_invalid_connection_profile(self):
        """Test HyperledgerNetworkBase with invalid connection profile."""
        with pytest.raises(ValidationError) as exc_info:
            HyperledgerNetworkBase(
                name="Invalid Profile Network",
                network_type=NetworkType.FABRIC,
                version="2.2.0",
                connection_profile="not-a-dict",  # Should be a dict
                admin_username="admin"
            )
        errors = exc_info.value.errors()
        assert any("connection_profile" in str(error["loc"]) for error in errors)
    
    def test_network_create_valid(self):
        """Test valid HyperledgerNetworkCreate schema."""
        network = HyperledgerNetworkCreate(
            name="Fabric Production Network",
            network_type=NetworkType.FABRIC,
            version="2.2.3",
            connection_profile={
                "name": "prod-network",
                "version": "1.0.0",
                "organizations": {
                    "Org1": {
                        "mspid": "Org1MSP",
                        "peers": ["peer0.org1.example.com"]
                    }
                }
            },
            admin_username="admin",
            admin_cert_path="/path/to/admin/cert",
            admin_key_path="/path/to/admin/key",
            metadata={
                "consortium": "ProductionConsortium",
                "orderer_url": "grpcs://orderer.example.com:7050"
            },
            is_production=True
        )
        
        assert network.name == "Fabric Production Network"
        assert network.network_type == NetworkType.FABRIC
        assert network.version == "2.2.3"
        assert "organizations" in network.connection_profile
        assert network.admin_username == "admin"
        assert network.admin_cert_path == "/path/to/admin/cert"
        assert network.admin_key_path == "/path/to/admin/key"
        assert network.metadata["consortium"] == "ProductionConsortium"
        assert network.is_production is True
    
    def test_network_update_valid(self):
        """Test valid HyperledgerNetworkUpdate schema."""
        update = HyperledgerNetworkUpdate(
            connection_profile={
                "name": "updated-network",
                "version": "1.0.0",
                "organizations": {
                    "Org1": {"mspid": "Org1MSP"},
                    "Org2": {"mspid": "Org2MSP"}
                }
            },
            admin_cert_path="/path/to/new/cert",
            admin_key_path="/path/to/new/key",
            metadata={
                "updated_at": "2023-05-20",
                "notes": "Updated connection profile"
            }
        )
        
        assert update.connection_profile["name"] == "updated-network"
        assert "Org2" in update.connection_profile["organizations"]
        assert update.admin_cert_path == "/path/to/new/cert"
        assert update.admin_key_path == "/path/to/new/key"
        assert update.metadata["updated_at"] == "2023-05-20"
        assert update.network_type is None  # Shouldn't be updatable
        assert update.version is None
    
    def test_network_update_immutable_fields(self):
        """Test that immutable fields cannot be updated in HyperledgerNetworkUpdate."""
        with pytest.raises(ValidationError) as exc_info:
            HyperledgerNetworkUpdate(
                network_type=NetworkType.BESU  # Should not be allowed to update
            )
        errors = exc_info.value.errors()
        assert any("network_type" in str(error["loc"]) for error in errors)
        
        with pytest.raises(ValidationError) as exc_info:
            HyperledgerNetworkUpdate(
                version="2.3.0"  # Should not be allowed to update
            )
        errors = exc_info.value.errors()
        assert any("version" in str(error["loc"]) for error in errors)
    
    def test_network_out_schema(self):
        """Test HyperledgerNetworkOut schema."""
        network = HyperledgerNetworkOut(
            _id="60d21b4667d0d8992e610c96",
            name="Fabric Test Network",
            network_type=NetworkType.FABRIC,
            version="2.2.3",
            connection_profile={
                "name": "test-network",
                "organizations": {"Org1": {"mspid": "Org1MSP"}}
            },
            admin_username="admin",
            admin_cert_path="/path/to/admin/cert",
            admin_key_path="/path/to/admin/key",
            metadata={"consortium": "SampleConsortium"},
            is_production=False,
            created_at="2023-01-01T10:00:00",
            updated_at="2023-01-15T14:30:00",
            is_active=True
        )
        
        assert network.id == "60d21b4667d0d8992e610c96"  # Alias for _id
        assert network.name == "Fabric Test Network"
        assert network.network_type == NetworkType.FABRIC
        assert network.version == "2.2.3"
        assert "organizations" in network.connection_profile
        assert network.admin_username == "admin"
        assert network.admin_cert_path == "/path/to/admin/cert"
        assert network.admin_key_path == "/path/to/admin/key"
        assert network.metadata["consortium"] == "SampleConsortium"
        assert network.is_production is False
        assert network.created_at == "2023-01-01T10:00:00"
        assert network.updated_at == "2023-01-15T14:30:00"
        assert network.is_active is True


@pytest.mark.unit
@pytest.mark.schema
@pytest.mark.blockchain
class TestHyperledgerChannelSchemas:
    """Tests for Hyperledger channel schemas validation."""
    
    def test_channel_base_valid(self):
        """Test valid HyperledgerChannelBase schema."""
        channel = HyperledgerChannelBase(
            name="mychannel",
            network_id="60d21b4667d0d8992e610c96",
            organizations=["Org1MSP", "Org2MSP"],
            config_path="/path/to/channel/config.json",
            metadata={
                "block_height": 150,
                "policy": "OR('Org1MSP.member', 'Org2MSP.member')"
            }
        )
        
        assert channel.name == "mychannel"
        assert channel.network_id == "60d21b4667d0d8992e610c96"
        assert "Org1MSP" in channel.organizations
        assert "Org2MSP" in channel.organizations
        assert channel.config_path == "/path/to/channel/config.json"
        assert channel.metadata["block_height"] == 150
    
    def test_channel_base_minimal(self):
        """Test HyperledgerChannelBase with only required fields."""
        channel = HyperledgerChannelBase(
            name="minimal-channel",
            network_id="60d21b4667d0d8992e610c96",
            organizations=["Org1MSP"]
        )
        
        assert channel.name == "minimal-channel"
        assert channel.network_id == "60d21b4667d0d8992e610c96"
        assert channel.organizations == ["Org1MSP"]
        assert channel.config_path is None
        assert channel.metadata is None
    
    def test_channel_base_invalid_network_id(self):
        """Test HyperledgerChannelBase with invalid network_id."""
        with pytest.raises(ValidationError) as exc_info:
            HyperledgerChannelBase(
                name="test-channel",
                network_id="invalid-id",  # Not a valid ObjectId
                organizations=["Org1MSP"]
            )
        errors = exc_info.value.errors()
        assert any("network_id" in str(error["loc"]) for error in errors)
    
    def test_channel_create_valid(self):
        """Test valid HyperledgerChannelCreate schema."""
        channel = HyperledgerChannelCreate(
            name="newchannel",
            network_id="60d21b4667d0d8992e610c96",
            organizations=["Org1MSP", "Org2MSP", "Org3MSP"],
            config_path="/path/to/channel/config.json",
            metadata={"channel_admin": "Org1MSP"},
            is_active=True
        )
        
        assert channel.name == "newchannel"
        assert channel.network_id == "60d21b4667d0d8992e610c96"
        assert len(channel.organizations) == 3
        assert channel.config_path == "/path/to/channel/config.json"
        assert channel.metadata["channel_admin"] == "Org1MSP"
        assert channel.is_active is True
    
    def test_channel_update_valid(self):
        """Test valid HyperledgerChannelUpdate schema."""
        update = HyperledgerChannelUpdate(
            organizations=["Org1MSP", "Org2MSP", "Org4MSP"],  # Added Org4MSP
            metadata={
                "block_height": 200,
                "updated_by": "admin"
            },
            is_active=True
        )
        
        assert "Org4MSP" in update.organizations
        assert update.metadata["block_height"] == 200
        assert update.metadata["updated_by"] == "admin"
        assert update.is_active is True
        assert update.name is None
        assert update.network_id is None
    
    def test_channel_update_immutable_fields(self):
        """Test that immutable fields cannot be updated in HyperledgerChannelUpdate."""
        with pytest.raises(ValidationError) as exc_info:
            HyperledgerChannelUpdate(
                network_id="60d21b4667d0d8992e610c97"  # Should not be allowed to update
            )
        errors = exc_info.value.errors()
        assert any("network_id" in str(error["loc"]) for error in errors)
        
        with pytest.raises(ValidationError) as exc_info:
            HyperledgerChannelUpdate(
                name="renamed-channel"  # Should not be allowed to update
            )
        errors = exc_info.value.errors()
        assert any("name" in str(error["loc"]) for error in errors)
    
    def test_channel_out_schema(self):
        """Test HyperledgerChannelOut schema."""
        channel = HyperledgerChannelOut(
            _id="60d21b4667d0d8992e610c97",
            name="mychannel",
            network_id="60d21b4667d0d8992e610c96",
            organizations=["Org1MSP", "Org2MSP"],
            config_path="/path/to/channel/config.json",
            metadata={"block_height": 150},
            created_at="2023-01-05T10:00:00",
            updated_at="2023-01-20T14:30:00",
            is_active=True
        )
        
        assert channel.id == "60d21b4667d0d8992e610c97"  # Alias for _id
        assert channel.name == "mychannel"
        assert channel.network_id == "60d21b4667d0d8992e610c96"
        assert "Org1MSP" in channel.organizations
        assert channel.config_path == "/path/to/channel/config.json"
        assert channel.metadata["block_height"] == 150
        assert channel.created_at == "2023-01-05T10:00:00"
        assert channel.updated_at == "2023-01-20T14:30:00"
        assert channel.is_active is True


@pytest.mark.unit
@pytest.mark.schema
@pytest.mark.blockchain
class TestHyperledgerChaincodeSchemas:
    """Tests for Hyperledger chaincode schemas validation."""
    
    def test_chaincode_base_valid(self):
        """Test valid HyperledgerChaincodeBase schema."""
        chaincode = HyperledgerChaincodeBase(
            name="asset-transfer",
            version="1.0.0",
            channel_id="60d21b4667d0d8992e610c97",
            language=ChaincodeLanguage.GOLANG,
            path="/path/to/chaincode",
            init_required=False,
            metadata={
                "description": "Asset transfer chaincode",
                "endorsement_policy": "AND('Org1MSP.peer', 'Org2MSP.peer')"
            }
        )
        
        assert chaincode.name == "asset-transfer"
        assert chaincode.version == "1.0.0"
        assert chaincode.channel_id == "60d21b4667d0d8992e610c97"
        assert chaincode.language == ChaincodeLanguage.GOLANG
        assert chaincode.path == "/path/to/chaincode"
        assert chaincode.init_required is False
        assert chaincode.metadata["description"] == "Asset transfer chaincode"
    
    def test_chaincode_base_minimal(self):
        """Test HyperledgerChaincodeBase with only required fields."""
        chaincode = HyperledgerChaincodeBase(
            name="basic-chaincode",
            version="1.0.0",
            channel_id="60d21b4667d0d8992e610c97",
            language=ChaincodeLanguage.GOLANG
        )
        
        assert chaincode.name == "basic-chaincode"
        assert chaincode.version == "1.0.0"
        assert chaincode.channel_id == "60d21b4667d0d8992e610c97"
        assert chaincode.language == ChaincodeLanguage.GOLANG
        assert chaincode.path is None
        assert chaincode.init_required is False
        assert chaincode.metadata is None
    
    def test_chaincode_base_invalid_version(self):
        """Test HyperledgerChaincodeBase with invalid version format."""
        with pytest.raises(ValidationError) as exc_info:
            HyperledgerChaincodeBase(
                name="invalid-chaincode",
                version="invalid",  # Invalid semver format
                channel_id="60d21b4667d0d8992e610c97",
                language=ChaincodeLanguage.GOLANG
            )
        errors = exc_info.value.errors()
        assert any("version" in str(error["loc"]) for error in errors)
    
    def test_chaincode_base_invalid_channel_id(self):
        """Test HyperledgerChaincodeBase with invalid channel_id."""
        with pytest.raises(ValidationError) as exc_info:
            HyperledgerChaincodeBase(
                name="invalid-channel-chaincode",
                version="1.0.0",
                channel_id="invalid-id",  # Not a valid ObjectId
                language=ChaincodeLanguage.GOLANG
            )
        errors = exc_info.value.errors()
        assert any("channel_id" in str(error["loc"]) for error in errors)
    
    def test_chaincode_create_valid(self):
        """Test valid HyperledgerChaincodeCreate schema."""
        chaincode = HyperledgerChaincodeCreate(
            name="new-chaincode",
            version="1.0.0",
            channel_id="60d21b4667d0d8992e610c97",
            language=ChaincodeLanguage.JAVASCRIPT,
            path="/path/to/js/chaincode",
            init_required=True,
            metadata={
                "description": "New chaincode in JavaScript",
                "collections_config": "/path/to/collections.json"
            },
            package_id="new-chaincode:d908a140358f5f3307x"
        )
        
        assert chaincode.name == "new-chaincode"
        assert chaincode.version == "1.0.0"
        assert chaincode.channel_id == "60d21b4667d0d8992e610c97"
        assert chaincode.language == ChaincodeLanguage.JAVASCRIPT
        assert chaincode.path == "/path/to/js/chaincode"
        assert chaincode.init_required is True
        assert chaincode.metadata["description"] == "New chaincode in JavaScript"
        assert chaincode.package_id == "new-chaincode:d908a140358f5f3307x"
    
    def test_chaincode_update_valid(self):
        """Test valid HyperledgerChaincodeUpdate schema."""
        update = HyperledgerChaincodeUpdate(
            version="1.1.0",  # New version
            path="/path/to/updated/chaincode",
            metadata={
                "updated_at": "2023-05-20",
                "update_notes": "Fixed bugs"
            },
            package_id="updated-chaincode:e019b250459f6f4408y"
        )
        
        assert update.version == "1.1.0"
        assert update.path == "/path/to/updated/chaincode"
        assert update.metadata["updated_at"] == "2023-05-20"
        assert update.package_id == "updated-chaincode:e019b250459f6f4408y"
        assert update.name is None
        assert update.channel_id is None
        assert update.language is None
    
    def test_chaincode_update_immutable_fields(self):
        """Test that immutable fields cannot be updated in HyperledgerChaincodeUpdate."""
        with pytest.raises(ValidationError) as exc_info:
            HyperledgerChaincodeUpdate(
                name="renamed-chaincode"  # Should not be allowed to update
            )
        errors = exc_info.value.errors()
        assert any("name" in str(error["loc"]) for error in errors)
        
        with pytest.raises(ValidationError) as exc_info:
            HyperledgerChaincodeUpdate(
                channel_id="60d21b4667d0d8992e610c98"  # Should not be allowed to update
            )
        errors = exc_info.value.errors()
        assert any("channel_id" in str(error["loc"]) for error in errors)
        
        with pytest.raises(ValidationError) as exc_info:
            HyperledgerChaincodeUpdate(
                language=ChaincodeLanguage.JAVA  # Should not be allowed to update
            )
        errors = exc_info.value.errors()
        assert any("language" in str(error["loc"]) for error in errors)
    
    def test_chaincode_out_schema(self):
        """Test HyperledgerChaincodeOut schema."""
        chaincode = HyperledgerChaincodeOut(
            _id="60d21b4667d0d8992e610c98",
            name="asset-transfer",
            version="1.0.0",
            channel_id="60d21b4667d0d8992e610c97",
            language=ChaincodeLanguage.GOLANG,
            path="/path/to/chaincode",
            init_required=False,
            metadata={
                "description": "Asset transfer chaincode",
                "endorsement_policy": "AND('Org1MSP.peer', 'Org2MSP.peer')"
            },
            package_id="asset-transfer:a808c14025ff5e3407x",
            created_at="2023-01-10T10:00:00",
            updated_at="2023-01-25T14:30:00",
            is_active=True
        )
        
        assert chaincode.id == "60d21b4667d0d8992e610c98"  # Alias for _id
        assert chaincode.name == "asset-transfer"
        assert chaincode.version == "1.0.0"
        assert chaincode.channel_id == "60d21b4667d0d8992e610c97"
        assert chaincode.language == ChaincodeLanguage.GOLANG
        assert chaincode.path == "/path/to/chaincode"
        assert chaincode.init_required is False
        assert chaincode.metadata["description"] == "Asset transfer chaincode"
        assert chaincode.package_id == "asset-transfer:a808c14025ff5e3407x"
        assert chaincode.created_at == "2023-01-10T10:00:00"
        assert chaincode.updated_at == "2023-01-25T14:30:00"
        assert chaincode.is_active is True
    
    def test_network_type_enum(self):
        """Test NetworkType enum values."""
        assert NetworkType.FABRIC.value == "fabric"
        assert NetworkType.BESU.value == "besu"
        assert NetworkType.SAWTOOTH.value == "sawtooth"
        assert NetworkType.IROHA.value == "iroha"
    
    def test_chaincode_language_enum(self):
        """Test ChaincodeLanguage enum values."""
        assert ChaincodeLanguage.GOLANG.value == "golang"
        assert ChaincodeLanguage.JAVASCRIPT.value == "javascript"
        assert ChaincodeLanguage.TYPESCRIPT.value == "typescript"
        assert ChaincodeLanguage.JAVA.value == "java" 