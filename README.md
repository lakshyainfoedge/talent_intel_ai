# 🛰️ Talent Intel AI - Intelligent Candidate Scoring Platform

A comprehensive talent intelligence platform that leverages AI to analyze job descriptions and resumes, providing intelligent candidate scoring and ranking for recruiters and hiring managers.

## 🌟 Overview

Talent Intel AI is a modern full-stack application that combines the power of Google's Vertex AI (Gemini 2.0 Flash) with advanced semantic similarity matching to provide:

- **Intelligent Resume Parsing**: Extract structured data from resumes using AI
- **Job Description Analysis**: Parse and understand job requirements from URLs or files
- **Multi-Factor Scoring**: Comprehensive candidate evaluation with transparent scoring
- **AI Content Detection**: Identify AI-generated resume content
- **Interactive Dashboard**: Modern React interface with data visualization
- **Batch Processing**: Handle multiple resumes and job descriptions efficiently

## 🏗️ Architecture

### Backend (FastAPI)

- **Framework**: FastAPI with async support
- **AI Engine**: Google Vertex AI (Gemini 2.0 Flash)
- **Embeddings**: Sentence Transformers for semantic similarity
- **Database**: MongoDB for data persistence
- **File Processing**: Support for PDF, DOCX, and TXT files

### Frontend (React)

- **Framework**: Next.js 15 with React 19
- **Styling**: Tailwind CSS with modern UI components
- **Charts**: Recharts for data visualization
- **File Upload**: Drag-and-drop interface with validation
- **Export**: PDF report generation with jsPDF

### Legacy Applications

- **Streamlit MVP**: Original proof-of-concept with Vertex AI integration
- **SkillSight AI**: Enhanced version with domain intelligence and company analysis

## 🚀 Features

### Core Functionality

- **Job Description Processing**

  - URL-based JD fetching and parsing
  - AI-powered extraction of requirements, skills, and responsibilities
  - Seniority level detection and classification

- **Resume Analysis**

  - Multi-format support (PDF, DOCX, TXT)
  - Structured data extraction (skills, experience, education)
  - AI content detection and validity scoring
  - Seniority and trajectory analysis

- **Intelligent Scoring Algorithm**
  - **Experience Similarity** (30%): Semantic matching using embeddings
  - **Skills Match** (20%): Overlap analysis of required vs candidate skills
  - **Domain Expertise** (30%): Industry and domain alignment
  - **AI Detection Penalty** (-10%): Reduces score for AI-generated content
  - **Trajectory Alignment**: Career progression matching

### Advanced Features

- **Company Intelligence**: Startup vs enterprise classification
- **Domain Matching**: Industry-specific expertise evaluation
- **Batch Processing**: Handle multiple JDs and resumes simultaneously
- **Interactive Feedback**: Real-time weight adjustment based on user feedback
- **Data Visualization**: Comprehensive charts and progress indicators
- **PDF Reports**: Professional candidate evaluation reports

## 📁 Project Structure

```
talent_intel_ai/
├── backend/                    # FastAPI backend
│   └── app/
│       ├── api/               # API routes and endpoints
│       │   └── api_v1/
│       │       ├── endpoints/ # Individual endpoint modules
│       │       │   ├── job_descriptions.py
│       │       │   ├── resumes.py
│       │       │   └── scores.py
│       │       └── api.py     # Main API router
│       ├── core/              # Core configuration
│       │   └── config.py
│       ├── db/                # Database connections
│       │   └── mongodb.py
│       ├── models/            # Data models
│       │   └── base.py
│       ├── main.py            # FastAPI application
│       └── requirements.txt   # Python dependencies
├── frontend/                   # React frontend
│   ├── app/                   # Next.js app directory
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Main dashboard
│   ├── components/            # Reusable UI components
│   │   └── ui/               # Shadcn/ui components
│   ├── lib/                   # Utility functions
│   ├── public/                # Static assets
│   ├── package.json           # Node.js dependencies
│   └── tsconfig.json          # TypeScript configuration
├── app.py                     # Streamlit MVP (Vertex AI)
├── talent_intel_app.py        # SkillSight AI (Enhanced version)
├── app2.py                    # Alternative implementation
├── .env                       # Environment variables
├── service_account.json       # Google Cloud credentials
└── .gitignore                 # Git ignore rules
```

## 🛠️ Setup Instructions

### Prerequisites

- **Python 3.8+**
- **Node.js 18+**
- **MongoDB** (local or cloud)
- **Google Cloud Project** with Vertex AI enabled

### Backend Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd talent_intel_ai
   ```

2. **Set up Python environment**

   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r app/requirements.txt
   ```

3. **Configure environment variables**
   Create `.env` file in the root directory:

   ```env
   GOOGLE_CLOUD_PROJECT=your-project-id
   GOOGLE_CLOUD_REGION=us-central1
   GOOGLE_APPLICATION_CREDENTIALS=./service_account.json
   MONGODB_URL=mongodb://localhost:27017
   DATABASE_NAME=talent_intel_ai
   ```

4. **Set up Google Cloud credentials**

   - Download service account JSON from Google Cloud Console
   - Place it as `service_account.json` in the root directory
   - Enable Vertex AI API in your Google Cloud project

5. **Start the backend server**
   ```bash
   cd backend
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Frontend Setup

1. **Install dependencies**

   ```bash
   cd frontend
   npm install
   ```

2. **Start the development server**

   ```bash
   npm run dev
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Legacy Applications Setup

#### Streamlit MVP

```bash
pip install streamlit google-cloud-aiplatform vertexai pdfminer.six python-docx beautifulsoup4 requests
streamlit run app.py
```

#### SkillSight AI

```bash
pip install sentence-transformers torch
streamlit run talent_intel_app.py
```

## 📖 Usage Guide

### Main Application (React + FastAPI)

1. **Job Description Input**

   - Paste a job description URL in the input field
   - The system will automatically fetch and parse the content

2. **Resume Upload**

   - Drag and drop or select up to 10 resume files
   - Supported formats: PDF, DOCX, TXT
   - Files are validated and processed in batch

3. **Scoring Configuration**

   - Adjust scoring weights using the sliders:
     - Experience Similarity (default: 50%)
     - Skills Match (default: 35%)
     - Trajectory Alignment (default: 15%)

4. **Results Analysis**

   - View ranked candidates with detailed scores
   - Interactive dashboard with visualizations
   - Detailed breakdowns for each candidate
   - AI detection and validity metrics

5. **Export Reports**
   - Generate professional PDF reports
   - Download comprehensive candidate evaluations

### API Endpoints

#### Job Descriptions

```http
POST /api/v1/job-descriptions
Content-Type: application/json
{
  "url": "https://company.com/job-posting"
}
```

#### Resume Upload

```http
POST /api/v1/resumes/upload/batch
Content-Type: multipart/form-data
files: [resume1.pdf, resume2.docx, ...]
```

#### Batch Scoring

```http
POST /api/v1/scores/batch-score
Content-Type: application/json
{
  "jd_id": "job_description_id",
  "resume_ids": ["resume_id_1", "resume_id_2"],
  "weights": {
    "experience": 0.5,
    "skills": 0.35,
    "trajectory": 0.15
  }
}
```

## 🧠 AI Models and Algorithms

### Google Vertex AI Integration

- **Model**: Gemini 2.0 Flash
- **Temperature**: 0.0 for consistent parsing
- **Use Cases**:
  - Resume parsing and structure extraction
  - Job description analysis
  - AI content detection
  - Company classification

### Semantic Similarity

- **Model**: Sentence Transformers (all-MiniLM-L6-v2)
- **Purpose**: Calculate experience similarity between JD and resumes
- **Method**: Cosine similarity on embedded text representations

### Scoring Algorithm

```python
final_score = (
    (experience_weight * experience_similarity) +
    (skills_weight * skills_overlap_ratio) +
    (trajectory_weight * seniority_alignment) +
    domain_bonus - ai_penalty
)
```

## 🔧 Configuration

### Environment Variables

- `GOOGLE_CLOUD_PROJECT`: Your Google Cloud project ID
- `GOOGLE_CLOUD_REGION`: Vertex AI region (default: us-central1)
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account JSON
- `MONGODB_URL`: MongoDB connection string
- `DATABASE_NAME`: Database name for storing data

### Scoring Weights

Default weights can be adjusted in real-time:

- **Experience Similarity**: 50% (semantic matching)
- **Skills Match**: 35% (keyword overlap)
- **Trajectory Alignment**: 15% (seniority matching)

## 📊 Data Models

### Job Description Schema

```json
{
  "title": "string",
  "seniority": "junior|mid|senior|lead|manager|director|executive",
  "required_skills": ["skill1", "skill2"],
  "nice_to_have_skills": ["skill1", "skill2"],
  "responsibilities": ["responsibility1", "responsibility2"],
  "domain": "industry/sector",
  "raw_summary": "string"
}
```

### Resume Schema

```json
{
  "name": "string",
  "titles": ["title1", "title2"],
  "seniority": "junior|mid|senior|lead|manager|director|executive",
  "skills": ["skill1", "skill2"],
  "experience_bullets": ["experience1", "experience2"],
  "education": ["degree1", "degree2"],
  "domains": ["domain1", "domain2"]
}
```

### Scoring Result Schema

```json
{
  "score": 85.5,
  "exp_sim": 0.78,
  "skill_overlap": 0.65,
  "trajectory": 0.9,
  "ai_pct": 15,
  "validity_pct": 85,
  "parsed": {
    /* resume data */
  },
  "ai": {
    /* AI detection details */
  }
}
```

## 🚀 Deployment

### Production Deployment

1. **Backend (FastAPI)**

   ```bash
   # Using Docker
   docker build -t talent-intel-api ./backend
   docker run -p 8000:8000 talent-intel-api

   # Using Gunicorn
   gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
   ```

2. **Frontend (Next.js)**

   ```bash
   npm run build
   npm start

   # Or deploy to Vercel/Netlify
   ```

3. **Environment Setup**
   - Set production environment variables
   - Configure CORS origins for your domain
   - Set up MongoDB Atlas or production database
   - Configure Google Cloud service account

### Docker Deployment

```yaml
# docker-compose.yml
version: "3.8"
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - MONGODB_URL=mongodb://mongo:27017
    depends_on:
      - mongo

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend

  mongo:
    image: mongo:latest
    ports:
      - "27017:27017"
```

## 🧪 Testing

### Backend Testing

```bash
cd backend
pytest tests/
```

### Frontend Testing

```bash
cd frontend
npm test
npm run test:e2e
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in the GitHub repository
- Check the API documentation at `/docs` endpoint
- Review the troubleshooting section below

## 🔍 Troubleshooting

### Common Issues

1. **Google Cloud Authentication**

   ```bash
   # Verify credentials
   gcloud auth application-default login
   export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account.json"
   ```

2. **MongoDB Connection**

   ```bash
   # Check MongoDB status
   mongosh --eval "db.adminCommand('ismaster')"
   ```

3. **File Upload Issues**

   - Ensure file size is under 10MB
   - Check supported formats: PDF, DOCX, TXT
   - Verify CORS settings for file uploads

4. **API Rate Limits**
   - Vertex AI has quotas - monitor usage in Google Cloud Console
   - Implement retry logic for production use

## 📈 Performance Optimization

- **Caching**: Implement Redis for API response caching
- **Database**: Add indexes for frequently queried fields
- **File Processing**: Use background tasks for large file processing
- **Frontend**: Implement lazy loading and code splitting
- **CDN**: Use CDN for static assets in production

## 🔮 Future Enhancements

- [ ] Multi-language resume support
- [ ] Video interview analysis integration
- [ ] Advanced analytics and reporting
- [ ] Integration with ATS systems
- [ ] Mobile application
- [ ] Real-time collaboration features
- [ ] Advanced ML model fine-tuning
- [ ] Bias detection and mitigation tools

---

**Built with ❤️ using React, FastAPI, and Google Vertex AI**
