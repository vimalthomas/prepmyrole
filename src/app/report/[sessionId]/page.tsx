import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Your Assessment Report",
};

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-[72px] h-[72px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="#1e293b" strokeWidth="6" />
          <circle cx="32" cy="32" r={radius} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-base">
          {score}
        </span>
      </div>
      <span className="text-slate-500 text-[11px] text-center">{label}</span>
    </div>
  );
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  const grade = score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center gap-4">
      <span className="text-slate-400 text-sm w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-slate-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-sm font-semibold w-8 text-right tabular-nums ${grade}`}>{score}</span>
    </div>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      score: true,
      questions: { orderBy: { sequence: "asc" } },
    },
  });

  if (!session || !session.score) notFound();

  const score = session.score;
  const overallColor = score.overallScore >= 75 ? "#22c55e" : score.overallScore >= 50 ? "#f59e0b" : "#ef4444";
  const overallLabel = score.overallScore >= 75 ? "Strong" : score.overallScore >= 50 ? "Developing" : "Needs Work";

  const scoreRings = [
    { score: score.contentScore,    label: "Content",    color: "#3b82f6" },
    { score: score.roleFitScore,    label: "Role Fit",   color: "#8b5cf6" },
    { score: score.languageScore,   label: "Language",   color: "#06b6d4" },
    { score: score.fluencyScore,    label: "Fluency",    color: "#f59e0b" },
    { score: score.confidenceScore, label: "Confidence", color: "#ec4899" },
  ];

  const proficiencyLabel =
    session.proficiency.charAt(0).toUpperCase() + session.proficiency.slice(1);

  return (
    <div className="min-h-screen bg-[#0f1117] py-12 px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[120px]"
          style={{ background: `${overallColor}18` }} />
      </div>

      <div className="relative max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-6 transition-colors">
            ← New Session
          </Link>
          <h1 className="text-3xl font-bold text-white mb-1">Assessment Report</h1>
          <p className="text-slate-500 text-sm">
            {proficiencyLabel}-level {session.role} · {session.durationMinutes} min ·{" "}
            {session.questions.length} questions
          </p>
        </div>

        {/* Overall Score */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-8 text-center shadow-xl">
          <p className="text-slate-500 text-xs uppercase tracking-widest mb-6">Overall Score</p>
          <div className="relative w-40 h-40 mx-auto mb-5">
            <svg className="w-40 h-40 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#1e293b" strokeWidth="7" />
              <circle cx="50" cy="50" r="44" fill="none" stroke={overallColor} strokeWidth="7"
                strokeDasharray={`${(score.overallScore / 100) * 276.5} 276.5`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-white tabular-nums">{score.overallScore}</span>
              <span className="text-xs font-medium mt-0.5" style={{ color: overallColor }}>{overallLabel}</span>
            </div>
          </div>
          <p className="text-white text-base leading-relaxed max-w-md mx-auto">{score.summary}</p>
        </div>

        {/* Score Breakdown */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6 shadow-xl">
          <h2 className="text-white font-semibold mb-6">Score Breakdown</h2>
          <div className="flex justify-between mb-8 px-2">
            {scoreRings.map((s) => <ScoreRing key={s.label} {...s} />)}
          </div>
          <div className="space-y-4">
            <ScoreBar score={score.contentScore}    label="Content" />
            <ScoreBar score={score.roleFitScore}    label="Role Fit" />
            <ScoreBar score={score.languageScore}   label="Language" />
            <ScoreBar score={score.fluencyScore}    label="Fluency" />
            <ScoreBar score={score.confidenceScore} label="Confidence" />
          </div>
        </div>

        {/* Strengths & Opportunities */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <h2 className="text-emerald-400 font-semibold text-sm uppercase tracking-wider mb-4">Strengths</h2>
            <ul className="space-y-3">
              {score.strengths.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-slate-300 text-sm leading-snug">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <h2 className="text-amber-400 font-semibold text-sm uppercase tracking-wider mb-4">Opportunities</h2>
            <ul className="space-y-3">
              {score.opportunities.map((o, i) => (
                <li key={i} className="flex gap-2.5 text-slate-300 text-sm leading-snug">
                  <span className="text-amber-400 mt-0.5 flex-shrink-0">→</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Detailed Feedback */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6 shadow-xl">
          <h2 className="text-white font-semibold mb-3">Detailed Feedback</h2>
          <p className="text-slate-300 leading-relaxed text-sm">{score.detailedFeedback}</p>
        </div>

        {/* Transcript */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6 shadow-xl">
          <h2 className="text-white font-semibold mb-5">
            Session Transcript
            <span className="ml-2 text-slate-500 font-normal text-sm">({session.questions.length} questions)</span>
          </h2>
          <div className="space-y-5">
            {session.questions.map((q, i) => (
              <div key={q.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-[10px] font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-slate-200 text-sm leading-relaxed">{q.questionText}</p>
                </div>
                <div className="ml-9 pl-3 border-l border-slate-700">
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {q.answerText || <span className="italic text-slate-600">No answer recorded</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pt-2 pb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-600/20"
          >
            Practice Again →
          </Link>
        </div>
      </div>
    </div>
  );
}
