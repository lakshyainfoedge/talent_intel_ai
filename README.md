# Talent Intel AI

An AI-powered talent intelligence platform that helps recruiters find the best candidates by analyzing resumes against job descriptions using advanced NLP and machine learning.

## 🚀 Features

- **AI-Powered Job Analysis**: Extract requirements from job posting URLs using Google Vertex AI
- **Smart Resume Parsing**: Parse resumes in multiple formats (PDF, DOCX, DOC, TXT)
- **Multi-Factor Candidate Scoring**: Experience, skills, seniority level, and AI validation
- **Modern 3-Step Wizard UI**: Job Description → Resume Upload → Results Analysis
- **Interactive Data Visualization**: Charts and graphs for candidate analysis
- **AI Content Detection**: Identify AI-generated or heavily edited resumes
- **Batch Processing**: Handle multiple resumes efficiently

## 🏗️ Architecture

- **Backend**: FastAPI with MongoDB
- **Frontend**: React 18 with TypeScript and Tailwind CSS
- **AI/ML**: Google Vertex AI (Gemini 2.0 Flash) for content analysis
- **Database**: MongoDB for storing job descriptions, resumes, and scores

## 📋 Prerequisites

- Python 3.8+
- Node.js 16+
- MongoDB (local or cloud)
- Google Cloud Project with Vertex AI enabled

## 🛠️ Installation & Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd talent_intel_ai
```

### 2. Backend Setup

#### Install Python Dependencies

```bash
pip install -r requirements.txt
```

#### Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_REGION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/service-account.json

# MongoDB Configuration
MONGODB_URL=mongodb://localhost:27017
MONGODB_DATABASE=talent_intel

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
```

#### Set up Google Cloud Authentication

1. Create a service account in Google Cloud Console
2. Download the JSON key file
3. Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable

### 3. Frontend Setup

#### Navigate to Frontend Directory

```bash
cd frontend
```

#### Install Node Dependencies

```bash
npm install
```

#### Configure Frontend Environment (Optional)

Create `frontend/.env` file:

```env
REACT_APP_API_URL=http://localhost:8000/api/v1
```

## 🚀 Running the Application

### 1. Start MongoDB

Make sure MongoDB is running on your system:

```bash
# If using local MongoDB
mongod

# Or use MongoDB Atlas (cloud) - update MONGODB_URL in .env
```

### 2. Start the Backend Server

```bash
# From project root
cd backend
python -m app.main

# Or using uvicorn directly
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend API will be available at `http://localhost:8000`

### 3. Start the Frontend Development Server

```bash
# In a new terminal
cd frontend
npm start
```

The frontend will be available at `http://localhost:3000`

## 📱 Usage Guide

### Step 1: Job Description Analysis

1. Open `http://localhost:3000` in your browser
2. Paste a job posting URL (LinkedIn, Indeed, Glassdoor, etc.)
3. Click "Analyze Job Description"
4. AI extracts skills, requirements, and responsibilities

### Step 2: Resume Upload

1. Drag and drop multiple resume files or click to browse
2. Supported formats: PDF, DOCX, DOC, TXT (max 10MB each)
3. Click "Process Resumes" to upload and parse with AI

### Step 3: Results Analysis

1. View ranked candidates with match scores
2. Interactive charts showing candidate distribution
3. Click on candidates for detailed analysis
4. AI validation scores to detect generated content

## 🔧 API Endpoints

### Job Descriptions

- `POST /api/v1/job-descriptions` - Create from URL
- `GET /api/v1/job-descriptions/{id}` - Get specific job description
- `GET /api/v1/job-descriptions` - List all job descriptions

### Resumes

- `POST /api/v1/resumes/upload` - Upload single resume
- `POST /api/v1/resumes/upload/batch` - Upload multiple resumes
- `GET /api/v1/resumes/{id}` - Get specific resume
- `GET /api/v1/resumes` - List all resumes

### Scoring

- `POST /api/v1/scores` - Calculate single score
- `POST /api/v1/scores/batch-score` - Batch score multiple candidates
- `GET /api/v1/scores/{id}` - Get specific score

## 🏭 Production Deployment

### Backend Production

```bash
# Install production dependencies
pip install gunicorn

# Run with Gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend Production

```bash
cd frontend
npm run build

# Serve with a static file server
npx serve -s build -l 3000
```

## 🧪 Testing

### Backend Testing

```bash
# Run tests (if you have them)
pytest

# Test API endpoints
curl -X POST "http://localhost:8000/api/v1/job-descriptions" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com/job-posting"}'
```

### Frontend Testing

```bash
cd frontend
npm test
```

## 🔍 Troubleshooting

### Common Issues

1. **Google Cloud Authentication Errors**

   - Verify service account JSON file path
   - Check Vertex AI API is enabled
   - Ensure correct project ID in environment

2. **MongoDB Connection Issues**

   - Check MongoDB is running
   - Verify connection string in `.env`
   - Check firewall settings

3. **CORS Errors**

   - Backend already configured for CORS
   - Check frontend API URL configuration

4. **File Upload Issues**
   - Check file size limits (10MB max)
   - Verify supported formats
   - Check backend file processing

## 📊 Technology Stack

### Backend

- **FastAPI**: Modern Python web framework
- **MongoDB**: Document database with Motor (async driver)
- **Google Vertex AI**: Gemini 2.0 Flash for content analysis
- **Pydantic**: Data validation and serialization
- **BeautifulSoup**: Web scraping for job descriptions

### Frontend

- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Heroicons**: Beautiful SVG icons
- **React Dropzone**: File upload with drag-and-drop
- **Recharts**: Data visualization library
- **Axios**: HTTP client for API calls

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section
2. Review API documentation
3. Check browser console for frontend issues
4. Review backend logs for API issues
