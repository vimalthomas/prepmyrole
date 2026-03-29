import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateNextQuestion } from "@/lib/claude";
import { ConversationTurn, Proficiency } from "@/types";
import {
  sanitizeText,
  enforceLimit,
  detectPromptInjection,
  rateLimit,
  getClientIp,
  isValidUUID,
  LIMITS,
} from "@/lib/security";

export async function POST(req: NextRequest) {
  // Rate limit: 60 next-question calls per IP per 10 minutes
  const ip = getClientIp(req);
  const { allowed } = rateLimit(ip, "next");
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    // Validate session and question IDs
    if (!isValidUUID(body.sessionId) || !isValidUUID(body.currentQuestionId)) {
      return NextResponse.json({ error: "Invalid session." }, { status: 400 });
    }

    const answerText = enforceLimit(
      sanitizeText(body.answerText),
      LIMITS.ANSWER_MAX_CHARS
    );

    // Silently strip injection attempts from answers rather than blocking
    // (user may have been quoted something; we just neutralize it)
    const safeAnswer = detectPromptInjection(answerText)
      ? answerText.replace(/ignore\s+(all\s+)?(previous|prior)\s+instructions/gi, "[redacted]")
          .replace(/you\s+are\s+now/gi, "[redacted]")
      : answerText;

    const session = await prisma.session.findUnique({
      where: { id: body.sessionId },
      include: { questions: { orderBy: { sequence: "asc" } } },
    });

    if (!session || session.status !== "active") {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    // Verify the question belongs to this session
    const questionBelongsToSession = session.questions.some(
      (q) => q.id === body.currentQuestionId
    );
    if (!questionBelongsToSession) {
      return NextResponse.json({ error: "Invalid question." }, { status: 400 });
    }

    await prisma.question.update({
      where: { id: body.currentQuestionId },
      data: { answerText: safeAnswer, answeredAt: new Date() },
    });

    const history: ConversationTurn[] = session.questions.map((q) => ({
      questionId: q.id,
      sequence: q.sequence,
      questionText: q.questionText,
      answerText:
        q.id === body.currentQuestionId ? safeAnswer : q.answerText || "",
    }));

    const nextQuestion = await generateNextQuestion(
      session.role,
      session.proficiency as Proficiency,
      history,
      safeAnswer
    );

    const newQuestion = await prisma.question.create({
      data: {
        sessionId: body.sessionId,
        sequence: session.questions.length + 1,
        questionText: nextQuestion,
      },
    });

    return NextResponse.json({
      questionId: newQuestion.id,
      questionText: nextQuestion,
      sequence: newQuestion.sequence,
    });
  } catch (error) {
    console.error("Next question error:", error);
    return NextResponse.json({ error: "Failed to generate next question" }, { status: 500 });
  }
}
