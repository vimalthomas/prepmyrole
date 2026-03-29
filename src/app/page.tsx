"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Proficiency } from "@/types";

const PROFICIENCY_OPTIONS: { value: Proficiency; label: string; desc: string }[] = [
  { value: "junior", label: "Junior", desc: "0–2 years, learning fundamentals" },
  { value: "mid", label: "Mid-Level", desc: "2–5 years, independent contributor" },
  { value: "senior", label: "Senior", desc: "5+ years, leads projects" },
  { value: "lead", label: "Lead / Principal", desc: "Cross-team impact, strategy" },
];

const DURATION_OPTIONS = [
  { value: 5, label: "5 minutes", desc: "Quick check-in" },
  { value: 10, label: "10 minutes", desc: "Full assessment" },
];

export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [proficiency, setProficiency] = useState<Proficiency>("mid");
  const [duration, setDuration] = useState<5 | 10>(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleStart() {
    if (!role.trim()) {
      setError("Please enter a role to continue.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, roleDescription, proficiency, durationMinutes: duration }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start session");

      router.push(
        `/session?id=${data.sessionId}&q=${data.questionId}&text=${encodeURIComponent(data.questionText)}&duration=${duration}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">PrepMyRole</h1>
          <p className="text-slate-400 text-lg">
            AI-powered interview practice with real-time feedback
          </p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 space-y-6">
          {/* Role Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Role / Job Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Software Engineer, Product Manager, Data Scientist"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Role Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Role Context{" "}
              <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <textarea
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="Paste a job description or add context about the role, company, or specific skills to focus on..."
              rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Proficiency Level */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Proficiency Level
            </label>
            <div className="grid grid-cols-2 gap-3">
              {PROFICIENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setProficiency(opt.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    proficiency === opt.value
                      ? "border-blue-500 bg-blue-500/10 text-white"
                      : "border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Session Duration
            </label>
            <div className="grid grid-cols-2 gap-3">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value as 5 | 10)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    duration === opt.value
                      ? "border-blue-500 bg-blue-500/10 text-white"
                      : "border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          {/* Start Button */}
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-lg transition-colors"
          >
            {loading ? "Setting up your session..." : "Start Interview"}
          </button>

          <p className="text-slate-500 text-xs text-center">
            Allow microphone access when prompted. Camera will be on but not analyzed.
          </p>
        </div>
      </div>
    </div>
  );
}
