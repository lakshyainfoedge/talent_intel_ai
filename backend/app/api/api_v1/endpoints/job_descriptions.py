from fastapi import APIRouter, HTTPException, Depends, Body
from typing import List, Optional
import requests
from bs4 import BeautifulSoup
import hashlib
from urllib.parse import urlparse
from bson import ObjectId
import os
from dotenv import load_dotenv
import vertexai
from vertexai.preview.generative_models import GenerativeModel, Part
import json

from app.models.base import JobDescription
from app.db.mongodb import MongoDB, get_db
from app.core.config import settings

router = APIRouter()

# Load environment variables
load_dotenv()

# Vertex AI config
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")
GEMINI_MODEL_NAME = "gemini-2.0-flash"

# JD prompt (same as app.py)
JD_PROMPT = """
You are an expert HR analyst. Given a Job Description (JD) as plain text, return a STRICT JSON with:
{
  "title": string,
  "seniority": one of ["intern","junior","mid","senior","lead","manager","director","executive"],
  "required_skills": string[] (max 25, lowercase tokens),
  "nice_to_have_skills": string[] (max 20, lowercase tokens),
  "responsibilities": string[] (concise bullet points),
  "raw_summary": string
}
Only output JSON. No markdown. No commentary.
"""

async def fetch_job_description(url: str) -> str:
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.extract()
            
        # Get text
        text = soup.get_text()
        
        # Clean up text
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch job description: {str(e)}")

def parse_jd_with_gemini(jd_text: str) -> dict:
    # Initialize Vertex AI and Gemini model
    print("Initializing Vertex AI...", PROJECT_ID, LOCATION)
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    gemini = GenerativeModel(GEMINI_MODEL_NAME)
    resp = gemini.generate_content([JD_PROMPT, Part.from_text(jd_text)], safety_settings=None)
    raw = resp.candidates[0].content.parts[0].text if resp and resp.candidates else "{}"
    raw = raw.strip().strip("` ")
    try:
        return json.loads(raw)
    except Exception:
        start = raw.find("{"); end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(raw[start:end+1])
            except Exception:
                pass
    return {}

@router.post("", response_model=JobDescription)
async def create_job_description(
    url: str = Body(..., embed=True),
    db: MongoDB = Depends(get_db)
):
    # Validate URL
    parsed_url = urlparse(url)
    if not all([parsed_url.scheme, parsed_url.netloc]):
        raise HTTPException(status_code=400, detail="Invalid URL")
    
    # Generate URL hash
    url_hash = hashlib.sha256(url.encode()).hexdigest()
    
    # Check if JD already exists
    collection = db.get_collection("job_descriptions")
    existing = await collection.find_one({"url_hash": url_hash})
    if existing:
        return db.serialize_doc(existing)
    
    # Fetch job description
    try:
        content = await fetch_job_description(url)
        # Parse JD using Gemini
        parsed_data = parse_jd_with_gemini(content)
        # console.log("Parsed JD Data:", parsed_data)
        # Create job description document
        jd_data = {
            "url": url,
            "content": content,
            "url_hash": url_hash,
            "parsed_data": parsed_data
        }
        # Save to database
        result = await collection.insert_one(jd_data)
        jd_data["id"] = str(result.inserted_id)
        serialized_jd_data = db.serialize_doc(jd_data)
        jd = JobDescription(**serialized_jd_data)
    
        return jd
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process job description: {str(e)}")

@router.get("/{jd_id}", response_model=JobDescription)
async def get_job_description(
    jd_id: str,
    db: MongoDB = Depends(get_db)
):
    # Convert jd_id to ObjectId for MongoDB query
    try:
        object_id = ObjectId(jd_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job description ID format")
    collection = db.get_collection("job_descriptions")
    jd = await collection.find_one({"_id": object_id})
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found")
    return db.serialize_doc(jd)

@router.get("", response_model=List[JobDescription])
async def list_job_descriptions(
    skip: int = 0,
    limit: int = 10,
    db: MongoDB = Depends(get_db)
):
    collection = db.get_collection("job_descriptions")
    cursor = collection.find().sort("created_at", -1).skip(skip).limit(limit)
    jds = []
    async for doc in cursor:
        jds.append(db.serialize_doc(doc))
    return jds
