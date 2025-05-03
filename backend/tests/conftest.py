import pytest
import asyncio
from typing import Dict, Any, Generator, AsyncGenerator
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import AsyncClient
from bson import ObjectId
import mongomock_motor
import os
import sys
from pathlib import Path

# Add the parent directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app
from app.config.database import get_database
from app.utils.auth import create_access_token, get_current_user, get_admin_user

# Override the get_database dependency
@pytest.fixture
def mock_db():
    """Create a mock MongoDB database."""
    client = mongomock_motor.AsyncMongoMockClient()
    return client["test_cvsu_alumni"]

@pytest.fixture
def override_get_database(mock_db):
    """Override the get_database dependency."""
    
    async def _get_database():
        yield mock_db
    
    app.dependency_overrides[get_database] = _get_database

@pytest.fixture
def test_app(override_get_database) -> FastAPI:
    """Create a test app with overridden dependencies."""
    return app

@pytest.fixture
def client(test_app) -> Generator:
    """Create a test client."""
    with TestClient(test_app) as client:
        yield client

@pytest.fixture
async def async_client(test_app) -> AsyncGenerator:
    """Create an async test client."""
    async with AsyncClient(app=test_app, base_url="http://test") as client:
        yield client

# User test fixtures
@pytest.fixture
def normal_user_token_headers() -> Dict[str, str]:
    """Create a token for a normal user."""
    user_id = str(ObjectId())
    access_token = create_access_token(data={"sub": user_id})
    return {"Authorization": f"Bearer {access_token}"}

@pytest.fixture
def admin_user_token_headers() -> Dict[str, str]:
    """Create a token for an admin user."""
    admin_id = str(ObjectId())
    access_token = create_access_token(data={"sub": admin_id, "is_admin": True})
    return {"Authorization": f"Bearer {access_token}"}

# Mock users
@pytest.fixture
def mock_normal_user() -> Dict[str, Any]:
    """Create a mock normal user."""
    user_id = str(ObjectId())
    return {
        "_id": user_id,
        "email": "user@example.com",
        "full_name": "Test User",
        "hashed_password": "$2b$12$Ix8QxUgJBHNsTa7d5C1khu0gqC4uECUPy2tZ9iQwjVkZD9LQXYwM.",  # hashed "password"
        "is_active": True,
        "is_admin": False,
        "student_id": "2020-12345",
        "graduation_year": 2020,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

@pytest.fixture
def mock_admin_user() -> Dict[str, Any]:
    """Create a mock admin user."""
    admin_id = str(ObjectId())
    return {
        "_id": admin_id,
        "email": "admin@example.com",
        "full_name": "Admin User",
        "hashed_password": "$2b$12$Ix8QxUgJBHNsTa7d5C1khu0gqC4uECUPy2tZ9iQwjVkZD9LQXYwM.",
        "is_active": True,
        "is_admin": True,
        "student_id": None,
        "graduation_year": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

# Mock database setup
@pytest.fixture
async def mock_db_setup(mock_db, mock_normal_user, mock_admin_user):
    """Set up the mock database with test data."""
    await mock_db.users.insert_one(mock_normal_user)
    await mock_db.users.insert_one(mock_admin_user)
    
    # Mock current user dependency
    async def mock_get_current_user():
        return mock_normal_user
    
    app.dependency_overrides[get_current_user] = mock_get_current_user
    
    # Mock admin user dependency
    async def mock_get_admin_user():
        return mock_admin_user
    
    app.dependency_overrides[get_admin_user] = mock_get_admin_user
    
    yield
    
    # Clean up
    await mock_db.users.delete_many({})
    app.dependency_overrides = {}

# Mock blockchain
@pytest.fixture
def mock_blockchain_response():
    """Mock blockchain response for testing."""
    return {
        "success": True,
        "transaction_id": "mock-transaction-id-12345",
        "message": "Success",
        "verified": True,
        "data": {
            "document_id": str(ObjectId()),
            "document_hash": "mock-document-hash",
            "timestamp": datetime.utcnow().isoformat()
        },
        "history": [
            {
                "transaction_id": "mock-transaction-id-12345",
                "timestamp": datetime.utcnow().isoformat(),
                "action": "STORE",
                "user": "admin@example.com"
            }
        ]
    } 