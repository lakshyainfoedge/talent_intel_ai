"use client";

import { useMemo, useState } from "react";
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

export default function Dashboard() {
  // Inputs
  const [jdUrl, setJdUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  // UI / Data
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [jdStruct, setJdStruct] = useState<any | null>(null);

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
    setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
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
        "http://localhost:8002/api/v1/job-descriptions",
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
        "http://localhost:8002/api/v1/resumes/upload/batch",
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
      console.log(resumeIds, jdId,weights ,"hiiiiii jd");
      if (!jdId) {
        console.warn("No JD id found in response", jd);
      }
      
      const scored = await fetch(
        "http://localhost:8002/api/v1/scores/batch-score",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jd_id: jdId, resume_ids: resumeIds, weights }),
        }
      ).then((r) => r.json());

      setResults(Array.isArray(scored) ? scored : scored?.data ?? []);
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
            <span className="text-sm font-normal text-muted-foreground">
              MVP • Next.js + shadcn
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Paste a JD URL, upload resumes, and view ranked candidates with
            explainable scores.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={clearAll} disabled={loading}>
            Clear
          </Button>
          <Button
            onClick={handleProcess}
            disabled={loading || !jdUrl || files.length === 0}
          >
            {loading ? "Processing…" : "⚡ Process Candidates"}
          </Button>
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
              <Input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={handleFileUpload}
              />
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

      {/* JD Structure (optional) */}
      {jdStruct && (
        <Card>
          <CardHeader>
            <CardTitle>📋 JD Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap leading-5 bg-muted/40 p-3 rounded-md overflow-x-auto">
              {JSON.stringify(jdStruct, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Ranked Candidates */}
      {results && results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">🏆 Ranked Candidates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {results.map((r: any, idx: number) => {
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
                        {fileLabel ? ` (${fileLabel})` : ""}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Score {pct(score)} / 100
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Score meters */}
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

                    {/* Validity meter */}
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

      {/* Empty state */}
      {(!results || results.length === 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Provide a JD URL and upload resumes to view the dashboard. Your
              data will appear here after processing.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                "Total Candidates",
                "Processed",
                "Valid Resumes",
                "Growth Rate",
              ].map((t, i) => (
                <Card key={t}>
                  <CardHeader>
                    <CardTitle className="text-sm">{t}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">
                      {[25, 12, 10, "4.5%"][i] as any}
                    </div>
                    <div className="mt-2">
                      <Progress value={[60, 35, 80, 70][i]} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground pt-4 border-t">
        MVP demo • Not for production use. Ensure JD and resumes do not include
        sensitive PIIs without consent.
      </div>
    </div>
  );
}
