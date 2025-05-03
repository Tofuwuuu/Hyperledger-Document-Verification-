import pytest
from pydantic import ValidationError
from datetime import datetime

from app.schemas.token import (
    TokenBase,
    TokenCreate,
    TokenUpdate,
    TokenOut,
    TokenType
)

@pytest.mark.unit
@pytest.mark.schema
class TestTokenSchemas:
    """Tests for token schemas validation."""
    
    def test_token_base_valid(self):
        """Test valid TokenBase schema."""
        token = TokenBase(
            name="Certificate Token",
            symbol="CERT",
            token_type=TokenType.ERC721,
            decimal_places=0,
            metadata={
                "description": "Digital Certificate Token",
                "image": "https://example.com/image.png"
            }
        )
        
        assert token.name == "Certificate Token"
        assert token.symbol == "CERT"
        assert token.token_type == TokenType.ERC721
        assert token.decimal_places == 0
        assert token.metadata == {
            "description": "Digital Certificate Token",
            "image": "https://example.com/image.png"
        }
    
    def test_token_base_minimal(self):
        """Test TokenBase with only required fields."""
        token = TokenBase(
            name="Minimal Token",
            symbol="MIN",
            token_type=TokenType.ERC20
        )
        
        assert token.name == "Minimal Token"
        assert token.symbol == "MIN"
        assert token.token_type == TokenType.ERC20
        assert token.decimal_places == 18  # Default value
        assert token.metadata is None
    
    def test_token_base_invalid_symbol(self):
        """Test TokenBase with invalid symbol."""
        with pytest.raises(ValidationError) as exc_info:
            TokenBase(
                name="Invalid Symbol Token",
                symbol="TOOLONG",  # Too many characters
                token_type=TokenType.ERC20
            )
        errors = exc_info.value.errors()
        assert any("symbol" in str(error["loc"]) for error in errors)
        
        with pytest.raises(ValidationError) as exc_info:
            TokenBase(
                name="Invalid Symbol Token",
                symbol="12",  # Too short
                token_type=TokenType.ERC20
            )
        errors = exc_info.value.errors()
        assert any("symbol" in str(error["loc"]) for error in errors)
    
    def test_token_base_invalid_decimal_places(self):
        """Test TokenBase with invalid decimal_places."""
        with pytest.raises(ValidationError) as exc_info:
            TokenBase(
                name="Invalid Decimals Token",
                symbol="IDT",
                token_type=TokenType.ERC20,
                decimal_places=-1  # Negative value
            )
        errors = exc_info.value.errors()
        assert any("decimal_places" in str(error["loc"]) for error in errors)
        
        with pytest.raises(ValidationError) as exc_info:
            TokenBase(
                name="Invalid Decimals Token",
                symbol="IDT",
                token_type=TokenType.ERC20,
                decimal_places=19  # Too high
            )
        errors = exc_info.value.errors()
        assert any("decimal_places" in str(error["loc"]) for error in errors)
    
    def test_token_base_invalid_token_type(self):
        """Test TokenBase with invalid token_type."""
        with pytest.raises(ValidationError) as exc_info:
            TokenBase(
                name="Invalid Type Token",
                symbol="ITT",
                token_type="NOT_A_TYPE"  # Invalid enum value
            )
        errors = exc_info.value.errors()
        assert any("token_type" in str(error["loc"]) for error in errors)
    
    def test_token_create_valid(self):
        """Test valid TokenCreate schema."""
        token = TokenCreate(
            name="Certificate Token",
            symbol="CERT",
            token_type=TokenType.ERC721,
            decimal_places=0,
            metadata={
                "description": "Digital Certificate Token",
                "image": "https://example.com/image.png"
            },
            initial_supply=1000,
            max_supply=10000,
            is_mintable=True,
            is_burnable=True,
            blockchain_id="60d21b4667d0d8992e610c87"
        )
        
        assert token.name == "Certificate Token"
        assert token.symbol == "CERT"
        assert token.token_type == TokenType.ERC721
        assert token.decimal_places == 0
        assert token.metadata == {
            "description": "Digital Certificate Token",
            "image": "https://example.com/image.png"
        }
        assert token.initial_supply == 1000
        assert token.max_supply == 10000
        assert token.is_mintable is True
        assert token.is_burnable is True
        assert token.blockchain_id == "60d21b4667d0d8992e610c87"
    
    def test_token_create_minimal(self):
        """Test TokenCreate with only required fields."""
        token = TokenCreate(
            name="Minimal Create Token",
            symbol="MCT",
            token_type=TokenType.ERC20,
            blockchain_id="60d21b4667d0d8992e610c87"
        )
        
        assert token.name == "Minimal Create Token"
        assert token.symbol == "MCT"
        assert token.token_type == TokenType.ERC20
        assert token.decimal_places == 18  # Default
        assert token.metadata is None
        assert token.initial_supply == 0  # Default
        assert token.max_supply is None  # Default
        assert token.is_mintable is True  # Default
        assert token.is_burnable is True  # Default
        assert token.blockchain_id == "60d21b4667d0d8992e610c87"
    
    def test_token_create_invalid_supply(self):
        """Test TokenCreate with invalid supply values."""
        # Initial supply greater than max supply
        with pytest.raises(ValidationError) as exc_info:
            TokenCreate(
                name="Invalid Supply Token",
                symbol="IST",
                token_type=TokenType.ERC20,
                initial_supply=10000,
                max_supply=1000,
                blockchain_id="60d21b4667d0d8992e610c87"
            )
        errors = exc_info.value.errors()
        assert any("supply" in str(error["msg"]) for error in errors)
        
        # Negative initial supply
        with pytest.raises(ValidationError) as exc_info:
            TokenCreate(
                name="Negative Supply Token",
                symbol="NST",
                token_type=TokenType.ERC20,
                initial_supply=-10,
                blockchain_id="60d21b4667d0d8992e610c87"
            )
        errors = exc_info.value.errors()
        assert any("initial_supply" in str(error["loc"]) for error in errors)
    
    def test_token_create_invalid_blockchain_id(self):
        """Test TokenCreate with invalid blockchain_id."""
        with pytest.raises(ValidationError) as exc_info:
            TokenCreate(
                name="Invalid Blockchain ID Token",
                symbol="IBT",
                token_type=TokenType.ERC20,
                blockchain_id="not-a-valid-id"  # Not a valid ObjectId
            )
        errors = exc_info.value.errors()
        assert any("blockchain_id" in str(error["loc"]) for error in errors)
    
    def test_token_update_valid(self):
        """Test valid TokenUpdate schema."""
        # Full update
        update = TokenUpdate(
            name="Updated Token",
            metadata={
                "description": "Updated description",
                "website": "https://updated.example.com"
            },
            is_mintable=False,
            is_burnable=False
        )
        
        assert update.name == "Updated Token"
        assert update.metadata == {
            "description": "Updated description",
            "website": "https://updated.example.com"
        }
        assert update.is_mintable is False
        assert update.is_burnable is False
        
        # Partial update
        update = TokenUpdate(
            name="New Name Only"
        )
        
        assert update.name == "New Name Only"
        assert update.symbol is None
        assert update.metadata is None
        assert update.is_mintable is None
        assert update.is_burnable is None
    
    def test_token_update_immutable_fields(self):
        """Test TokenUpdate rejecting updates to immutable fields."""
        with pytest.raises(ValidationError) as exc_info:
            TokenUpdate(
                token_type=TokenType.ERC1155  # Cannot change token type
            )
        errors = exc_info.value.errors()
        assert any("token_type" in str(error["loc"]) for error in errors)
        
        with pytest.raises(ValidationError) as exc_info:
            TokenUpdate(
                decimal_places=12  # Cannot change decimal places
            )
        errors = exc_info.value.errors()
        assert any("decimal_places" in str(error["loc"]) for error in errors)
        
        with pytest.raises(ValidationError) as exc_info:
            TokenUpdate(
                initial_supply=500  # Cannot change initial supply
            )
        errors = exc_info.value.errors()
        assert any("initial_supply" in str(error["loc"]) for error in errors)
    
    def test_token_update_clear_metadata(self):
        """Test TokenUpdate with empty metadata to clear it."""
        update = TokenUpdate(
            metadata={}  # Empty dict to clear metadata
        )
        
        assert update.metadata == {}
    
    def test_token_out_schema(self):
        """Test TokenOut schema."""
        token = TokenOut(
            _id="60d21b4667d0d8992e610c82",
            name="Certificate Token",
            symbol="CERT",
            token_type=TokenType.ERC721,
            decimal_places=0,
            metadata={
                "description": "Digital Certificate Token",
                "image": "https://example.com/image.png"
            },
            initial_supply=1000,
            current_supply=950,
            max_supply=10000,
            is_mintable=True,
            is_burnable=True,
            blockchain_id="60d21b4667d0d8992e610c87",
            blockchain_name="Ethereum Mainnet",
            contract_address="0x1234567890123456789012345678901234567890",
            deployment_tx_hash="0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            is_deployed=True,
            is_active=True,
            created_at="2023-01-01T10:00:00",
            updated_at="2023-01-15T14:30:00"
        )
        
        assert token.id == "60d21b4667d0d8992e610c82"  # Alias for _id
        assert token.name == "Certificate Token"
        assert token.symbol == "CERT"
        assert token.token_type == TokenType.ERC721
        assert token.decimal_places == 0
        assert token.metadata == {
            "description": "Digital Certificate Token",
            "image": "https://example.com/image.png"
        }
        assert token.initial_supply == 1000
        assert token.current_supply == 950
        assert token.max_supply == 10000
        assert token.is_mintable is True
        assert token.is_burnable is True
        assert token.blockchain_id == "60d21b4667d0d8992e610c87"
        assert token.blockchain_name == "Ethereum Mainnet"
        assert token.contract_address == "0x1234567890123456789012345678901234567890"
        assert token.deployment_tx_hash == "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
        assert token.is_deployed is True
        assert token.is_active is True
        assert token.created_at == "2023-01-01T10:00:00"
        assert token.updated_at == "2023-01-15T14:30:00"
    
    def test_token_out_minimal(self):
        """Test TokenOut with minimal fields."""
        token = TokenOut(
            _id="60d21b4667d0d8992e610c83",
            name="Minimal Output Token",
            symbol="MOT",
            token_type=TokenType.ERC20,
            decimal_places=18,
            initial_supply=0,
            current_supply=0,
            is_mintable=True,
            is_burnable=True,
            blockchain_id="60d21b4667d0d8992e610c88",
            blockchain_name="Polygon Testnet",
            is_deployed=False,
            is_active=True,
            created_at="2023-02-01T10:00:00",
            updated_at="2023-02-01T10:00:00"
        )
        
        assert token.id == "60d21b4667d0d8992e610c83"
        assert token.name == "Minimal Output Token"
        assert token.symbol == "MOT"
        assert token.token_type == TokenType.ERC20
        assert token.decimal_places == 18
        assert token.metadata is None
        assert token.initial_supply == 0
        assert token.current_supply == 0
        assert token.max_supply is None
        assert token.is_mintable is True
        assert token.is_burnable is True
        assert token.blockchain_id == "60d21b4667d0d8992e610c88"
        assert token.blockchain_name == "Polygon Testnet"
        assert token.contract_address is None
        assert token.deployment_tx_hash is None
        assert token.is_deployed is False
        assert token.is_active is True
        assert token.created_at == "2023-02-01T10:00:00"
        assert token.updated_at == "2023-02-01T10:00:00"
    
    def test_token_type_enum(self):
        """Test TokenType enum values."""
        assert TokenType.ERC20.value == "erc20"
        assert TokenType.ERC721.value == "erc721"
        assert TokenType.ERC1155.value == "erc1155" 