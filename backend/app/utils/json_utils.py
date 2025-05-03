from bson import ObjectId
from datetime import datetime
import json

class JSONEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles MongoDB ObjectId and datetime objects."""
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

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