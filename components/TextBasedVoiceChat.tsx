"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Mic,
  MicOff,
  Loader2,
  Sparkles,
  Volume2,
  Play,
  CheckCircle2,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface Message {
  role: "assistant" | "user";
  content: string;
  timestamp: number;
}

interface TextBasedVoiceChatProps {
  sessionId: string;
  questions: Array<{
    question: string;
    focus: string;
  }>;
  jobDescription: string;
  cvText: string;
}

export function TextBasedVoiceChat({
  sessionId,
  questions,
  jobDescription,
  cvText,
}: TextBasedVoiceChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Candidate draft response (live speech + editable text)
  const [candidateAnswer, setCandidateAnswer] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isListeningRef = useRef(false);
  const handleUserResponseRef = useRef<((transcript: string) => Promise<void>) | null>(null);
  const { toast } = useToast();

  // Speak text using TTS API
  const speak = useCallback(
    async (text: string) => {
      if (isSpeaking) return;

      setIsSpeaking(true);
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: "alloy" }),
        });

        if (!response.ok) {
          throw new Error("TTS failed");
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
      } catch (error) {
        console.error("TTS error:", error);
        setIsSpeaking(false);
      }
    },
    [isSpeaking]
  );

  // Start the interview with the first question
  const startInterview = useCallback(async () => {
    setHasStarted(true);
    const intro = `Hello! I'm conducting your interview today. Let's begin with the first question.`;
    const firstQuestion = questions[0]?.question || "Can you tell me about your background?";
    const fullMessage = `${intro}\n\nQuestion 1 of ${questions.length}: ${firstQuestion}`;

    setMessages([
      {
        role: "assistant",
        content: fullMessage,
        timestamp: Date.now(),
      },
    ]);

    await speak(fullMessage);
  }, [questions, speak]);

  // Handle user's submitted response
  const handleUserResponse = useCallback(
    async (answerText: string) => {
      const cleanAnswer = answerText.trim();
      if (!cleanAnswer) return;

      // Stop listening if active
      isListeningRef.current = false;
      setIsListening(false);
      try {
        recognitionRef.current?.stop();
      } catch {}

      setIsProcessing(true);
      setCandidateAnswer("");
      setInterimTranscript("");

      // Append user message immediately
      const newUserMessage: Message = {
        role: "user",
        content: cleanAnswer,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, newUserMessage]);

      try {
        console.log("🎤 Sending response to chat API:", {
          questionIndex: currentQuestionIndex,
          length: cleanAnswer.length,
        });

        // Get auth session token
        const { supabase } = await import("@/lib/supabase");
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();

        // Send to NVIDIA Nemotron adaptive interview API
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authSession?.access_token
              ? `Bearer ${authSession.access_token}`
              : "",
          },
          body: JSON.stringify({
            sessionId,
            message: cleanAnswer,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Chat API failed with status ${response.status}`);
        }

        let fullReply = "";
        let nextQuestionIndex = currentQuestionIndex;
        let isCompleteInterview = false;

        // Initialize placeholder AI message for streaming
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "",
            timestamp: Date.now(),
          },
        ]);

        if (response.body && response.headers.get("content-type")?.includes("text/event-stream")) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("data: ")) {
                try {
                  const eventData = JSON.parse(trimmed.slice(6));
                  if (eventData.type === "token" && eventData.text) {
                    fullReply += eventData.text;
                    setMessages((prev) => {
                      const updated = [...prev];
                      const lastIdx = updated.length - 1;
                      if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
                        updated[lastIdx] = {
                          ...updated[lastIdx],
                          content: fullReply,
                        };
                      }
                      return updated;
                    });
                  } else if (eventData.type === "complete") {
                    fullReply = eventData.reply || fullReply;
                    nextQuestionIndex = eventData.currentQuestionIndex ?? nextQuestionIndex;
                    isCompleteInterview = !!eventData.isComplete;
                  }
                } catch {}
              }
            }
          }
        } else {
          const data = await response.json();
          fullReply = data.reply;
          nextQuestionIndex = data.nextQuestionIndex;
          isCompleteInterview = data.isComplete;
          setMessages((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: fullReply,
              };
            }
            return updated;
          });
        }

        setCurrentQuestionIndex(nextQuestionIndex);
        setIsProcessing(false);

        // Speak the completed interviewer reply
        if (fullReply) {
          await speak(fullReply);
        }

        if (isCompleteInterview) {
          setIsComplete(true);
        }
      } catch (error: any) {
        console.error("Error processing response:", error);
        setIsProcessing(false);
        toast({
          title: "Interviewer Response Error",
          description: error?.message || "Failed to process your response. Please try again.",
          variant: "destructive",
        });
      }
    },
    [sessionId, currentQuestionIndex, speak, toast]
  );

  // Keep ref updated
  useEffect(() => {
    handleUserResponseRef.current = handleUserResponse;
  }, [handleUserResponse]);

  // Initialize Web Speech API with resilient continuous capture
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let newFinal = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0]?.transcript || "";
        if (item.isFinal) {
          newFinal += text + " ";
        } else {
          interim += text;
        }
      }

      if (newFinal) {
        setCandidateAnswer((prev) => {
          const cleanPrev = prev.trim();
          const cleanNew = newFinal.trim();
          return cleanPrev ? `${cleanPrev} ${cleanNew}` : cleanNew;
        });
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn("Speech recognition notice:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        isListeningRef.current = false;
        setIsListening(false);
        toast({
          title: "Microphone Access Denied",
          description: "Please enable microphone permission in your browser or type your response.",
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => {
      // If the user intended to keep speaking, Chrome automatically times out continuous mode after silence.
      // Auto-restart recognition so long answers are never interrupted!
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch {}
      } else {
        setIsListening(false);
        setInterimTranscript("");
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isListeningRef.current = false;
      try {
        recognition.abort();
      } catch {}
    };
  }, [toast]);

  // Toggle microphone dictation
  const toggleListening = useCallback(() => {
    if (isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      try {
        recognitionRef.current?.stop();
      } catch {}
    } else {
      if (isSpeaking) {
        toast({
          title: "Please wait",
          description: "Wait for the AI interviewer to finish speaking before answering.",
        });
        return;
      }

      if (!recognitionRef.current) {
        toast({
          title: "Speech Recognition Unavailable",
          description: "Speech-to-text is not supported by this browser. You can type your answer below.",
        });
        return;
      }

      try {
        isListeningRef.current = true;
        setIsListening(true);
        recognitionRef.current.start();
      } catch (err: any) {
        console.warn("Recognition start error:", err.message);
      }
    }
  }, [isListening, isSpeaking, toast]);

  // Submit the candidate's answer
  const submitCandidateAnswer = useCallback(() => {
    const fullText = (candidateAnswer + (interimTranscript ? ` ${interimTranscript}` : "")).trim();
    if (!fullText) {
      toast({
        title: "Empty Response",
        description: "Please speak or type your answer before submitting.",
      });
      return;
    }

    if (isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      try {
        recognitionRef.current?.stop();
      } catch {}
    }

    if (handleUserResponseRef.current) {
      handleUserResponseRef.current(fullText);
    }
  }, [candidateAnswer, interimTranscript, isListening, toast]);

  // Handle finishing the interview and saving transcript
  const handleEndInterview = useCallback(async () => {
    try {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (!authSession?.access_token) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to save your interview.",
          variant: "destructive",
        });
        return;
      }

      const transcript = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }));

      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          transcript: JSON.stringify(transcript),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save session: ${errorText}`);
      }

      window.location.href = `/sessions/${sessionId}`;
    } catch (error) {
      console.error("Error ending interview:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save interview.",
        variant: "destructive",
      });
    }
  }, [sessionId, messages, toast]);

  const progressPercent = Math.min(
    100,
    Math.round(((currentQuestionIndex + 1) / Math.max(1, questions.length)) * 100)
  );

  const wordCount = (candidateAnswer + (interimTranscript ? ` ${interimTranscript}` : ""))
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 text-slate-100">
      <Card className="p-6 md:p-8 bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-2xl rounded-2xl">
        {/* Header with Provider Badges */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Live Voice Interview
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> STT / TTS Mode
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                NVIDIA Nemotron STAR
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1.5">
              {isComplete ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Interview Completed! Ready for STAR Evaluation.
                </span>
              ) : (
                <>
                  Question <span className="text-white font-semibold">{currentQuestionIndex + 1}</span> of{" "}
                  <span className="text-white font-semibold">{questions.length}</span>
                  {questions[currentQuestionIndex]?.focus && (
                    <span className="text-slate-400 ml-2">
                      • Focus: <span className="text-slate-200">{questions[currentQuestionIndex].focus}</span>
                    </span>
                  )}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isSpeaking && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse text-sm font-medium">
                <Volume2 className="w-4 h-4 text-blue-400 animate-bounce" />
                <span>Interviewer Speaking...</span>
              </div>
            )}
            {isProcessing && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Nemotron Analyzing...</span>
              </div>
            )}
            {isListening && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse text-sm font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span>Listening... Speak freely</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {!isComplete && (
          <div className="py-3">
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Welcome Screen before starting */}
        {!hasStarted ? (
          <div className="py-10 text-center space-y-6 max-w-xl mx-auto">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 text-blue-400 shadow-xl shadow-blue-500/10">
              <Volume2 className="w-10 h-10 text-blue-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Ready for your behavioral interview?</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                NVIDIA Nemotron has prepared <strong className="text-white">{questions.length} personalized STAR questions</strong> tailored to your background. You can speak naturally into your microphone or type your answers.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 text-left space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">First Question Preview</div>
              <div className="text-sm font-medium text-slate-100">
                &ldquo;{questions[0]?.question}&rdquo;
              </div>
            </div>

            <Button
              onClick={startInterview}
              disabled={isSpeaking}
              className="w-full max-w-sm py-6 text-base font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-blue-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-5 h-5 mr-2 fill-white" />
              Start Interview
            </Button>
          </div>
        ) : (
          <>
            {/* Conversation Messages Transcript */}
            <div className="space-y-4 my-6 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl shadow-sm transition-all ${
                    msg.role === "assistant"
                      ? "bg-blue-950/40 border border-blue-500/30 text-slate-100 ml-0 mr-8 md:mr-16"
                      : "bg-emerald-950/40 border border-emerald-500/30 text-slate-100 ml-8 md:ml-16 mr-0"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        msg.role === "assistant" ? "text-blue-400" : "text-emerald-400"
                      }`}
                    >
                      {msg.role === "assistant" ? "AI Interviewer (Nemotron)" : "You (Candidate)"}
                    </span>
                  </div>
                  <div className="text-sm leading-relaxed text-slate-100 whitespace-pre-wrap font-normal">
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Candidate Response Workspace */}
            {!isComplete && (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium text-slate-300">
                    <Mic className="w-3.5 h-3.5 text-blue-400" />
                    Your Answer (Speak into microphone or type below)
                  </span>
                  <span className={wordCount >= 35 ? "text-emerald-400 font-semibold" : "text-slate-400"}>
                    {wordCount} words {wordCount >= 35 ? "✓ (Good STAR detail)" : "(Aim for 35+ words)"}
                  </span>
                </div>

                <div className="relative rounded-xl border border-slate-700 bg-slate-950/70 focus-within:border-blue-500 transition-all p-2">
                  <Textarea
                    value={candidateAnswer}
                    onChange={(e) => setCandidateAnswer(e.target.value)}
                    placeholder="Speak your answer or type here... (Describe Situation, Task, Action you took, and measurable Results)"
                    className="w-full bg-transparent border-none text-slate-100 placeholder:text-slate-500 resize-none min-h-[90px] focus-visible:ring-0 text-sm leading-relaxed"
                    disabled={isProcessing}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        submitCandidateAnswer();
                      }
                    }}
                  />

                  {/* Live speech transcription pulse */}
                  {interimTranscript && (
                    <div className="px-3 py-1.5 text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg animate-pulse flex items-center gap-2 mt-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                      <span>{interimTranscript}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 mt-2 px-1">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={toggleListening}
                        disabled={isSpeaking || isProcessing}
                        className={`font-semibold text-xs px-3.5 py-1.5 rounded-lg transition-all ${
                          isListening
                            ? "bg-red-600 hover:bg-red-500 text-white animate-pulse"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                        }`}
                      >
                        {isListening ? (
                          <>
                            <MicOff className="w-3.5 h-3.5 mr-1.5" />
                            Pause Mic
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                            Speak (Mic)
                          </>
                        )}
                      </Button>
                      <span className="text-[11px] text-slate-500 hidden sm:inline">
                        Ctrl+Enter to submit
                      </span>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={submitCandidateAnswer}
                      disabled={isProcessing || (!candidateAnswer.trim() && !interimTranscript.trim())}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-md shadow-blue-500/20 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Nemotron Evaluating...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          Submit Answer
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEndInterview}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Finish Interview Early
                  </Button>
                </div>
              </div>
            )}

            {isComplete && (
              <div className="pt-6 border-t border-slate-800 flex justify-center">
                <Button
                  onClick={handleEndInterview}
                  className="py-5 px-8 text-base font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  View STAR Evaluation Report
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
