import pytest
from pydantic import ValidationError
from bson import ObjectId

from app.schemas.course import (
    CourseBase,
    CourseCreate,
    CourseUpdate,
    CourseOut
)

@pytest.mark.unit
@pytest.mark.schema
class TestCourseSchemas:
    """Tests for course schemas validation."""
    
    def test_course_base_valid(self):
        """Test valid CourseBase schema."""
        course = CourseBase(
            name="Introduction to Computer Science",
            code="CS101",
            description="Fundamentals of computer science and programming",
            credits=3,
            instructor_ids=["60d21b4667d0d8992e610c85", "60d21b4667d0d8992e610c86"],
            student_ids=["60d21b4667d0d8992e610c87", "60d21b4667d0d8992e610c88"],
            institution_id="60d21b4667d0d8992e610c89"
        )
        
        assert course.name == "Introduction to Computer Science"
        assert course.code == "CS101"
        assert course.description == "Fundamentals of computer science and programming"
        assert course.credits == 3
        assert course.instructor_ids == ["60d21b4667d0d8992e610c85", "60d21b4667d0d8992e610c86"]
        assert course.student_ids == ["60d21b4667d0d8992e610c87", "60d21b4667d0d8992e610c88"]
        assert course.institution_id == "60d21b4667d0d8992e610c89"
    
    def test_course_base_minimal(self):
        """Test CourseBase with only required fields."""
        course = CourseBase(
            name="Calculus I",
            code="MATH101",
            institution_id="60d21b4667d0d8992e610c89"
        )
        
        assert course.name == "Calculus I"
        assert course.code == "MATH101"
        assert course.institution_id == "60d21b4667d0d8992e610c89"
        assert course.description is None
        assert course.credits is None
        assert course.instructor_ids == []
        assert course.student_ids == []
    
    def test_course_base_invalid_name(self):
        """Test CourseBase with invalid name."""
        # Empty name
        with pytest.raises(ValidationError) as exc_info:
            CourseBase(
                name="",
                code="CS101",
                institution_id="60d21b4667d0d8992e610c89"
            )
        errors = exc_info.value.errors()
        assert any("name" in str(error["loc"]) for error in errors)
        
        # Too long name
        with pytest.raises(ValidationError) as exc_info:
            CourseBase(
                name="A" * 256,  # More than 255 characters
                code="CS101",
                institution_id="60d21b4667d0d8992e610c89"
            )
        errors = exc_info.value.errors()
        assert any("name" in str(error["loc"]) for error in errors)
    
    def test_course_base_invalid_code(self):
        """Test CourseBase with invalid code."""
        # Empty code
        with pytest.raises(ValidationError) as exc_info:
            CourseBase(
                name="Introduction to Computer Science",
                code="",
                institution_id="60d21b4667d0d8992e610c89"
            )
        errors = exc_info.value.errors()
        assert any("code" in str(error["loc"]) for error in errors)
        
        # Too long code
        with pytest.raises(ValidationError) as exc_info:
            CourseBase(
                name="Introduction to Computer Science",
                code="CS" * 51,  # More than 100 characters
                institution_id="60d21b4667d0d8992e610c89"
            )
        errors = exc_info.value.errors()
        assert any("code" in str(error["loc"]) for error in errors)
    
    def test_course_base_invalid_credits(self):
        """Test CourseBase with invalid credits."""
        # Negative credits
        with pytest.raises(ValidationError) as exc_info:
            CourseBase(
                name="Introduction to Computer Science",
                code="CS101",
                institution_id="60d21b4667d0d8992e610c89",
                credits=-1
            )
        errors = exc_info.value.errors()
        assert any("credits" in str(error["loc"]) for error in errors)
        
        # Too high credits
        with pytest.raises(ValidationError) as exc_info:
            CourseBase(
                name="Introduction to Computer Science",
                code="CS101",
                institution_id="60d21b4667d0d8992e610c89",
                credits=1000  # Unreasonably high
            )
        errors = exc_info.value.errors()
        assert any("credits" in str(error["loc"]) for error in errors)
    
    def test_course_base_invalid_institution_id(self):
        """Test CourseBase with invalid institution_id."""
        with pytest.raises(ValidationError) as exc_info:
            CourseBase(
                name="Introduction to Computer Science",
                code="CS101",
                institution_id="invalid-id"  # Not a valid ObjectId
            )
        errors = exc_info.value.errors()
        assert any("institution_id" in str(error["loc"]) for error in errors)
    
    def test_course_base_invalid_instructor_ids(self):
        """Test CourseBase with invalid instructor_ids."""
        with pytest.raises(ValidationError) as exc_info:
            CourseBase(
                name="Introduction to Computer Science",
                code="CS101",
                institution_id="60d21b4667d0d8992e610c89",
                instructor_ids=["invalid-id"]  # Not a valid ObjectId
            )
        errors = exc_info.value.errors()
        assert any("instructor_ids" in str(error["loc"]) for error in errors)
    
    def test_course_base_invalid_student_ids(self):
        """Test CourseBase with invalid student_ids."""
        with pytest.raises(ValidationError) as exc_info:
            CourseBase(
                name="Introduction to Computer Science",
                code="CS101",
                institution_id="60d21b4667d0d8992e610c89",
                student_ids=["invalid-id"]  # Not a valid ObjectId
            )
        errors = exc_info.value.errors()
        assert any("student_ids" in str(error["loc"]) for error in errors)
    
    def test_course_create_valid(self):
        """Test valid CourseCreate schema."""
        course = CourseCreate(
            name="Advanced Machine Learning",
            code="CS456",
            description="Advanced topics in machine learning and neural networks",
            credits=4,
            instructor_ids=["60d21b4667d0d8992e610c85"],
            student_ids=["60d21b4667d0d8992e610c87", "60d21b4667d0d8992e610c88"],
            institution_id="60d21b4667d0d8992e610c89",
            is_active=True,
            start_date="2023-09-01",
            end_date="2023-12-15"
        )
        
        assert course.name == "Advanced Machine Learning"
        assert course.code == "CS456"
        assert course.description == "Advanced topics in machine learning and neural networks"
        assert course.credits == 4
        assert course.instructor_ids == ["60d21b4667d0d8992e610c85"]
        assert course.student_ids == ["60d21b4667d0d8992e610c87", "60d21b4667d0d8992e610c88"]
        assert course.institution_id == "60d21b4667d0d8992e610c89"
        assert course.is_active is True
        assert course.start_date == "2023-09-01"
        assert course.end_date == "2023-12-15"
    
    def test_course_create_defaults(self):
        """Test CourseCreate with default values."""
        course = CourseCreate(
            name="Philosophy 101",
            code="PHIL101",
            institution_id="60d21b4667d0d8992e610c89"
        )
        
        assert course.name == "Philosophy 101"
        assert course.code == "PHIL101"
        assert course.institution_id == "60d21b4667d0d8992e610c89"
        assert course.description is None
        assert course.credits is None
        assert course.instructor_ids == []
        assert course.student_ids == []
        assert course.is_active is True  # Default value
        assert course.start_date is None
        assert course.end_date is None
    
    def test_course_create_invalid_dates(self):
        """Test CourseCreate with invalid dates."""
        # End date before start date
        with pytest.raises(ValidationError) as exc_info:
            CourseCreate(
                name="Philosophy 101",
                code="PHIL101",
                institution_id="60d21b4667d0d8992e610c89",
                start_date="2023-12-15",
                end_date="2023-09-01"  # Before start date
            )
        errors = exc_info.value.errors()
        assert any(("end_date" in str(error["loc"]) or "start_date" in str(error["loc"])) for error in errors)
        
        # Invalid date format
        with pytest.raises(ValidationError) as exc_info:
            CourseCreate(
                name="Philosophy 101",
                code="PHIL101",
                institution_id="60d21b4667d0d8992e610c89",
                start_date="not-a-date"
            )
        errors = exc_info.value.errors()
        assert any("start_date" in str(error["loc"]) for error in errors)
    
    def test_course_update_valid(self):
        """Test valid CourseUpdate schema."""
        # Full update
        update = CourseUpdate(
            name="Updated Course Name",
            code="UPD101",
            description="Updated course description",
            credits=5,
            instructor_ids=["60d21b4667d0d8992e610c90"],
            student_ids=["60d21b4667d0d8992e610c91"],
            is_active=False,
            start_date="2024-01-15",
            end_date="2024-05-30"
        )
        
        assert update.name == "Updated Course Name"
        assert update.code == "UPD101"
        assert update.description == "Updated course description"
        assert update.credits == 5
        assert update.instructor_ids == ["60d21b4667d0d8992e610c90"]
        assert update.student_ids == ["60d21b4667d0d8992e610c91"]
        assert update.is_active is False
        assert update.start_date == "2024-01-15"
        assert update.end_date == "2024-05-30"
        
        # Partial update
        update = CourseUpdate(
            name="New Course Name",
            is_active=False
        )
        
        assert update.name == "New Course Name"
        assert update.is_active is False
        assert update.code is None
        assert update.description is None
        assert update.credits is None
        assert update.instructor_ids is None
        assert update.student_ids is None
        assert update.start_date is None
        assert update.end_date is None
    
    def test_course_update_remove_instructors(self):
        """Test CourseUpdate with empty instructor list."""
        update = CourseUpdate(
            instructor_ids=[]  # Remove all instructors
        )
        
        assert update.instructor_ids == []
    
    def test_course_update_remove_students(self):
        """Test CourseUpdate with empty student list."""
        update = CourseUpdate(
            student_ids=[]  # Remove all students
        )
        
        assert update.student_ids == []
    
    def test_course_out_schema(self):
        """Test CourseOut schema."""
        course = CourseOut(
            _id="60d21b4667d0d8992e610c92",
            name="Data Structures",
            code="CS201",
            description="Study of data structures and algorithms",
            credits=4,
            instructor_ids=["60d21b4667d0d8992e610c85"],
            student_ids=["60d21b4667d0d8992e610c87", "60d21b4667d0d8992e610c88"],
            institution_id="60d21b4667d0d8992e610c89",
            is_active=True,
            start_date="2023-09-01",
            end_date="2023-12-15",
            created_at="2023-06-15T10:00:00",
            updated_at="2023-08-01T14:30:00"
        )
        
        assert course.id == "60d21b4667d0d8992e610c92"  # Alias for _id
        assert course.name == "Data Structures"
        assert course.code == "CS201"
        assert course.description == "Study of data structures and algorithms"
        assert course.credits == 4
        assert course.instructor_ids == ["60d21b4667d0d8992e610c85"]
        assert course.student_ids == ["60d21b4667d0d8992e610c87", "60d21b4667d0d8992e610c88"]
        assert course.institution_id == "60d21b4667d0d8992e610c89"
        assert course.is_active is True
        assert course.start_date == "2023-09-01"
        assert course.end_date == "2023-12-15"
        assert course.created_at == "2023-06-15T10:00:00"
        assert course.updated_at == "2023-08-01T14:30:00" 