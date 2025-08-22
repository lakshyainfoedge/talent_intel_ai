from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
from typing import List
import os
import hashlib
from datetime import datetime
import json
from dotenv import load_dotenv
import vertexai
from vertexai.preview.generative_models import GenerativeModel, Part

from app.models.base import Resume
from app.db.mongodb import MongoDB, get_db
from app.core.config import settings

router = APIRouter()

# Load environment variables
load_dotenv()

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")
GEMINI_MODEL_NAME = "gemini-2.0-flash"

RESUME_PROMPT = """
You are an expert resume parser. Extract structured data from the provided resume TEXT with best-effort inference.

Output STRICT JSON only (no markdown, no commentary) with this exact schema:
{
  "name": string | null,
  "titles": string[],
  "seniority": one of ["intern","junior","mid","senior","lead","manager","director","executive"],
  "skills": string[],
  "experience_bullets": string[],
  "education": string[]
}

Rules:
- Prefer real values over null. Infer when reasonably clear; use null only if truly absent.
- "titles": collect distinct role titles (e.g., "software engineer", "data scientist"). Keep 1-5 most representative, lowercase.
- "seniority": infer from titles, years, scope (e.g., intern, junior, mid, senior, lead, manager, director, executive). Default to "mid" if unclear.
- "skills": normalize to lowercase, deduplicate, max 50 terms. Prefer hard skills, technologies, frameworks, languages, tools.
- "experience_bullets": concise, action-oriented bullets capturing concrete work (avoid fluff). 3-10 bullets total across roles.
- "education": degrees and institutions (e.g., "B.Tech, IIT Bombay", "MS Computer Science, Stanford").
- Robustly handle PDFs and noisy OCR (broken lines, headers/footers, columns). Ignore contact headers unless informative.
- Do not invent employers or dates; omit rather than hallucinate.

Examples (illustrative; do not copy):
Input snippet: "Senior Software Engineer at Acme (2019-2023). Built microservices in Go, Kubernetes, GCP. Led 4 engineers."
Possible fields: titles=["senior software engineer"], seniority="senior", skills=["go","kubernetes","gcp","microservices"],
experience_bullets=["built microservices in go on kubernetes","led team of 4 engineers"].

Return ONLY the JSON object.
"""

def parse_resume_with_gemini(resume_text: str) -> dict:
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    gemini = GenerativeModel(GEMINI_MODEL_NAME)
    resp = gemini.generate_content([RESUME_PROMPT, Part.from_text(resume_text)], safety_settings=None)
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

@router.post("/upload", response_model=Resume)
async def upload_resume(
    file: UploadFile = File(...),
    db: MongoDB = Depends(get_db)
):
    # Read file content
    content = await file.read()
    
    # Generate file hash
    file_hash = hashlib.sha256(content).hexdigest()
    
    # Check if resume already exists
    collection = db.get_collection("resumes")
    existing = await collection.find_one({"file_hash": file_hash})
    if existing:
        return db.serialize_doc(existing)
    
    # Parse resume using Gemini
    resume_text = content.decode('utf-8', errors='ignore')
    parsed_data = parse_resume_with_gemini(resume_text)
    
    # Build dict for MongoDB
    resume_data = {
        "file_hash": file_hash,
        "file_name": file.filename,
        "file_size": len(content),
        "file_type": file.content_type,
        "content": {"text": resume_text},
        "parsed_data": parsed_data
    }
    # Save to database
    result = await collection.insert_one(resume_data)
    # Remove _id if present, set id as string
    resume_data.pop("_id", None)
    resume_data["id"] = str(result.inserted_id)
    resume = Resume(**resume_data)
    return resume

@router.post("/upload/batch", response_model=List[Resume])
async def upload_resumes_batch(
    files: List[UploadFile] = File(...),
    db: MongoDB = Depends(get_db)
):
    collection = db.get_collection("resumes")
    results = []
    for file in files:
        content = await file.read()
        file_hash = hashlib.sha256(content).hexdigest()
        existing = await collection.find_one({"file_hash": file_hash})
        if existing:
            results.append(db.serialize_doc(existing))
            continue
        resume_text = content.decode('utf-8', errors='ignore')
        parsed_data = parse_resume_with_gemini(resume_text)
        resume_data = {
            "file_hash": file_hash,
            "file_name": file.filename,
            "file_size": len(content),
            "file_type": file.content_type,
            "content": {"text": resume_text},
            "parsed_data": parsed_data
        }
        result = await collection.insert_one(resume_data)
        resume_data.pop("_id", None)
        resume_data["id"] = str(result.inserted_id)
        resume = Resume(**resume_data)
        results.append(resume)
    return results

@router.get("/{resume_id}", response_model=Resume)
async def get_resume(
    resume_id: str,
    db: MongoDB = Depends(get_db)
):
    collection = db.get_collection("resumes")
    resume = await collection.find_one({"_id": resume_id})
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return db.serialize_doc(resume)

@router.get("/", response_model=List[Resume])
async def list_resumes(
    skip: int = 0,
    limit: int = 10,
    db: MongoDB = Depends(get_db)
):
    collection = db.get_collection("resumes")
    cursor = collection.find().skip(skip).limit(limit)
    resumes = []
    async for doc in cursor:
        resumes.append(db.serialize_doc(doc))
    return resumes
