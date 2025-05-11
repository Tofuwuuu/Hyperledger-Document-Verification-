import re
import unicodedata
import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

def generate_url_slug(text: str) -> str:
    """
    Convert text to URL-friendly slug.
    Example: "Hello World!" -> "hello-world"
    """
    # Normalize unicode characters
    text = unicodedata.normalize('NFKD', text)
    
    # Convert to lowercase
    text = text.lower()
    
    # Replace spaces with hyphens
    text = re.sub(r'\s+', '-', text)
    
    # Remove any non-alphanumeric characters except hyphens
    text = re.sub(r'[^\w\-]', '', text)
    
    # Remove consecutive hyphens
    text = re.sub(r'\-+', '-', text)
    
    # Remove leading and trailing hyphens
    text = text.strip('-')
    
    # If slug is empty, use timestamp
    if not text:
        text = f"event-{int(datetime.now().timestamp())}"
        
    logger.info(f"Generated slug: {text}")
    return text

def format_datetime(dt: Optional[datetime] = None, fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    """
    Format a datetime object as a string.
    If no datetime is provided, uses current time.
    """
    if dt is None:
        dt = datetime.now()
    return dt.strftime(fmt)

def truncate_string(text: str, max_length: int = 100) -> str:
    """
    Truncate a string to a maximum length, adding ellipsis if truncated.
    """
    if len(text) <= max_length:
        return text
    return text[:max_length-3] + "..."

def safe_get(obj: dict, path: str, default=None):
    """
    Safely get a value from a nested dictionary using dot notation.
    Example: safe_get({"a": {"b": 1}}, "a.b") -> 1
    """
    keys = path.split(".")
    result = obj
    
    try:
        for key in keys:
            result = result[key]
        return result
    except (KeyError, TypeError):
        return default 