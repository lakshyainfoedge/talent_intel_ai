import React, { useEffect, useState } from "react";
import {
  ChartBarIcon,
  UserIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartPieIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  ComposedChart,
  Scatter,
  Area,
  ReferenceLine,
  Treemap,
} from "recharts";
import toast from "react-hot-toast";
import { JobDescription, Resume, CandidateScore } from "../App";
import { batchScoreResumes } from "../services/api";
import LoadingSkeleton from "./LoadingSkeleton";

interface ResultsStepProps {
  jobDescription: JobDescription;
  resumes: Resume[];
  candidateScores: CandidateScore[];
  onScoresComplete: (scores: CandidateScore[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export default function ResultsStep({
  jobDescription,
  resumes,
  candidateScores,
  onScoresComplete,
  isLoading,
  setIsLoading,
}: ResultsStepProps) {
  const [selectedCandidate, setSelectedCandidate] =
    useState<CandidateScore | null>(null);
  const [calculatingScores, setCalculatingScores] = useState(false);

  useEffect(() => {
    if (candidateScores.length === 0) {
      calculateScores();
    }
  }, [candidateScores.length]);

  useEffect(() => {
    if (
      candidateScores.length === 0 &&
      jobDescription &&
      jobDescription.id &&
      resumes.length > 0
    ) {
      console.log("Initial load - calculating scores");
      calculateScores();
    }
  }, []);

  const calculateScores = async () => {
    setIsLoading(true);
    setCalculatingScores(true);
    try {
      // Debug logging for job description
      console.log("Job Description:", jobDescription);
      console.log(
        "Job Description ID:",
        jobDescription?.id || jobDescription?._id
      );

      // Validate job description ID - with more detailed error
      if (!jobDescription) {
        throw new Error("Job description is null or undefined");
      }

      // Get the ID from either id or _id property
      const jobDescriptionId = jobDescription.id || jobDescription._id;

      // Check if ID exists and is in the correct format (MongoDB ObjectId is 24 chars)
      if (
        !jobDescriptionId ||
        typeof jobDescriptionId !== "string" ||
        jobDescriptionId.trim() === ""
      ) {
        console.error("Job description object:", jobDescription);
        throw new Error(`Job description ID is missing or invalid`);
      }

      // Validate resumes
      if (!resumes || resumes.length === 0) {
        throw new Error("No resumes available for scoring");
      }

      // Filter out any resumes with missing IDs
      const validResumes = resumes.filter((resume) => {
        const resumeId = resume?.id || resume?._id;
        return (
          resume &&
          resumeId &&
          typeof resumeId === "string" &&
          resumeId.trim() !== ""
        );
      });

      if (validResumes.length === 0) {
        throw new Error("No valid resume IDs found");
      }

      console.log(
        "Valid Resume IDs:",
        validResumes.map((r) => r.id || r._id)
      );

      // Ensure we only have string values in the array (no undefined)
      const resumeIds = validResumes
        .map((resume) => resume.id || resume._id)
        .filter((id): id is string => id !== undefined);

      // Define scoring weights
      const weights = {
        experience: 0.6,
        skills: 0.3,
        trajectory: 0.1,
      };

      console.log("Calling API with:", {
        jdId: jobDescriptionId,
        resumeIds,
        weights,
      });

      const scores = await batchScoreResumes(
        jobDescriptionId,
        resumeIds,
        weights
      );
      const sortedScores = scores.sort((a, b) => b.score - a.score);
      onScoresComplete(sortedScores);
      toast.success("Candidate analysis completed!");
    } catch (error: any) {
      console.error("Score calculation error:", error);
      toast.error(error.message || "Failed to calculate scores");
    } finally {
      setIsLoading(false);
      setCalculatingScores(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-100";
    if (score >= 60) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const getValidityColor = (validity: number) => {
    if (validity >= 80) return "text-green-600";
    if (validity >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const chartData = candidateScores.slice(0, 10).map((candidate, index) => ({
    name: candidate.parsed.name || `Candidate ${index + 1}`,
    score: Math.round(candidate.score),
    experience: Math.round(candidate.exp_sim * 100),
    skills: Math.round(candidate.skill_overlap * 100),
    trajectory: Math.round(candidate.trajectory * 100),
  }));

  const validityData = [
    {
      name: "High Validity (80%+)",
      value: candidateScores.filter((c) => c.validity_pct >= 80).length,
      color: "#10B981",
    },
    {
      name: "Medium Validity (60-79%)",
      value: candidateScores.filter(
        (c) => c.validity_pct >= 60 && c.validity_pct < 80
      ).length,
      color: "#F59E0B",
    },
    {
      name: "Low Validity (<60%)",
      value: candidateScores.filter((c) => c.validity_pct < 60).length,
      color: "#EF4444",
    },
  ];

  const radarData = chartData.map((candidate) => ({
    subject: candidate.name,
    experience: candidate.experience,
    skills: candidate.skills,
    trajectory: candidate.trajectory,
  }));

  const skillsData = [
    { name: "JavaScript", value: 100 },
    { name: "TypeScript", value: 80 },
    { name: "React", value: 90 },
    { name: "Node.js", value: 70 },
    { name: "Python", value: 60 },
    { name: "Java", value: 50 },
  ];

  const getTimelineData = (candidate: CandidateScore) => {
    // Create mock experience data from experience bullets
    const mockExperienceData = [
      { role: candidate.parsed.titles[0] || "Recent Position", years: 3 },
      { role: candidate.parsed.titles[1] || "Previous Position", years: 2 },
      { role: candidate.parsed.titles[2] || "Earlier Position", years: 1.5 },
    ].filter((_, index) => index < candidate.parsed.titles.length);

    return mockExperienceData;
  };

  const CustomTreemapContent = (props: any) => {
    // Default colors if not provided
    const defaultColors = [
      "#8884d8",
      "#83a6ed",
      "#8dd1e1",
      "#82ca9d",
      "#a4de6c",
      "#d0ed57",
    ];

    // Safely extract props with fallbacks for everything
    const {
      x = 0,
      y = 0,
      width = 0,
      height = 0,
      depth = 0,
      index = 0,
      name = "",
      colors = defaultColors,
    } = props || {};

    // Determine fill color safely without depending on root.children
    const getFillColor = () => {
      if (depth >= 2) return "none";

      // Use modulo to ensure we always get a valid index regardless of input
      const colorIndex = index % defaultColors.length;
      return colors[colorIndex] || defaultColors[colorIndex] || "#8884d8";
    };

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: getFillColor(),
            stroke: "#fff",
            strokeWidth: 2 / (depth + 1e-10),
            strokeOpacity: 1 / (depth + 1e-10),
          }}
        />
        {depth === 1 && width > 0 && height > 0 && (
          <text
            x={x + width / 2}
            y={y + height / 2 + 7}
            textAnchor="middle"
            fill="#fff"
            fontSize={12}
          >
            {name}
          </text>
        )}
      </g>
    );
  };

  // Render loading state
  if (isLoading || candidateScores.length === 0) {
    return (
      <div className="p-6 sm:p-8 animate-fadeIn">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary-100 rounded-full shadow-sm">
              <ChartBarIcon className="h-8 w-8 text-primary-600 animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Analyzing Candidates
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto">
            Our AI is matching candidates to the job requirements and
            calculating scores...
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Candidate List Skeleton */}
          <div className="lg:col-span-1">
            <div className="card border-gray-200 shadow-md p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <UserIcon className="h-5 w-5 text-primary-500 mr-2" />
                Candidate Rankings
              </h3>

              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center p-3 rounded-lg border border-gray-100 bg-gray-50"
                  >
                    <div className="mr-3">
                      <LoadingSkeleton type="avatar" />
                    </div>
                    <div className="flex-1">
                      <LoadingSkeleton type="text" width="w-2/3" />
                      <div className="mt-2">
                        <LoadingSkeleton type="text" width="w-1/2" />
                      </div>
                    </div>
                    <div className="ml-2">
                      <LoadingSkeleton
                        type="text"
                        width="w-12"
                        height="h-8"
                        className="rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Skeleton */}
          <div className="lg:col-span-2 space-y-6">
            {/* Score Breakdown */}
            <div className="card border-gray-200 shadow-md p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Score Breakdown
              </h3>
              <LoadingSkeleton type="chart" height="h-64" />
            </div>

            {/* Skills Match */}
            <div className="card border-gray-200 shadow-md p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Skills Match
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LoadingSkeleton type="chart" height="h-48" />
                <LoadingSkeleton type="chart" height="h-48" />
              </div>
            </div>

            {/* Experience Analysis */}
            <div className="card border-gray-200 shadow-md p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Experience Analysis
              </h3>
              <LoadingSkeleton type="chart" height="h-64" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white p-8 rounded-lg shadow-lg mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">
              Candidate Analysis Results
            </h2>
            <p className="text-primary-100">
              Ranked candidates for:{" "}
              <span className="font-semibold">
                {jobDescription.parsed_data.title}
              </span>
            </p>
          </div>
          <div className="p-4 bg-white bg-opacity-20 rounded-full">
            <ChartBarIcon className="h-10 w-10 text-white" />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card bg-white shadow-md hover:shadow-lg transition-shadow border-l-4 border-primary-500 p-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-3xl font-bold text-primary-600 mb-2">
                {candidateScores.length}
              </div>
              <div className="text-sm text-gray-600">Total Candidates</div>
            </div>
            <div className="p-3 bg-primary-100 rounded-full">
              <UserIcon className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </div>
        <div className="card bg-white shadow-md hover:shadow-lg transition-shadow border-l-4 border-green-500 p-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-3xl font-bold text-green-600 mb-2">
                {candidateScores.filter((c) => c.score >= 70).length}
              </div>
              <div className="text-sm text-gray-600">Strong Matches</div>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="card bg-white shadow-md hover:shadow-lg transition-shadow border-l-4 border-blue-500 p-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {Math.round(
                  candidateScores.reduce((sum, c) => sum + c.score, 0) /
                    candidateScores.length
                ) || 0}
              </div>
              <div className="text-sm text-gray-600">Avg Match Score</div>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <ChartPieIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="card bg-white shadow-md hover:shadow-lg transition-shadow border-l-4 border-purple-500 p-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {candidateScores.filter((c) => c.validity_pct >= 80).length}
              </div>
              <div className="text-sm text-gray-600">High Validity</div>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <ArrowTrendingUpIcon className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Candidate Rankings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900">
              Candidate Rankings
            </h3>
            <div className="flex space-x-2">
              <button className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium">
                Sort by Score
              </button>
              <button className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium">
                Filter
              </button>
            </div>
          </div>
          {candidateScores.map((candidate, index) => (
            <div
              key={candidate.resume_id}
              className={`card bg-white shadow-md hover:shadow-lg transition-all duration-200 border border-gray-100 ${
                selectedCandidate?.resume_id === candidate.resume_id
                  ? "ring-2 ring-primary-500"
                  : ""
              }`}
              onClick={() => setSelectedCandidate(candidate)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        index < 3
                          ? "bg-primary-100 text-primary-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      <span className="text-lg font-bold">#{index + 1}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">
                      {candidate.parsed.name || "Anonymous Candidate"}
                    </h4>
                    <p className="text-sm text-gray-500">{candidate.file}</p>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700 capitalize">
                        {candidate.parsed.seniority} Level
                      </span>
                      <div className="flex items-center">
                        {candidate.validity_pct >= 80 ? (
                          <CheckCircleIcon className="h-4 w-4 text-green-500 mr-1" />
                        ) : (
                          <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500 mr-1" />
                        )}
                        <span
                          className={`text-xs ${getValidityColor(
                            candidate.validity_pct
                          )}`}
                        >
                          {candidate.validity_pct}% Valid
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${getScoreColor(
                      candidate.score
                    )}`}
                  >
                    {Math.round(candidate.score)}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Match Score</div>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center">
                  <span className="text-sm font-medium w-24 text-gray-500">
                    Experience
                  </span>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{
                          width: `${Math.round(candidate.exp_sim * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <span className="ml-4 text-sm font-medium text-gray-700">
                    {Math.round(candidate.exp_sim * 100)}%
                  </span>
                </div>

                <div className="flex items-center">
                  <span className="text-sm font-medium w-24 text-gray-500">
                    Skills
                  </span>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-green-600 h-2.5 rounded-full"
                        style={{
                          width: `${Math.round(
                            candidate.skill_overlap * 100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <span className="ml-4 text-sm font-medium text-gray-700">
                    {Math.round(candidate.skill_overlap * 100)}%
                  </span>
                </div>

                <div className="flex items-center">
                  <span className="text-sm font-medium w-24 text-gray-500">
                    Level Match
                  </span>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-purple-600 h-2.5 rounded-full"
                        style={{
                          width: `${Math.round(candidate.trajectory * 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <span className="ml-4 text-sm font-medium text-gray-700">
                    {Math.round(candidate.trajectory * 100)}%
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                <button
                  className="text-primary-600 hover:text-primary-800 text-sm font-medium flex items-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCandidate(candidate);
                  }}
                >
                  View Details
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 ml-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Analysis */}
        <div className="space-y-6">
          {/* Charts */}
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Top Candidates Overview
            </h3>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fill: "#4B5563", fontSize: 12 }}
                      tickLine={{ stroke: "#E5E7EB" }}
                      axisLine={{ stroke: "#E5E7EB" }}
                    />
                    <YAxis
                      tick={{ fill: "#4B5563" }}
                      tickLine={{ stroke: "#E5E7EB" }}
                      axisLine={{ stroke: "#E5E7EB" }}
                      label={{
                        value: "Match Score (%)",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#4B5563",
                        fontSize: 12,
                      }}
                    />
                    <Tooltip
                      formatter={(value) => [`${value}%`, "Match Score"]}
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #E5E7EB",
                        borderRadius: "0.375rem",
                        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                        padding: "8px 12px",
                      }}
                      cursor={{ fill: "rgba(79, 70, 229, 0.1)" }}
                    />
                    <Bar
                      dataKey="score"
                      fill="#4F46E5"
                      radius={[4, 4, 0, 0]}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.score >= 80
                              ? "#4F46E5"
                              : entry.score >= 60
                              ? "#6366F1"
                              : "#818CF8"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-12 w-12 text-gray-400 mx-auto mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    <p className="text-gray-500">No candidate data available</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Data will appear once candidates are analyzed
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Resume Validity Distribution
            </h3>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <div className="text-sm text-gray-600 mb-3">
                Percentage of resumes with high, medium, and low data validity
                scores
              </div>
              <div className="flex flex-col md:flex-row items-center justify-center">
                {candidateScores.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <Pie
                        data={validityData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, value, percent }) =>
                          `${value} (${
                            percent ? (percent * 100).toFixed(0) : 0
                          }%)`
                        }
                        labelLine={true}
                        animationDuration={1500}
                        animationEasing="ease-out"
                      >
                        {validityData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke="#fff"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [
                          `${value} candidates`,
                          name,
                        ]}
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #E5E7EB",
                          borderRadius: "0.375rem",
                          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                          padding: "8px 12px",
                        }}
                      />
                      <Legend
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        wrapperStyle={{ paddingLeft: "10px" }}
                        formatter={(value) => (
                          <span style={{ color: "#4B5563", fontSize: "12px" }}>
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] w-full bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-12 w-12 text-gray-400 mx-auto mb-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
                        />
                      </svg>
                      <p className="text-gray-500">
                        No validity data available
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        Data will appear once candidates are analyzed
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Top Candidates Comparison
            </h3>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart
                    outerRadius={90}
                    width={730}
                    height={250}
                    data={radarData}
                    margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
                  >
                    <PolarGrid stroke="#E5E7EB" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "#4B5563", fontSize: 12 }}
                      tickLine={{ stroke: "#E5E7EB" }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: "#4B5563" }}
                      tickCount={5}
                      axisLine={{ stroke: "#E5E7EB" }}
                    />
                    <Radar
                      name="Experience Match"
                      dataKey="experience"
                      stroke="#4F46E5"
                      fill="#4F46E5"
                      fillOpacity={0.6}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                    <Radar
                      name="Skills Match"
                      dataKey="skills"
                      stroke="#10B981"
                      fill="#10B981"
                      fillOpacity={0.6}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                    <Radar
                      name="Career Trajectory"
                      dataKey="trajectory"
                      stroke="#F59E0B"
                      fill="#F59E0B"
                      fillOpacity={0.6}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: "10px" }}
                      formatter={(value) => (
                        <span style={{ color: "#4B5563", fontSize: "12px" }}>
                          {value}
                        </span>
                      )}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #E5E7EB",
                        borderRadius: "0.375rem",
                        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                        padding: "8px 12px",
                      }}
                      formatter={(value) => [`${value}%`, "Match Score"]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-12 w-12 text-gray-400 mx-auto mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    <p className="text-gray-500">
                      No comparison data available
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                      Data will appear once candidates are analyzed
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Most In-Demand Skills
            </h3>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              {skillsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <Treemap
                    data={skillsData}
                    dataKey="value"
                    aspectRatio={4 / 3}
                    stroke="#fff"
                    animationDuration={1500}
                    animationEasing="ease-out"
                    content={
                      <CustomTreemapContent
                        colors={[
                          "#4F46E5", // Indigo
                          "#6366F1", // Lighter indigo
                          "#818CF8", // Even lighter indigo
                          "#10B981", // Green
                          "#34D399", // Lighter green
                          "#6EE7B7", // Even lighter green
                        ]}
                      />
                    }
                  >
                    <Tooltip
                      formatter={(value, name) => [
                        `${value} candidates`,
                        `Skill: ${name}`,
                      ]}
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #E5E7EB",
                        borderRadius: "0.375rem",
                        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                        padding: "8px 12px",
                      }}
                    />
                  </Treemap>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-12 w-12 text-gray-400 mx-auto mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    <p className="text-gray-500">No skills data available</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Data will appear once candidates are analyzed
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selected Candidate Details */}
          {selectedCandidate && (
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Candidate Details
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Name</h4>
                  <p className="text-sm text-gray-900">
                    {selectedCandidate.parsed.name || "Not specified"}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700">Skills</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedCandidate.parsed.skills
                      .slice(0, 8)
                      .map((skill, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {skill}
                        </span>
                      ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700">
                    Experience Timeline
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      layout="vertical"
                      data={getTimelineData(selectedCandidate)}
                      margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, "dataMax + 1"]} />
                      <YAxis type="category" dataKey="role" width={100} />
                      <Tooltip
                        formatter={(value, name, props) => [
                          `${value} years as ${props.payload.role}`,
                          "Duration",
                        ]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Bar dataKey="years" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700">
                    Experience Highlights
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-1 mt-1">
                    {selectedCandidate.parsed.experience_bullets
                      .slice(0, 3)
                      .map((bullet, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-gray-400 mr-2">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700">
                    AI Analysis
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedCandidate.ai.rationale}
                  </p>
                  {selectedCandidate.ai.flags.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">Flags:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedCandidate.ai.flags.map((flag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
