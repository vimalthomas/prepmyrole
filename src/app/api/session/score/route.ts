import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateScoreReport } from "@/lib/claude";
import { extractMetrics } from "@/lib/deepgram";
import { ConversationTurn, DeepgramWord, Proficiency } from "@/types";
import {
  sanitizeText,
  enforceLimit,
  rateLimit,
  getClientIp,
  isValidUUID,
  LIMITS,
} from "@/lib/security";

export async function POST(req: NextRequest) {
  // Rate limit: 10 score requests per IP per 10 minutes
  const ip = getClientIp(req);
  const { allowed } = rateLimit(ip, "score");
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    if (!isValidUUID(body.sessionId)) {
      return NextResponse.json({ error: "Invalid session." }, { status: 400 });
    }

    const lastAnswer = enforceLimit(
      sanitizeText(body.lastAnswer),
      LIMITS.ANSWER_MAX_CHARS
    );

    // Validate Deepgram words array — only accept expected shape, cap at 10k words
    const rawWords = Array.isArray(body.allDeepgramWords)
      ? body.allDeepgramWords.slice(0, 10000)
      : [];
    const allDeepgramWords: DeepgramWord[] = rawWords
      .filter(
        (w: unknown) =>
          w !== null &&
          typeof w === "object" &&
          typeof (w as Record<string, unknown>).word === "string" &&
          typeof (w as Record<string, unknown>).start === "number" &&
          typeof (w as Record<string, unknown>).end === "number" &&
          typeof (w as Record<string, unknown>).confidence === "number"
      )
      .map((w: Record<string, unknown>) => ({
        word: sanitizeText(w.word as string).slice(0, 50),
        start: w.start as number,
        end: w.end as number,
        confidence: Math.min(1, Math.max(0, w.confidence as number)),
      }));

    const totalDurationSeconds =
      typeof body.totalDurationSeconds === "number"
        ? Math.min(Math.max(0, body.totalDurationSeconds), 3600)
        : 600;

    const session = await prisma.session.findUnique({
      where: { id: body.sessionId },
      include: { questions: { orderBy: { sequence: "asc" } } },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    // Prevent double-scoring
    const existingScore = await prisma.score.findUnique({
      where: { sessionId: body.sessionId },
    });
    if (existingScore) {
      return NextResponse.json(existingScore);
    }

    if (body.lastQuestionId && isValidUUID(body.lastQuestionId) && lastAnswer) {
      await prisma.question.update({
        where: { id: body.lastQuestionId },
        data: { answerText: lastAnswer, answeredAt: new Date() },
      });
    }

    const history: ConversationTurn[] = session.questions.map((q) => ({
      questionId: q.id,
      sequence: q.sequence,
      questionText: q.questionText,
      answerText:
        q.id === body.lastQuestionId ? lastAnswer : q.answerText || "(no answer)",
    }));

    const deepgramMetrics = extractMetrics(allDeepgramWords, totalDurationSeconds);
    const scoreData = await generateScoreReport(
      session.role,
      session.proficiency as Proficiency,
      history,
      deepgramMetrics
    );

    const score = await prisma.score.create({
      data: { sessionId: body.sessionId, ...scoreData },
    });

    await prisma.session.update({
      where: { id: body.sessionId },
      data: { status: "completed", completedAt: new Date() },
    });

    return NextResponse.json({ scoreId: score.id, ...scoreData });
  } catch (error) {
    console.error("Scoring error:", error);
    return NextResponse.json({ error: "Failed to score session" }, { status: 500 });
  }
}
