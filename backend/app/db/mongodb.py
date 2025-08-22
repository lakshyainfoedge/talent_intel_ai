from motor.motor_asyncio import AsyncIOMotorClient
from motor.core import AgnosticDatabase
from typing import Dict, Any, Optional
import json
from bson import ObjectId
from datetime import datetime

from app.core.config import settings

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return json.JSONEncoder.default(self, o)

class MongoDB:
    client: AsyncIOMotorClient = None
    db: AgnosticDatabase = None
    
    @classmethod
    async def connect_db(cls):
        cls.client = AsyncIOMotorClient(settings.MONGODB_URL)
        cls.db = cls.client[settings.MONGODB_DB_NAME]
        
    @classmethod
    async def close_db(cls):
        if cls.client:
            cls.client.close()
            
    @classmethod
    def get_collection(cls, collection_name: str):
        if cls.db is None:
            raise Exception("Database not connected")
        return cls.db[collection_name]
    
    @classmethod
    def serialize_doc(cls, doc: Dict[str, Any]) -> Dict[str, Any]:
        print("xyz")
        if not doc:
            return None
        # Convert ObjectId to string but keep the key as '_id'
        doc['_id'] = str(doc['_id'])
        return doc

# Dependency
def get_db() -> MongoDB:
    return MongoDB
