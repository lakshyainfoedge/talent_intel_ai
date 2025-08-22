# app.py — FastAPI backend for Talent Intel AI
# Run: uvicorn app:app --reload --port 8001
# Prereqs:
#   pip install fastapi uvicorn python-multipart google-cloud-aiplatform vertexai pdfminer.six python-docx beautifulsoup4 requests numpy scikit-learn python-dotenv
# Env:
#   gcloud auth application-default login
#   export GOOGLE_CLOUD_PROJECT="your-project"
#   export GOOGLE_CLOUD_REGION="us-central1"

import io
import os
import re
import json
import hashlib
from typing import Dict, List, Tuple, Optional
import requests
from bs4 import BeautifulSoup

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from dotenv import load_dotenv
load_dotenv()

# -------------------------------
# Vertex AI
# -------------------------------
import vertexai
from vertexai.generative_models import GenerativeModel, Part
try:
    from vertexai.language_models import TextEmbeddingModel
except Exception:
    from vertexai.preview.language_models import TextEmbeddingModel  # type: ignore

# -------------------------------
# Parsers
# -------------------------------
try:
    from pdfminer.high_level import extract_text as pdf_extract_text
except Exception:
    pdf_extract_text = None

try:
    import docx
except Exception:
    docx = None

# -------------------------------
# Config
# -------------------------------
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")
EMBED_MODEL_NAME = "text-embedding-004"
GEMINI_MODEL_NAME = "gemini-2.0-flash"

def init_vertex() -> Tuple[GenerativeModel, TextEmbeddingModel]:
    if not PROJECT_ID:
        print("WARNING: GOOGLE_CLOUD_PROJECT not set")
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    gemini = GenerativeModel(GEMINI_MODEL_NAME)
    emb = TextEmbeddingModel.from_pretrained(EMBED_MODEL_NAME)
    return gemini, emb

gemini, emb_model = init_vertex()

# -------------------------------
# Utility
# -------------------------------
def _normalize_text(t: str) -> str:
    t = t.replace("\xa0", " ")
    t = re.sub(r"\s+", " ", t)
    return t.strip()

def fetch_jd_text(url: str) -> str:
    headers = {"User-Agent": "TalentIntelAI/1.0 (+demo)"}
    r = requests.get(url, headers=headers, timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "form"]):
        tag.decompose()
    text_nodes = [x.get_text(" ") for x in soup.find_all(["h1", "h2", "h3", "p", "li"])]
    text = "\n".join([_normalize_text(t) for t in text_nodes if t and _normalize_text(t)])
    uniq, seen = [], set()
    for p in text.split("\n"):
        key = hashlib.md5(p.encode("utf-8")).hexdigest()[:10]
        if key not in seen:
            seen.add(key); uniq.append(p)
    return "\n".join(uniq)[:20000]

def read_resume_bytes(name: str, data: bytes) -> str:
    name = name.lower()
    if name.endswith(".pdf") and pdf_extract_text:
        try:
            return _normalize_text(pdf_extract_text(io.BytesIO(data)))
        except Exception:
            pass
    if (name.endswith(".docx") or name.endswith(".doc")) and docx:
        try:
            d = docx.Document(io.BytesIO(data))
            return _normalize_text("\n".join([p.text for p in d.paragraphs]))
        except Exception:
            pass
    try:
        return _normalize_text(data.decode("utf-8", errors="ignore"))
    except Exception:
        return ""

def embed_texts(texts: List[str]) -> np.ndarray:
    vectors: List[List[float]] = []
    B = 32
    for i in range(0, len(texts), B):
        batch = texts[i:i+B]
        res = emb_model.get_embeddings(batch)
        for e in res:
            vectors.append(e.values)
    return np.array(vectors, dtype=np.float32)

def cosine(a: np.ndarray, b: np.ndarray) -> float:
    a = a.reshape(1, -1); b = b.reshape(1, -1)
    return float(cosine_similarity(a, b)[0, 0])

# -------------------------------
# Prompts
# -------------------------------
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

def gemini_json(system_prompt: str, text: str) -> Dict:
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

# -------------------------------
# Scoring
# -------------------------------
SENIORITY_MAP = {
    "intern": 0, "junior": 1, "mid": 2, "senior": 3, "lead": 4,
    "manager": 5, "director": 6, "executive": 7
}

def skills_overlap_score(jd_skills: List[str], res_skills: List[str]) -> float:
    if not jd_skills:
        return 0.0
    jd = set([s.strip().lower() for s in jd_skills])
    rs = set([s.strip().lower() for s in res_skills])
    overlap = jd.intersection(rs)
    return len(overlap) / max(1, len(jd))

def trajectory_alignment(jd_level: str, resume_level: str) -> float:
    a = SENIORITY_MAP.get((jd_level or "").lower(), 2)
    b = SENIORITY_MAP.get((resume_level or "").lower(), 2)
    diff = abs(a - b)
    if diff == 0: return 1.0
    if diff == 1: return 0.8
    if diff == 2: return 0.5
    return 0.25

def candidate_score(exp_sim: float, skill_overlap: float, traj: float, w: Dict[str, float]) -> float:
    score = (
        w["experience"] * exp_sim +
        w["skills"] * skill_overlap +
        w["trajectory"] * traj
    )
    return float(max(0.0, min(1.0, score))) * 100.0

# -------------------------------
# FastAPI
# -------------------------------
app = FastAPI(title="Talent Intel AI API", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class JDIn(BaseModel):
    url: str

@app.post("/jd")
def jd_endpoint(body: JDIn):
    text = fetch_jd_text(body.url)
    jd = gemini_json(JD_PROMPT, text) if text else {}
    return {"text": text, "jd": jd}

@app.post("/resumes")
async def resumes_endpoint(files: List[UploadFile] = File(...)):
    out = []
    for f in files:
        buf = await f.read()
        text = read_resume_bytes(f.filename, buf)
        parsed = gemini_json(RESUME_PROMPT, text) if text else {}
        ai = gemini_json(AI_DETECT_PROMPT, text) if text else {}

        # Fallback display name
        base = os.path.splitext(os.path.basename(f.filename))[0]
        name = (parsed.get("name") or "").strip()
        display_name = name if name else base
        parsed["name"] = display_name  # ensure frontend sees a stable name

        # Minimal diagnostics (optional, remove in prod)
        # print(f"[RESUME] file={f.filename} name={parsed.get('name')} text_len={len(text)} snippet={text[:120].replace('\\n',' ')}")

        out.append({
            "file": f.filename,
            "text": text,
            "parsed": parsed,
            "ai": ai,
        })
    return out

class ScoreIn(BaseModel):
    jd: Dict
    resumes: List[Dict]
    weights: Dict[str, float]


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

# from typing import List

# def extract_skills_from_bullets(bullets: List[str], jd_skills: List[str]) -> List[str]:
#     """
#     Very simple rule-based extractor: check if JD skills appear in experience bullets text.
#     """
#     bullets_text = " ".join(bullets).lower()
#     extracted = []
#     for skill in jd_skills:
#         if skill.lower() in bullets_text:
#             extracted.append(skill)
#     return list(set(extracted))


@app.post("/score")
def score_endpoint(body: ScoreIn):
    jd_struct = body.jd or {}
    jd_resp_text = "\n".join(jd_struct.get("responsibilities", [])) or jd_struct.get("raw_summary") or ""
    if not jd_resp_text and body.jd.get("text"):
        jd_resp_text = body.jd["text"]
    jd_vec = embed_texts([jd_resp_text])[0] if jd_resp_text else None

    jd_req_skills = jd_struct.get("required_skills", [])

    rows = []
    for r in body.resumes:
        res_struct = r.get("parsed", {})
        ai_struct = r.get("ai", {})
        ai_pct = int(ai_struct.get("ai_likelihood_percent", 0)) if isinstance(ai_struct, dict) else 0
        ai_pct = max(0, min(100, ai_pct))
        validity_pct = 100 - ai_pct

        # Experience text
        exp_text = "\n".join(res_struct.get("experience_bullets", [])) or r.get("text", "")
        res_vec = embed_texts([exp_text])[0] if exp_text else None

        # Experience similarity
        exp_sim = 0.0
        if jd_vec is not None and res_vec is not None:
            exp_sim = (cosine(jd_vec, res_vec) + 1) / 2.0  # [-1,1] -> [0,1]

        # ✅ Extract resume skills from experience bullets
        extracted_skills = extract_skills_from_bullets(res_struct.get("experience_bullets", []), jd_req_skills)

        # Merge with parsed skills (optional)
        combined_skills = list(set(res_struct.get("skills", [])) | set(extracted_skills))

        # Compute skill overlap
        skill_overlap = skills_overlap_score(jd_req_skills, combined_skills)

        # Trajectory alignment
        traj = trajectory_alignment(jd_struct.get("seniority", "mid"), res_struct.get("seniority", "mid"))

        # Final candidate score
        score = candidate_score(exp_sim, skill_overlap, traj, body.weights)

        rows.append({
            "file": r.get("file"),
            "parsed": res_struct,
            "ai": ai_struct,
            "ai_pct": ai_pct,
            "validity_pct": validity_pct,
            "exp_sim": exp_sim,
            "skill_overlap": skill_overlap,
            "trajectory": traj,
            "score": score,
        })

    rows = sorted(rows, key=lambda x: x["score"], reverse=True)
    return rows


# @app.post("/score")
# def score_endpoint(body: ScoreIn):
#     jd_struct = body.jd or {}
#     jd_resp_text = "\n".join(jd_struct.get("responsibilities", [])) or jd_struct.get("raw_summary") or ""
#     if not jd_resp_text and body.jd.get("text"):
#         jd_resp_text = body.jd["text"]
#     jd_vec = embed_texts([jd_resp_text])[0] if jd_resp_text else None

#     jd_req_skills = jd_struct.get("required_skills", [])

#     rows = []
#     for r in body.resumes:
#         res_struct = r.get("parsed", {})
#         ai_struct = r.get("ai", {})
#         ai_pct = int(ai_struct.get("ai_likelihood_percent", 0)) if isinstance(ai_struct, dict) else 0
#         ai_pct = max(0, min(100, ai_pct))
#         validity_pct = 100 - ai_pct

#         exp_text = "\n".join(res_struct.get("experience_bullets", [])) or r.get("text", "")
#         res_vec = embed_texts([exp_text])[0] if exp_text else None

#         exp_sim = 0.0
#         if jd_vec is not None and res_vec is not None:
#             exp_sim = (cosine(jd_vec, res_vec) + 1) / 2.0  # [-1,1] -> [0,1]

#         skill_overlap = skills_overlap_score(jd_req_skills, res_struct.get("skills", []))
#         traj = trajectory_alignment(jd_struct.get("seniority", "mid"), res_struct.get("seniority", "mid"))

#         score = candidate_score(exp_sim, skill_overlap, traj, body.weights)

#         rows.append({
#             "file": r.get("file"),
#             "parsed": res_struct,
#             "ai": ai_struct,
#             "ai_pct": ai_pct,
#             "validity_pct": validity_pct,
#             "exp_sim": exp_sim,
#             "skill_overlap": skill_overlap,
#             "trajectory": traj,
#             "score": score,
#         })

#     rows = sorted(rows, key=lambda x: x["score"], reverse=True)
#     return rows