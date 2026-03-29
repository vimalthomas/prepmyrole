import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="#334155" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
          {score}
        </span>
      </div>
      <span className="text-slate-400 text-xs text-center">{label}</span>
    </div>
  );
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color =
    score >= 75 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-4">
      <span className="text-slate-400 text-sm w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-slate-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-white text-sm w-8 text-right">{score}</span>
    </div>
  );
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      score: true,
      questions: { orderBy: { sequence: "asc" } },
    },
  });

  if (!session || !session.score) {
    notFound();
  }

  const score = session.score;
  const overallColor =
    score.overallScore >= 75
      ? "#22c55e"
      : score.overallScore >= 50
      ? "#eab308"
      : "#ef4444";

  const scoreRings = [
    { score: score.contentScore, label: "Content", color: "#3b82f6" },
    { score: score.roleFitScore, label: "Role Fit", color: "#8b5cf6" },
    { score: score.languageScore, label: "Language", color: "#06b6d4" },
    { score: score.fluencyScore, label: "Fluency", color: "#f59e0b" },
    { score: score.confidenceScore, label: "Confidence", color: "#ec4899" },
  ];

  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-1">Assessment Report</h1>
          <p className="text-slate-400">
            {session.proficiency.charAt(0).toUpperCase() + session.proficiency.slice(1)}-level{" "}
            {session.role} — {session.durationMinutes} min session
          </p>
        </div>

        {/* Overall Score */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 text-center">
          <p className="text-slate-400 text-sm mb-4 uppercase tracking-wider">Overall Score</p>
          <div className="relative w-36 h-36 mx-auto mb-4">
            <svg className="w-36 h-36 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#334155" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke={overallColor}
                strokeWidth="8"
                strokeDasharray={`${(score.overallScore / 100) * 276.5} 276.5`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-white">
              {score.overallScore}
            </span>
          </div>
          <p className="text-white text-lg">{score.summary}</p>
        </div>

        {/* Dimension Scores */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <h2 className="text-white font-semibold mb-6">Score Breakdown</h2>
          <div className="flex justify-between mb-8">
            {scoreRings.map((s) => (
              <ScoreRing key={s.label} {...s} />
            ))}
          </div>
          <div className="space-y-3">
            <ScoreBar score={score.contentScore} label="Content" />
            <ScoreBar score={score.roleFitScore} label="Role Fit" />
            <ScoreBar score={score.languageScore} label="Language" />
            <ScoreBar score={score.fluencyScore} label="Fluency" />
            <ScoreBar score={score.confidenceScore} label="Confidence" />
          </div>
        </div>

        {/* Strengths & Opportunities */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <h2 className="text-green-400 font-semibold mb-4">Strengths</h2>
            <ul className="space-y-2">
              {score.strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-slate-300 text-sm">
                  <span className="text-green-400 mt-0.5">+</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <h2 className="text-yellow-400 font-semibold mb-4">Areas to Improve</h2>
            <ul className="space-y-2">
              {score.opportunities.map((o, i) => (
                <li key={i} className="flex gap-2 text-slate-300 text-sm">
                  <span className="text-yellow-400 mt-0.5">→</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Detailed Feedback */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <h2 className="text-white font-semibold mb-3">Detailed Feedback</h2>
          <p className="text-slate-300 leading-relaxed">{score.detailedFeedback}</p>
        </div>

        {/* Questions & Answers */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <h2 className="text-white font-semibold mb-4">
            Session Transcript ({session.questions.length} questions)
          </h2>
          <div className="space-y-4">
            {session.questions.map((q, i) => (
              <div key={q.id} className="border-l-2 border-slate-600 pl-4">
                <p className="text-slate-400 text-xs mb-1">Q{i + 1}</p>
                <p className="text-white text-sm mb-2">{q.questionText}</p>
                <p className="text-slate-300 text-sm">
                  {q.answerText || <span className="text-slate-500 italic">No answer recorded</span>}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Try Again */}
        <div className="text-center pb-4">
          <Link
            href="/"
            className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
          >
            Practice Again
          </Link>
        </div>
      </div>
    </div>
  );
}
