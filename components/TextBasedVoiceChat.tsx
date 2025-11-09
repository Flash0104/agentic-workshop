"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
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
  onerror: ((event: Event) => void) | null;
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

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handleUserResponseRef = useRef<((transcript: string) => Promise<void>) | null>(null);
  const { toast } = useToast();

  // Speak text using TTS API
  const speak = useCallback(async (text: string) => {
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
      toast({
        title: "Audio Error",
        description: "Failed to play audio response",
        variant: "destructive",
      });
    }
  }, [isSpeaking, toast]);

  // Start the interview with the first question
  const startInterview = useCallback(async () => {
    setHasStarted(true);
    const intro = `Hello! I'm conducting your interview today. Let's begin with the first question.`;
    const firstQuestion = questions[0].question;
    const fullMessage = `${intro} ${firstQuestion}`;

    setMessages([
      {
        role: "assistant",
        content: fullMessage,
        timestamp: Date.now(),
      },
    ]);

    await speak(fullMessage);
  }, [questions, speak]);

  // Handle user's spoken response
  const handleUserResponse = useCallback(
    async (transcript: string) => {
      setIsListening(false);
      setIsProcessing(true);

      // Add user message
      const newUserMessage = {
        role: "user" as const,
        content: transcript,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, newUserMessage]);

      try {
        // Build conversation history for context
        const conversationHistory = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        console.log("🎤 Sending to chat API:");
        console.log("  - questionIndex:", currentQuestionIndex);
        console.log("  - user said:", transcript);
        console.log("  - history length:", conversationHistory.length);

        // Send to GPT-4 for acknowledgment and next question
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: transcript,
            questionIndex: currentQuestionIndex,
            questions,
            conversationHistory, // Pass full history
            jobDescription,
            cvText,
          }),
        });

        if (!response.ok) {
          throw new Error("Chat API failed");
        }

        const { reply, nextQuestionIndex, isComplete } = await response.json();

        console.log("🤖 Received from chat API:");
        console.log("  - reply:", reply);
        console.log("  - nextQuestionIndex:", nextQuestionIndex);
        console.log("  - isComplete:", isComplete);

        // Add AI response
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: reply,
            timestamp: Date.now(),
          },
        ]);

        // Update question index
        setCurrentQuestionIndex(nextQuestionIndex);
        setIsProcessing(false);

        // Speak the response
        await speak(reply);

        // Check if interview is complete
        if (isComplete) {
          console.log("✅ Interview complete!");
          setIsComplete(true);
        }
      } catch (error) {
        console.error("Error processing response:", error);
        setIsProcessing(false);
        toast({
          title: "Error",
          description: "Failed to process your response",
          variant: "destructive",
        });
      }
    },
    [sessionId, currentQuestionIndex, questions, messages, jobDescription, cvText, speak, toast]
  );

  // Keep ref updated
  useEffect(() => {
    handleUserResponseRef.current = handleUserResponse;
  }, [handleUserResponse]);

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Keep listening continuously
      recognition.interimResults = true; // Show interim results
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      let finalTranscript = "";
      let silenceTimer: NodeJS.Timeout | null = null;

      recognition.onresult = (event) => {
        let interimTranscript = "";
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }

        console.log("Interim:", interimTranscript);
        console.log("Final so far:", finalTranscript);

        // Reset silence timer on any speech
        if (silenceTimer) {
          clearTimeout(silenceTimer);
        }

        // If we have final speech, wait 2 seconds of silence before submitting
        if (finalTranscript.trim()) {
          silenceTimer = setTimeout(() => {
            console.log("Silence detected, submitting:", finalTranscript);
            recognition.stop();
            // Use ref to get latest callback
            if (handleUserResponseRef.current) {
              handleUserResponseRef.current(finalTranscript.trim());
            }
            finalTranscript = "";
          }, 2000); // 2 seconds of silence
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (silenceTimer) clearTimeout(silenceTimer);
        setIsListening(false);
        if (event.error !== "no-speech" && event.error !== "aborted") {
          toast({
            title: "Speech Recognition Error",
            description: `Error: ${event.error}`,
            variant: "destructive",
          });
        }
      };

      recognition.onend = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      toast({
        title: "Speech Recognition Not Supported",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive",
      });
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [toast]);

  // Start/stop listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (isSpeaking) {
        toast({
          title: "Please wait",
          description: "Wait for the AI to finish speaking",
        });
        return;
      }

      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (error) {
        console.error("Error starting recognition:", error);
        toast({
          title: "Error",
          description: "Failed to start speech recognition",
          variant: "destructive",
        });
      }
    }
  }, [isListening, isSpeaking, toast]);

  // Handle finishing the interview
  const handleEndInterview = useCallback(async () => {
    try {
      // Get auth token
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

      // Save transcript to session
      const transcript = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }));

      console.log("💾 Saving interview...");
      console.log("  - sessionId:", sessionId);
      console.log("  - transcript messages:", transcript.length);
      console.log("  - has auth token:", !!authSession.access_token);

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

      console.log("📡 Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Error response:", errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || `Failed to save session (${response.status})`);
      }

      console.log("✅ Session saved successfully!");

      // Redirect to session review page
      window.location.href = `/sessions/${sessionId}`;
    } catch (error) {
      console.error("Error ending interview:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save interview. Please try again.",
        variant: "destructive",
      });
    }
  }, [sessionId, messages, toast]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card className="p-6 bg-white/5 border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Live Interview (STT/TTS)</h2>
            <p className="text-sm text-gray-400 mt-1">
              {isComplete ? (
                "Interview Complete!"
              ) : (
                <>Question {currentQuestionIndex + 1} of {questions.length}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSpeaking && (
              <div className="flex items-center gap-2 text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">AI Speaking...</span>
              </div>
            )}
            {isProcessing && (
              <div className="flex items-center gap-2 text-yellow-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Processing...</span>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg ${
                msg.role === "assistant"
                  ? "bg-blue-500/10 border border-blue-500/20"
                  : "bg-green-500/10 border border-green-500/20"
              }`}
            >
              <div className="text-xs text-gray-400 mb-1">
                {msg.role === "assistant" ? "Interviewer" : "You"}
              </div>
              <div className="text-sm">{msg.content}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-4">
          {!hasStarted ? (
            <Button
              onClick={startInterview}
              className="flex-1"
              disabled={isSpeaking}
            >
              Start Interview
            </Button>
          ) : isComplete ? (
            <Button
              onClick={handleEndInterview}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              End & Review Session
            </Button>
          ) : (
            <Button
              onClick={toggleListening}
              className={`flex-1 ${
                isListening
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-green-500 hover:bg-green-600"
              }`}
              disabled={isSpeaking || isProcessing}
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Start Recording
                </>
              )}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

