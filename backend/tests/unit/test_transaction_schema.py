import pytest
from pydantic import ValidationError
from datetime import datetime
from bson import ObjectId

from app.schemas.transaction import (
    TransactionBase,
    TransactionCreate,
    TransactionUpdate,
    TransactionOut,
    TransactionType,
    TransactionStatus
)

@pytest.mark.unit
@pytest.mark.schema
class TestTransactionSchemas:
    """Tests for transaction schemas validation."""
    
    def test_transaction_base_valid(self):
        """Test valid TransactionBase schema."""
        transaction = TransactionBase(
            transaction_type=TransactionType.TOKEN_TRANSFER,
            token_id="60d21b4667d0d8992e610c82",
            from_address="0x1234567890123456789012345678901234567890",
            to_address="0xabcdef1234567890abcdef1234567890abcdef12",
            amount="100.5",
            fee="0.01",
            metadata={
                "purpose": "Test transfer",
                "ref_id": "ABC123"
            }
        )
        
        assert transaction.transaction_type == TransactionType.TOKEN_TRANSFER
        assert transaction.token_id == "60d21b4667d0d8992e610c82"
        assert transaction.from_address == "0x1234567890123456789012345678901234567890"
        assert transaction.to_address == "0xabcdef1234567890abcdef1234567890abcdef12"
        assert transaction.amount == "100.5"
        assert transaction.fee == "0.01"
        assert transaction.metadata == {
            "purpose": "Test transfer",
            "ref_id": "ABC123"
        }
    
    def test_transaction_base_minimal(self):
        """Test TransactionBase with only required fields."""
        transaction = TransactionBase(
            transaction_type=TransactionType.TOKEN_TRANSFER,
            token_id="60d21b4667d0d8992e610c82",
            from_address="0x1234567890123456789012345678901234567890",
            to_address="0xabcdef1234567890abcdef1234567890abcdef12",
            amount="10"
        )
        
        assert transaction.transaction_type == TransactionType.TOKEN_TRANSFER
        assert transaction.token_id == "60d21b4667d0d8992e610c82"
        assert transaction.from_address == "0x1234567890123456789012345678901234567890"
        assert transaction.to_address == "0xabcdef1234567890abcdef1234567890abcdef12"
        assert transaction.amount == "10"
        assert transaction.fee is None
        assert transaction.metadata is None
    
    def test_transaction_base_invalid_addresses(self):
        """Test TransactionBase with invalid addresses."""
        # Invalid from_address
        with pytest.raises(ValidationError) as exc_info:
            TransactionBase(
                transaction_type=TransactionType.TOKEN_TRANSFER,
                token_id="60d21b4667d0d8992e610c82",
                from_address="invalid-address",  # Not a valid Ethereum address
                to_address="0xabcdef1234567890abcdef1234567890abcdef12",
                amount="100"
            )
        errors = exc_info.value.errors()
        assert any("from_address" in str(error["loc"]) for error in errors)
        
        # Invalid to_address
        with pytest.raises(ValidationError) as exc_info:
            TransactionBase(
                transaction_type=TransactionType.TOKEN_TRANSFER,
                token_id="60d21b4667d0d8992e610c82",
                from_address="0x1234567890123456789012345678901234567890",
                to_address="not-hex-address",  # Not a valid Ethereum address
                amount="100"
            )
        errors = exc_info.value.errors()
        assert any("to_address" in str(error["loc"]) for error in errors)
    
    def test_transaction_base_invalid_amount(self):
        """Test TransactionBase with invalid amount."""
        with pytest.raises(ValidationError) as exc_info:
            TransactionBase(
                transaction_type=TransactionType.TOKEN_TRANSFER,
                token_id="60d21b4667d0d8992e610c82",
                from_address="0x1234567890123456789012345678901234567890",
                to_address="0xabcdef1234567890abcdef1234567890abcdef12",
                amount="not-a-number"  # Not a valid amount
            )
        errors = exc_info.value.errors()
        assert any("amount" in str(error["loc"]) for error in errors)
        
        # Negative amount
        with pytest.raises(ValidationError) as exc_info:
            TransactionBase(
                transaction_type=TransactionType.TOKEN_TRANSFER,
                token_id="60d21b4667d0d8992e610c82",
                from_address="0x1234567890123456789012345678901234567890",
                to_address="0xabcdef1234567890abcdef1234567890abcdef12",
                amount="-10"  # Negative amount
            )
        errors = exc_info.value.errors()
        assert any("amount" in str(error["loc"]) for error in errors)
    
    def test_transaction_base_invalid_fee(self):
        """Test TransactionBase with invalid fee."""
        with pytest.raises(ValidationError) as exc_info:
            TransactionBase(
                transaction_type=TransactionType.TOKEN_TRANSFER,
                token_id="60d21b4667d0d8992e610c82",
                from_address="0x1234567890123456789012345678901234567890",
                to_address="0xabcdef1234567890abcdef1234567890abcdef12",
                amount="100",
                fee="not-a-number"  # Not a valid fee
            )
        errors = exc_info.value.errors()
        assert any("fee" in str(error["loc"]) for error in errors)
        
        # Negative fee
        with pytest.raises(ValidationError) as exc_info:
            TransactionBase(
                transaction_type=TransactionType.TOKEN_TRANSFER,
                token_id="60d21b4667d0d8992e610c82",
                from_address="0x1234567890123456789012345678901234567890",
                to_address="0xabcdef1234567890abcdef1234567890abcdef12",
                amount="100",
                fee="-0.01"  # Negative fee
            )
        errors = exc_info.value.errors()
        assert any("fee" in str(error["loc"]) for error in errors)
    
    def test_transaction_create_valid(self):
        """Test valid TransactionCreate schema."""
        transaction = TransactionCreate(
            transaction_type=TransactionType.TOKEN_TRANSFER,
            token_id="60d21b4667d0d8992e610c82",
            from_address="0x1234567890123456789012345678901234567890",
            to_address="0xabcdef1234567890abcdef1234567890abcdef12",
            amount="100.5",
            fee="0.01",
            metadata={
                "purpose": "Test transfer",
                "ref_id": "ABC123"
            },
            blockchain_id="60d21b4667d0d8992e610c87"
        )
        
        assert transaction.transaction_type == TransactionType.TOKEN_TRANSFER
        assert transaction.token_id == "60d21b4667d0d8992e610c82"
        assert transaction.from_address == "0x1234567890123456789012345678901234567890"
        assert transaction.to_address == "0xabcdef1234567890abcdef1234567890abcdef12"
        assert transaction.amount == "100.5"
        assert transaction.fee == "0.01"
        assert transaction.metadata == {
            "purpose": "Test transfer",
            "ref_id": "ABC123"
        }
        assert transaction.blockchain_id == "60d21b4667d0d8992e610c87"
    
    def test_transaction_create_minimal(self):
        """Test TransactionCreate with only required fields."""
        transaction = TransactionCreate(
            transaction_type=TransactionType.TOKEN_TRANSFER,
            token_id="60d21b4667d0d8992e610c82",
            from_address="0x1234567890123456789012345678901234567890",
            to_address="0xabcdef1234567890abcdef1234567890abcdef12",
            amount="10",
            blockchain_id="60d21b4667d0d8992e610c87"
        )
        
        assert transaction.transaction_type == TransactionType.TOKEN_TRANSFER
        assert transaction.token_id == "60d21b4667d0d8992e610c82"
        assert transaction.from_address == "0x1234567890123456789012345678901234567890"
        assert transaction.to_address == "0xabcdef1234567890abcdef1234567890abcdef12"
        assert transaction.amount == "10"
        assert transaction.fee is None
        assert transaction.metadata is None
        assert transaction.blockchain_id == "60d21b4667d0d8992e610c87"
    
    def test_transaction_create_invalid_blockchain_id(self):
        """Test TransactionCreate with invalid blockchain_id."""
        with pytest.raises(ValidationError) as exc_info:
            TransactionCreate(
                transaction_type=TransactionType.TOKEN_TRANSFER,
                token_id="60d21b4667d0d8992e610c82",
                from_address="0x1234567890123456789012345678901234567890",
                to_address="0xabcdef1234567890abcdef1234567890abcdef12",
                amount="100",
                blockchain_id="not-a-valid-id"  # Not a valid ObjectId
            )
        errors = exc_info.value.errors()
        assert any("blockchain_id" in str(error["loc"]) for error in errors)
    
    def test_transaction_create_invalid_token_id(self):
        """Test TransactionCreate with invalid token_id."""
        with pytest.raises(ValidationError) as exc_info:
            TransactionCreate(
                transaction_type=TransactionType.TOKEN_TRANSFER,
                token_id="invalid-token-id",  # Not a valid ObjectId
                from_address="0x1234567890123456789012345678901234567890",
                to_address="0xabcdef1234567890abcdef1234567890abcdef12",
                amount="100",
                blockchain_id="60d21b4667d0d8992e610c87"
            )
        errors = exc_info.value.errors()
        assert any("token_id" in str(error["loc"]) for error in errors)
    
    def test_transaction_update_valid(self):
        """Test valid TransactionUpdate schema."""
        update = TransactionUpdate(
            status=TransactionStatus.CONFIRMED,
            tx_hash="0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
            block_number=123456,
            metadata={
                "confirmed_at": "2023-01-15T12:30:45",
                "confirmations": 24
            }
        )
        
        assert update.status == TransactionStatus.CONFIRMED
        assert update.tx_hash == "0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
        assert update.block_number == 123456
        assert update.metadata == {
            "confirmed_at": "2023-01-15T12:30:45",
            "confirmations": 24
        }
    
    def test_transaction_update_minimal(self):
        """Test TransactionUpdate with minimal fields."""
        # Just status update
        update = TransactionUpdate(
            status=TransactionStatus.PENDING
        )
        
        assert update.status == TransactionStatus.PENDING
        assert update.tx_hash is None
        assert update.block_number is None
        assert update.metadata is None
        
        # Just tx_hash update
        update = TransactionUpdate(
            tx_hash="0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
        )
        
        assert update.status is None
        assert update.tx_hash == "0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
        assert update.block_number is None
        assert update.metadata is None
    
    def test_transaction_update_invalid_tx_hash(self):
        """Test TransactionUpdate with invalid tx_hash."""
        with pytest.raises(ValidationError) as exc_info:
            TransactionUpdate(
                tx_hash="not-a-valid-hash"  # Not a valid transaction hash
            )
        errors = exc_info.value.errors()
        assert any("tx_hash" in str(error["loc"]) for error in errors)
    
    def test_transaction_update_invalid_block_number(self):
        """Test TransactionUpdate with invalid block_number."""
        with pytest.raises(ValidationError) as exc_info:
            TransactionUpdate(
                block_number=-1  # Negative block number
            )
        errors = exc_info.value.errors()
        assert any("block_number" in str(error["loc"]) for error in errors)
    
    def test_transaction_update_immutable_fields(self):
        """Test TransactionUpdate rejects updates to immutable fields."""
        with pytest.raises(ValidationError) as exc_info:
            TransactionUpdate(
                transaction_type=TransactionType.TOKEN_MINT  # Cannot change type
            )
        errors = exc_info.value.errors()
        assert any("transaction_type" in str(error["loc"]) for error in errors)
        
        with pytest.raises(ValidationError) as exc_info:
            TransactionUpdate(
                token_id="60d21b4667d0d8992e610c83"  # Cannot change token_id
            )
        errors = exc_info.value.errors()
        assert any("token_id" in str(error["loc"]) for error in errors)
        
        with pytest.raises(ValidationError) as exc_info:
            TransactionUpdate(
                from_address="0xabcdef1234567890abcdef1234567890abcdef12"  # Cannot change from
            )
        errors = exc_info.value.errors()
        assert any("from_address" in str(error["loc"]) for error in errors)
    
    def test_transaction_out_schema(self):
        """Test TransactionOut schema."""
        transaction = TransactionOut(
            _id="60d21b4667d0d8992e610c90",
            transaction_type=TransactionType.TOKEN_TRANSFER,
            token_id="60d21b4667d0d8992e610c82",
            token_name="Certificate Token",
            token_symbol="CERT",
            from_address="0x1234567890123456789012345678901234567890",
            to_address="0xabcdef1234567890abcdef1234567890abcdef12",
            amount="100.5",
            fee="0.01",
            status=TransactionStatus.CONFIRMED,
            tx_hash="0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
            block_number=123456,
            metadata={
                "purpose": "Test transfer",
                "ref_id": "ABC123",
                "confirmed_at": "2023-01-15T12:30:45"
            },
            blockchain_id="60d21b4667d0d8992e610c87",
            blockchain_name="Ethereum Mainnet",
            created_at="2023-01-15T10:00:00",
            updated_at="2023-01-15T12:35:00"
        )
        
        assert transaction.id == "60d21b4667d0d8992e610c90"  # Alias for _id
        assert transaction.transaction_type == TransactionType.TOKEN_TRANSFER
        assert transaction.token_id == "60d21b4667d0d8992e610c82"
        assert transaction.token_name == "Certificate Token"
        assert transaction.token_symbol == "CERT"
        assert transaction.from_address == "0x1234567890123456789012345678901234567890"
        assert transaction.to_address == "0xabcdef1234567890abcdef1234567890abcdef12"
        assert transaction.amount == "100.5"
        assert transaction.fee == "0.01"
        assert transaction.status == TransactionStatus.CONFIRMED
        assert transaction.tx_hash == "0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
        assert transaction.block_number == 123456
        assert transaction.metadata == {
            "purpose": "Test transfer",
            "ref_id": "ABC123",
            "confirmed_at": "2023-01-15T12:30:45"
        }
        assert transaction.blockchain_id == "60d21b4667d0d8992e610c87"
        assert transaction.blockchain_name == "Ethereum Mainnet"
        assert transaction.created_at == "2023-01-15T10:00:00"
        assert transaction.updated_at == "2023-01-15T12:35:00"
    
    def test_transaction_out_minimal(self):
        """Test TransactionOut with minimal fields."""
        transaction = TransactionOut(
            _id="60d21b4667d0d8992e610c91",
            transaction_type=TransactionType.TOKEN_MINT,
            token_id="60d21b4667d0d8992e610c83",
            token_name="Standard Token",
            token_symbol="STD",
            from_address="0x0000000000000000000000000000000000000000",
            to_address="0x1234567890123456789012345678901234567890",
            amount="1000",
            status=TransactionStatus.PENDING,
            blockchain_id="60d21b4667d0d8992e610c88",
            blockchain_name="Polygon Testnet",
            created_at="2023-02-01T10:00:00",
            updated_at="2023-02-01T10:00:00"
        )
        
        assert transaction.id == "60d21b4667d0d8992e610c91"
        assert transaction.transaction_type == TransactionType.TOKEN_MINT
        assert transaction.token_id == "60d21b4667d0d8992e610c83"
        assert transaction.token_name == "Standard Token"
        assert transaction.token_symbol == "STD"
        assert transaction.from_address == "0x0000000000000000000000000000000000000000"
        assert transaction.to_address == "0x1234567890123456789012345678901234567890"
        assert transaction.amount == "1000"
        assert transaction.fee is None
        assert transaction.status == TransactionStatus.PENDING
        assert transaction.tx_hash is None
        assert transaction.block_number is None
        assert transaction.metadata is None
        assert transaction.blockchain_id == "60d21b4667d0d8992e610c88"
        assert transaction.blockchain_name == "Polygon Testnet"
        assert transaction.created_at == "2023-02-01T10:00:00"
        assert transaction.updated_at == "2023-02-01T10:00:00"
    
    def test_transaction_type_enum(self):
        """Test TransactionType enum values."""
        assert TransactionType.TOKEN_TRANSFER.value == "token_transfer"
        assert TransactionType.TOKEN_MINT.value == "token_mint"
        assert TransactionType.TOKEN_BURN.value == "token_burn"
    
    def test_transaction_status_enum(self):
        """Test TransactionStatus enum values."""
        assert TransactionStatus.PENDING.value == "pending"
        assert TransactionStatus.CONFIRMED.value == "confirmed"
        assert TransactionStatus.FAILED.value == "failed"
        assert TransactionStatus.CANCELED.value == "canceled" 