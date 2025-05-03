import pytest
from pydantic import ValidationError
from bson import ObjectId

from app.schemas.wallet import (
    WalletBase,
    WalletCreate,
    WalletUpdate,
    WalletOut,
    WalletType
)


@pytest.mark.unit
@pytest.mark.schema
class TestWalletSchemas:
    """Tests for wallet schemas validation."""
    
    def test_wallet_base_valid(self):
        """Test valid WalletBase schema."""
        wallet = WalletBase(
            name="My Ethereum Wallet",
            address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            blockchain_id="60d21b4667d0d8992e610c87",
            wallet_type=WalletType.EXTERNAL,
            private_key="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            metadata={
                "derivation_path": "m/44'/60'/0'/0/0",
                "source": "metamask"
            }
        )
        
        assert wallet.name == "My Ethereum Wallet"
        assert wallet.address == "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        assert wallet.blockchain_id == "60d21b4667d0d8992e610c87"
        assert wallet.wallet_type == WalletType.EXTERNAL
        assert wallet.private_key == "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        assert wallet.metadata == {
            "derivation_path": "m/44'/60'/0'/0/0",
            "source": "metamask"
        }
    
    def test_wallet_base_minimal(self):
        """Test WalletBase with only required fields."""
        wallet = WalletBase(
            name="Minimal Wallet",
            address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            blockchain_id="60d21b4667d0d8992e610c87",
            wallet_type=WalletType.EXTERNAL
        )
        
        assert wallet.name == "Minimal Wallet"
        assert wallet.address == "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        assert wallet.blockchain_id == "60d21b4667d0d8992e610c87"
        assert wallet.wallet_type == WalletType.EXTERNAL
        assert wallet.private_key is None
        assert wallet.metadata is None
    
    def test_wallet_base_invalid_address(self):
        """Test WalletBase with invalid Ethereum address."""
        # Not a valid Ethereum address
        with pytest.raises(ValidationError) as exc_info:
            WalletBase(
                name="Invalid Address Wallet",
                address="0xinvalid",
                blockchain_id="60d21b4667d0d8992e610c87",
                wallet_type=WalletType.EXTERNAL
            )
        errors = exc_info.value.errors()
        assert any("address" in str(error["loc"]) for error in errors)
    
    def test_wallet_base_invalid_private_key(self):
        """Test WalletBase with invalid private key."""
        # Too short private key
        with pytest.raises(ValidationError) as exc_info:
            WalletBase(
                name="Invalid Key Wallet",
                address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
                blockchain_id="60d21b4667d0d8992e610c87",
                wallet_type=WalletType.EXTERNAL,
                private_key="0x1234"  # Too short
            )
        errors = exc_info.value.errors()
        assert any("private_key" in str(error["loc"]) for error in errors)
    
    def test_wallet_base_invalid_blockchain_id(self):
        """Test WalletBase with invalid blockchain_id."""
        # Invalid ObjectId format
        with pytest.raises(ValidationError) as exc_info:
            WalletBase(
                name="Invalid Blockchain ID Wallet",
                address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
                blockchain_id="invalid_id",  # Not a valid ObjectId
                wallet_type=WalletType.EXTERNAL
            )
        errors = exc_info.value.errors()
        assert any("blockchain_id" in str(error["loc"]) for error in errors)
    
    def test_wallet_create_valid(self):
        """Test valid WalletCreate schema."""
        wallet = WalletCreate(
            name="New Wallet",
            address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            blockchain_id="60d21b4667d0d8992e610c87",
            wallet_type=WalletType.CUSTODIAL,
            private_key="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            metadata={
                "service": "fireblocks",
                "vault_id": "12345"
            },
            is_default=True
        )
        
        assert wallet.name == "New Wallet"
        assert wallet.address == "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        assert wallet.blockchain_id == "60d21b4667d0d8992e610c87"
        assert wallet.wallet_type == WalletType.CUSTODIAL
        assert wallet.private_key == "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        assert wallet.metadata == {
            "service": "fireblocks",
            "vault_id": "12345"
        }
        assert wallet.is_default is True
    
    def test_wallet_create_minimal(self):
        """Test WalletCreate with only required fields."""
        wallet = WalletCreate(
            name="Minimal Create Wallet",
            address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            blockchain_id="60d21b4667d0d8992e610c87",
            wallet_type=WalletType.EXTERNAL
        )
        
        assert wallet.name == "Minimal Create Wallet"
        assert wallet.address == "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        assert wallet.blockchain_id == "60d21b4667d0d8992e610c87"
        assert wallet.wallet_type == WalletType.EXTERNAL
        assert wallet.private_key is None
        assert wallet.metadata is None
        assert wallet.is_default is False  # Default value
    
    def test_wallet_update_valid(self):
        """Test valid WalletUpdate schema."""
        update = WalletUpdate(
            name="Updated Wallet Name",
            private_key="0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            metadata={
                "notes": "Updated wallet for testing",
                "last_used": "2023-05-15"
            },
            is_default=True
        )
        
        assert update.name == "Updated Wallet Name"
        assert update.private_key == "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
        assert update.metadata == {
            "notes": "Updated wallet for testing",
            "last_used": "2023-05-15"
        }
        assert update.is_default is True
        assert update.address is None  # Shouldn't be updatable
        assert update.blockchain_id is None  # Shouldn't be updatable
        assert update.wallet_type is None  # Shouldn't be updatable
    
    def test_wallet_update_minimal(self):
        """Test WalletUpdate with minimal fields."""
        # Just name update
        update = WalletUpdate(
            name="New Name Only"
        )
        
        assert update.name == "New Name Only"
        assert update.private_key is None
        assert update.metadata is None
        assert update.is_default is None
        assert update.address is None
        assert update.blockchain_id is None
        assert update.wallet_type is None
    
    def test_wallet_update_immutable_fields(self):
        """Test that immutable fields cannot be updated in WalletUpdate."""
        # Address should be immutable
        with pytest.raises(ValidationError) as exc_info:
            WalletUpdate(
                address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F"  # Should not be allowed to update
            )
        errors = exc_info.value.errors()
        assert any("address" in str(error["loc"]) for error in errors)
        
        # Blockchain ID should be immutable
        with pytest.raises(ValidationError) as exc_info:
            WalletUpdate(
                blockchain_id="60d21b4667d0d8992e610c87"  # Should not be allowed to update
            )
        errors = exc_info.value.errors()
        assert any("blockchain_id" in str(error["loc"]) for error in errors)
        
        # Wallet type should be immutable
        with pytest.raises(ValidationError) as exc_info:
            WalletUpdate(
                wallet_type=WalletType.CUSTODIAL  # Should not be allowed to update
            )
        errors = exc_info.value.errors()
        assert any("wallet_type" in str(error["loc"]) for error in errors)
    
    def test_wallet_out_schema(self):
        """Test WalletOut schema."""
        wallet = WalletOut(
            _id="60d21b4667d0d8992e610c90",
            name="Output Wallet",
            address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            blockchain_id="60d21b4667d0d8992e610c87",
            wallet_type=WalletType.EXTERNAL,
            private_key="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            metadata={
                "derivation_path": "m/44'/60'/0'/0/0",
                "source": "metamask"
            },
            is_default=True,
            created_at="2023-01-01T10:00:00",
            updated_at="2023-01-15T14:30:00",
            is_active=True
        )
        
        assert wallet.id == "60d21b4667d0d8992e610c90"  # Alias for _id
        assert wallet.name == "Output Wallet"
        assert wallet.address == "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        assert wallet.blockchain_id == "60d21b4667d0d8992e610c87"
        assert wallet.wallet_type == WalletType.EXTERNAL
        assert wallet.private_key == "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        assert wallet.metadata == {
            "derivation_path": "m/44'/60'/0'/0/0",
            "source": "metamask"
        }
        assert wallet.is_default is True
        assert wallet.created_at == "2023-01-01T10:00:00"
        assert wallet.updated_at == "2023-01-15T14:30:00"
        assert wallet.is_active is True
    
    def test_wallet_out_minimal(self):
        """Test WalletOut with minimal fields."""
        wallet = WalletOut(
            _id="60d21b4667d0d8992e610c91",
            name="Minimal Output Wallet",
            address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            blockchain_id="60d21b4667d0d8992e610c87",
            wallet_type=WalletType.EXTERNAL,
            is_default=False,
            created_at="2023-02-01T10:00:00",
            updated_at="2023-02-01T10:00:00",
            is_active=True
        )
        
        assert wallet.id == "60d21b4667d0d8992e610c91"
        assert wallet.name == "Minimal Output Wallet"
        assert wallet.address == "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        assert wallet.blockchain_id == "60d21b4667d0d8992e610c87"
        assert wallet.wallet_type == WalletType.EXTERNAL
        assert wallet.private_key is None
        assert wallet.metadata is None
        assert wallet.is_default is False
        assert wallet.created_at == "2023-02-01T10:00:00"
        assert wallet.updated_at == "2023-02-01T10:00:00"
        assert wallet.is_active is True
    
    def test_wallet_out_inactive(self):
        """Test WalletOut with inactive status."""
        wallet = WalletOut(
            _id="60d21b4667d0d8992e610c92",
            name="Inactive Wallet",
            address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            blockchain_id="60d21b4667d0d8992e610c87",
            wallet_type=WalletType.EXTERNAL,
            is_default=False,
            created_at="2022-01-01T10:00:00",
            updated_at="2023-03-15T14:20:00",
            is_active=False
        )
        
        assert wallet.id == "60d21b4667d0d8992e610c92"
        assert wallet.name == "Inactive Wallet"
        assert wallet.address == "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        assert wallet.blockchain_id == "60d21b4667d0d8992e610c87"
        assert wallet.wallet_type == WalletType.EXTERNAL
        assert wallet.private_key is None
        assert wallet.metadata is None
        assert wallet.is_default is False
        assert wallet.created_at == "2022-01-01T10:00:00"
        assert wallet.updated_at == "2023-03-15T14:20:00"
        assert wallet.is_active is False
    
    def test_wallet_type_enum(self):
        """Test WalletType enum values."""
        assert WalletType.EXTERNAL.value == "external"
        assert WalletType.CUSTODIAL.value == "custodial"
        assert WalletType.MANAGED.value == "managed" 