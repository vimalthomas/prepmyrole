"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Proficiency } from "@/types";

const PROFICIENCY_OPTIONS: { value: Proficiency; label: string; desc: string; color: string }[] = [
  { value: "junior",  label: "Junior",          desc: "0–2 yrs · Fundamentals",       color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40" },
  { value: "mid",     label: "Mid-Level",        desc: "2–5 yrs · Independent",        color: "from-blue-500/20 to-blue-500/5 border-blue-500/40" },
  { value: "senior",  label: "Senior",           desc: "5+ yrs · Project lead",        color: "from-violet-500/20 to-violet-500/5 border-violet-500/40" },
  { value: "lead",    label: "Lead / Principal", desc: "Strategy · Cross-team impact", color: "from-orange-500/20 to-orange-500/5 border-orange-500/40" },
];

const DURATION_OPTIONS = [
  { value: 5,  label: "5 min",  desc: "Quick check" },
  { value: 10, label: "10 min", desc: "Full session" },
];

export default function HomePage() {
  const router = useRouter();
  const [role, setRole]                     = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [proficiency, setProficiency]       = useState<Proficiency>("mid");
  const [duration, setDuration]             = useState<5 | 10>(10);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");

  async function handleStart() {
    if (!role.trim()) { setError("Please enter a role to continue."); return; }
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, roleDescription, proficiency, durationMinutes: duration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start session");
      router.push(`/session?id=${data.sessionId}&q=${data.questionId}&text=${encodeURIComponent(data.questionText)}&duration=${duration}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-violet-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative flex flex-col items-center justify-center flex-1 px-4 py-16">
        {/* Badge */}
        <div className="mb-6 flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          AI-Powered Interview Practice
        </div>

        {/* Heading */}
        <h1 className="text-5xl md:text-6xl font-bold text-white text-center mb-3 animate-fade-in" style={{ animationDelay: "60ms" }}>
          {"Prep "}<span className="text-blue-400">My</span>{" Role"}
        </h1>
        <p className="text-slate-400 text-lg text-center mb-10 max-w-md animate-fade-in" style={{ animationDelay: "120ms" }}>
          Real-time AI interview with speech analysis, adaptive questions, and detailed feedback.
        </p>

        {/* Card */}
        <div className="w-full max-w-xl bg-slate-900/80 backdrop-blur border border-slate-700/60 rounded-2xl p-8 shadow-2xl space-y-6 animate-fade-in" style={{ animationDelay: "180ms" }}>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Role / Job Title <span className="text-blue-400">*</span>
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="e.g. Software Engineer, Product Manager…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Role Context <span className="text-slate-500 font-normal text-xs">(optional — paste a JD for tailored questions)</span>
            </label>
            <textarea
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="Paste a job description or describe the company, tech stack, or focus areas…"
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60 transition-all resize-none"
            />
          </div>

          {/* Proficiency */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Proficiency Level</label>
            <div className="grid grid-cols-2 gap-2">
              {PROFICIENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setProficiency(opt.value)}
                  className={`p-3 rounded-xl border bg-gradient-to-br text-left transition-all ${
                    proficiency === opt.value
                      ? opt.color + " text-white shadow-lg scale-[1.02]"
                      : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                  }`}
                >
                  <div className="font-semibold text-sm">{opt.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Session Duration</label>
            <div className="grid grid-cols-2 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value as 5 | 10)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    duration === opt.value
                      ? "border-blue-500/60 bg-blue-500/10 text-white shadow-lg"
                      : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                  }`}
                >
                  <div className="font-semibold text-sm">{opt.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm flex items-center gap-2">
              <span>⚠</span> {error}
            </p>
          )}

          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base transition-all shadow-lg shadow-blue-600/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Setting up your session…
              </span>
            ) : (
              "Start Interview →"
            )}
          </button>

          <p className="text-slate-600 text-xs text-center">
            Microphone + camera required · Audio analyzed · Video not recorded
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-8 animate-fade-in" style={{ animationDelay: "300ms" }}>
          {["Adaptive questions", "Real-time transcription", "Speech analysis", "Detailed scoring"].map((f) => (
            <span key={f} className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
