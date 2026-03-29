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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-xl mb-4">Starting in</p>
          <div className="text-8xl font-bold text-white">{countdown || "Go!"}</div>
          <p className="text-slate-400 mt-4">Make sure your microphone is ready</p>
        </div>
      </div>
    );
  }

  if (state === "ending") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="text-white text-xl font-medium">Time&apos;s up!</p>
          <p className="text-slate-400 mt-2">Analyzing your responses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
        <span className="text-slate-400 text-sm">Question {questionNumber}</span>
        <div className="flex items-center gap-4">
          {isListening && (
            <span className="flex items-center gap-1.5 text-green-400 text-xs">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Listening
            </span>
          )}
          <div className={`text-2xl font-mono font-bold ${isLowTime ? "text-red-400" : "text-white"}`}>
            {formatTime(timeLeft)}
          </div>
          <button
            onClick={handleTimeUp}
            disabled={state === "processing"}
            className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-400 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Timer progress bar */}
      <div className="h-1 bg-slate-700">
        <div
          className={`h-full transition-all duration-1000 ${isLowTime ? "bg-red-500" : "bg-blue-500"}`}
          style={{ width: `${timePercent}%` }}
        />
      </div>

      <div className="flex flex-1">
        {/* Main area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {/* Question card */}
          <div className="w-full max-w-2xl mb-8">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Interviewer</p>
              {state === "processing" ? (
                <div className="flex items-center gap-3 text-slate-400">
                  <div className="flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                  <span className="text-sm">Preparing next question...</span>
                </div>
              ) : (
                <p className="text-white text-xl leading-relaxed">{currentQuestion}</p>
              )}
            </div>
          </div>

          {/* Transcript card */}
          <div className="w-full max-w-2xl">
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 min-h-[120px]">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Your Answer</p>
              <p className="text-white text-lg leading-relaxed">
                {finalTranscript && <span>{finalTranscript} </span>}
                {liveTranscript && <span className="text-slate-400">{liveTranscript}</span>}
                {!fullTranscript && state === "answering" && (
                  <span className="text-slate-500 italic">Start speaking...</span>
                )}
              </p>
            </div>

            {state === "answering" && (
              <button
                onClick={handleSubmitAnswer}
                disabled={!finalTranscript.trim() || submitting}
                className="mt-4 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                {submitting ? "Processing..." : "Next Question →"}
              </button>
            )}
          </div>

          {error && <p className="mt-4 text-red-400 text-sm text-center">{error}</p>}
        </div>

        {/* Camera panel */}
        <div className="w-64 p-4 flex flex-col items-center justify-start pt-8 border-l border-slate-700">
          <div className="w-full aspect-video bg-slate-800 rounded-xl overflow-hidden border border-slate-700 relative">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {!isCameraOn && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">
                Camera loading...
              </div>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-2">Camera on — not analyzed</p>
        </div>
      </div>
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SessionPageInner />
    </Suspense>
  );
}
