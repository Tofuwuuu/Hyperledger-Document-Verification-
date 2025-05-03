import pytest
from pydantic import ValidationError
from datetime import datetime
from bson import ObjectId

from app.schemas.credential import (
    CredentialBase,
    CredentialCreate,
    CredentialUpdate,
    CredentialOut,
    CredentialStatus
)

@pytest.mark.unit
@pytest.mark.schema
class TestCredentialSchemas:
    """Tests for credential schemas validation."""
    
    def test_credential_base_valid(self):
        """Test valid CredentialBase schema."""
        credential = CredentialBase(
            title="Computer Science Degree",
            description="Bachelor's degree in Computer Science",
            issuer_id="60d21b4667d0d8992e610c85",
            recipient_id="60d21b4667d0d8992e610c86",
            metadata={
                "university": "Example University",
                "graduation_year": 2023,
                "degree_type": "Bachelor's",
                "major": "Computer Science"
            },
            credential_type="academic_degree",
            image_url="https://example.com/credentials/cs_degree.png"
        )
        
        assert credential.title == "Computer Science Degree"
        assert credential.description == "Bachelor's degree in Computer Science"
        assert credential.issuer_id == "60d21b4667d0d8992e610c85"
        assert credential.recipient_id == "60d21b4667d0d8992e610c86"
        assert credential.metadata["university"] == "Example University"
        assert credential.metadata["graduation_year"] == 2023
        assert credential.credential_type == "academic_degree"
        assert credential.image_url == "https://example.com/credentials/cs_degree.png"
    
    def test_credential_base_minimal(self):
        """Test CredentialBase with only required fields."""
        credential = CredentialBase(
            title="Certificate of Completion",
            issuer_id="60d21b4667d0d8992e610c85",
            recipient_id="60d21b4667d0d8992e610c86",
            credential_type="course_completion"
        )
        
        assert credential.title == "Certificate of Completion"
        assert credential.issuer_id == "60d21b4667d0d8992e610c85"
        assert credential.recipient_id == "60d21b4667d0d8992e610c86"
        assert credential.credential_type == "course_completion"
        assert credential.description is None
        assert credential.metadata is None
        assert credential.image_url is None
    
    def test_credential_base_invalid_ids(self):
        """Test CredentialBase with invalid IDs."""
        # Invalid issuer_id
        with pytest.raises(ValidationError) as exc_info:
            CredentialBase(
                title="Test Credential",
                issuer_id="invalid-id",
                recipient_id="60d21b4667d0d8992e610c86",
                credential_type="generic"
            )
        errors = exc_info.value.errors()
        assert any("issuer_id" in str(error["loc"]) for error in errors)
        
        # Invalid recipient_id
        with pytest.raises(ValidationError) as exc_info:
            CredentialBase(
                title="Test Credential",
                issuer_id="60d21b4667d0d8992e610c85",
                recipient_id="invalid-id",
                credential_type="generic"
            )
        errors = exc_info.value.errors()
        assert any("recipient_id" in str(error["loc"]) for error in errors)
    
    def test_credential_base_invalid_image_url(self):
        """Test CredentialBase with invalid image_url."""
        with pytest.raises(ValidationError) as exc_info:
            CredentialBase(
                title="Test Credential",
                issuer_id="60d21b4667d0d8992e610c85",
                recipient_id="60d21b4667d0d8992e610c86",
                credential_type="generic",
                image_url="not-a-url"
            )
        errors = exc_info.value.errors()
        assert any("image_url" in str(error["loc"]) for error in errors)
    
    def test_credential_base_title_length(self):
        """Test CredentialBase with invalid title length."""
        # Too short
        with pytest.raises(ValidationError) as exc_info:
            CredentialBase(
                title="",  # Empty title
                issuer_id="60d21b4667d0d8992e610c85",
                recipient_id="60d21b4667d0d8992e610c86",
                credential_type="generic"
            )
        errors = exc_info.value.errors()
        assert any("title" in str(error["loc"]) for error in errors)
        
        # Too long (generate a string > 100 chars)
        long_title = "A" * 101
        with pytest.raises(ValidationError) as exc_info:
            CredentialBase(
                title=long_title,
                issuer_id="60d21b4667d0d8992e610c85",
                recipient_id="60d21b4667d0d8992e610c86",
                credential_type="generic"
            )
        errors = exc_info.value.errors()
        assert any("title" in str(error["loc"]) for error in errors)
    
    def test_credential_create_valid(self):
        """Test valid CredentialCreate schema."""
        credential = CredentialCreate(
            title="Professional Certification",
            description="AWS Certified Solutions Architect",
            issuer_id="60d21b4667d0d8992e610c85",
            recipient_id="60d21b4667d0d8992e610c86",
            metadata={
                "certification_level": "Associate",
                "expiration_date": "2025-12-31",
                "certification_id": "SAA-C02-123456"
            },
            credential_type="professional_certification",
            image_url="https://example.com/credentials/aws_cert.png",
            blockchain_id="60d21b4667d0d8992e610c87",
            expiration_date="2025-12-31T23:59:59"
        )
        
        assert credential.title == "Professional Certification"
        assert credential.description == "AWS Certified Solutions Architect"
        assert credential.issuer_id == "60d21b4667d0d8992e610c85"
        assert credential.recipient_id == "60d21b4667d0d8992e610c86"
        assert credential.metadata["certification_level"] == "Associate"
        assert credential.credential_type == "professional_certification"
        assert credential.image_url == "https://example.com/credentials/aws_cert.png"
        assert credential.blockchain_id == "60d21b4667d0d8992e610c87"
        assert credential.expiration_date == "2025-12-31T23:59:59"
    
    def test_credential_create_minimal(self):
        """Test CredentialCreate with minimal fields."""
        credential = CredentialCreate(
            title="Attendance Certificate",
            issuer_id="60d21b4667d0d8992e610c85",
            recipient_id="60d21b4667d0d8992e610c86",
            credential_type="attendance"
        )
        
        assert credential.title == "Attendance Certificate"
        assert credential.issuer_id == "60d21b4667d0d8992e610c85"
        assert credential.recipient_id == "60d21b4667d0d8992e610c86"
        assert credential.credential_type == "attendance"
        assert credential.description is None
        assert credential.metadata is None
        assert credential.image_url is None
        assert credential.blockchain_id is None
        assert credential.expiration_date is None
    
    def test_credential_create_invalid_blockchain_id(self):
        """Test CredentialCreate with invalid blockchain_id."""
        with pytest.raises(ValidationError) as exc_info:
            CredentialCreate(
                title="Test Credential",
                issuer_id="60d21b4667d0d8992e610c85",
                recipient_id="60d21b4667d0d8992e610c86",
                credential_type="generic",
                blockchain_id="invalid-id"
            )
        errors = exc_info.value.errors()
        assert any("blockchain_id" in str(error["loc"]) for error in errors)
    
    def test_credential_create_invalid_expiration_date(self):
        """Test CredentialCreate with invalid expiration_date format."""
        with pytest.raises(ValidationError) as exc_info:
            CredentialCreate(
                title="Test Credential",
                issuer_id="60d21b4667d0d8992e610c85",
                recipient_id="60d21b4667d0d8992e610c86",
                credential_type="generic",
                expiration_date="invalid-date"
            )
        errors = exc_info.value.errors()
        assert any("expiration_date" in str(error["loc"]) for error in errors)
    
    def test_credential_update_valid(self):
        """Test valid CredentialUpdate schema."""
        # Full update
        update = CredentialUpdate(
            title="Updated Certification",
            description="Updated AWS Certification",
            metadata={
                "updated_field": "new value",
                "version": 2
            },
            image_url="https://example.com/credentials/updated_cert.png",
            status=CredentialStatus.REVOKED,
            revocation_reason="Certificate holder violated terms"
        )
        
        assert update.title == "Updated Certification"
        assert update.description == "Updated AWS Certification"
        assert update.metadata["updated_field"] == "new value"
        assert update.metadata["version"] == 2
        assert update.image_url == "https://example.com/credentials/updated_cert.png"
        assert update.status == CredentialStatus.REVOKED
        assert update.revocation_reason == "Certificate holder violated terms"
        
        # Partial update
        update = CredentialUpdate(
            status=CredentialStatus.REVOKED,
            revocation_reason="Superseded by newer certification"
        )
        
        assert update.status == CredentialStatus.REVOKED
        assert update.revocation_reason == "Superseded by newer certification"
        assert update.title is None
        assert update.description is None
        assert update.metadata is None
        assert update.image_url is None
    
    def test_credential_update_invalid_status_revocation(self):
        """Test CredentialUpdate with revoked status but no reason."""
        with pytest.raises(ValidationError) as exc_info:
            CredentialUpdate(
                status=CredentialStatus.REVOKED,
                # Missing revocation_reason
            )
        errors = exc_info.value.errors()
        assert len(errors) > 0  # Should have at least one error
    
    def test_credential_update_clear_fields(self):
        """Test CredentialUpdate with empty strings to clear optional fields."""
        update = CredentialUpdate(
            description="",  # Clear description
            image_url=""  # Clear image URL
        )
        
        assert update.description == ""
        assert update.image_url == ""
    
    def test_credential_out_schema(self):
        """Test CredentialOut schema."""
        credential = CredentialOut(
            _id="60d21b4667d0d8992e610c88",
            title="Software Engineering Certificate",
            description="Certification in Modern Software Engineering Practices",
            issuer_id="60d21b4667d0d8992e610c85",
            recipient_id="60d21b4667d0d8992e610c86",
            metadata={
                "modules_completed": ["Agile", "CI/CD", "TDD", "DevOps"],
                "grade": "A",
                "completion_date": "2023-05-15"
            },
            credential_type="professional_certification",
            image_url="https://example.com/credentials/se_cert.png",
            blockchain_id="60d21b4667d0d8992e610c87",
            blockchain_tx_id="0x1234567890abcdef1234567890abcdef12345678",
            transaction_timestamp="2023-05-16T10:30:00",
            status=CredentialStatus.ACTIVE,
            expiration_date="2026-05-15T23:59:59",
            created_at="2023-05-16T10:00:00",
            updated_at="2023-05-16T10:30:00"
        )
        
        assert credential.id == "60d21b4667d0d8992e610c88"  # Alias for _id
        assert credential.title == "Software Engineering Certificate"
        assert credential.description == "Certification in Modern Software Engineering Practices"
        assert credential.issuer_id == "60d21b4667d0d8992e610c85"
        assert credential.recipient_id == "60d21b4667d0d8992e610c86"
        assert "Agile" in credential.metadata["modules_completed"]
        assert credential.credential_type == "professional_certification"
        assert credential.image_url == "https://example.com/credentials/se_cert.png"
        assert credential.blockchain_id == "60d21b4667d0d8992e610c87"
        assert credential.blockchain_tx_id == "0x1234567890abcdef1234567890abcdef12345678"
        assert credential.transaction_timestamp == "2023-05-16T10:30:00"
        assert credential.status == CredentialStatus.ACTIVE
        assert credential.expiration_date == "2026-05-15T23:59:59"
        assert credential.created_at == "2023-05-16T10:00:00"
        assert credential.updated_at == "2023-05-16T10:30:00"
        assert credential.revocation_reason is None
    
    def test_credential_out_revoked(self):
        """Test CredentialOut with revoked status."""
        credential = CredentialOut(
            _id="60d21b4667d0d8992e610c89",
            title="Revoked Certificate",
            issuer_id="60d21b4667d0d8992e610c85",
            recipient_id="60d21b4667d0d8992e610c86",
            credential_type="generic",
            status=CredentialStatus.REVOKED,
            revocation_reason="Information provided was incorrect",
            revocation_date="2023-06-01T12:00:00",
            created_at="2023-05-01T10:00:00",
            updated_at="2023-06-01T12:00:00"
        )
        
        assert credential.id == "60d21b4667d0d8992e610c89"
        assert credential.title == "Revoked Certificate"
        assert credential.status == CredentialStatus.REVOKED
        assert credential.revocation_reason == "Information provided was incorrect"
        assert credential.revocation_date == "2023-06-01T12:00:00"
    
    def test_credential_out_expired(self):
        """Test CredentialOut with expired status."""
        credential = CredentialOut(
            _id="60d21b4667d0d8992e610c90",
            title="Expired Certificate",
            issuer_id="60d21b4667d0d8992e610c85",
            recipient_id="60d21b4667d0d8992e610c86",
            credential_type="generic",
            status=CredentialStatus.EXPIRED,
            expiration_date="2022-12-31T23:59:59",
            created_at="2022-01-01T10:00:00",
            updated_at="2023-01-01T00:00:01"
        )
        
        assert credential.id == "60d21b4667d0d8992e610c90"
        assert credential.title == "Expired Certificate"
        assert credential.status == CredentialStatus.EXPIRED
        assert credential.expiration_date == "2022-12-31T23:59:59"
    
    def test_credential_status_enum(self):
        """Test CredentialStatus enum values."""
        assert CredentialStatus.PENDING.value == "pending"
        assert CredentialStatus.ACTIVE.value == "active"
        assert CredentialStatus.EXPIRED.value == "expired"
        assert CredentialStatus.REVOKED.value == "revoked" 