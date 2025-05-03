import pytest
from datetime import datetime
from pydantic import ValidationError
from bson import ObjectId

from app.schemas.institution import (
    InstitutionBase,
    InstitutionCreate,
    InstitutionUpdate,
    InstitutionOut
)

@pytest.mark.unit
@pytest.mark.schema
class TestInstitutionSchemas:
    """Tests for institution schemas validation."""
    
    def test_institution_base_valid(self):
        """Test valid InstitutionBase schema."""
        institution = InstitutionBase(
            name="Harvard University",
            address="Cambridge, MA 02138, USA",
            website="https://www.harvard.edu",
            description="Harvard University is a private Ivy League research university in Cambridge, Massachusetts.",
            contact_email="info@harvard.edu",
            contact_phone="+1-617-495-1000"
        )
        
        assert institution.name == "Harvard University"
        assert institution.address == "Cambridge, MA 02138, USA"
        assert institution.website == "https://www.harvard.edu"
        assert institution.description == "Harvard University is a private Ivy League research university in Cambridge, Massachusetts."
        assert institution.contact_email == "info@harvard.edu"
        assert institution.contact_phone == "+1-617-495-1000"
    
    def test_institution_base_minimal(self):
        """Test InstitutionBase with only required fields."""
        institution = InstitutionBase(
            name="MIT"
        )
        
        assert institution.name == "MIT"
        assert institution.address is None
        assert institution.website is None
        assert institution.description is None
        assert institution.contact_email is None
        assert institution.contact_phone is None
    
    def test_institution_base_invalid_name(self):
        """Test InstitutionBase with invalid name."""
        # Empty name
        with pytest.raises(ValidationError) as exc_info:
            InstitutionBase(name="")
        errors = exc_info.value.errors()
        assert any("name" in str(error["loc"]) for error in errors)
        
        # Too long name
        with pytest.raises(ValidationError) as exc_info:
            InstitutionBase(name="A" * 256)  # More than 255 characters
        errors = exc_info.value.errors()
        assert any("name" in str(error["loc"]) for error in errors)
    
    def test_institution_base_invalid_website(self):
        """Test InstitutionBase with invalid website."""
        with pytest.raises(ValidationError) as exc_info:
            InstitutionBase(
                name="Harvard University",
                website="not-a-url"
            )
        errors = exc_info.value.errors()
        assert any("website" in str(error["loc"]) for error in errors)
    
    def test_institution_base_invalid_email(self):
        """Test InstitutionBase with invalid email."""
        with pytest.raises(ValidationError) as exc_info:
            InstitutionBase(
                name="Harvard University",
                contact_email="not-an-email"
            )
        errors = exc_info.value.errors()
        assert any("contact_email" in str(error["loc"]) for error in errors)
    
    def test_institution_base_invalid_phone(self):
        """Test InstitutionBase with invalid phone."""
        with pytest.raises(ValidationError) as exc_info:
            InstitutionBase(
                name="Harvard University",
                contact_phone="abc"  # Not a valid phone format
            )
        errors = exc_info.value.errors()
        assert any("contact_phone" in str(error["loc"]) for error in errors)
    
    def test_institution_create_valid(self):
        """Test valid InstitutionCreate schema."""
        institution = InstitutionCreate(
            name="Stanford University",
            address="450 Serra Mall, Stanford, CA 94305, USA",
            website="https://www.stanford.edu",
            description="Stanford University is a private research university in Stanford, California.",
            contact_email="info@stanford.edu",
            contact_phone="+1-650-723-2300",
            logo_url="https://example.com/stanford-logo.png",
            is_verified=True
        )
        
        assert institution.name == "Stanford University"
        assert institution.address == "450 Serra Mall, Stanford, CA 94305, USA"
        assert institution.website == "https://www.stanford.edu"
        assert institution.description == "Stanford University is a private research university in Stanford, California."
        assert institution.contact_email == "info@stanford.edu"
        assert institution.contact_phone == "+1-650-723-2300"
        assert institution.logo_url == "https://example.com/stanford-logo.png"
        assert institution.is_verified is True
    
    def test_institution_create_defaults(self):
        """Test InstitutionCreate with default values."""
        institution = InstitutionCreate(
            name="Yale University"
        )
        
        assert institution.name == "Yale University"
        assert institution.address is None
        assert institution.website is None
        assert institution.description is None
        assert institution.contact_email is None
        assert institution.contact_phone is None
        assert institution.logo_url is None
        assert institution.is_verified is False  # Default value
    
    def test_institution_create_invalid_logo_url(self):
        """Test InstitutionCreate with invalid logo URL."""
        with pytest.raises(ValidationError) as exc_info:
            InstitutionCreate(
                name="Yale University",
                logo_url="not-a-url"
            )
        errors = exc_info.value.errors()
        assert any("logo_url" in str(error["loc"]) for error in errors)
    
    def test_institution_update_valid(self):
        """Test valid InstitutionUpdate schema."""
        # Full update
        update = InstitutionUpdate(
            name="Updated University Name",
            address="Updated Address",
            website="https://www.updated-university.edu",
            description="Updated description",
            contact_email="updated@example.edu",
            contact_phone="+1-123-456-7890",
            logo_url="https://example.com/updated-logo.png",
            is_verified=True
        )
        
        assert update.name == "Updated University Name"
        assert update.address == "Updated Address"
        assert update.website == "https://www.updated-university.edu"
        assert update.description == "Updated description"
        assert update.contact_email == "updated@example.edu"
        assert update.contact_phone == "+1-123-456-7890"
        assert update.logo_url == "https://example.com/updated-logo.png"
        assert update.is_verified is True
        
        # Partial update
        update = InstitutionUpdate(
            name="New University Name",
            is_verified=True
        )
        
        assert update.name == "New University Name"
        assert update.is_verified is True
        assert update.address is None
        assert update.website is None
        assert update.description is None
        assert update.contact_email is None
        assert update.contact_phone is None
        assert update.logo_url is None
    
    def test_institution_update_clear_fields(self):
        """Test InstitutionUpdate with empty strings to clear fields."""
        update = InstitutionUpdate(
            address="",  # Clear address
            description=""  # Clear description
        )
        
        assert update.address == ""
        assert update.description == ""
    
    def test_institution_out_schema(self):
        """Test InstitutionOut schema."""
        institution = InstitutionOut(
            _id="60d21b4667d0d8992e610c92",
            name="Princeton University",
            address="Princeton, NJ 08544, USA",
            website="https://www.princeton.edu",
            description="Princeton University is a private Ivy League research university in Princeton, New Jersey.",
            contact_email="info@princeton.edu",
            contact_phone="+1-609-258-3000",
            logo_url="https://example.com/princeton-logo.png",
            is_verified=True,
            created_at="2023-06-15T10:00:00",
            updated_at="2023-08-01T14:30:00"
        )
        
        assert institution.id == "60d21b4667d0d8992e610c92"  # Alias for _id
        assert institution.name == "Princeton University"
        assert institution.address == "Princeton, NJ 08544, USA"
        assert institution.website == "https://www.princeton.edu"
        assert institution.description == "Princeton University is a private Ivy League research university in Princeton, New Jersey."
        assert institution.contact_email == "info@princeton.edu"
        assert institution.contact_phone == "+1-609-258-3000"
        assert institution.logo_url == "https://example.com/princeton-logo.png"
        assert institution.is_verified is True
        assert institution.created_at == "2023-06-15T10:00:00"
        assert institution.updated_at == "2023-08-01T14:30:00" 