"""
Document utilities
"""

import hashlib


def calculate_hash(content: bytes) -> str:
    """
    Calculate SHA-256 hash of document content.
    """
    return hashlib.sha256(content).hexdigest()