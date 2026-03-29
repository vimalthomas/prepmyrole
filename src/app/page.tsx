"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Proficiency } from "@/types";

const PROFICIENCY_OPTIONS: { value: Proficiency; label: string; desc: string; color: string }[] = [
  { value: "junior",  label: "Junior",          desc: "Still learning the ropes",      color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40" },
  { value: "mid",     label: "Mid-Level",        desc: "Got a few years under my belt", color: "from-blue-500/20 to-blue-500/5 border-blue-500/40" },
  { value: "senior",  label: "Senior",           desc: "I lead projects and people",    color: "from-violet-500/20 to-violet-500/5 border-violet-500/40" },
  { value: "lead",    label: "Lead / Principal", desc: "I shape direction and strategy",color: "from-orange-500/20 to-orange-500/5 border-orange-500/40" },
];

const DURATION_OPTIONS = [
  { value: 5,  label: "5 min",  desc: "Quick warmup" },
  { value: 10, label: "10 min", desc: "Proper practice" },
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
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col">
      {/* Soft background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-100 rounded-full blur-[100px] opacity-60" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-indigo-100 rounded-full blur-[100px] opacity-50" />
      </div>

      <div className="relative flex flex-col items-center justify-center flex-1 px-4 py-16">
        {/* Badge */}
        <div className="mb-6 flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-500 text-xs font-medium animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Your personal interview coach
        </div>

        {/* Heading */}
        <h1 suppressHydrationWarning className="text-5xl md:text-6xl font-bold text-gray-900 text-center mb-3 animate-fade-in" style={{ animationDelay: "60ms" }}>
          {"Prep "}<span className="text-blue-500">My</span>{" Role"}
        </h1>
        <p className="text-gray-500 text-lg text-center mb-10 max-w-md animate-fade-in" style={{ animationDelay: "120ms" }}>
          Practice out loud. Get honest feedback. Walk into your next interview ready.
        </p>

        {/* Card */}
        <div className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl p-8 shadow-sm space-y-6 animate-fade-in" style={{ animationDelay: "180ms" }}>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What role are you preparing for?
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="e.g. Software Engineer, Product Manager…"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Got a job posting? <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <textarea
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="Drop in the job description and we'll tailor the questions to match…"
              rows={3}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all resize-none"
            />
          </div>

          {/* Proficiency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Where are you in your career?</label>
            <div className="grid grid-cols-2 gap-2">
              {PROFICIENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setProficiency(opt.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    proficiency === opt.value
                      ? "border-blue-400 bg-blue-50 text-gray-900 shadow-sm scale-[1.02]"
                      : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:text-gray-700"
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
            <label className="block text-sm font-medium text-gray-700 mb-3">How long do you have?</label>
            <div className="grid grid-cols-2 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value as 5 | 10)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    duration === opt.value
                      ? "border-blue-400 bg-blue-50 text-gray-900 shadow-sm"
                      : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  <div className="font-semibold text-sm">{opt.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm flex items-center gap-2">
              <span>⚠</span> {error}
            </p>
          )}

          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-blue-500 hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base transition-all shadow-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Setting up your session…
              </span>
            ) : (
              "Let's get started"
            )}
          </button>

          <p className="text-gray-400 text-xs text-center">
            You&apos;ll need your mic on. Camera optional. Nothing is stored.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-8 animate-fade-in" style={{ animationDelay: "300ms" }}>
          {["Questions that follow your answers", "Hear yourself think", "Know where you stand", "No judgement, just feedback"].map((f) => (
            <span key={f} className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-400 text-xs shadow-sm">
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
