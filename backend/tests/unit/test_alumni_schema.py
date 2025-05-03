import pytest
from datetime import datetime
from pydantic import ValidationError

from app.schemas.alumni import (
    AlumniCreate,
    AlumniUpdate,
    AlumniOut,
    AlumniSearchQuery,
    AlumniSearchResult
)

@pytest.mark.unit
@pytest.mark.schema
class TestAlumniSchemas:
    """Tests for alumni schemas validation."""
    
    def test_alumni_create_valid(self):
        """Test valid AlumniCreate schema."""
        now = datetime.utcnow().date()
        alumni = AlumniCreate(
            full_name="John Doe",
            student_id="2020-12345",
            graduation_year=2020,
            program="BS Computer Science",
            contact_email="johndoe@example.com",
            contact_number="+639123456789",
            current_job="Software Engineer",
            company="Tech Company"
        )
        assert alumni.full_name == "John Doe"
        assert alumni.student_id == "2020-12345"
        assert alumni.graduation_year == 2020
        assert alumni.program == "BS Computer Science"
        assert alumni.contact_email == "johndoe@example.com"
        assert alumni.contact_number == "+639123456789"
        assert alumni.current_job == "Software Engineer"
        assert alumni.company == "Tech Company"
    
    def test_alumni_create_invalid_email(self):
        """Test AlumniCreate with invalid email."""
        with pytest.raises(ValidationError) as exc_info:
            AlumniCreate(
                full_name="John Doe",
                student_id="2020-12345",
                graduation_year=2020,
                program="BS Computer Science",
                contact_email="invalid-email",  # Invalid email
                contact_number="+639123456789",
                current_job="Software Engineer",
                company="Tech Company"
            )
        errors = exc_info.value.errors()
        assert any("contact_email" in str(error["loc"]) for error in errors)
    
    def test_alumni_create_invalid_student_id(self):
        """Test AlumniCreate with invalid student ID."""
        with pytest.raises(ValidationError) as exc_info:
            AlumniCreate(
                full_name="John Doe",
                student_id="ID@123",  # Invalid characters
                graduation_year=2020,
                program="BS Computer Science",
                contact_email="johndoe@example.com",
                contact_number="+639123456789",
                current_job="Software Engineer",
                company="Tech Company"
            )
        errors = exc_info.value.errors()
        assert any("student_id" in str(error["loc"]) for error in errors)
    
    def test_alumni_create_invalid_graduation_year(self):
        """Test AlumniCreate with invalid graduation year."""
        future_year = datetime.now().year + 5
        with pytest.raises(ValidationError) as exc_info:
            AlumniCreate(
                full_name="John Doe",
                student_id="2020-12345",
                graduation_year=future_year,  # Future year
                program="BS Computer Science",
                contact_email="johndoe@example.com",
                contact_number="+639123456789",
                current_job="Software Engineer",
                company="Tech Company"
            )
        errors = exc_info.value.errors()
        assert any("graduation_year" in str(error["loc"]) for error in errors)
        
        with pytest.raises(ValidationError) as exc_info:
            AlumniCreate(
                full_name="John Doe",
                student_id="2020-12345",
                graduation_year=1900,  # Too old
                program="BS Computer Science",
                contact_email="johndoe@example.com",
                contact_number="+639123456789",
                current_job="Software Engineer",
                company="Tech Company"
            )
        errors = exc_info.value.errors()
        assert any("graduation_year" in str(error["loc"]) for error in errors)
    
    def test_alumni_create_invalid_phone(self):
        """Test AlumniCreate with invalid phone number."""
        with pytest.raises(ValidationError) as exc_info:
            AlumniCreate(
                full_name="John Doe",
                student_id="2020-12345",
                graduation_year=2020,
                program="BS Computer Science",
                contact_email="johndoe@example.com",
                contact_number="invalid-phone",  # Invalid phone
                current_job="Software Engineer",
                company="Tech Company"
            )
        errors = exc_info.value.errors()
        assert any("contact_number" in str(error["loc"]) for error in errors)
    
    def test_alumni_update_partial(self):
        """Test AlumniUpdate with partial fields."""
        # Update only email
        update = AlumniUpdate(contact_email="new@example.com")
        assert update.contact_email == "new@example.com"
        assert update.full_name is None
        assert update.current_job is None
        
        # Update only job and company
        update = AlumniUpdate(
            current_job="Senior Developer",
            company="New Company"
        )
        assert update.current_job == "Senior Developer"
        assert update.company == "New Company"
        assert update.contact_email is None
    
    def test_alumni_update_invalid(self):
        """Test AlumniUpdate with invalid data."""
        with pytest.raises(ValidationError) as exc_info:
            AlumniUpdate(contact_email="invalid-email")
        errors = exc_info.value.errors()
        assert any("contact_email" in str(error["loc"]) for error in errors)
        
        future_year = datetime.now().year + 5
        with pytest.raises(ValidationError) as exc_info:
            AlumniUpdate(graduation_year=future_year)
        errors = exc_info.value.errors()
        assert any("graduation_year" in str(error["loc"]) for error in errors)
    
    def test_alumni_out_schema(self):
        """Test AlumniOut schema."""
        now = datetime.utcnow()
        alumni = AlumniOut(
            _id="5f9f1b9b9c9d1b1b1b1b1b1b",
            full_name="John Doe",
            student_id="2020-12345",
            graduation_year=2020,
            program="BS Computer Science",
            contact_email="johndoe@example.com",
            contact_number="+639123456789",
            current_job="Software Engineer",
            company="Tech Company",
            created_at=now,
            updated_at=now,
            user_id="5f9f1b9b9c9d1b1b1b1b1b1b"
        )
        assert alumni.id == "5f9f1b9b9c9d1b1b1b1b1b1b"  # Alias for _id
        assert alumni.full_name == "John Doe"
        assert alumni.student_id == "2020-12345"
        assert alumni.graduation_year == 2020
        assert alumni.program == "BS Computer Science"
        assert alumni.contact_email == "johndoe@example.com"
        assert alumni.contact_number == "+639123456789"
        assert alumni.current_job == "Software Engineer"
        assert alumni.company == "Tech Company"
        assert alumni.created_at == now
        assert alumni.updated_at == now
        assert alumni.user_id == "5f9f1b9b9c9d1b1b1b1b1b1b"
    
    def test_alumni_search_query_valid(self):
        """Test valid AlumniSearchQuery schema."""
        query = AlumniSearchQuery(
            name="John",
            student_id="2020",
            graduation_year=2020,
            program="Computer Science",
            page=2,
            limit=25
        )
        assert query.name == "John"
        assert query.student_id == "2020"
        assert query.graduation_year == 2020
        assert query.program == "Computer Science"
        assert query.page == 2
        assert query.limit == 25
    
    def test_alumni_search_query_defaults(self):
        """Test AlumniSearchQuery default values."""
        query = AlumniSearchQuery()
        assert query.name is None
        assert query.student_id is None
        assert query.graduation_year is None
        assert query.program is None
        assert query.page == 1
        assert query.limit == 10
    
    def test_alumni_search_query_invalid_pagination(self):
        """Test AlumniSearchQuery with invalid pagination."""
        with pytest.raises(ValidationError) as exc_info:
            AlumniSearchQuery(page=0)  # Page must be >= 1
        errors = exc_info.value.errors()
        assert any("page" in str(error["loc"]) for error in errors)
        
        with pytest.raises(ValidationError) as exc_info:
            AlumniSearchQuery(limit=0)  # Limit must be >= 1
        errors = exc_info.value.errors()
        assert any("limit" in str(error["loc"]) for error in errors)
        
        with pytest.raises(ValidationError) as exc_info:
            AlumniSearchQuery(limit=101)  # Limit must be <= 100
        errors = exc_info.value.errors()
        assert any("limit" in str(error["loc"]) for error in errors)
    
    def test_alumni_search_result_schema(self):
        """Test AlumniSearchResult schema."""
        now = datetime.utcnow()
        alumni1 = AlumniOut(
            _id="5f9f1b9b9c9d1b1b1b1b1b1b",
            full_name="John Doe",
            student_id="2020-12345",
            graduation_year=2020,
            program="BS Computer Science",
            contact_email="johndoe@example.com",
            contact_number="+639123456789",
            current_job="Software Engineer",
            company="Tech Company",
            created_at=now,
            updated_at=now,
            user_id="5f9f1b9b9c9d1b1b1b1b1b1b"
        )
        
        alumni2 = AlumniOut(
            _id="5f9f1b9b9c9d1b1b1b1b1b1c",
            full_name="Jane Doe",
            student_id="2020-54321",
            graduation_year=2020,
            program="BS Information Technology",
            contact_email="janedoe@example.com",
            contact_number="+639123456780",
            current_job="Data Scientist",
            company="Tech Company",
            created_at=now,
            updated_at=now,
            user_id="5f9f1b9b9c9d1b1b1b1b1b1c"
        )
        
        result = AlumniSearchResult(
            items=[alumni1, alumni2],
            total=2,
            page=1,
            pages=1,
            limit=10
        )
        
        assert len(result.items) == 2
        assert result.items[0].full_name == "John Doe"
        assert result.items[1].full_name == "Jane Doe"
        assert result.total == 2
        assert result.page == 1
        assert result.pages == 1
        assert result.limit == 10 