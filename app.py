# app.py — Talent Intel AI (Streamlit MVP using Vertex AI Gemini)
# ----------------------------------------------------------------------------
# What this MVP does
# - Input: JD URL + one or more resumes (PDF/DOCX/TXT)
# - Uses Vertex AI Gemini to parse JD & Resumes into structured JSON
# - Uses Vertex AI Text Embeddings (text-embedding-004) for similarity
# - Computes a transparent 0–100 Candidate Score with a breakdown:
#     * Experience Similarity (embeddings)
#     * Skill Match (overlap of parsed skills)
#     * Trajectory Alignment (title seniority vs JD level)
# - Uses Gemini to estimate AI-generated likelihood for resume text
# - UI shows meters for Candidate Score and Resume Validity % (100 - AI% )
# - In-session feedback (👍/👎) nudges weights
# ----------------------------------------------------------------------------
# Prereqs
#   pip install streamlit google-cloud-aiplatform vertexai pdfminer.six python-docx beautifulsoup4 requests
#   gcloud auth application-default login   (or set GOOGLE_APPLICATION_CREDENTIALS)
#   export GOOGLE_CLOUD_PROJECT="your-project"; export GOOGLE_CLOUD_REGION="us-central1"
# Run
#   streamlit run app.py
# ----------------------------------------------------------------------------

import io
import os
import re
import json
import time
import math
import hashlib
from typing import Dict, List, Tuple

import requests
from bs4 import BeautifulSoup

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

import streamlit as st

# Load environment variables from .env
from dotenv import load_dotenv
load_dotenv()

# Parsers
try:
    from pdfminer.high_level import extract_text as pdf_extract_text
except Exception:
    pdf_extract_text = None

try:
    import docx
except Exception:
    docx = None

# Vertex AI
import vertexai
from vertexai.generative_models import GenerativeModel, Part

# Embeddings model (handle both GA and preview import locations)
try:
    from vertexai.language_models import TextEmbeddingModel
except Exception:
    from vertexai.preview.language_models import TextEmbeddingModel  # type: ignore

# -------------------------------
# Config & Session State
# -------------------------------

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")
EMBED_MODEL_NAME = "text-embedding-004"
GEMINI_MODEL_NAME = "gemini-2.0-flash"

st.set_page_config(page_title="Talent Intel AI — MVP", page_icon="🛰️", layout="wide")
st.title("🛰️ Talent Intel AI — Candidate Scoring & Resume Trust (MVP)")
st.caption("Paste a JD URL, upload resumes, then get a ranked shortlist with explainable scores.")

if "weights" not in st.session_state:
    st.session_state.weights = {
        "experience": 0.5,   # embedding similarity
        "skills": 0.35,      # overlap ratio
        "trajectory": 0.15,  # seniority alignment
    }

if "feedback_count" not in st.session_state:
    st.session_state.feedback_count = 0

# -------------------------------
# Utility
# -------------------------------

@st.cache_resource(show_spinner=False)
def init_vertex() -> Tuple[GenerativeModel, TextEmbeddingModel]:
    if not PROJECT_ID:
        st.warning("GOOGLE_CLOUD_PROJECT not set — set your GCP project in env.")
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    gemini = GenerativeModel(GEMINI_MODEL_NAME)
    emb = TextEmbeddingModel.from_pretrained(EMBED_MODEL_NAME)
    return gemini, emb


def _normalize_text(t: str) -> str:
    t = t.replace("\xa0", " ")
    t = re.sub(r"\s+", " ", t)
    return t.strip()


@st.cache_data(show_spinner=False)
def fetch_jd_text(url: str) -> str:
    headers = {"User-Agent": "TalentIntelAI/1.0 (+demo)"}
    r = requests.get(url, headers=headers, timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "header", "footer", "nav", "form"]):
        tag.decompose()
    text_nodes = [x.get_text(" ") for x in soup.find_all(["h1", "h2", "h3", "p", "li"]) ]
    text = "\n".join([_normalize_text(t) for t in text_nodes if t and _normalize_text(t)])
    # crude dedupe
    uniq, seen = [], set()
    for p in text.split("\n"):
        key = hashlib.md5(p.encode("utf-8")).hexdigest()[:10]
        if key not in seen:
            seen.add(key); uniq.append(p)
    return "\n".join(uniq)[:20000]  # safety limit


def read_resume_file(file) -> str:
    name = file.name.lower()
    data = file.read()
    # Probe & reset pointer for re-reads in Streamlit
    try:
        file.seek(0)
    except Exception:
        pass

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
    # Fallback assume utf-8 text
    try:
        return _normalize_text(data.decode("utf-8", errors="ignore"))
    except Exception:
        return ""


@st.cache_data(show_spinner=False)
def embed_texts(_emb_model: TextEmbeddingModel, texts: List[str]) -> np.ndarray:
    # Call Vertex embeddings in batches to stay within quotas
    vectors: List[List[float]] = []
    B = 32
    for i in range(0, len(texts), B):
        batch = texts[i:i+B]
        res = _emb_model.get_embeddings(batch)
        for e in res:
            vectors.append(e.values)
    return np.array(vectors, dtype=np.float32)


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    a = a.reshape(1, -1); b = b.reshape(1, -1)
    return float(cosine_similarity(a, b)[0, 0])


# -------------------------------
# Gemini Prompts
# -------------------------------

JD_PROMPT = (
    """
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
)

RESUME_PROMPT = (
    """
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
)

AI_DETECT_PROMPT = (
    """
You are an AI-content auditor. Estimate the likelihood that the text was generated or heavily edited by an LLM.
Return a STRICT JSON like:
{
  "ai_likelihood_percent": number (0-100 integer),
  "rationale": string (short),
  "flags": string[] (patterns such as generic phrasing, templated bullets, low-specificity)
}
Only output JSON. No markdown. No commentary.
"""
)

# -------------------------------
# Scoring Functions
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
    # Perfect if equal; slight penalty if off by 1; larger penalty otherwise
    diff = abs(a - b)
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.8
    if diff == 2:
        return 0.5
    return 0.25


def candidate_score(exp_sim: float, skill_overlap: float, traj: float, w: Dict[str, float]) -> float:
    score = (
        w["experience"] * exp_sim +
        w["skills"] * skill_overlap +
        w["trajectory"] * traj
    )
    return float(max(0.0, min(1.0, score))) * 100.0


# -------------------------------
# Gemini calls
# -------------------------------

def gemini_json(gemini: GenerativeModel, system_prompt: str, text: str) -> Dict:
    resp = gemini.generate_content([system_prompt, Part.from_text(text)], safety_settings=None)
    raw = resp.candidates[0].content.parts[0].text if resp and resp.candidates else "{}"
    # Normalize typical JSON formatting quirks
    raw = raw.strip().strip("` ")
    try:
        return json.loads(raw)
    except Exception:
        # best-effort repair: attempt to find first/last braces
        start = raw.find("{"); end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(raw[start:end+1])
            except Exception:
                pass
    return {}


# -------------------------------
# UI: Inputs
# -------------------------------

with st.sidebar:
    st.header("Settings")
    st.write("Adjust scoring weights (these reset on refresh).")
    w_exp = st.slider("Experience Similarity", 0.0, 1.0, st.session_state.weights["experience"], 0.05)
    w_sk = st.slider("Skill Match", 0.0, 1.0, st.session_state.weights["skills"], 0.05)
    w_tr = st.slider("Trajectory Alignment", 0.0, 1.0, st.session_state.weights["trajectory"], 0.05)
    tot = w_exp + w_sk + w_tr
    if tot == 0:
        st.warning("Weights sum to 0 — adjust sliders.")
    else:
        st.session_state.weights = {"experience": w_exp/tot, "skills": w_sk/tot, "trajectory": w_tr/tot}

jd_url = st.text_input("🔗 Paste Job Description URL")
resumes = st.file_uploader("📄 Upload candidate resumes (PDF, DOCX, TXT)", type=["pdf","docx","doc","txt"], accept_multiple_files=True)

if jd_url:
    with st.spinner("Fetching JD from URL…"):
        try:
            jd_text = fetch_jd_text(jd_url)
            st.success("JD fetched.")
        except Exception as e:
            st.error(f"Failed to fetch JD: {e}")
            jd_text = ""
    with st.expander("Preview JD Text", expanded=False):
        st.write(jd_text[:4000] + ("…" if len(jd_text) > 4000 else ""))
else:
    jd_text = ""


# -------------------------------
# Process Button
# -------------------------------

process = st.button("⚡ Process Candidates", type="primary", disabled=not (jd_text and resumes))

if process:
    gemini, emb_model = init_vertex()

    # Parse JD via Gemini
    with st.spinner("Analyzing JD with Gemini…"):
        jd_struct = gemini_json(gemini, JD_PROMPT, jd_text)
        if not jd_struct:
            st.warning("JD parsing returned empty JSON. Proceeding with raw text only.")
        st.subheader("📋 JD Structure")
        st.json(jd_struct)

    # Prepare JD embeddings on the responsibilities (or full text as fallback)
    jd_resp_text = "\n".join(jd_struct.get("responsibilities", [])) if jd_struct else jd_text
    if not jd_resp_text:
        jd_resp_text = jd_text
    jd_vec = embed_texts(emb_model, [jd_resp_text])[0]

    # JD required skills for skill overlap
    jd_req_skills = jd_struct.get("required_skills", []) if jd_struct else []

    rows = []

    for file in resumes:
        with st.spinner(f"Processing {file.name}…"):
            res_text = read_resume_file(file)
            if not res_text:
                st.error(f"Could not parse text from {file.name}")
                continue

            # Parse resume via Gemini
            res_struct = gemini_json(gemini, RESUME_PROMPT, res_text)

            # AI detection via Gemini
            ai_struct = gemini_json(gemini, AI_DETECT_PROMPT, res_text)
            ai_pct = int(ai_struct.get("ai_likelihood_percent", 0))
            ai_pct = max(0, min(100, ai_pct))
            validity_pct = 100 - ai_pct

            # Experience similarity: embeddings similarity between JD responsibilities and resume experience bullets (or full resume)
            exp_text = "\n".join(res_struct.get("experience_bullets", [])) if res_struct else res_text
            res_vec = embed_texts(emb_model, [exp_text])[0]
            exp_sim = (cosine(jd_vec, res_vec) + 1) / 2.0  # map [-1,1] -> [0,1]

            # Skill overlap
            skill_overlap = skills_overlap_score(jd_req_skills, res_struct.get("skills", []) if res_struct else [])

            # Trajectory alignment
            traj = trajectory_alignment(jd_struct.get("seniority", "mid") if jd_struct else "mid",
                                        res_struct.get("seniority", "mid") if res_struct else "mid")

            score = candidate_score(exp_sim, skill_overlap, traj, st.session_state.weights)

            rows.append({
                "file": file.name,
                "parsed": res_struct,
                "ai": ai_struct,
                "ai_pct": ai_pct,
                "validity_pct": validity_pct,
                "exp_sim": exp_sim,
                "skill_overlap": skill_overlap,
                "trajectory": traj,
                "score": score,
            })

    # Rank and Display
    if rows:
        rows = sorted(rows, key=lambda r: r["score"], reverse=True)
        st.subheader("🏆 Ranked Candidates")

        for i, r in enumerate(rows, 1):
            with st.container(border=True):
                st.markdown(f"### #{i} — {r['file']}")
                c1, c2, c3, c4 = st.columns([1.2, 1, 1, 1])
                with c1:
                    st.metric("Candidate Score", f"{r['score']:.1f} / 100")
                    st.progress(r["score"] / 100.0)
                with c2:
                    st.metric("Experience Similarity", f"{r['exp_sim']*100:.0f}%")
                    st.progress(r["exp_sim"])
                with c3:
                    st.metric("Skill Match", f"{r['skill_overlap']*100:.0f}%")
                    st.progress(r["skill_overlap"])
                with c4:
                    st.metric("Trajectory Alignment", f"{int(r['trajectory']*100)}%")
                    st.progress(r["trajectory"])

                st.markdown("#### 🤖 Resume Validity Meter")
                st.metric("Validity (higher is better)", f"{r['validity_pct']}%")
                st.progress(r["validity_pct"] / 100.0)
                with st.expander("AI-detection details"):
                    st.json(r["ai"])  # shows rationale & flags

                with st.expander("Parsed Resume (structured)"):
                    st.json(r["parsed"])  # titles, skills, bullets, education

                # Feedback buttons to nudge weights during session
                fb1, fb2 = st.columns(2)
                with fb1:
                    if st.button(f"👍 Relevant — boost this profile", key=f"up_{i}"):
                        st.session_state.feedback_count += 1
                        # slightly increase weight on strongest signal for this resume
                        strongest = max([("experience", r['exp_sim']), ("skills", r['skill_overlap']), ("trajectory", r['trajectory'])], key=lambda x: x[1])[0]
                        w = st.session_state.weights
                        w[strongest] = min(1.5 * w[strongest], 1.0)
                        s = sum(w.values());
                        for k in w: w[k] /= s
                        st.rerun()
                with fb2:
                    if st.button(f"👎 Not relevant — reduce similar", key=f"down_{i}"):
                        st.session_state.feedback_count += 1
                        weakest = min([("experience", r['exp_sim']), ("skills", r['skill_overlap']), ("trajectory", r['trajectory'])], key=lambda x: x[1])[0]
                        w = st.session_state.weights
                        w[weakest] = max(0.7 * w[weakest], 0.05)
                        s = sum(w.values());
                        for k in w: w[k] /= s
                        st.rerun()

    else:
        st.info("No rows to display yet.")

# Footer note
st.markdown("---")
st.caption("MVP demo • Not for production use. Ensure JD and resumes do not include sensitive PIIs without consent.")
