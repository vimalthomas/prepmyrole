"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DeepgramClient } from "@deepgram/sdk";
import { DeepgramWord } from "@/types";

interface DgWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}
interface DgMessage {
  type: string;
  is_final?: boolean;
  channel?: { alternatives: Array<{ transcript: string; words: DgWord[] }> };
}

type SessionState = "countdown" | "active" | "answering" | "processing" | "ending";

function SessionPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const sessionId = params.get("id") || "";
  const initialQuestionId = params.get("q") || "";
  const initialQuestionText = decodeURIComponent(params.get("text") || "");
  const durationMinutes = parseInt(params.get("duration") || "10");

  const [state, setState] = useState<SessionState>("countdown");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const [currentQuestion, setCurrentQuestion] = useState(initialQuestionText);
  const [currentQuestionId, setCurrentQuestionId] = useState(initialQuestionId);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dgSocketRef = useRef<any>(null);
  const allWordsRef = useRef<DeepgramWord[]>([]);
  const sessionStartTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isMountedRef = useRef(true);
  const timeLeftRef = useRef(durationMinutes * 60);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Countdown before starting
  useEffect(() => {
    if (state !== "countdown") return;
    if (countdown === 0) {
      setState("active");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [state, countdown]);

  // Start camera + audio when active
  useEffect(() => {
    if (state !== "active") return;
    startMediaAndDeepgram();
    sessionStartTimeRef.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Session timer — only starts once we enter answering
  useEffect(() => {
    if (state !== "answering") return;
    if (timerRef.current) return; // already running

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          handleTimeUp();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  function cleanup() {
    dgSocketRef.current?.close();
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  async function startMediaAndDeepgram() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOn(true);
      }

      await connectDeepgram(stream);
    } catch (err) {
      console.error("Media error:", err);
      setError("Could not access microphone or camera. Please allow permissions and refresh.");
    }
  }

  async function connectDeepgram(stream: MediaStream) {
    try {
      const tokenRes = await fetch("/api/deepgram-token");
      const { key } = await tokenRes.json();

      const client = new DeepgramClient({ apiKey: key });

      const socket = await client.listen.v1.connect({
        model: "nova-2",
        language: "en-US",
        smart_format: "true",
        interim_results: "true",
        utterance_end_ms: 1000,
        Authorization: `Token ${key}`,
      });

      socket.on("open", () => {
        setIsListening(true);
        setState("answering");

        const audioTrack = stream.getAudioTracks()[0];
        const audioStream = new MediaStream([audioTrack]);
        const recorder = new MediaRecorder(audioStream, { mimeType: "audio/webm" });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && socket.readyState === 1) {
            socket.sendMedia(e.data);
          }
        };

        recorder.start(250);
        mediaRecorderRef.current = recorder;
      });

      socket.on("message", (message: unknown) => {
        const msg = message as DgMessage;
        if (msg.type !== "Results") return;
        const alt = msg.channel?.alternatives?.[0];
        if (!alt) return;

        const words = alt.words || [];
        const text = alt.transcript || "";

        if (msg.is_final) {
          const mappedWords: DeepgramWord[] = words.map((w) => ({
            word: w.word,
            start: w.start,
            end: w.end,
            confidence: w.confidence,
          }));
          allWordsRef.current = [...allWordsRef.current, ...mappedWords];
          setFinalTranscript((prev) => (prev ? prev + " " + text : text).trim());
          setLiveTranscript("");
        } else {
          setLiveTranscript(text);
        }
      });

      socket.on("error", (err) => {
        console.error("Deepgram error:", err);
      });

      dgSocketRef.current = socket;

      // Actually establish the WebSocket connection
      socket.connect();
    } catch (err) {
      console.error("Deepgram connect error:", err);
      setError("Failed to connect speech recognition. Check your Deepgram API key.");
    }
  }

  const handleSubmitAnswer = useCallback(async () => {
    const answer = (finalTranscript + " " + liveTranscript).trim();
    if (!answer || submitting) return;

    setSubmitting(true);
    setState("processing");
    setLiveTranscript("");
    setFinalTranscript("");

    try {
      const res = await fetch("/api/session/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          currentQuestionId,
          answerText: answer,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (!isMountedRef.current) return;
      setCurrentQuestion(data.questionText);
      setCurrentQuestionId(data.questionId);
      setQuestionNumber((n) => n + 1);
      setState("answering");
    } catch (err) {
      console.error("Next question error:", err);
      setError("Failed to get next question. Please try again.");
      setState("answering");
    } finally {
      if (isMountedRef.current) setSubmitting(false);
    }
  }, [finalTranscript, liveTranscript, submitting, sessionId, currentQuestionId]);

  async function handleTimeUp() {
    setState("ending");
    const answer = (finalTranscript + " " + liveTranscript).trim();
    const elapsed = (Date.now() - sessionStartTimeRef.current) / 1000;

    cleanup();

    try {
      const res = await fetch("/api/session/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          lastQuestionId: currentQuestionId,
          lastAnswer: answer || "(no answer)",
          allDeepgramWords: allWordsRef.current,
          totalDurationSeconds: elapsed,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      router.push(`/report/${sessionId}`);
    } catch (err) {
      console.error("Score error:", err);
      setError("Failed to generate report. Please refresh.");
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const fullTranscript = [finalTranscript, liveTranscript].filter(Boolean).join(" ");
  const timePercent = (timeLeft / (durationMinutes * 60)) * 100;
  const isLowTime = timeLeft < 60;

  if (state === "countdown") {
    return (
      <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <p className="text-gray-400 mb-6 uppercase tracking-widest text-xs">Starting in</p>
          <div className="text-9xl font-bold text-gray-900 tabular-nums">{countdown || "Go!"}</div>
          <p className="text-gray-400 mt-6 text-sm">Make sure your microphone is unmuted</p>
        </div>
      </div>
    );
  }

  if (state === "ending") {
    return (
      <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
            <div className="absolute inset-0 rounded-full border-4 border-blue-400 border-t-transparent animate-spin" />
          </div>
          <p className="text-gray-800 text-xl font-semibold">Analyzing your session…</p>
          <p className="text-gray-400 mt-2 text-sm">This takes about 10 seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-xs uppercase tracking-wider">Q{questionNumber}</span>
          {isListening && (
            <span className="flex items-center gap-1.5 text-emerald-500 text-xs font-medium">
              <span className="relative flex">
                <span className="pulse-ring absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className={`text-xl font-mono font-bold tabular-nums ${isLowTime ? "text-red-500" : "text-gray-800"}`}>
            {formatTime(timeLeft)}
          </div>
          <button
            onClick={handleTimeUp}
            disabled={state === "processing"}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-400 hover:bg-red-50 text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Timer progress bar */}
      <div className="h-0.5 bg-gray-100">
        <div
          className={`h-full transition-all duration-1000 ${isLowTime ? "bg-red-400" : "bg-blue-400"}`}
          style={{ width: `${timePercent}%` }}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          {/* Question card */}
          <div className="w-full max-w-2xl animate-fade-in">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <span className="text-blue-500 text-xs font-bold">AI</span>
                </div>
                <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">Interviewer</span>
              </div>
              {state === "processing" ? (
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span key={delay} className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                  <span className="text-gray-400 text-sm">Preparing next question…</span>
                </div>
              ) : (
                <p className="text-gray-800 text-xl leading-relaxed">{currentQuestion}</p>
              )}
            </div>
          </div>

          {/* Answer card */}
          <div className="w-full max-w-2xl">
            <div className={`rounded-2xl border p-6 min-h-[130px] transition-all ${
              isListening && state === "answering"
                ? "border-emerald-200 bg-emerald-50/50"
                : "border-gray-200 bg-white"
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                  <span className="text-gray-500 text-xs font-bold">You</span>
                </div>
                <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">Your Answer</span>
                {isListening && state === "answering" && (
                  <div className="ml-auto flex items-end gap-0.5 h-4">
                    {[1, 3, 2, 4, 2, 3, 1].map((h, i) => (
                      <span key={i} className="w-0.5 bg-emerald-400 rounded-full waveform-bar"
                        style={{ height: `${h * 25}%`, animationDelay: `${i * 100}ms` }} />
                    ))}
                  </div>
                )}
              </div>
              <p className="text-gray-800 text-lg leading-relaxed">
                {finalTranscript && <span>{finalTranscript} </span>}
                {liveTranscript && <span className="text-gray-400">{liveTranscript}</span>}
                {!fullTranscript && state === "answering" && (
                  <span className="text-gray-300 italic">Start speaking…</span>
                )}
              </p>
            </div>

            {state === "answering" && (
              <button
                onClick={handleSubmitAnswer}
                disabled={!finalTranscript.trim() || submitting}
                className="mt-3 w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium transition-all shadow-sm"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing…
                  </span>
                ) : "Next Question"}
              </button>
            )}
          </div>

          {error && (
            <p className="text-red-500 text-sm flex items-center gap-2">
              <span>⚠</span> {error}
            </p>
          )}
        </div>

        {/* Camera panel */}
        <div className="w-60 p-4 flex flex-col gap-3 items-center justify-start pt-8 border-l border-gray-200 bg-white">
          <div className="w-full aspect-video bg-gray-100 rounded-xl overflow-hidden border border-gray-200 relative">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {!isCameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                <span className="text-gray-400 text-xs">Starting camera…</span>
              </div>
            )}
            {isCameraOn && (
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur px-1.5 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-white text-[10px]">LIVE</span>
              </div>
            )}
          </div>
          <p className="text-slate-600 text-[11px] text-center">Video on · not recorded or analyzed</p>
        </div>
      </div>
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SessionPageInner />
    </Suspense>
  );
}
