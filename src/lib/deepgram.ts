import { DeepgramMetrics, DeepgramWord } from "@/types";

const FILLER_WORDS = new Set([
  "um", "uh", "like", "you know", "basically", "literally",
  "actually", "so", "well", "right", "okay", "yeah",
]);

export function extractMetrics(
  words: DeepgramWord[],
  durationSeconds: number
): DeepgramMetrics {
  if (!words || words.length === 0) {
    return {
      wordsPerMinute: 0,
      fillerWordCount: 0,
      fillerWords: [],
      avgWordConfidence: 0,
      pauseCount: 0,
      totalWords: 0,
    };
  }

  const durationMinutes = durationSeconds / 60;
  const wordsPerMinute = Math.round(words.length / durationMinutes);

  const fillerWordsFound: string[] = [];
  let fillerWordCount = 0;
  for (const w of words) {
    if (FILLER_WORDS.has(w.word.toLowerCase())) {
      fillerWordCount++;
      if (!fillerWordsFound.includes(w.word.toLowerCase())) {
        fillerWordsFound.push(w.word.toLowerCase());
      }
    }
  }

  const avgWordConfidence =
    words.reduce((sum, w) => sum + w.confidence, 0) / words.length;

  // Count pauses > 1.5 seconds between words
  let pauseCount = 0;
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap > 1.5) pauseCount++;
  }

  return {
    wordsPerMinute,
    fillerWordCount,
    fillerWords: fillerWordsFound,
    avgWordConfidence,
    pauseCount,
    totalWords: words.length,
  };
}
