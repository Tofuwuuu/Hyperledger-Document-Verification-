import pytest
from datetime import datetime
from pydantic import ValidationError
from bson import ObjectId

from app.schemas.certificate import (
    CertificateBase,
    CertificateCreate,
    CertificateUpdate,
    CertificateOut
)

@pytest.mark.unit
@pytest.mark.schema
class TestCertificateSchemas:
    """Tests for certificate schemas validation."""
    
    def test_certificate_base_valid(self):
        """Test valid CertificateBase schema."""
        cert = CertificateBase(
            name="Bachelor of Science in Computer Science",
            description="Undergraduate degree in Computer Science",
            issue_date=datetime.utcnow().date(),
            alumni_id="60d21b4667d0d8992e610c85"
        )
        assert cert.name == "Bachelor of Science in Computer Science"
        assert cert.description == "Undergraduate degree in Computer Science"
        assert isinstance(cert.issue_date, datetime.date)
        assert cert.alumni_id == "60d21b4667d0d8992e610c85"
    
    def test_certificate_base_invalid_name(self):
        """Test CertificateBase with invalid name."""
        with pytest.raises(ValidationError) as exc_info:
            CertificateBase(
                name="",  # Empty name
                description="Undergraduate degree in Computer Science",
                issue_date=datetime.utcnow().date(),
                alumni_id="60d21b4667d0d8992e610c85"
            )
        errors = exc_info.value.errors()
        assert any("name" in str(error["loc"]) for error in errors)
        
        # Test with too long name
        long_name = "A" * 256  # More than 255 characters
        with pytest.raises(ValidationError) as exc_info:
            CertificateBase(
                name=long_name,
                description="Undergraduate degree in Computer Science",
                issue_date=datetime.utcnow().date(),
                alumni_id="60d21b4667d0d8992e610c85"
            )
        errors = exc_info.value.errors()
        assert any("name" in str(error["loc"]) for error in errors)
    
    def test_certificate_base_invalid_date(self):
        """Test CertificateBase with invalid issue date."""
        future_date = datetime(datetime.now().year + 2, 1, 1).date()
        with pytest.raises(ValidationError) as exc_info:
            CertificateBase(
                name="Bachelor of Science in Computer Science",
                description="Undergraduate degree in Computer Science",
                issue_date=future_date,  # Future date
                alumni_id="60d21b4667d0d8992e610c85"
            )
        errors = exc_info.value.errors()
        assert any("issue_date" in str(error["loc"]) for error in errors)
    
    def test_certificate_base_invalid_alumni_id(self):
        """Test CertificateBase with invalid alumni ID."""
        with pytest.raises(ValidationError) as exc_info:
            CertificateBase(
                name="Bachelor of Science in Computer Science",
                description="Undergraduate degree in Computer Science",
                issue_date=datetime.utcnow().date(),
                alumni_id="invalid-id"  # Invalid ObjectId format
            )
        errors = exc_info.value.errors()
        assert any("alumni_id" in str(error["loc"]) for error in errors)
    
    def test_certificate_create_valid(self):
        """Test valid CertificateCreate schema."""
        cert = CertificateCreate(
            name="Bachelor of Science in Computer Science",
            description="Undergraduate degree in Computer Science",
            issue_date=datetime.utcnow().date(),
            alumni_id="60d21b4667d0d8992e610c85",
            blockchain_record="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        )
        assert cert.name == "Bachelor of Science in Computer Science"
        assert cert.description == "Undergraduate degree in Computer Science"
        assert isinstance(cert.issue_date, datetime.date)
        assert cert.alumni_id == "60d21b4667d0d8992e610c85"
        assert cert.blockchain_record == "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    
    def test_certificate_create_without_blockchain(self):
        """Test CertificateCreate without blockchain record."""
        cert = CertificateCreate(
            name="Bachelor of Science in Computer Science",
            description="Undergraduate degree in Computer Science",
            issue_date=datetime.utcnow().date(),
            alumni_id="60d21b4667d0d8992e610c85"
            # No blockchain_record
        )
        assert cert.blockchain_record is None
    
    def test_certificate_create_invalid_blockchain(self):
        """Test CertificateCreate with invalid blockchain record."""
        with pytest.raises(ValidationError) as exc_info:
            CertificateCreate(
                name="Bachelor of Science in Computer Science",
                description="Undergraduate degree in Computer Science",
                issue_date=datetime.utcnow().date(),
                alumni_id="60d21b4667d0d8992e610c85",
                blockchain_record="invalid-hash"  # Invalid hash format
            )
        errors = exc_info.value.errors()
        assert any("blockchain_record" in str(error["loc"]) for error in errors)
    
    def test_certificate_update_valid(self):
        """Test valid CertificateUpdate schema."""
        # Full update
        update = CertificateUpdate(
            name="Updated Certificate Name",
            description="Updated description",
            blockchain_record="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        )
        assert update.name == "Updated Certificate Name"
        assert update.description == "Updated description"
        assert update.blockchain_record == "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        
        # Partial update
        update = CertificateUpdate(description="Only description updated")
        assert update.description == "Only description updated"
        assert update.name is None
        assert update.blockchain_record is None
    
    def test_certificate_update_invalid(self):
        """Test CertificateUpdate with invalid data."""
        with pytest.raises(ValidationError) as exc_info:
            CertificateUpdate(
                name="",  # Empty name is invalid
            )
        errors = exc_info.value.errors()
        assert any("name" in str(error["loc"]) for error in errors)
        
        with pytest.raises(ValidationError) as exc_info:
            CertificateUpdate(
                blockchain_record="invalid-hash"  # Invalid hash format
            )
        errors = exc_info.value.errors()
        assert any("blockchain_record" in str(error["loc"]) for error in errors)
    
    def test_certificate_out_schema(self):
        """Test CertificateOut schema."""
        now = datetime.utcnow()
        cert = CertificateOut(
            _id="60d21b4667d0d8992e610c85",
            name="Bachelor of Science in Computer Science",
            description="Undergraduate degree in Computer Science",
            issue_date=now.date(),
            alumni_id="60d21b4667d0d8992e610c85",
            blockchain_record="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            created_at=now,
            updated_at=now,
            is_verified=True
        )
        
        assert cert.id == "60d21b4667d0d8992e610c85"  # Alias for _id
        assert cert.name == "Bachelor of Science in Computer Science"
        assert cert.description == "Undergraduate degree in Computer Science"
        assert cert.issue_date == now.date()
        assert cert.alumni_id == "60d21b4667d0d8992e610c85"
        assert cert.blockchain_record == "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        assert cert.created_at == now
        assert cert.updated_at == now
        assert cert.is_verified is True 