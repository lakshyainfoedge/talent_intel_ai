import React, { useState } from "react";
import { Toaster } from "react-hot-toast";
import JobDescriptionStep from "./components/JobDescriptionStep";
import ResumeUploadStep from "./components/ResumeUploadStep";
import ResultsStep from "./components/ResultsStep";
import ProgressBar from "./components/ProgressBar";

export interface JobDescription {
  id?: string;
  _id?: string;
  url: string;
  parsed_data: {
    title: string;
    seniority: string;
    required_skills: string[];
    nice_to_have_skills: string[];
    responsibilities: string[];
    raw_summary: string;
  };
}

export interface Resume {
  id?: string;
  _id?: string;
  file_name: string;
  parsed_data: {
    name: string;
    titles: string[];
    seniority: string;
    skills: string[];
    experience_bullets: string[];
    education: string[];
  };
}

export interface CandidateScore {
  resume_id: string;
  file: string;
  parsed: Resume["parsed_data"];
  ai: {
    ai_likelihood_percent: number;
    rationale: string;
    flags: string[];
  };
  ai_pct: number;
  validity_pct: number;
  exp_sim: number;
  skill_overlap: number;
  trajectory: number;
  score: number;
}

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [jobDescription, setJobDescription] = useState<JobDescription | null>(
    null
  );
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [candidateScores, setCandidateScores] = useState<CandidateScore[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleJobDescriptionComplete = (jd: JobDescription) => {
    setJobDescription(jd);
    setCurrentStep(2);
  };

  const handleResumesComplete = (uploadedResumes: Resume[]) => {
    setResumes(uploadedResumes);
    setCurrentStep(3);
  };

  const handleScoresComplete = (scores: CandidateScore[]) => {
    setCandidateScores(scores);
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setJobDescription(null);
    setResumes([]);
    setCandidateScores([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#363636",
            color: "#fff",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          },
          success: {
            iconTheme: {
              primary: "#10B981",
              secondary: "#FFFFFF",
            },
          },
          error: {
            iconTheme: {
              primary: "#EF4444",
              secondary: "#FFFFFF",
            },
          },
        }}
      />

      {/* Header */}
      <header className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center py-4 sm:py-6">
            <div className="flex items-center space-x-3 mb-4 sm:mb-0">
              <div className="bg-indigo-600 p-2 rounded-lg shadow-md transform transition-transform hover:scale-105">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 sm:h-8 sm:w-8 text-white"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
                  Talent Intel{" "}
                  <span className="ml-2 bg-indigo-600 text-white text-xs sm:text-sm py-1 px-2 rounded animate-pulse-custom">
                    AI
                  </span>
                </h1>
                <p className="text-gray-600 mt-1 text-sm sm:text-base">
                  Find the perfect candidates with AI-powered matching
                </p>
              </div>
            </div>
            {currentStep > 1 && (
              <button
                onClick={resetWizard}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 transform hover:-translate-y-1 hover:shadow"
              >
                <div className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Start Over
                </div>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <ProgressBar currentStep={currentStep} />
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pb-8 sm:pb-12">
        <div
          className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-500 animate-fadeIn ${
            currentStep === 3 ? "shadow-lg" : ""
          }`}
        >
          {currentStep === 1 && (
            <JobDescriptionStep
              onComplete={handleJobDescriptionComplete}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          )}

          {currentStep === 2 && jobDescription && (
            <ResumeUploadStep
              jobDescription={jobDescription}
              onComplete={handleResumesComplete}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          )}

          {currentStep === 3 && jobDescription && resumes.length > 0 && (
            <ResultsStep
              jobDescription={jobDescription}
              resumes={resumes}
              candidateScores={candidateScores}
              onScoresComplete={handleScoresComplete}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex flex-col sm:flex-row justify-between items-center">
            <div className="text-sm text-gray-500 mb-2 sm:mb-0">
              {new Date().getFullYear()} Talent Intel AI. All rights reserved.
            </div>
            <div className="flex space-x-4">
              <a
                href="#"
                className="text-gray-400 hover:text-indigo-600 transition-colors duration-200"
              >
                Privacy Policy
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-indigo-600 transition-colors duration-200"
              >
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
