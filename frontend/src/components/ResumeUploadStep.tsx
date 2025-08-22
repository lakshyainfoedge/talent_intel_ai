import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { JobDescription, Resume } from "../App";
import { uploadResumes } from "../services/api";
import LoadingSkeleton from "./LoadingSkeleton";

interface ResumeUploadStepProps {
  jobDescription: JobDescription;
  onComplete: (resumes: Resume[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function ResumeUploadStep({
  jobDescription,
  onComplete,
  isLoading,
  setIsLoading,
}: ResumeUploadStepProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processingFiles, setProcessingFiles] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter((file) => {
      const isValidType =
        file.type === "application/pdf" ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.type === "application/msword" ||
        file.type === "text/plain";

      if (!isValidType) {
        toast.error(`${file.name} is not a supported file type`);
        return false;
      }

      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        toast.error(`${file.name} is too large (max 10MB)`);
        return false;
      }

      return true;
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "application/msword": [".doc"],
      "text/plain": [".txt"],
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one resume");
      return;
    }

    setIsLoading(true);
    setProcessingFiles(true);

    try {
      const resumes = await uploadResumes(selectedFiles);
      toast.success(`Successfully processed ${resumes.length} resumes!`);
      onComplete(resumes);
    } catch (error: any) {
      toast.error(error.message || "Failed to upload resumes");
      setProcessingFiles(false);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary-100 rounded-full shadow-sm">
            <CloudArrowUpIcon className="h-8 w-8 text-primary-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Upload Candidate Resumes
        </h2>
        <p className="text-gray-600 max-w-lg mx-auto">
          Upload resumes to analyze and rank candidates for:{" "}
          <span className="font-semibold text-primary-700">
            {jobDescription.parsed_data.title}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Area */}
        <div className="space-y-6">
          <div className="card border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-300">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300 ${
                isDragActive
                  ? "border-primary-400 bg-primary-50 scale-[1.02]"
                  : "border-gray-300 hover:border-primary-400 hover:bg-gray-50"
              }`}
            >
              <input {...getInputProps()} />
              <CloudArrowUpIcon
                className={`mx-auto h-12 w-12 mb-4 transition-colors duration-300 ${
                  isDragActive ? "text-primary-500" : "text-gray-400"
                }`}
              />
              {isDragActive ? (
                <p className="text-primary-600 font-medium animate-pulse">
                  Drop the files here...
                </p>
              ) : (
                <>
                  <p className="text-gray-600 mb-2">
                    <span className="font-medium text-primary-600">
                      Click to upload
                    </span>{" "}
                    or drag and drop
                  </p>
                  <p className="text-sm text-gray-500">
                    PDF, DOCX, DOC, or TXT files (max 10MB each)
                  </p>
                </>
              )}
            </div>
          </div>

          {selectedFiles.length > 0 && (
            <div className="card border-gray-200 shadow-md transition-all duration-300">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <DocumentTextIcon className="h-5 w-5 text-primary-500 mr-2" />
                Selected Files ({selectedFiles.length})
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-gray-100 transition-colors duration-200"
                  >
                    <div className="flex items-center">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-500 transition-colors duration-200 p-1 rounded-full hover:bg-red-50"
                      disabled={isLoading}
                      aria-label="Remove file"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={isLoading || selectedFiles.length === 0}
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
                Processing Resumes...
              </>
            ) : (
              <>
                <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                {`Process ${selectedFiles.length} Resume${
                  selectedFiles.length !== 1 ? "s" : ""
                }`}
              </>
            )}
          </button>

          {/* Processing Skeletons */}
          {processingFiles && (
            <div className="mt-6 animate-fadeIn">
              <div className="card border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <svg
                    className="animate-spin h-4 w-4 mr-2 text-primary-500"
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
                  Processing Resumes
                </h3>

                <div className="space-y-4">
                  {Array.from({
                    length: Math.min(selectedFiles.length, 3),
                  }).map((_, index) => (
                    <div
                      key={index}
                      className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <LoadingSkeleton
                        type="avatar"
                        className="flex-shrink-0"
                      />
                      <div className="flex-1">
                        <LoadingSkeleton type="text" width="w-1/3" />
                        <div className="mt-2 space-y-1">
                          <LoadingSkeleton type="text" width="w-full" />
                          <LoadingSkeleton type="text" width="w-5/6" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <LoadingSkeleton type="button" width="w-16" />
                          <LoadingSkeleton type="button" width="w-20" />
                          <LoadingSkeleton type="button" width="w-24" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 text-center text-sm text-gray-500">
                  Extracting skills, experience, and qualifications...
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Job Requirements Preview */}
        <div className="card border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-300">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <DocumentTextIcon className="h-5 w-5 text-primary-500 mr-2" />
            Job Requirements
          </h3>
          <div className="space-y-5">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Position
              </h4>
              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded-md border border-gray-100">
                {jobDescription.parsed_data.title}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Seniority Level
              </h4>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                {jobDescription.parsed_data.seniority}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Required Skills
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {jobDescription.parsed_data.required_skills
                  .slice(0, 10)
                  .map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary-50 text-primary-700 border border-primary-100 transition-colors duration-200 hover:bg-primary-100"
                    >
                      {skill}
                    </span>
                  ))}
                {jobDescription.parsed_data.required_skills.length > 10 && (
                  <span className="text-xs text-gray-500 px-2 py-1">
                    +{jobDescription.parsed_data.required_skills.length - 10}{" "}
                    more
                  </span>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Key Responsibilities
              </h4>
              <ul className="text-sm text-gray-600 space-y-2 bg-gray-50 p-3 rounded-md border border-gray-100">
                {jobDescription.parsed_data.responsibilities
                  .slice(0, 3)
                  .map((resp, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-primary-500 mr-2">•</span>
                      <span className="line-clamp-2">{resp}</span>
                    </li>
                  ))}
                {jobDescription.parsed_data.responsibilities.length > 3 && (
                  <li className="text-xs text-gray-500 ml-4 mt-1 italic">
                    +{jobDescription.parsed_data.responsibilities.length - 3}{" "}
                    more responsibilities
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
