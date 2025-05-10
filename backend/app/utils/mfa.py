import random
import string
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple

# Set up logging
logger = logging.getLogger(__name__)

# Store MFA verification codes in memory - in production, use Redis or similar
# Format: { "setup_id": {"code": "123456", "email": "user@email.com", "expires": datetime } }
mfa_verification_codes = {}

# Store active MFA sessions
# Format: { "session_id": {"user_id": "user_id", "expires": datetime } }
mfa_sessions = {}

def generate_verification_code(length: int = 6) -> str:
    """Generate a numeric verification code"""
    return ''.join(random.choices(string.digits, k=length))

def store_verification_code(email: str, user_id: str = None, setup_id: str = None) -> Tuple[str, str]:
    """
    Generate and store a verification code for MFA
    
    Returns:
        Tuple of (setup_id, code)
    """
    if not setup_id:
        setup_id = str(uuid.uuid4())
        
    code = generate_verification_code()
    expires = datetime.utcnow() + timedelta(minutes=10)  # Code expires in 10 minutes
    
    mfa_verification_codes[setup_id] = {
        "code": code,
        "email": email,
        "user_id": user_id,
        "expires": expires
    }
    
    logger.info(f"Generated MFA code for {email}: {code}")
    return setup_id, code

def verify_code(setup_id: str, code: str) -> bool:
    """Verify an MFA verification code"""
    if setup_id not in mfa_verification_codes:
        logger.warning(f"MFA setup_id not found: {setup_id}")
        return False
        
    stored_data = mfa_verification_codes[setup_id]
    
    # Check if code has expired
    if datetime.utcnow() > stored_data["expires"]:
        logger.warning(f"MFA code expired for {setup_id}")
        del mfa_verification_codes[setup_id]
        return False
        
    # Check if the code matches
    if stored_data["code"] != code:
        logger.warning(f"MFA code mismatch for {setup_id}")
        return False
        
    # If we've verified the code, we can delete it
    del mfa_verification_codes[setup_id]
    return True

def create_mfa_session(user_id: str) -> str:
    """Create and store an MFA session"""
    session_id = str(uuid.uuid4())
    expires = datetime.utcnow() + timedelta(minutes=30)  # Session expires in 30 minutes
    
    mfa_sessions[session_id] = {
        "user_id": user_id,
        "expires": expires
    }
    
    return session_id

def verify_mfa_session(session_id: str) -> Optional[str]:
    """Verify an MFA session and return the user_id if valid"""
    if session_id not in mfa_sessions:
        return None
        
    session = mfa_sessions[session_id]
    
    # Check if session has expired
    if datetime.utcnow() > session["expires"]:
        del mfa_sessions[session_id]
        return None
        
    # Return the user_id
    return session["user_id"]

def mask_email(email: str) -> str:
    """
    Mask an email address for display purposes
    e.g. j****e@example.com
    """
    if not email or '@' not in email:
        return '****@****.com'
        
    username, domain = email.split('@', 1)
    
    if len(username) <= 2:
        masked_username = username[0] + '*' * len(username)
    else:
        masked_username = username[0] + '*' * (len(username) - 2) + username[-1]
        
    return f"{masked_username}@{domain}" 