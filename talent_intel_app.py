# app.py - SkillSight AI (MVP with Domain/Company Intelligence using Gemini only)

import streamlit as st
import requests
import vertexai
from vertexai.generative_models import GenerativeModel, Part, GenerationConfig
from sentence_transformers import SentenceTransformer, util
import torch
import json
import re
import os
from dotenv import load_dotenv
from google.oauth2 import service_account
import json
import base64

# ---------------------------
# Load environment variables
# ---------------------------
load_dotenv(override=True)

# ---------------------------
# Init Vertex with Service Account Creds
# ---------------------------

def _load_service_account_info() -> dict:
    """Load service account info from one of several env vars.
    Priority order:
      1) GOOGLE_APPLICATION_CREDENTIALS (path to JSON file)
      2) GOOGLE_APPLICATION_CREDENTIALS_JSON_B64 (base64-encoded JSON)
      3) GOOGLE_APPLICATION_CREDENTIALS_JSON (raw JSON string)
    """
    # 1) File path
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if creds_path and os.path.exists(creds_path):
        with open(creds_path, "r") as f:
            return json.load(f)

    # 2) Base64 string
    creds_b64 = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON_B64")
    if creds_b64:
        try:
            decoded = base64.b64decode(creds_b64)
            return json.loads(decoded)
        except Exception as e:
            raise ValueError(f"Invalid base64 in GOOGLE_APPLICATION_CREDENTIALS_JSON_B64: {e}")

    # 3) Raw JSON string
    creds_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if creds_json:
        try:
            return json.loads(creds_json)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS_JSON: {e}")

    raise ValueError(
        "No credentials found. Set one of: GOOGLE_APPLICATION_CREDENTIALS, "
        "GOOGLE_APPLICATION_CREDENTIALS_JSON_B64, GOOGLE_APPLICATION_CREDENTIALS_JSON"
    )

try:
    SERVICE_ACCOUNT_INFO = _load_service_account_info()

    # Ensure required fields are present
    required_fields = [
        "type",
        "project_id",
        "private_key_id",
        "private_key",
        "client_email",
        "client_id",
        "auth_uri",
        "token_uri",
    ]
    missing_fields = [f for f in required_fields if f not in SERVICE_ACCOUNT_INFO]
    if missing_fields:
        raise ValueError(f"Missing required service account fields: {', '.join(missing_fields)}")

    credentials = service_account.Credentials.from_service_account_info(SERVICE_ACCOUNT_INFO)
    project_id = SERVICE_ACCOUNT_INFO["project_id"]
except Exception as e:
    st.error(f"❌ Error initializing Google Cloud credentials: {e}")
    st.stop()

vertexai.init(project=project_id, location="us-central1", credentials=credentials)

# ---------------------------
# Gemini Init with system instruction
# ---------------------------

gemini = GenerativeModel(
    model_name="gemini-2.0-flash",
    generation_config=GenerationConfig(
        temperature=0.0,
        top_p=1.0,
        top_k=1,
        candidate_count=1,
        max_output_tokens=2048,
    ),
    system_instruction=Part.from_text(
        """You are an expert AI that parses resumes, job descriptions, and company details. 
Always return only valid JSON matching the expected schema of the task.

Schemas:
- Resume Parsing: {
    "skills": [string],
    "experience": [
        {"company": string, "role": string, "years": number, "domain": string}
    ],
    "domains": [string]
}

- JD Parsing: {
    "responsibilities": [string],
    "required_skills": [string],
    "domain": string
}

- AI Detection: {
    "ai_likelihood": number
}

- Company Classification: {
    "startup": boolean,
    "type": "product" | "service" | "unknown"
}

Never include explanations, only output valid JSON."""
    ),
)

embedder = SentenceTransformer("all-MiniLM-L6-v2")

st.set_page_config(page_title="SkillSight AI", layout="wide")
st.title("🛰️ SkillSight AI — Candidate Scoring MVP (Domain + Company Intelligence + Batch Mode)")

# ---------------------------
# Helpers
# ---------------------------

def fetch_jd_text(url: str) -> str:
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    return r.text[:5000]

def parse_with_gemini(prompt: str, text: str) -> dict:
    response = gemini.generate_content([prompt, Part.from_text(text)])
    raw = response.candidates[0].content.parts[0].text.strip()

    # 🔧 Clean output (remove markdown wrappers like ```json ... ```)
    cleaned = re.sub(r"^```(json)?", "", raw)
    cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except Exception:
        # fallback: show raw text if JSON decoding fails
        return {"error": "invalid_json", "raw": raw}

def get_embedding(text: str):
    return embedder.encode(text, convert_to_tensor=True)

def compute_similarity(text1: str, text2: str):
    emb1, emb2 = get_embedding(text1), get_embedding(text2)
    return float(util.pytorch_cos_sim(emb1, emb2).item())

# ---------------------------
# Company Intelligence using Gemini
# ---------------------------

def lookup_company_info(company: str) -> dict:
    """
    Uses Gemini to classify company as startup/enterprise and product/service.
    """
    prompt = f"""
    Analyze the company name: \"{company}\" and classify into JSON with fields:
    {{
        "startup": true/false,
        "type": "product" or "service"
    }}
    Return only valid JSON.
    """
    try:
        result = parse_with_gemini(prompt, company)
        return json.loads(result)
    except Exception as e:
        print("Gemini company info error:", e)
        return {"startup": False, "type": "unknown"}

# ---------------------------
# UI
# ---------------------------

st.sidebar.header("⚙️ Batch Mode Settings")
batch_mode = st.sidebar.checkbox("Enable Batch JD Upload", value=False)

if batch_mode:
    jd_files = st.file_uploader("📑 Upload multiple Job Descriptions (txt/pdf)", accept_multiple_files=True)
else:
    jd_url = st.text_input("🔗 Paste Job Description URL")

resumes = st.file_uploader("📄 Upload candidate resumes", accept_multiple_files=True)

# Process JDs
job_descriptions = []
if batch_mode and jd_files:
    for jd in jd_files:
        text = jd.read().decode("utf-8", errors="ignore")[:5000]
        structured = parse_with_gemini(
            "Extract responsibilities, required skills, and domain (industry/sector) as JSON.",
            text,
        )
        job_descriptions.append({"name": jd.name, "raw": text, "structured": structured})
elif not batch_mode and "jd_url" in locals() and jd_url:
    jd_raw = fetch_jd_text(jd_url)
    structured = parse_with_gemini(
        "Extract responsibilities, required skills, and domain (industry/sector) as JSON.",
        jd_raw,
    )
    job_descriptions.append({"name": jd_url, "raw": jd_raw, "structured": structured})

# Process resumes vs JDs
if job_descriptions and resumes:
    for jd in job_descriptions:
        st.subheader(f"📋 Job Description Extracted — {jd['name']}")
        st.json(jd["structured"])

        candidates = []
        for resume in resumes:
            with st.spinner(f"Processing {resume.name}..."):
                text = resume.read().decode("utf-8", errors="ignore")[:5000]

                # Parse resume
                resume_struct = parse_with_gemini(
                    "Extract candidate experience, skills, companies worked at, and domain expertise as JSON.",
                    text,
                )
                if not isinstance(resume_struct, dict):
                    resume_struct = {"skills": [], "experience": []}

                # AI detection
                ai_detect = parse_with_gemini(
                    "Estimate the likelihood (0-100) that the following resume was written by AI.",
                    text,
                )
                try:
                    ai_score = int(re.findall(r"\\d+", ai_detect)[0])
                except Exception:
                    ai_score = 50

                # Compute similarity
                sim = compute_similarity(jd["raw"], text)
                exp_score = round(sim * 100, 2)

                # Domain matching
                domain_match = 0
                jd_struct = json.loads(jd["structured"]) if isinstance(jd["structured"], str) else jd["structured"]
                if "domain" in jd_struct:
                    jd_domain = jd_struct.get("domain", "").lower()
                    candidate_domains = [exp.get("domain", "").lower() for exp in resume_struct.get("experience", [])]
                    if candidate_domains:
                        domain_match = int((sum(1 for d in candidate_domains if jd_domain in d) / len(candidate_domains)) * 100)

                # Company intelligence (startup/product/service)
                company_insights = []
                for exp in resume_struct.get("experience", []):
                    company_name = exp.get("company", "")
                    if company_name:
                        company_info = lookup_company_info(company_name)
                        company_insights.append({company_name: company_info})

                # Domain-weighted adjustment (require at least 50% domain match for bonus)
                domain_bonus = 0
                if domain_match >= 50:
                    domain_bonus = 10

                # Final Score (weighted)
                final_score = (
                    (0.30 * exp_score)
                    + (0.20 * len(resume_struct.get("skills", [])))
                    + (0.30 * domain_match)
                    - (0.10 * (ai_score / 100) * 100)
                    + domain_bonus
                )
                final_score = max(0, min(100, round(final_score, 2)))

                candidates.append({
                    "name": resume.name,
                    "score": final_score,
                    "experience_score": exp_score,
                    "domain_match": domain_match,
                    "ai_likelihood": ai_score,
                    "resume_struct": resume_struct,
                    "company_insights": company_insights
                })

        st.subheader("🏆 Top 5 Candidates")
        candidates = sorted(candidates, key=lambda x: x["score"], reverse=True)[:5]

        for c in candidates:
            st.markdown(f"### {c['name']}")
            st.metric("Candidate Score", f"{c['score']} / 100")
            st.progress(c["score"] / 100)

            st.write("📊 Breakdown:")
            st.write(f"- Experience Match: {c['experience_score']}%")
            st.write(f"- Domain Match: {c['domain_match']}%")
            st.write(f"- Resume Validity: {100 - c['ai_likelihood']}% Human")

            st.write("🧑 Resume Parsed Data:")
            st.json(c["resume_struct"])

            st.write("🏢 Company Insights:")
            st.json(c["company_insights"])
