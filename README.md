# � Talent Intelligence AI

![Python](https://img.shields.io/badge/Python-3.9%2B-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-green?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)
![MongoDB](https://img.shields.io/badge/MongoDB-4.4%2B-green?style=for-the-badge&logo=mongodb)
![Google Cloud](https://img.shields.io/badge/Vertex_AI-Gemini-blue?style=for-the-badge&logo=google-cloud)

An AI-powered platform that automates the recruitment workflow by intelligently parsing job descriptions, processing resumes, and scoring candidates based on skills, experience, and career trajectory.

<!-- Placeholder for a GIF of the app in action -->

_![App Demo GIF](./docs/demo.gif)_

## 📋 Table of Contents

- [✨ Features](#-features)
- [🛠️ Tech Stack](#-tech-stack)
- [🚀 Getting Started](#-getting-started)
- [API Reference](#api-reference)
- [Workflow Engine](#-workflow-engine)
- [Project Structure](#-project-structure)

## ✨ Features

- **AI-Powered Parsing**: Uses Google's Gemini AI to extract structured data from job descriptions (via URL) and resumes (PDF, DOCX).
- **Multi-Factor Scoring**: Ranks candidates using a weighted algorithm based on semantic experience matching, skill overlap, and career trajectory analysis.
- **Batch Processing**: Upload and analyze multiple resumes at once.
- **Interactive Dashboard**: A modern React UI to visualize candidate rankings, compare scores, and review detailed results.
- **Dynamic Weighting**: Adjust the importance of experience, skills, and trajectory in real-time to fine-tune candidate scoring.
- **PDF Reporting**: Download a professional, ranked report of all candidates.

## 🛠️ Tech Stack

| Component        | Technology                                           |
| :--------------- | :--------------------------------------------------- |
| **Backend**      | `Python`, `FastAPI`, `Uvicorn`                       |
| **Frontend**     | `React 18`, `TypeScript`, `Next.js`, `Tailwind CSS`  |
| **Database**     | `MongoDB`                                            |
| **AI & ML**      | `Google Vertex AI (Gemini)`, `Sentence Transformers` |
| **File Parsing** | `pdfminer.six`, `python-docx`                        |
| **Deployment**   | (Ready for Dockerization)                            |

## 🚀 Getting Started

Follow these instructions to get the project running on your local machine.

### Prerequisites

- Python 3.9+
- Node.js 18+
- MongoDB instance (local or cloud)
- Google Cloud account with Vertex AI enabled.

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows, use `venv\Scripts\activate`

# Install dependencies
pip install -r app/requirements.txt

# Create a .env file in `backend/app` and add your credentials
# (see .env.example for template)
cp app/.env.example app/.env
# nano app/.env

# Run the server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup

```bash
# Open a new terminal and navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

Your application should now be running!

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## API Reference

The backend exposes the following RESTful endpoints:

| Method | Endpoint                       | Description                               |
| :----- | :----------------------------- | :---------------------------------------- |
| `POST` | `/api/v1/job-descriptions`     | Analyzes a JD from a URL and saves it.    |
| `POST` | `/api/v1/resumes/upload/batch` | Uploads and processes a batch of resumes. |
| `POST` | `/api/v1/scores/batch-score`   | Scores a batch of resumes against a JD.   |

## 🧠 Workflow Engine

<details>
<summary>Click to see a deep dive into the project's internal workflow</summary>

Let's break down the entire workflow of your project in greater detail, from the moment a user interacts with the interface to the final ranked results.

### Step 1: Frontend Interaction & State Management (in `frontend/app/page.tsx`)

When you land on the page, the React application initializes its state using `useState` hooks. This manages:

- **Inputs**: The job description URL (`jdUrl`) and the list of uploaded resume files (`files`).
- **UI State**: Loading indicators (`loading`), the current processing phase (`phase`), and status messages (`status`) to give you real-time feedback.
- **Scoring Weights**: The values for experience (`wExp`), skills (`wSk`), and trajectory (`wTr`) are controlled by sliders. A `useMemo` hook recalculates the normalized weights whenever you adjust a slider, ensuring they always add up to 100%.
- **Data**: The processed job description (`jdStruct`) and the final candidate results (`results`) are stored here once fetched from the backend.

### Step 2: Kicking Off the Process (`handleProcess` function)

When you click "Process Candidates," the `handleProcess` async function orchestrates the entire workflow by making a series of `fetch` calls to your FastAPI backend. It executes these steps in a specific order:

1.  **Analyze Job Description**: It makes a `POST` request to `http://localhost:8000/api/v1/job-descriptions` with the URL you provided.
2.  **Upload Resumes**: It takes the list of files, bundles them into `FormData`, and sends them in a `POST` request to `http://localhost:8000/api/v1/resumes/upload/batch`.
3.  **Score Candidates**: Once it receives the IDs for the processed job description and resumes, it makes a final `POST` request to `http://localhost:8000/api/v1/scores/batch-score`. This request includes the IDs and the normalized scoring weights.

Throughout this process, it updates the `loading`, `phase`, and `status` states to show you exactly what's happening (e.g., "Analyzing JD...", "Uploading and processing 5 resume(s)...").

### Step 3: Backend Logic - The FastAPI Endpoints

This is where the core AI and data processing happens.

#### A. Job Description Endpoint (`job_descriptions.py`)

- Receives the URL from the frontend.
- Uses a library like `requests` and `BeautifulSoup4` to fetch and parse the HTML content of the job page, extracting the main text.
- This text is then passed to a **Google Gemini** prompt, which is engineered to extract structured information like job title, required skills, years of experience, and key responsibilities.
- The structured JSON output from Gemini is saved as a new document in your **MongoDB** database. The unique ID of this document is returned to the frontend.

#### B. Resume Upload Endpoint (`resumes.py`)

- This endpoint is designed to handle multiple file uploads at once.
- It iterates through each uploaded file. Based on the file type (`.pdf`, `.docx`), it uses libraries like `pdfminer.six` or `python-docx` to extract the raw text.
- Similar to the job description, the raw text of each resume is sent to **Google Gemini** with a prompt designed to parse it into a structured format (e.g., name, skills, work history, education).
- Each parsed resume is stored as a document in MongoDB, and their new IDs are collected and returned to the frontend.

#### C. Scoring Endpoint (`scores.py`)

This is the most complex part of the backend.

- It receives the job description ID, a list of resume IDs, and the scoring weights.
- It fetches the corresponding structured data from MongoDB.
- **Experience Scoring**: It takes the work history sections from the job description and a resume. Using a **Sentence Transformer** model (like `all-MiniLM-L6-v2`), it converts these texts into numerical vectors (embeddings). It then calculates the **cosine similarity** between these vectors to get a score from 0 to 1, representing how semantically similar the experiences are.
- **Skill Scoring**: It compares the list of required skills from the job description with the skills extracted from the resume and calculates an overlap score.
- **Trajectory Scoring**: It analyzes the progression of job titles and seniority levels in the resume to assess career growth, comparing it to the seniority level of the target job.
- **Final Calculation**: It combines these individual scores using the weights you provided from the frontend. For example: `Final Score = (exp_sim * wExp) + (skill_overlap * wSk) + (traj_score * wTr)`.
- The final, ranked list of candidates with their detailed score breakdowns is returned as a JSON array.

### Step 4: Visualizing Results and Reporting

- The frontend's `handleProcess` function receives the final JSON array and updates the `results` state using `setResults`.
- This state change automatically triggers a re-render in React:
  - The **Recharts** area chart is populated with the new data, creating a visual comparison of all candidates across the different scoring factors.
  - The "Ranked Candidates" section maps over the `results` array to display a detailed `Card` for each candidate, showing their overall score, a breakdown with progress bars, and extracted details like top skills.
- If you click **"Download Report,"** the `downloadPdfReport` function uses the `jsPDF` library to generate a PDF on the fly in your browser, creating a professional-looking table of the ranked candidates that you can save or share.

</details>

## 📂 Project Structure

```
.talent_intel_ai/
├── backend/
│   ├── app/
│   │   ├── api/         # API endpoint routers
│   │   ├── core/        # Core logic (scoring, parsing)
│   │   ├── db/          # Database models and connection
│   │   ├── main.py      # FastAPI app entrypoint
│   │   └── requirements.txt
│   └── .env.example   # Environment variable template
├── frontend/
│   ├── app/           # Next.js app directory
│   ├── components/    # Reusable React components
│   ├── public/        # Static assets
│   └── ...
└── README.md
```

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
