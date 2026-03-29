import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateFirstQuestion } from "@/lib/claude";
import { Proficiency } from "@/types";
import {
  sanitizeText,
  enforceLimit,
  detectPromptInjection,
  rateLimit,
  getClientIp,
  isValidProficiency,
  isValidDuration,
  LIMITS,
} from "@/lib/security";

export async function POST(req: NextRequest) {
  // Rate limit: 10 new sessions per IP per 10 minutes
  const ip = getClientIp(req);
  const { allowed } = rateLimit(ip, "start");
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    // Sanitize and validate all inputs
    const role = enforceLimit(sanitizeText(body.role), LIMITS.ROLE_MAX_CHARS);
    const roleDescription = enforceLimit(
      sanitizeText(body.roleDescription),
      LIMITS.ROLE_DESCRIPTION_MAX_CHARS
    );
    const proficiency = body.proficiency;
    const durationMinutes = body.durationMinutes;

    if (!role) {
      return NextResponse.json({ error: "Role is required." }, { status: 400 });
    }

    if (!isValidProficiency(proficiency)) {
      return NextResponse.json({ error: "Invalid proficiency level." }, { status: 400 });
    }

    if (!isValidDuration(durationMinutes)) {
      return NextResponse.json({ error: "Invalid duration." }, { status: 400 });
    }

    // Prompt injection check
    if (detectPromptInjection(role) || detectPromptInjection(roleDescription)) {
      return NextResponse.json(
        { error: "Invalid input detected." },
        { status: 400 }
      );
    }

    const firstQuestion = await generateFirstQuestion(
      role,
      roleDescription,
      proficiency as Proficiency
    );

    const session = await prisma.session.create({
      data: {
        role,
        roleDescription,
        proficiency,
        durationMinutes,
        status: "active",
        questions: {
          create: { sequence: 1, questionText: firstQuestion },
        },
      },
      include: { questions: true },
    });

    return NextResponse.json({
      sessionId: session.id,
      questionId: session.questions[0].id,
      questionText: firstQuestion,
      sequence: 1,
    });
  } catch (error) {
    console.error("Session start error:", error);
    return NextResponse.json({ error: "Failed to start session" }, { status: 500 });
  }
}
