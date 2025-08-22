import axios from "axios";
import { JobDescription, Resume, CandidateScore } from "../App";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error("API Error:", error.response?.data || error.message);

    if (error.response?.status === 500) {
      throw new Error("Server error. Please try again later.");
    } else if (error.response?.status === 404) {
      throw new Error("Resource not found.");
    } else if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    } else {
      throw new Error(error.message || "An unexpected error occurred.");
    }
  }
);

export const createJobDescription = async (
  url: string
): Promise<JobDescription> => {
  const response = await api.post("/job-descriptions", { url });
  return response.data;
};

export const uploadResumes = async (files: File[]): Promise<Resume[]> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await api.post("/resumes/upload/batch", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const batchScoreResumes = async (
  jdId: string,
  resumeIds: string[],
  weights?: { experience: number; skills: number; trajectory: number }
): Promise<CandidateScore[]> => {
  // Filter out any null or undefined values from resumeIds
  const validResumeIds = resumeIds.filter(
    (id) => id !== null && id !== undefined
  );

  // Ensure jdId is a string
  if (!jdId) {
    throw new Error("Job description ID is required");
  }

  const response = await api.post("/scores/batch-score", {
    jd_id: jdId,
    resume_ids: validResumeIds.map((id) =>
      id.startsWith("_") ? id.slice(1) : id
    ),
    weights: weights || { experience: 0.6, skills: 0.3, trajectory: 0.1 },
  });

  return response.data;
};

export const getJobDescription = async (
  jdId: string
): Promise<JobDescription> => {
  const response = await api.get(`/job-descriptions/${jdId}`);
  return response.data;
};

export const getResume = async (resumeId: string): Promise<Resume> => {
  const response = await api.get(`/resumes/${resumeId}`);
  return response.data;
};

export default api;
