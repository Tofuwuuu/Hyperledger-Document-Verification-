from datetime import datetime, timezone
from typing import Optional

def ensure_timezone_aware(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Ensures a datetime object has timezone information (UTC).
    If the datetime is naive (no timezone), it will be converted to UTC.
    If None is provided, None is returned.
    """
    if dt is None:
        return None
        
    # If datetime has no timezone info (naive), add UTC timezone
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
        
    # Already has timezone info, return as is
    return dt

def get_aware_datetime(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Get an aware datetime object (with timezone) from any datetime.
    This is a wrapper around ensure_timezone_aware for backward compatibility.
    """
    return ensure_timezone_aware(dt)

def get_aware_current_datetime() -> datetime:
    """
    Get the current datetime with UTC timezone.
    """
    return datetime.now(timezone.utc) 