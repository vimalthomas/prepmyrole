// ─── Input Sanitization ───────────────────────────────────────────────────────

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

export function sanitizeText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[&<>"']/g, (c) => HTML_ESCAPE[c] ?? c)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // strip control chars
    .trim();
}

// ─── Input Limits ─────────────────────────────────────────────────────────────

export const LIMITS = {
  ROLE_MAX_CHARS: 100,
  ROLE_DESCRIPTION_MAX_CHARS: 2000,
  ANSWER_MAX_CHARS: 5000,
};

export function enforceLimit(value: string, max: number): string {
  return value.slice(0, max);
}

// ─── Prompt Injection Defense ─────────────────────────────────────────────────

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /you\s+are\s+now\s+/i,
  /new\s+instructions?:/i,
  /system\s*:/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
  /forget\s+(everything|all)/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /act\s+as\s+(if\s+you\s+are|a\s+)/i,
  /jailbreak/i,
  /DAN\s+mode/i,
];

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Wraps user-supplied content in clear delimiters so Claude
 * cannot be confused about what is instruction vs. user content.
 */
export function wrapUserContent(label: string, content: string): string {
  return `<${label}>\n${content}\n</${label}>`;
}

// ─── Rate Limiting (in-memory, per IP) ───────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

export function rateLimit(
  ip: string,
  action: "start" | "next" | "score",
  limits = { start: 10, next: 60, score: 10 }, // per 10 minutes
  windowMs = 10 * 60 * 1000
): { allowed: boolean; remaining: number } {
  const key = `${ip}:${action}`;
  const now = Date.now();
  const max = limits[action];

  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: max - entry.count };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

// ─── Session ID Validation ────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: unknown): boolean {
  return typeof id === "string" && UUID_REGEX.test(id);
}

// ─── Proficiency / Duration Allowlist ────────────────────────────────────────

const VALID_PROFICIENCIES = new Set(["junior", "mid", "senior", "lead"]);
const VALID_DURATIONS = new Set([5, 10]);

export function isValidProficiency(value: unknown): boolean {
  return typeof value === "string" && VALID_PROFICIENCIES.has(value);
}

export function isValidDuration(value: unknown): boolean {
  return typeof value === "number" && VALID_DURATIONS.has(value);
}
