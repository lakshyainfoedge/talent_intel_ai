from fastapi import APIRouter, HTTPException, Depends, Body, UploadFile, File
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from app.models.base import Score
from app.db.mongodb import MongoDB, get_db
from app.core.config import settings
import vertexai
from vertexai.generative_models import GenerativeModel, Part
import os
import json
from bson import ObjectId


router = APIRouter()

async def calculate_similarity(
    resume_embedding: List[float],
    jd_embedding: List[float]
) -> float:
    """Calculate cosine similarity between resume and JD embeddings."""
    if not resume_embedding or not jd_embedding:
        return 0.0
    
    # Ensure embeddings are 2D arrays for sklearn
    resume_array = np.array(resume_embedding).reshape(1, -1)
    jd_array = np.array(jd_embedding).reshape(1, -1)
    
    # Calculate cosine similarity
    similarity = cosine_similarity(resume_array, jd_array)[0][0]
    
    # Convert to 0-100 scale
    return max(0.0, min(100.0, (similarity + 1) * 50))

@router.post("", response_model=Score)
async def calculate_score(
    resume_id: str = Body(..., embed=True),
    jd_id: str = Body(..., embed=True),
    db: MongoDB = Depends(get_db)
):
    # Check if score already exists
    collection = db.get_collection("scores")
    existing = await collection.find_one({
        "resume_id": resume_id,
        "jd_id": jd_id
    })
    
    if existing:
        return db.serialize_doc(existing)
    
    # Get resume and JD data
    resumes_collection = db.get_collection("resumes")
    resume = await resumes_collection.find_one({"_id": resume_id})
    
    jd_collection = db.get_collection("job_descriptions")
    jd = await jd_collection.find_one({"_id": jd_id})
    
    if not resume or not jd:
        raise HTTPException(status_code=404, detail="Resume or Job Description not found")
    
    # Calculate scores (simplified example - you'll want to enhance this)
    # In a real implementation, you'd use embeddings and more sophisticated scoring
    
    # For now, we'll just calculate a simple similarity score
    # In a real implementation, you'd get these from your ML model
    resume_text = resume.get("content", {}).get("text", "")
    jd_text = jd.get("content", "")
    
    # Simple word overlap as a placeholder
    resume_words = set(resume_text.lower().split())
    jd_words = set(jd_text.lower().split())
    
    if not jd_words:
        similarity_score = 0.0
    else:
        common_words = resume_words.intersection(jd_words)
        similarity_score = (len(common_words) / len(jd_words)) * 100
    
    # Create score breakdown
    score_breakdown = {
        "skill_match": similarity_score * 0.4,
        "experience_match": similarity_score * 0.3,
        "education_match": similarity_score * 0.2,
        "other_factors": similarity_score * 0.1
    }
    
    # Calculate overall score (weighted average)
    overall_score = sum(score_breakdown.values()) / len(score_breakdown)
    
    # Create score document
    score = Score(
        resume_id=resume_id,
        jd_id=jd_id,
        overall_score=overall_score,
        score_breakdown=score_breakdown
    )
    
    # Save to database
    result = await collection.insert_one(score.dict(by_alias=True, exclude={"id"}))
    score.id = str(result.inserted_id)
    
    return score

@router.get("/{score_id}", response_model=Score)
async def get_score(
    score_id: str,
    db: MongoDB = Depends(get_db)
):
    collection = db.get_collection("scores")
    score = await collection.find_one({"_id": score_id})
    if not score:
        raise HTTPException(status_code=404, detail="Score not found")
    return db.serialize_doc(score)

@router.get("/resume/{resume_id}", response_model=List[Score])
async def get_scores_by_resume(
    resume_id: str,
    skip: int = 0,
    limit: int = 10,
    db: MongoDB = Depends(get_db)
):
    collection = db.get_collection("scores")
    cursor = collection.find({"resume_id": resume_id}).skip(skip).limit(limit)
    scores = []
    async for doc in cursor:
        scores.append(db.serialize_doc(doc))
    return scores

@router.get("/job-description/{jd_id}", response_model=List[Score])
async def get_scores_by_jd(
    jd_id: str,
    skip: int = 0,
    limit: int = 10,
    db: MongoDB = Depends(get_db)
):
    collection = db.get_collection("scores")
    cursor = collection.find({"jd_id": jd_id}).sort("overall_score", -1).skip(skip).limit(limit)
    scores = []
    async for doc in cursor:
        scores.append(db.serialize_doc(doc))
    return scores

# Prompts (reuse from app.py)
RESUME_PROMPT = """
You are an expert resume parser. Given resume text, return STRICT JSON:
{
  "name": string | null,
  "titles": string[] (role titles found),
  "seniority": one of ["intern","junior","mid","senior","lead","manager","director","executive"],
  "skills": string[] (max 50, lowercase tokens),
  "experience_bullets": string[] (concise bullets describing actual work done),
  "education": string[]
}
Only output JSON. No markdown. No commentary.
"""

AI_DETECT_PROMPT = """
You are an AI-content auditor. Estimate the likelihood that the text was generated or heavily edited by an LLM.
Return a STRICT JSON like:
{
  "ai_likelihood_percent": number (0-100 integer),
  "rationale": string (short),
  "flags": string[] (patterns such as generic phrasing, templated bullets, low-specificity)
}
Only output JSON. No markdown. No commentary.
"""

def gemini_json(gemini: GenerativeModel, system_prompt: str, text: str) -> dict:
    resp = gemini.generate_content([system_prompt, Part.from_text(text)], safety_settings=None)
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

def skills_overlap_score(jd_skills, res_skills):
    if not jd_skills:
        return 0.0
    jd = set([s.strip().lower() for s in jd_skills])
    rs = set([s.strip().lower() for s in res_skills])
    overlap = jd.intersection(rs)
    return len(overlap) / max(1, len(jd))

SENIORITY_MAP = {
    "intern": 0, "junior": 1, "mid": 2, "senior": 3, "lead": 4,
    "manager": 5, "director": 6, "executive": 7
}
def trajectory_alignment(jd_level, resume_level):
    a = SENIORITY_MAP.get((jd_level or "").lower(), 2)
    b = SENIORITY_MAP.get((resume_level or "").lower(), 2)
    diff = abs(a - b)
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.8
    if diff == 2:
        return 0.5
    return 0.25

def candidate_score(exp_sim, skill_overlap, traj, w):
    score = (
        w["experience"] * exp_sim +
        w["skills"] * skill_overlap +
        w["trajectory"] * traj
    )
    return float(max(0.0, min(1.0, score))) * 100.0

def extract_skills_from_bullets(bullets: List[str], jd_skills: List[str]) -> List[str]:
    """
    Very simple rule-based extractor: check if JD skills appear in experience bullets text.
    """
    bullets_text = " ".join(bullets).lower()
    extracted = []
    for skill in jd_skills:
        if skill.lower() in bullets_text:
            extracted.append(skill)
    return list(set(extracted))

@router.post("/batch-score", response_model=List[dict])
async def batch_score_resumes(
    jd_id: str = Body(...),
    resume_ids: List[str] = Body(...),
    weights: Optional[Dict[str, float]] = Body(None),
    db: MongoDB = Depends(get_db)
):
    # Load JD from DB
    jd_collection = db.get_collection("job_descriptions")
    try:
        object_id = ObjectId(jd_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job description ID format")
    jd = await jd_collection.find_one({"_id": object_id})
    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found")
    jd_struct = jd.get("parsed_data", {})
    jd_text = jd.get("content", "")
    jd_req_skills = jd_struct.get("required_skills", [])
    jd_resp_text = "\n".join(jd_struct.get("responsibilities", [])) if jd_struct else jd_text
    if not jd_resp_text:
        jd_resp_text = jd_text
        
    # print("JD Text:", jd_resp_text)

    # Dummy embedding: use word overlap as a proxy for experience similarity
    def exp_similarity(jd_text, res_text):
        jd_words = set(jd_text.lower().split())
        res_words = set(res_text.lower().split())
        if not jd_words:
            return 0.0
        return len(jd_words & res_words) / len(jd_words)

    # Use provided weights or default
    if not weights:
        weights = {"experience": 0.5, "skills": 0.35, "trajectory": 0.15}

    # Initialize Gemini for AI detection
    PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
    LOCATION = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")
    GEMINI_MODEL_NAME = "gemini-2.0-flash"
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    gemini = GenerativeModel(GEMINI_MODEL_NAME)

    resumes_collection = db.get_collection("resumes")
    rows = []
    for resume_id in resume_ids:
        object_id = ObjectId(resume_id)
        resume = await resumes_collection.find_one({"_id": object_id})
        print(f"Found resume: {resume}")
        if not resume:
            continue
        res_struct = resume.get("parsed_data", {})
        res_text = resume.get("content", {}).get("text", "")
        # AI detection via Gemini (like app.py)
        ai_struct = gemini_json(gemini, AI_DETECT_PROMPT, res_text)
        ai_pct = int(ai_struct.get("ai_likelihood_percent", 0))
        ai_pct = max(0, min(100, ai_pct))
        validity_pct = 100 - ai_pct
        extracted_skills = extract_skills_from_bullets(res_struct.get("experience_bullets", []), jd_req_skills)
        combined_skills = list(set(res_struct.get("skills", [])) | set(extracted_skills))

        exp_sim = exp_similarity(jd_resp_text, res_text)
        skill_overlap = skills_overlap_score(jd_req_skills, combined_skills)
        traj = trajectory_alignment(jd_struct.get("seniority", "mid") if jd_struct else "mid",
                                   res_struct.get("seniority", "mid") if res_struct else "mid")
        score = candidate_score(exp_sim, skill_overlap, traj, weights)

        rows.append({
            "resume_id": resume_id,
            "file": resume.get("file_name", ""),
            "parsed": res_struct,
            "ai": ai_struct,
            "ai_pct": ai_pct,
            "validity_pct": validity_pct,
            "exp_sim": exp_sim,
            "skill_overlap": skill_overlap,
            "trajectory": traj,
            "score": score,
        })
    return rows
