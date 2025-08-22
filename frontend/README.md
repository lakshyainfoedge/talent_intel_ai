# Talent Intel AI - Frontend

A modern React frontend for the AI-powered talent intelligence platform that helps recruiters find the best candidates by analyzing resumes against job descriptions.

## Features

- **3-Step Wizard Interface**: Job Description → Resume Upload → Results Analysis
- **AI-Powered Job Analysis**: Extract requirements from job posting URLs
- **Drag-and-Drop Resume Upload**: Support for PDF, DOCX, DOC, and TXT files
- **Smart Candidate Ranking**: Multi-factor scoring with AI validation
- **Interactive Data Visualization**: Charts and graphs for candidate analysis
- **Modern UI/UX**: Built with Tailwind CSS and Heroicons

## Prerequisites

- Node.js 16+ and npm
- Backend API running on `http://localhost:8000`

## Installation

1. **Install dependencies:**

   ```bash
   cd frontend
   npm install
   ```

2. **Configure environment (optional):**
   Create `.env` file to customize API URL:
   ```env
   REACT_APP_API_URL=http://localhost:8000/api/v1
   ```

## Running the Application

1. **Start the development server:**

   ```bash
   npm start
   ```

2. **Open your browser:**
   Navigate to `http://localhost:3000`

## Usage Guide

### Step 1: Job Description Analysis

- Paste a job posting URL (LinkedIn, Indeed, Glassdoor, etc.)
- AI extracts skills, requirements, and responsibilities
- Creates a comprehensive job profile for matching

### Step 2: Resume Upload

- Drag and drop multiple resume files
- Supports PDF, DOCX, DOC, and TXT formats
- AI parses each resume for skills and experience
- Maximum file size: 10MB per resume

### Step 3: Results Analysis

- View ranked candidates with match scores
- Interactive charts showing candidate distribution
- Detailed breakdown of experience, skills, and level matching
- AI validation scores to detect generated content
- Click on candidates for detailed analysis

## Key Components

- **`App.tsx`**: Main application with wizard state management
- **`JobDescriptionStep.tsx`**: URL input and job analysis
- **`ResumeUploadStep.tsx`**: File upload with drag-and-drop
- **`ResultsStep.tsx`**: Candidate rankings and visualizations
- **`ProgressBar.tsx`**: Step navigation indicator
- **`services/api.ts`**: Backend API integration

## API Integration

The frontend connects to your FastAPI backend through these endpoints:

- `POST /api/v1/job-descriptions` - Create job description from URL
- `POST /api/v1/resumes/upload/batch` - Upload multiple resumes
- `POST /api/v1/scores/batch-score` - Calculate candidate scores

## Building for Production

```bash
npm run build
```

The build artifacts will be stored in the `build/` directory.

## Technology Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Heroicons** for icons
- **React Dropzone** for file uploads
- **Recharts** for data visualization
- **React Hot Toast** for notifications
- **Axios** for API calls

## Troubleshooting

### Common Issues

1. **API Connection Errors**

   - Ensure backend is running on `http://localhost:8000`
   - Check CORS settings in backend
   - Verify API endpoints are accessible

2. **File Upload Issues**

   - Check file size limits (10MB max)
   - Ensure supported file formats (PDF, DOCX, DOC, TXT)
   - Verify backend file processing endpoints

3. **Build Errors**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check TypeScript errors: `npm run build`

### Development Tips

- Use browser dev tools to monitor API requests
- Check console for error messages
- Enable verbose logging in `api.ts` for debugging
