"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

export default function Dashboard() {
  // Inputs
  const [jdUrl, setJdUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  // Refs
  const reportRef = useRef<HTMLDivElement>(null);

  // UI / Data
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [jdStruct, setJdStruct] = useState<any | null>(null);
  const [candidatesToShow, setCandidatesToShow] = useState<number>(10);

  // Available page sizes that don't exceed results length
  const availablePageSizes = useMemo(() => {
    const sizes = [10, 20, 50, 100, 200];
    if (!results || results.length === 0) return sizes;

    const maxSize = Math.max(...sizes.filter((size) => size <= results.length));
    const filteredSizes = sizes.filter((size) => size <= maxSize);
    return [
      ...new Set([...filteredSizes, results.length].sort((a, b) => a - b)),
    ];
  }, [results]);

  // Ensure current selection is valid
  useEffect(() => {
    if (
      results &&
      results.length > 0 &&
      (candidatesToShow > results.length || candidatesToShow === 0)
    ) {
      setCandidatesToShow(results.length);
    }
  }, [results, candidatesToShow]);

  // Weights (normalized like Streamlit)
  const [wExp, setWExp] = useState(0.5);
  const [wSk, setWSk] = useState(0.35);
  const [wTr, setWTr] = useState(0.15);
  const [feedbackCount, setFeedbackCount] = useState(0);

  const [phase, setPhase] = useState<"idle" | "jd" | "upload" | "score">(
    "idle"
  );
  const [status, setStatus] = useState("");

  const weights = useMemo(() => {
    const s = Math.max(0.0001, wExp + wSk + wTr);
    return {
      experience: wExp / s,
      skills: wSk / s,
      trajectory: wTr / s,
    };
  }, [wExp, wSk, wTr]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    // Limit to 10 files at a time
    if (e.target.files.length > 10) {
      alert("Please select up to 10 files at a time.");
      return;
    }

    const validFiles = Array.from(e.target.files).filter((file) => {
      const validTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const isValidType =
        validTypes.includes(file.type) ||
        [".pdf", ".doc", ".docx"].includes("." + fileExt);

      if (!isValidType) {
        alert(
          `File '${file.name}' is not a valid file type. Only PDF and Word documents are allowed.`
        );
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    setResults([]);
    setJdStruct(null);
  };

  const handleProcess = async () => {
    if (!jdUrl || files.length === 0) return;
    setLoading(true);

    try {
      setPhase("jd");
      setStatus("Analyzing JD…");
      // 1) Parse JD via local FastAPI
      const jdRes = await fetch(
        "http://localhost:8000/api/v1/job-descriptions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: jdUrl }),
        }
      ).then((r) => r.json());
      console.log(jdRes);
      const jd = jdRes?.jd ?? jdRes;
      setJdStruct(jd);

      // 2) Upload resumes
      setPhase("upload");
      setStatus(`Uploading and processing ${files.length} resume(s)…`);
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const resumes = await fetch(
        "http://localhost:8000/api/v1/resumes/upload/batch",
        {
          method: "POST",
          body: formData,
        }
      ).then((r) => r.json());
      console.log(resumes, "hi resume");
      // 3) Score candidates (pass normalized weights)
      setPhase("score");
      setStatus("Scoring candidates…");
      const resumeArr: any[] = Array.isArray(resumes)
        ? resumes
        : resumes?.data ?? [];
      const resumeIds: string[] = resumeArr
        .map((r: any) => r?._id)
        .filter(Boolean);
      const jdId = (jd as any)?._id ?? (jd as any)?.id;
      console.log(resumeIds, jdId, weights, "hiiiiii jd");
      if (!jdId) {
        console.warn("No JD id found in response", jd);
      }

      const scored = await fetch(
        "http://localhost:8000/api/v1/scores/batch-score",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jd_id: jdId, resume_ids: resumeIds, weights }),
        }
      ).then((r) => r.json());

      const resultsArray = Array.isArray(scored) ? scored : scored?.data || [];
      console.log("Scored results:", resultsArray);
      setResults(resultsArray);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setPhase("idle");
      setStatus("");
    }
  };

  // Helpers to read potentially missing fields safely
  const pct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  const as01 = (v: number) => Math.max(0, Math.min(1, v));

  // Generate and download PDF report
  const downloadPdfReport = () => {
    if (!results.length) return;

    setGeneratingPdf(true);

    try {
      const doc = new jsPDF("p", "pt", "a4");
      const title = "Candidate Evaluation Report";
      const date = new Date().toLocaleDateString();

      // Add title and date
      doc.setFontSize(20);
      doc.text(title, 40, 40);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${date}`, 40, 60);

      // Prepare table data
      const tableColumn = [
        "Rank",
        "Candidate",
        "Score",
        "Exp. Match",
        "Skills",
        "Trajectory",
      ];

      const tableRows = results.map((r: any, idx: number) => {
        const name =
          r?.parsed?.name || r?.parsed_data?.name || `Candidate ${idx + 1}`;
        const score = typeof r.score === "number" ? r.score : 0;
        const expSim = typeof r.exp_sim === "number" ? r.exp_sim : 0;
        const skOverlap =
          typeof r.skill_overlap === "number" ? r.skill_overlap : 0;
        const traj = typeof r.trajectory === "number" ? r.trajectory : 0;

        return [
          `#${idx + 1}`,
          name,
          `${pct(score)}%`,
          `${pct(expSim * 100)}%`,
          `${pct(skOverlap * 100)}%`,
          `${pct(traj * 100)}%`,
        ];
      });

      // Add table
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 80,
        styles: {
          fontSize: 8,
          cellPadding: 3,
          overflow: "linebreak",
          lineWidth: 0.1,
          lineColor: [220, 220, 220],
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        margin: { top: 10 },
      });

      // Add summary statistics
      const avgScore =
        results.reduce((acc, r) => acc + (r.score || 0), 0) / results.length;
      const topScore = Math.max(...results.map((r: any) => r.score || 0));

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      const finalY = doc?.lastAutoTable?.finalY ?? 80;
      doc.text("Summary Statistics", 40, finalY + 30);
      doc.setFontSize(10);
      doc.text(
        `Total Candidates: ${results.length}`,
        60,
        finalY + 50
      );
      doc.text(
        `Average Score: ${avgScore.toFixed(1)}%`,
        60,
        finalY + 70
      );
      doc.text(
        `Top Score: ${topScore.toFixed(1)}%`,
        60,
        finalY + 90
      );

      // Save the PDF
      doc.save(
        `candidate-report-${new Date().toISOString().split("T")[0]}.pdf`
      );
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Build per-candidate chart data
  const lineChartData = useMemo(() => {
    if (!results || results.length === 0)
      return [] as Array<{
        name: string;
        skills: number;
        experience: number;
        trajectory: number;
        score: number;
      }>;

    return results.map((r: any, idx: number) => {
      const name =
        r?.parsed?.name ||
        r?.parsed_data?.name ||
        r?.file ||
        r?.filename ||
        `Candidate ${idx + 1}`;

      const expSim = typeof r.exp_sim === "number" ? r.exp_sim : 0.6;
      const skOverlap =
        typeof r.skill_overlap === "number" ? r.skill_overlap : 0.5;
      const traj = typeof r.trajectory === "number" ? r.trajectory : 0.8;
      const score =
        typeof r.score === "number" ? r.score : Math.round(60 + (idx % 5) * 7);

      return {
        name,
        skills: pct(as01(skOverlap) * 100),
        experience: pct(as01(expSim) * 100),
        trajectory: pct(as01(traj) * 100),
        score: pct(score),
      };
    });
  }, [results]);

  const renderNameTick = ({ x, y, payload }: any) => {
    const parts = String(payload?.value ?? "").split(/\s+/);
    return (
      <g transform={`translate(${x},${y})`}>
        <text dy={16} textAnchor="end" fill="#6b7280" fontSize={11}>
          {parts.map((p: string, i: number) => (
            <tspan key={i} x={0} dy={i === 0 ? 0 : 14}>
              {p}
            </tspan>
          ))}
        </text>
      </g>
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Full-screen working overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader>
              <CardTitle>Working…</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                <div className="text-sm">{status || "Processing…"}</div>
              </div>
              {phase === "upload" && files.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {files.map((f) => f.name).join(", ")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <span>🛰️ Talent Intel AI</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Paste a JD URL, upload resumes, and view ranked candidates with
            explainable scores.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings (weights) */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  Experience Similarity
                </span>
                <span className="text-xs text-muted-foreground">
                  {(weights.experience * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={wExp}
                onChange={(e) => setWExp(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Skill Match</span>
                <span className="text-xs text-muted-foreground">
                  {(weights.skills * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={wSk}
                onChange={(e) => setWSk(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  Trajectory Alignment
                </span>
                <span className="text-xs text-muted-foreground">
                  {(weights.trajectory * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={wTr}
                onChange={(e) => setWTr(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Feedback in session: {feedbackCount}
            </div>
          </CardContent>
        </Card>

        {/* Inputs */}
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Job Description URL</label>
              <Input
                type="url"
                placeholder="https://company.com/job/senior-ml-engineer"
                value={jdUrl}
                onChange={(e) => setJdUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Upload candidate resumes (PDF, DOCX, TXT)
              </label>
              <div className="space-y-2">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted/70 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg
                        className="w-8 h-8 mb-2 text-muted-foreground"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 20 16"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                        />
                      </svg>
                      <p className="mb-2 text-sm text-muted-foreground">
                        <span className="font-semibold">Click to upload</span>{" "}
                        or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PDF or Word documents (MAX. 10 files at a time)
                      </p>
                    </div>
                    <Input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Accepted formats: PDF (.pdf), Word (.doc, .docx)
                </p>
              </div>
              {files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <span
                      key={`${f.name}-${i}`}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs bg-muted/50"
                    >
                      <span className="truncate max-w-[180px]" title={f.name}>
                        {f.name}
                      </span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => handleRemoveFile(i)}
                        aria-label={`Remove ${f.name}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {files.length > 0 && (
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium mb-2">
                    Uploaded Resumes
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60%]">File</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {files.map((f, i) => (
                        <TableRow key={`${f.name}-${i}`}>
                          <TableCell className="truncate">{f.name}</TableCell>
                          <TableCell>{Math.round(f.size / 1024)} KB</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRemoveFile(i)}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={clearAll} disabled={loading}>
                Reset
              </Button>
              <Button
                onClick={handleProcess}
                disabled={loading || !jdUrl || files.length === 0}
              >
                {loading ? "Processing…" : "⚡ Process Candidates"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* JD Structure (collapsible) */}
      {jdStruct && (
        <details className="group [&_svg]:open:rotate-180">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 transition-transform duration-200"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
              <span className="text-lg font-medium">📋 JD Structure</span>
            </div>
          </summary>
          <Card className="mt-2">
            <CardContent className="p-4">
              <pre className="text-xs whitespace-pre-wrap leading-5 bg-muted/40 p-3 rounded-md overflow-x-auto">
                {JSON.stringify(jdStruct, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </details>
      )}

      {/* Dashboard: Per-Resume Metrics */}
      {results && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full" style={{ height: 320 }}>
              <ResponsiveContainer width="95%" height="100%">
                <AreaChart
                  data={lineChartData}
                  margin={{ top: 10, right: 20, left: 32, bottom: 30 }}
                >
                  <defs>
                    <linearGradient id="fillSkills" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop
                        offset="95%"
                        stopColor="#3b82f6"
                        stopOpacity={0.05}
                      />
                    </linearGradient>

                    <linearGradient
                      id="fillExperience"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                      <stop
                        offset="95%"
                        stopColor="#22c55e"
                        stopOpacity={0.05}
                      />
                    </linearGradient>

                    <linearGradient
                      id="fillTrajectory"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop
                        offset="95%"
                        stopColor="#f59e0b"
                        stopOpacity={0.05}
                      />
                    </linearGradient>

                    <linearGradient id="fillScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                      <stop
                        offset="95%"
                        stopColor="#a855f7"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={0}
                    height={80}
                    tickMargin={12}
                    padding={{ left: 20, right: 20 }}
                    scale="point"
                    tick={renderNameTick}
                  />

                  <YAxis domain={[0, 100]} tickMargin={8} />
                  <Tooltip />
                  <Legend />
                  <Area
                    dataKey="skills"
                    stroke="#3b82f6"
                    fill="url(#fillSkills)"
                    dot={false}
                  />
                  <Area
                    dataKey="experience"
                    stroke="#22c55e"
                    fill="url(#fillExperience)"
                    dot={false}
                  />
                  <Area
                    dataKey="trajectory"
                    stroke="#f59e0b"
                    fill="url(#fillTrajectory)"
                    dot={false}
                  />
                  <Area
                    dataKey="score"
                    stroke="#a855f7"
                    fill="url(#fillScore)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ranked Candidates */}
      {results && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">🏆 Ranked Candidates</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <select
                value={candidatesToShow}
                onChange={(e) => setCandidatesToShow(Number(e.target.value))}
                className="rounded-md border p-1 text-sm bg-background"
              >
                {availablePageSizes.map((size) => (
                  <option key={size} value={size}>
                    {size === results.length ? `All (${size})` : size}
                  </option>
                ))}
                {results.length > 0 &&
                  !availablePageSizes.includes(results.length) && (
                    <option value={results.length}>
                      All ({results.length})
                    </option>
                  )}
              </select>
              <span className="text-sm text-muted-foreground">candidates</span>
              <Button
                onClick={downloadPdfReport}
                disabled={results.length === 0 || generatingPdf}
                variant="outline"
                size="sm"
                className="ml-4"
              >
                {generatingPdf ? "Generating..." : "📄 Download Report"}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {results.slice(0, candidatesToShow).map((r: any, idx: number) => {
              // Try to read fields if present; otherwise fallback
              const score =
                typeof r.score === "number"
                  ? r.score
                  : Math.round(60 + (idx % 5) * 7);
              const expSim = typeof r.exp_sim === "number" ? r.exp_sim : 0.6;
              const skOverlap =
                typeof r.skill_overlap === "number" ? r.skill_overlap : 0.5;
              const traj =
                typeof r.trajectory === "number" ? r.trajectory : 0.8;
              const aiPct = typeof r.ai_pct === "number" ? r.ai_pct : 12;
              const validity = 100 - aiPct;

              const name =
                r?.parsed?.name ||
                r?.parsed_data?.name ||
                r?.file ||
                r?.filename ||
                `Candidate ${idx + 1}`;
              const fileLabel = r?.file || r?.filename || "";

              return (
                <Card key={r._id ?? idx} className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>
                        #{idx + 1} — {name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Score {pct(score)} / 100
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs mb-1">Candidate Score</div>
                        <Progress value={pct(score)} />
                      </div>
                      <div>
                        <div className="text-xs mb-1">
                          Experience Similarity
                        </div>
                        <Progress value={pct(as01(expSim) * 100)} />
                      </div>
                      <div>
                        <div className="text-xs mb-1">Skill Match</div>
                        <Progress value={pct(as01(skOverlap) * 100)} />
                      </div>
                      <div>
                        <div className="text-xs mb-1">Trajectory Alignment</div>
                        <Progress value={pct(as01(traj) * 100)} />
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium mb-1">
                        🤖 Resume Validity
                      </div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Validity (higher is better)</span>
                        <span>{pct(validity)}%</span>
                      </div>
                      <Progress value={pct(validity)} />
                    </div>

                    {/* Quick facts */}
                    <div className="rounded-md border p-3 bg-card/30">
                      <div className="text-xs font-medium mb-2">
                        Quick facts
                      </div>
                      <ul className="text-xs space-y-1 list-disc pl-5">
                        <li>
                          Top skills:{" "}
                          {(r?.parsed?.skills || r?.parsed_data?.skills || [])
                            .slice(0, 6)
                            .join(", ")}
                        </li>
                        <li>
                          Titles:{" "}
                          {(r?.parsed?.titles || r?.parsed_data?.titles || [])
                            .slice(0, 3)
                            .join(", ")}
                        </li>
                      </ul>
                    </div>

                    {/* Expanders */}
                    <details className="rounded-md border p-3 bg-muted/40">
                      <summary className="cursor-pointer text-sm font-medium">
                        AI-detection details
                      </summary>
                      <pre className="text-xs mt-2 whitespace-pre-wrap leading-5">
                        {JSON.stringify(
                          r.ai ||
                            r.ai_struct || { ai_likelihood_percent: aiPct },
                          null,
                          2
                        )}
                      </pre>
                    </details>

                    <details className="rounded-md border p-3 bg-muted/40">
                      <summary className="cursor-pointer text-sm font-medium">
                        Parsed Resume (structured)
                      </summary>
                      <pre className="text-xs mt-2 whitespace-pre-wrap leading-5">
                        {JSON.stringify(
                          r.parsed || r.parsed_data || {},
                          null,
                          2
                        )}
                      </pre>
                    </details>

                    {/* Feedback buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setFeedbackCount((v) => v + 1);
                          // Nudge strongest signal weight
                          const trio: Array<[keyof typeof weights, number]> = [
                            ["experience", as01(expSim)],
                            ["skills", as01(skOverlap)],
                            ["trajectory", as01(traj)],
                          ];
                          trio.sort((a, b) => b[1] - a[1]);
                          const strongest = trio[0][0];
                          if (strongest === "experience")
                            setWExp((v) => Math.min(1, v * 1.2));
                          if (strongest === "skills")
                            setWSk((v) => Math.min(1, v * 1.2));
                          if (strongest === "trajectory")
                            setWTr((v) => Math.min(1, v * 1.2));
                        }}
                      >
                        👍 Relevant — boost profile
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFeedbackCount((v) => v + 1);
                          // Reduce weakest signal weight
                          const trio: Array<[keyof typeof weights, number]> = [
                            ["experience", as01(expSim)],
                            ["skills", as01(skOverlap)],
                            ["trajectory", as01(traj)],
                          ];
                          trio.sort((a, b) => a[1] - b[1]);
                          const weakest = trio[0][0];
                          if (weakest === "experience")
                            setWExp((v) => Math.max(0.05, v * 0.8));
                          if (weakest === "skills")
                            setWSk((v) => Math.max(0.05, v * 0.8));
                          if (weakest === "trajectory")
                            setWTr((v) => Math.max(0.05, v * 0.8));
                        }}
                      >
                        👎 Not relevant — reduce similar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
