import React, { useState } from "react";
import { LinkIcon, SparklesIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { JobDescription } from "../App";
import { createJobDescription } from "../services/api";
import LoadingSkeleton from "./LoadingSkeleton";

interface JobDescriptionStepProps {
  onComplete: (jd: JobDescription) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function JobDescriptionStep({
  onComplete,
  isLoading,
  setIsLoading,
}: JobDescriptionStepProps) {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setUrlError("Please enter a job description URL");
      return;
    }

    if (!validateUrl(url)) {
      setUrlError("Please enter a valid URL");
      return;
    }

    setUrlError("");
    setIsLoading(true);
    setIsAnalyzing(true);

    try {
      const jobDescription = await createJobDescription(url);
      toast.success("Job description processed successfully!");
      onComplete(jobDescription);
    } catch (error: any) {
      toast.error(error.message || "Failed to process job description");
      setIsAnalyzing(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary-100 rounded-full shadow-sm">
            <LinkIcon className="h-8 w-8 text-primary-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Enter Job Description
        </h2>
        <p className="text-gray-600 max-w-lg mx-auto">
          Paste the URL of a job posting to analyze requirements and find
          matching candidates
        </p>
      </div>

      <div className="card border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-300">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="job-url"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Job Description URL
            </label>
            <div className="relative group">
              <input
                type="url"
                id="job-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/job-posting"
                className={`input-field pr-10 transition-all duration-300 ${
                  urlError
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "group-hover:border-primary-400"
                }`}
                disabled={isLoading}
              />
              <LinkIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-hover:text-primary-500 transition-colors duration-300" />
            </div>
            {urlError && (
              <p className="mt-2 text-sm text-red-600 animate-fadeIn">
                {urlError}
              </p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors duration-300">
            <div className="flex items-start">
              <SparklesIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0 animate-pulse" />
              <div>
                <h3 className="text-sm font-medium text-blue-900 mb-1">
                  AI-Powered Analysis
                </h3>
                <p className="text-sm text-blue-700">
                  Our AI will extract key requirements, skills, and
                  responsibilities from the job posting to create a
                  comprehensive matching profile.
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transform hover:translate-y-[-2px] transition-all duration-300"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing Job Description...
              </>
            ) : (
              <>
                <SparklesIcon className="h-5 w-5 mr-2" />
                Analyze Job Description
              </>
            )}
          </button>
        </form>
      </div>

      {isAnalyzing && (
        <div className="mt-8 animate-fadeIn">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Analyzing Job Description
            </h3>
            <p className="text-sm text-gray-600">
              Please wait while our AI extracts key information
            </p>
          </div>

          <div className="card border-gray-200 p-4 mt-4">
            <div className="flex items-center mb-4">
              <LoadingSkeleton type="avatar" className="mr-3" />
              <div className="flex-1">
                <LoadingSkeleton type="text" width="w-1/3" />
                <LoadingSkeleton type="text" width="w-1/2" className="mt-1" />
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <LoadingSkeleton type="text" />
              <LoadingSkeleton type="text" width="w-5/6" />
              <LoadingSkeleton type="text" width="w-4/6" />
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Skills Being Extracted
              </h4>
              <div className="flex flex-wrap gap-2">
                <LoadingSkeleton type="button" width="w-20" />
                <LoadingSkeleton type="button" width="w-24" />
                <LoadingSkeleton type="button" width="w-16" />
                <LoadingSkeleton type="button" width="w-28" />
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Responsibilities
              </h4>
              <div className="space-y-2">
                <LoadingSkeleton type="list" />
                <LoadingSkeleton type="list" />
                <LoadingSkeleton type="list" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          Supported platforms:{" "}
          <span className="font-medium text-gray-600">LinkedIn</span>,{" "}
          <span className="font-medium text-gray-600">Indeed</span>,{" "}
          <span className="font-medium text-gray-600">Glassdoor</span>, company
          career pages, and more
        </p>
      </div>
    </div>
  );
}
