from bson import ObjectId
from datetime import datetime
import json
from bson.errors import InvalidId
from typing import Any, Dict, List

class JSONEncoder(json.JSONEncoder):
    """Custom JSON encoder for MongoDB objects and other non-serializable types."""
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def serialize_dict(obj: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively serialize dictionary values, converting ObjectId to string
    and datetime to ISO format string.
    """
    result = {}
    for key, value in obj.items():
        if isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, dict):
            result[key] = serialize_dict(value)
        elif isinstance(value, list):
            result[key] = serialize_list(value)
        else:
            result[key] = value
    return result

def serialize_list(obj_list: List[Any]) -> List[Any]:
    """
    Recursively serialize list values, converting ObjectId to string
    and datetime to ISO format string.
    """
    result = []
    for item in obj_list:
        if isinstance(item, ObjectId):
            result.append(str(item))
        elif isinstance(item, datetime):
            result.append(item.isoformat())
        elif isinstance(item, dict):
            result.append(serialize_dict(item))
        elif isinstance(item, list):
            result.append(serialize_list(item))
        else:
            result.append(item)
    return result

def jsonify(obj):
    """
    Convert any object to a JSON serializable form.
    Handles ObjectId, datetime, dict, and list recursively.
    """
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return serialize_dict(obj)
    elif isinstance(obj, list):
        return serialize_list(obj)
    return obj

def serialize_mongodb_doc(doc):
    """
    Convert MongoDB document with ObjectId to serializable format.
    Recursively converts all ObjectId instances to strings.
    
    Args:
        doc: MongoDB document or any object that might contain ObjectId
        
    Returns:
        Dict with all ObjectId converted to string
    """
    if isinstance(doc, list):
        return [serialize_mongodb_doc(item) for item in doc]
    
    if isinstance(doc, dict):
        return {k: serialize_mongodb_doc(v) for k, v in doc.items()}
    
    if isinstance(doc, ObjectId):
        return str(doc)
    
    # Return other types as is
    return doc 