export type Proficiency = "junior" | "mid" | "senior" | "lead";

export interface SessionConfig {
  role: string;
  roleDescription: string;
  proficiency: Proficiency;
  durationMinutes: 5 | 10;
}

export interface ConversationTurn {
  questionId: string;
  sequence: number;
  questionText: string;
  answerText?: string;
}

export interface ScoreBreakdown {
  overallScore: number;
  contentScore: number;
  fluencyScore: number;
  confidenceScore: number;
  languageScore: number;
  roleFitScore: number;
  strengths: string[];
  opportunities: string[];
  summary: string;
  detailedFeedback: string;
}

export interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface DeepgramMetrics {
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerWords: string[];
  avgWordConfidence: number;
  pauseCount: number;
  totalWords: number;
}
