import pytest
from pydantic import ValidationError
from bson import ObjectId

from app.schemas.contract import (
    ContractBase,
    ContractCreate,
    ContractUpdate,
    ContractOut,
    ContractType
)


@pytest.mark.unit
@pytest.mark.schema
class TestContractSchemas:
    """Tests for contract schemas validation."""
    
    def test_contract_base_valid(self):
        """Test valid ContractBase schema."""
        contract = ContractBase(
            name="ERC20 Token",
            address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            contract_type=ContractType.ERC20,
            blockchain_id="60d21b4667d0d8992e610c87",
            abi=[
                {
                    "inputs": [],
                    "name": "totalSupply",
                    "outputs": [{"type": "uint256", "name": ""}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ],
            metadata={
                "decimals": 18,
                "symbol": "TKN",
                "logo": "https://example.com/token.png"
            }
        )
        
        assert contract.name == "ERC20 Token"
        assert contract.address == "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        assert contract.contract_type == ContractType.ERC20
        assert contract.blockchain_id == "60d21b4667d0d8992e610c87"
        assert len(contract.abi) == 1
        assert contract.abi[0]["name"] == "totalSupply"
        assert contract.metadata == {
            "decimals": 18,
            "symbol": "TKN",
            "logo": "https://example.com/token.png"
        }
    
    def test_contract_base_minimal(self):
        """Test ContractBase with only required fields."""
        contract = ContractBase(
            name="Minimal Contract",
            address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            contract_type=ContractType.CUSTOM,
            blockchain_id="60d21b4667d0d8992e610c87",
            abi=[]  # Empty ABI
        )
        
        assert contract.name == "Minimal Contract"
        assert contract.address == "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        assert contract.contract_type == ContractType.CUSTOM
        assert contract.blockchain_id == "60d21b4667d0d8992e610c87"
        assert contract.abi == []
        assert contract.metadata is None
    
    def test_contract_base_invalid_address(self):
        """Test ContractBase with invalid Ethereum address."""
        # Not a valid Ethereum address
        with pytest.raises(ValidationError) as exc_info:
            ContractBase(
                name="Invalid Address Contract",
                address="0xinvalid",
                contract_type=ContractType.ERC20,
                blockchain_id="60d21b4667d0d8992e610c87",
                abi=[]
            )
        errors = exc_info.value.errors()
        assert any("address" in str(error["loc"]) for error in errors)
    
    def test_contract_base_invalid_blockchain_id(self):
        """Test ContractBase with invalid blockchain_id."""
        # Invalid ObjectId format
        with pytest.raises(ValidationError) as exc_info:
            ContractBase(
                name="Invalid Blockchain ID Contract",
                address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
                contract_type=ContractType.ERC20,
                blockchain_id="invalid_id",  # Not a valid ObjectId
                abi=[]
            )
        errors = exc_info.value.errors()
        assert any("blockchain_id" in str(error["loc"]) for error in errors)
    
    def test_contract_base_invalid_abi(self):
        """Test ContractBase with invalid ABI."""
        # ABI should be a list
        with pytest.raises(ValidationError) as exc_info:
            ContractBase(
                name="Invalid ABI Contract",
                address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
                contract_type=ContractType.ERC20,
                blockchain_id="60d21b4667d0d8992e610c87",
                abi="not_a_list"  # ABI should be a list
            )
        errors = exc_info.value.errors()
        assert any("abi" in str(error["loc"]) for error in errors)
    
    def test_contract_create_valid(self):
        """Test valid ContractCreate schema."""
        contract = ContractCreate(
            name="NFT Collection",
            address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            contract_type=ContractType.ERC721,
            blockchain_id="60d21b4667d0d8992e610c87",
            abi=[
                {
                    "inputs": [{"type": "uint256", "name": "tokenId"}],
                    "name": "ownerOf",
                    "outputs": [{"type": "address", "name": ""}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ],
            metadata={
                "collection_name": "Awesome NFTs",
                "base_uri": "https://api.example.com/metadata/"
            },
            is_verified=True
        )
        
        assert contract.name == "NFT Collection"
        assert contract.address == "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        assert contract.contract_type == ContractType.ERC721
        assert contract.blockchain_id == "60d21b4667d0d8992e610c87"
        assert len(contract.abi) == 1
        assert contract.abi[0]["name"] == "ownerOf"
        assert contract.metadata == {
            "collection_name": "Awesome NFTs",
            "base_uri": "https://api.example.com/metadata/"
        }
        assert contract.is_verified is True
    
    def test_contract_create_minimal(self):
        """Test ContractCreate with only required fields."""
        contract = ContractCreate(
            name="Minimal Create Contract",
            address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            contract_type=ContractType.CUSTOM,
            blockchain_id="60d21b4667d0d8992e610c87",
            abi=[]
        )
        
        assert contract.name == "Minimal Create Contract"
        assert contract.address == "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        assert contract.contract_type == ContractType.CUSTOM
        assert contract.blockchain_id == "60d21b4667d0d8992e610c87"
        assert contract.abi == []
        assert contract.metadata is None
        assert contract.is_verified is False  # Default value
    
    def test_contract_update_valid(self):
        """Test valid ContractUpdate schema."""
        update = ContractUpdate(
            name="Updated Contract Name",
            abi=[
                {
                    "inputs": [],
                    "name": "name",
                    "outputs": [{"type": "string", "name": ""}],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "symbol",
                    "outputs": [{"type": "string", "name": ""}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ],
            metadata={
                "updated_at": "2023-05-15",
                "notes": "Updated contract ABI"
            },
            is_verified=True
        )
        
        assert update.name == "Updated Contract Name"
        assert len(update.abi) == 2
        assert update.abi[0]["name"] == "name"
        assert update.abi[1]["name"] == "symbol"
        assert update.metadata == {
            "updated_at": "2023-05-15",
            "notes": "Updated contract ABI"
        }
        assert update.is_verified is True
        assert update.address is None  # Shouldn't be updatable
        assert update.blockchain_id is None  # Shouldn't be updatable
        assert update.contract_type is None  # Shouldn't be updatable
    
    def test_contract_update_minimal(self):
        """Test ContractUpdate with minimal fields."""
        # Just name update
        update = ContractUpdate(
            name="New Contract Name Only"
        )
        
        assert update.name == "New Contract Name Only"
        assert update.abi is None
        assert update.metadata is None
        assert update.is_verified is None
        assert update.address is None
        assert update.blockchain_id is None
        assert update.contract_type is None
    
    def test_contract_update_immutable_fields(self):
        """Test that immutable fields cannot be updated in ContractUpdate."""
        # Address should be immutable
        with pytest.raises(ValidationError) as exc_info:
            ContractUpdate(
                address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F"  # Should not be allowed to update
            )
        errors = exc_info.value.errors()
        assert any("address" in str(error["loc"]) for error in errors)
        
        # Blockchain ID should be immutable
        with pytest.raises(ValidationError) as exc_info:
            ContractUpdate(
                blockchain_id="60d21b4667d0d8992e610c87"  # Should not be allowed to update
            )
        errors = exc_info.value.errors()
        assert any("blockchain_id" in str(error["loc"]) for error in errors)
        
        # Contract type should be immutable
        with pytest.raises(ValidationError) as exc_info:
            ContractUpdate(
                contract_type=ContractType.ERC1155  # Should not be allowed to update
            )
        errors = exc_info.value.errors()
        assert any("contract_type" in str(error["loc"]) for error in errors)
    
    def test_contract_out_schema(self):
        """Test ContractOut schema."""
        contract = ContractOut(
            _id="60d21b4667d0d8992e610c93",
            name="Output Contract",
            address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            contract_type=ContractType.ERC20,
            blockchain_id="60d21b4667d0d8992e610c87",
            abi=[
                {
                    "inputs": [],
                    "name": "totalSupply",
                    "outputs": [{"type": "uint256", "name": ""}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ],
            metadata={
                "decimals": 18,
                "symbol": "TKN",
                "logo": "https://example.com/token.png"
            },
            is_verified=True,
            created_at="2023-01-01T10:00:00",
            updated_at="2023-01-15T14:30:00",
            is_active=True
        )
        
        assert contract.id == "60d21b4667d0d8992e610c93"  # Alias for _id
        assert contract.name == "Output Contract"
        assert contract.address == "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        assert contract.contract_type == ContractType.ERC20
        assert contract.blockchain_id == "60d21b4667d0d8992e610c87"
        assert len(contract.abi) == 1
        assert contract.abi[0]["name"] == "totalSupply"
        assert contract.metadata == {
            "decimals": 18,
            "symbol": "TKN",
            "logo": "https://example.com/token.png"
        }
        assert contract.is_verified is True
        assert contract.created_at == "2023-01-01T10:00:00"
        assert contract.updated_at == "2023-01-15T14:30:00"
        assert contract.is_active is True
    
    def test_contract_out_minimal(self):
        """Test ContractOut with minimal fields."""
        contract = ContractOut(
            _id="60d21b4667d0d8992e610c94",
            name="Minimal Output Contract",
            address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            contract_type=ContractType.CUSTOM,
            blockchain_id="60d21b4667d0d8992e610c87",
            abi=[],
            is_verified=False,
            created_at="2023-02-01T10:00:00",
            updated_at="2023-02-01T10:00:00",
            is_active=True
        )
        
        assert contract.id == "60d21b4667d0d8992e610c94"
        assert contract.name == "Minimal Output Contract"
        assert contract.address == "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        assert contract.contract_type == ContractType.CUSTOM
        assert contract.blockchain_id == "60d21b4667d0d8992e610c87"
        assert contract.abi == []
        assert contract.metadata is None
        assert contract.is_verified is False
        assert contract.created_at == "2023-02-01T10:00:00"
        assert contract.updated_at == "2023-02-01T10:00:00"
        assert contract.is_active is True
    
    def test_contract_out_inactive(self):
        """Test ContractOut with inactive status."""
        contract = ContractOut(
            _id="60d21b4667d0d8992e610c95",
            name="Inactive Contract",
            address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
            contract_type=ContractType.ERC20,
            blockchain_id="60d21b4667d0d8992e610c87",
            abi=[],
            is_verified=True,
            created_at="2022-01-01T10:00:00",
            updated_at="2023-03-15T14:20:00",
            is_active=False
        )
        
        assert contract.id == "60d21b4667d0d8992e610c95"
        assert contract.name == "Inactive Contract"
        assert contract.address == "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        assert contract.contract_type == ContractType.ERC20
        assert contract.blockchain_id == "60d21b4667d0d8992e610c87"
        assert contract.abi == []
        assert contract.metadata is None
        assert contract.is_verified is True
        assert contract.created_at == "2022-01-01T10:00:00"
        assert contract.updated_at == "2023-03-15T14:20:00"
        assert contract.is_active is False
    
    def test_contract_type_enum(self):
        """Test ContractType enum values."""
        assert ContractType.ERC20.value == "erc20"
        assert ContractType.ERC721.value == "erc721"
        assert ContractType.ERC1155.value == "erc1155"
        assert ContractType.CUSTOM.value == "custom" 