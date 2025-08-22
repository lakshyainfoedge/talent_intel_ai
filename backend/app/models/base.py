from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
import hashlib

class BaseDocument(BaseModel):
    id: Optional[str] = Field(alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def update_timestamps(self):
        self.updated_at = datetime.utcnow()

class Resume(BaseDocument):
    file_hash: str
    file_name: str
    file_size: int
    file_type: str
    content: Dict[str, Any]
    parsed_data: Optional[Dict[str, Any]] = None
    
    @classmethod
    def create_from_upload(cls, file: bytes, file_name: str, content: Dict[str, Any]):
        file_hash = hashlib.sha256(file).hexdigest()
        return cls(
            file_hash=file_hash,
            file_name=file_name,
            file_size=len(file),
            file_type=file_name.split('.')[-1].lower(),
            content=content,
            parsed_data=None
        )

class JobDescription(BaseDocument):
    url: str
    content: str
    parsed_data: Optional[Dict[str, Any]] = None
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    location: Optional[str] = None
    
    @classmethod
    def create_from_url(cls, url: str, content: str):
        return cls(
            url=url,
            content=content,
            parsed_data=None
        )

class Score(BaseDocument):
    resume_id: str
    jd_id: str
    overall_score: float
    score_breakdown: Dict[str, float]
    feedback: Optional[Dict[str, Any]] = None
