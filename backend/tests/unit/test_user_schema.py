import pytest
from datetime import datetime
from pydantic import ValidationError
from bson import ObjectId

from app.schemas.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserOut,
    UserRole
)

@pytest.mark.unit
@pytest.mark.schema
class TestUserSchemas:
    """Tests for user schemas validation."""
    
    def test_user_base_valid(self):
        """Test valid UserBase schema."""
        user = UserBase(
            email="test@example.com",
            full_name="Test User",
            organization="Test Organization",
            profile_image_url="https://example.com/images/profile.jpg"
        )
        
        assert user.email == "test@example.com"
        assert user.full_name == "Test User"
        assert user.organization == "Test Organization"
        assert user.profile_image_url == "https://example.com/images/profile.jpg"
    
    def test_user_base_minimal(self):
        """Test UserBase with only required fields."""
        user = UserBase(
            email="minimal@example.com"
        )
        
        assert user.email == "minimal@example.com"
        assert user.full_name is None
        assert user.organization is None
        assert user.profile_image_url is None
    
    def test_user_base_invalid_email(self):
        """Test UserBase with invalid email."""
        with pytest.raises(ValidationError) as exc_info:
            UserBase(
                email="not-an-email"
            )
        errors = exc_info.value.errors()
        assert any("email" in str(error["loc"]) for error in errors)
    
    def test_user_base_invalid_profile_image_url(self):
        """Test UserBase with invalid profile_image_url."""
        with pytest.raises(ValidationError) as exc_info:
            UserBase(
                email="valid@example.com",
                profile_image_url="not-a-url"
            )
        errors = exc_info.value.errors()
        assert any("profile_image_url" in str(error["loc"]) for error in errors)
    
    def test_user_create_valid(self):
        """Test valid UserCreate schema."""
        user = UserCreate(
            email="newuser@example.com",
            password="SecurePassword123!",
            full_name="New User",
            organization="New Organization",
            profile_image_url="https://example.com/images/newuser.jpg",
            role=UserRole.ISSUER
        )
        
        assert user.email == "newuser@example.com"
        assert user.password == "SecurePassword123!"
        assert user.full_name == "New User"
        assert user.organization == "New Organization"
        assert user.profile_image_url == "https://example.com/images/newuser.jpg"
        assert user.role == UserRole.ISSUER
    
    def test_user_create_minimal(self):
        """Test UserCreate with only required fields."""
        user = UserCreate(
            email="minimal@example.com",
            password="SecurePassword123!"
        )
        
        assert user.email == "minimal@example.com"
        assert user.password == "SecurePassword123!"
        assert user.full_name is None
        assert user.organization is None
        assert user.profile_image_url is None
        assert user.role == UserRole.RECIPIENT  # Default value
    
    def test_user_create_password_validation(self):
        """Test UserCreate password validation rules."""
        # Too short
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(
                email="valid@example.com",
                password="short"  # Less than 6 characters
            )
        errors = exc_info.value.errors()
        assert any("password" in str(error["loc"]) for error in errors)
    
    def test_user_create_invalid_role(self):
        """Test UserCreate with invalid role."""
        with pytest.raises(ValidationError) as exc_info:
            UserCreate(
                email="valid@example.com",
                password="ValidPassword123!",
                role="invalid_role"  # Not a valid enum value
            )
        errors = exc_info.value.errors()
        assert any("role" in str(error["loc"]) for error in errors)
    
    def test_user_update_valid(self):
        """Test valid UserUpdate schema."""
        # Full update
        update = UserUpdate(
            full_name="Updated Name",
            organization="Updated Organization",
            profile_image_url="https://example.com/images/updated.jpg",
            role=UserRole.ADMIN
        )
        
        assert update.full_name == "Updated Name"
        assert update.organization == "Updated Organization"
        assert update.profile_image_url == "https://example.com/images/updated.jpg"
        assert update.role == UserRole.ADMIN
        assert update.email is None
        assert update.password is None
        
        # Partial update
        update = UserUpdate(
            full_name="Updated Name Only"
        )
        
        assert update.full_name == "Updated Name Only"
        assert update.organization is None
        assert update.profile_image_url is None
        assert update.role is None
        assert update.email is None
        assert update.password is None
    
    def test_user_update_password(self):
        """Test UserUpdate with password change."""
        update = UserUpdate(
            password="NewSecurePassword123!"
        )
        
        assert update.password == "NewSecurePassword123!"
        assert update.full_name is None
        assert update.organization is None
        assert update.profile_image_url is None
        assert update.role is None
        assert update.email is None
    
    def test_user_update_clear_fields(self):
        """Test UserUpdate with empty strings to clear optional fields."""
        update = UserUpdate(
            full_name="",  # Clear full name
            organization="",  # Clear organization
            profile_image_url=""  # Clear profile image URL
        )
        
        assert update.full_name == ""
        assert update.organization == ""
        assert update.profile_image_url == ""
    
    def test_user_update_invalid_password(self):
        """Test UserUpdate with invalid password."""
        with pytest.raises(ValidationError) as exc_info:
            UserUpdate(
                password="weak"  # Does not meet password criteria
            )
        errors = exc_info.value.errors()
        assert any("password" in str(error["loc"]) for error in errors)
    
    def test_user_out_schema(self):
        """Test UserOut schema."""
        user = UserOut(
            _id="60d21b4667d0d8992e610c85",
            email="user@example.com",
            full_name="Complete User",
            organization="User Organization",
            profile_image_url="https://example.com/images/user.jpg",
            role=UserRole.ISSUER,
            is_active=True,
            is_verified=True,
            created_at="2023-01-01T10:00:00",
            updated_at="2023-01-15T14:30:00",
            last_login="2023-01-15T14:00:00"
        )
        
        assert user.id == "60d21b4667d0d8992e610c85"  # Alias for _id
        assert user.email == "user@example.com"
        assert user.full_name == "Complete User"
        assert user.organization == "User Organization"
        assert user.profile_image_url == "https://example.com/images/user.jpg"
        assert user.role == UserRole.ISSUER
        assert user.is_active is True
        assert user.is_verified is True
        assert user.created_at == "2023-01-01T10:00:00"
        assert user.updated_at == "2023-01-15T14:30:00"
        assert user.last_login == "2023-01-15T14:00:00"
        assert not hasattr(user, "password")  # Password should not be included
    
    def test_user_out_minimal(self):
        """Test UserOut with minimal fields."""
        user = UserOut(
            _id="60d21b4667d0d8992e610c86",
            email="minimal@example.com",
            role=UserRole.RECIPIENT,
            is_active=True,
            is_verified=False,
            created_at="2023-02-01T10:00:00",
            updated_at="2023-02-01T10:00:00"
        )
        
        assert user.id == "60d21b4667d0d8992e610c86"
        assert user.email == "minimal@example.com"
        assert user.full_name is None
        assert user.organization is None
        assert user.profile_image_url is None
        assert user.role == UserRole.RECIPIENT
        assert user.is_active is True
        assert user.is_verified is False
        assert user.created_at == "2023-02-01T10:00:00"
        assert user.updated_at == "2023-02-01T10:00:00"
        assert user.last_login is None
    
    def test_user_role_enum(self):
        """Test UserRole enum values."""
        assert UserRole.ADMIN.value == "admin"
        assert UserRole.ISSUER.value == "issuer"
        assert UserRole.RECIPIENT.value == "recipient" 