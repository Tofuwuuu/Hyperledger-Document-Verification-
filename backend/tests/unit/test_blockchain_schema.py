import pytest
from pydantic import ValidationError
from datetime import datetime
from bson import ObjectId

from app.schemas.blockchain import (
    BlockchainBase,
    BlockchainCreate,
    BlockchainUpdate,
    BlockchainOut,
    ChainType
)

@pytest.mark.unit
@pytest.mark.schema
class TestBlockchainSchemas:
    """Tests for blockchain schemas validation."""
    
    def test_blockchain_base_valid(self):
        """Test valid BlockchainBase schema."""
        blockchain = BlockchainBase(
            name="Ethereum Mainnet",
            chain_id=1,
            rpc_url="https://mainnet.infura.io/v3/your-api-key",
            chain_type=ChainType.PRODUCTION,
            symbol="ETH",
            explorer_url="https://etherscan.io",
            metadata={
                "gas_limit": 21000,
                "gas_price": "20000000000"
            }
        )
        
        assert blockchain.name == "Ethereum Mainnet"
        assert blockchain.chain_id == 1
        assert blockchain.rpc_url == "https://mainnet.infura.io/v3/your-api-key"
        assert blockchain.chain_type == ChainType.PRODUCTION
        assert blockchain.symbol == "ETH"
        assert blockchain.explorer_url == "https://etherscan.io"
        assert blockchain.metadata == {
            "gas_limit": 21000,
            "gas_price": "20000000000"
        }
    
    def test_blockchain_base_minimal(self):
        """Test BlockchainBase with only required fields."""
        blockchain = BlockchainBase(
            name="Ethereum Testnet",
            chain_id=5,
            rpc_url="https://goerli.infura.io/v3/your-api-key",
            chain_type=ChainType.TEST
        )
        
        assert blockchain.name == "Ethereum Testnet"
        assert blockchain.chain_id == 5
        assert blockchain.rpc_url == "https://goerli.infura.io/v3/your-api-key"
        assert blockchain.chain_type == ChainType.TEST
        assert blockchain.symbol is None
        assert blockchain.explorer_url is None
        assert blockchain.metadata is None
    
    def test_blockchain_base_invalid_chain_id(self):
        """Test BlockchainBase with invalid chain_id."""
        # Negative chain_id
        with pytest.raises(ValidationError) as exc_info:
            BlockchainBase(
                name="Invalid Blockchain",
                chain_id=-1,  # Negative chain_id
                rpc_url="https://example.com/rpc",
                chain_type=ChainType.TEST
            )
        errors = exc_info.value.errors()
        assert any("chain_id" in str(error["loc"]) for error in errors)
    
    def test_blockchain_base_invalid_rpc_url(self):
        """Test BlockchainBase with invalid rpc_url."""
        # Invalid URL format
        with pytest.raises(ValidationError) as exc_info:
            BlockchainBase(
                name="Invalid RPC Blockchain",
                chain_id=100,
                rpc_url="not-a-valid-url",  # Invalid URL
                chain_type=ChainType.TEST
            )
        errors = exc_info.value.errors()
        assert any("rpc_url" in str(error["loc"]) for error in errors)
    
    def test_blockchain_base_invalid_explorer_url(self):
        """Test BlockchainBase with invalid explorer_url."""
        # Invalid URL format
        with pytest.raises(ValidationError) as exc_info:
            BlockchainBase(
                name="Invalid Explorer Blockchain",
                chain_id=100,
                rpc_url="https://example.com/rpc",
                chain_type=ChainType.TEST,
                explorer_url="not-a-valid-url"  # Invalid URL
            )
        errors = exc_info.value.errors()
        assert any("explorer_url" in str(error["loc"]) for error in errors)
    
    def test_blockchain_base_invalid_symbol(self):
        """Test BlockchainBase with invalid symbol."""
        # Too long symbol
        with pytest.raises(ValidationError) as exc_info:
            BlockchainBase(
                name="Invalid Symbol Blockchain",
                chain_id=100,
                rpc_url="https://example.com/rpc",
                chain_type=ChainType.TEST,
                symbol="ETHBTC"  # Too long (max is 5)
            )
        errors = exc_info.value.errors()
        assert any("symbol" in str(error["loc"]) for error in errors)
    
    def test_blockchain_create_valid(self):
        """Test valid BlockchainCreate schema."""
        blockchain = BlockchainCreate(
            name="Polygon Mainnet",
            chain_id=137,
            rpc_url="https://polygon-rpc.com",
            chain_type=ChainType.PRODUCTION,
            symbol="MATIC",
            explorer_url="https://polygonscan.com",
            metadata={
                "gas_limit": 21000,
                "gas_price": "30000000000"
            }
        )
        
        assert blockchain.name == "Polygon Mainnet"
        assert blockchain.chain_id == 137
        assert blockchain.rpc_url == "https://polygon-rpc.com"
        assert blockchain.chain_type == ChainType.PRODUCTION
        assert blockchain.symbol == "MATIC"
        assert blockchain.explorer_url == "https://polygonscan.com"
        assert blockchain.metadata == {
            "gas_limit": 21000,
            "gas_price": "30000000000"
        }
    
    def test_blockchain_create_minimal(self):
        """Test BlockchainCreate with only required fields."""
        blockchain = BlockchainCreate(
            name="Polygon Mumbai",
            chain_id=80001,
            rpc_url="https://rpc-mumbai.matic.today",
            chain_type=ChainType.TEST
        )
        
        assert blockchain.name == "Polygon Mumbai"
        assert blockchain.chain_id == 80001
        assert blockchain.rpc_url == "https://rpc-mumbai.matic.today"
        assert blockchain.chain_type == ChainType.TEST
        assert blockchain.symbol is None
        assert blockchain.explorer_url is None
        assert blockchain.metadata is None
    
    def test_blockchain_update_valid(self):
        """Test valid BlockchainUpdate schema."""
        update = BlockchainUpdate(
            rpc_url="https://updated-mainnet.infura.io/v3/your-api-key",
            explorer_url="https://updated-etherscan.io",
            metadata={
                "gas_limit": 30000,
                "gas_price": "25000000000"
            }
        )
        
        assert update.rpc_url == "https://updated-mainnet.infura.io/v3/your-api-key"
        assert update.explorer_url == "https://updated-etherscan.io"
        assert update.metadata == {
            "gas_limit": 30000,
            "gas_price": "25000000000"
        }
        assert update.name is None
        assert update.chain_id is None
        assert update.chain_type is None
        assert update.symbol is None
    
    def test_blockchain_update_minimal(self):
        """Test BlockchainUpdate with minimal fields."""
        # Just RPC URL update
        update = BlockchainUpdate(
            rpc_url="https://new-rpc.example.com"
        )
        
        assert update.rpc_url == "https://new-rpc.example.com"
        assert update.name is None
        assert update.chain_id is None
        assert update.chain_type is None
        assert update.symbol is None
        assert update.explorer_url is None
        assert update.metadata is None
    
    def test_blockchain_update_immutable_chain_id(self):
        """Test that chain_id cannot be updated in BlockchainUpdate."""
        with pytest.raises(ValidationError) as exc_info:
            BlockchainUpdate(
                chain_id=42  # Should not be allowed to update chain_id
            )
        errors = exc_info.value.errors()
        assert any("chain_id" in str(error["loc"]) for error in errors)
    
    def test_blockchain_out_schema(self):
        """Test BlockchainOut schema."""
        blockchain = BlockchainOut(
            _id="60d21b4667d0d8992e610c87",
            name="Ethereum Mainnet",
            chain_id=1,
            rpc_url="https://mainnet.infura.io/v3/your-api-key",
            chain_type=ChainType.PRODUCTION,
            symbol="ETH",
            explorer_url="https://etherscan.io",
            metadata={
                "gas_limit": 21000,
                "gas_price": "20000000000"
            },
            created_at="2023-01-01T10:00:00",
            updated_at="2023-01-10T15:30:00",
            is_active=True
        )
        
        assert blockchain.id == "60d21b4667d0d8992e610c87"  # Alias for _id
        assert blockchain.name == "Ethereum Mainnet"
        assert blockchain.chain_id == 1
        assert blockchain.rpc_url == "https://mainnet.infura.io/v3/your-api-key"
        assert blockchain.chain_type == ChainType.PRODUCTION
        assert blockchain.symbol == "ETH"
        assert blockchain.explorer_url == "https://etherscan.io"
        assert blockchain.metadata == {
            "gas_limit": 21000,
            "gas_price": "20000000000"
        }
        assert blockchain.created_at == "2023-01-01T10:00:00"
        assert blockchain.updated_at == "2023-01-10T15:30:00"
        assert blockchain.is_active is True
    
    def test_blockchain_out_minimal(self):
        """Test BlockchainOut with minimal fields."""
        blockchain = BlockchainOut(
            _id="60d21b4667d0d8992e610c88",
            name="Goerli Testnet",
            chain_id=5,
            rpc_url="https://goerli.infura.io/v3/your-api-key",
            chain_type=ChainType.TEST,
            created_at="2023-02-01T10:00:00",
            updated_at="2023-02-01T10:00:00",
            is_active=True
        )
        
        assert blockchain.id == "60d21b4667d0d8992e610c88"
        assert blockchain.name == "Goerli Testnet"
        assert blockchain.chain_id == 5
        assert blockchain.rpc_url == "https://goerli.infura.io/v3/your-api-key"
        assert blockchain.chain_type == ChainType.TEST
        assert blockchain.symbol is None
        assert blockchain.explorer_url is None
        assert blockchain.metadata is None
        assert blockchain.created_at == "2023-02-01T10:00:00"
        assert blockchain.updated_at == "2023-02-01T10:00:00"
        assert blockchain.is_active is True
    
    def test_blockchain_out_inactive(self):
        """Test BlockchainOut with inactive status."""
        blockchain = BlockchainOut(
            _id="60d21b4667d0d8992e610c89",
            name="Deprecated Testnet",
            chain_id=999,
            rpc_url="https://deprecated.example.com/rpc",
            chain_type=ChainType.TEST,
            created_at="2022-01-01T10:00:00",
            updated_at="2023-03-15T14:20:00",
            is_active=False
        )
        
        assert blockchain.id == "60d21b4667d0d8992e610c89"
        assert blockchain.name == "Deprecated Testnet"
        assert blockchain.chain_id == 999
        assert blockchain.rpc_url == "https://deprecated.example.com/rpc"
        assert blockchain.chain_type == ChainType.TEST
        assert blockchain.created_at == "2022-01-01T10:00:00"
        assert blockchain.updated_at == "2023-03-15T14:20:00"
        assert blockchain.is_active is False
    
    def test_chain_type_enum(self):
        """Test ChainType enum values."""
        assert ChainType.PRODUCTION.value == "production"
        assert ChainType.TEST.value == "test"
        assert ChainType.DEVELOPMENT.value == "development" 