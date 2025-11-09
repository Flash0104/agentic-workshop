"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Send, Loader2 } from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface RealtimeVoiceChatProps {
  sessionId: string;
  questions: { question: string; focus: string }[];
  jobDescription: string;
  cvText: string;
  onComplete: () => void;
}

export default function RealtimeVoiceChat({
  sessionId,
  questions,
  jobDescription,
  cvText,
  onComplete,
}: RealtimeVoiceChatProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [textInput, setTextInput] = useState("");
  const { toast } = useToast();

  // Build instructions for the AI - memoized to prevent reconnections
  const instructions = useMemo(() => `You are an experienced job interviewer conducting a professional interview. 

CONTEXT:
Job Description: ${jobDescription}

Candidate's CV Summary: ${cvText.slice(0, 1000)}... (truncated for brevity)

You will ask the candidate ${questions.length} specific questions, one at a time. These questions were generated based on their CV and the job requirements. After each question, wait for their complete answer before moving to the next question.

The questions you should ask are:
${questions.map((q, i) => `${i + 1}. ${q.question} (Focus: ${q.focus})`).join("\n")}

Guidelines:
- Ask only ONE question at a time
- Listen carefully to the candidate's full response
- Provide brief acknowledgments (e.g., "I see", "Interesting", "Thank you")
- You may ask brief follow-up questions if the answer is unclear or incomplete
- Do NOT provide feedback or evaluation during the interview
- Keep your responses natural and conversational
- After all questions are answered, say "Thank you for your time. The interview is now complete."

Start by introducing yourself briefly and asking the first question.`, [jobDescription, cvText, questions]);

  // Memoize error handler to prevent reconnections
  const handleError = useCallback((error: Error) => {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  }, [toast]);

  const {
    isConnected,
    isRecording,
    messages,
    currentTranscript,
    startRecording,
    stopRecording,
    sendMessage,
  } = useRealtime({
    apiKey: "proxy", // Proxy handles auth, this is just a placeholder
    instructions,
    onError: handleError,
  });

  // Track when all questions have been answered
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage?.role === "assistant" &&
      lastMessage.content.toLowerCase().includes("interview is now complete")
    ) {
      setTimeout(() => {
        onComplete();
      }, 2000);
    }
  }, [messages, onComplete]);

  const handleTextSend = () => {
    if (!textInput.trim()) return;
    sendMessage(textInput);
    setTextInput("");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Live Interview</h2>
            <p className="text-sm text-gray-400 mt-1">
              {isConnected ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Connecting...
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Progress</p>
            <p className="text-lg font-semibold text-white">
              Question {Math.min(currentQuestionIndex + 1, questions.length)} of {questions.length}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <Card
              className={`max-w-[80%] p-4 ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-purple-500/30"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <p className="text-sm text-gray-400 mb-1">
                {msg.role === "user" ? "You" : "Interviewer"}
              </p>
              <p className="text-white">{msg.content}</p>
            </Card>
          </div>
        ))}

        {currentTranscript && (
          <div className="flex justify-end">
            <Card className="max-w-[80%] p-4 bg-purple-500/10 border-purple-500/20">
              <p className="text-sm text-gray-400 mb-1">You (speaking...)</p>
              <p className="text-white opacity-70">{currentTranscript}</p>
            </Card>
          </div>
        )}
      </div>

      {/* Input Controls */}
      <div className="p-6 border-t border-white/10">
        <div className="flex gap-3">
          {/* Voice Input */}
          <Button
            size="lg"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!isConnected}
            className={`${
              isRecording
                ? "bg-red-500 hover:bg-red-600"
                : "bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            } text-white px-6`}
          >
            {isRecording ? (
              <>
                <MicOff className="w-5 h-5 mr-2" />
                Stop Recording
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 mr-2" />
                Start Recording
              </>
            )}
          </Button>

          {/* Text Input */}
          <div className="flex-1 flex gap-2">
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleTextSend()}
              placeholder="Or type your answer..."
              disabled={!isConnected || isRecording}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            />
            <Button
              onClick={handleTextSend}
              disabled={!isConnected || !textInput.trim() || isRecording}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-3 text-center">
          Press and hold the microphone button to speak, or type your response
        </p>
      </div>
    </div>
  );
}


