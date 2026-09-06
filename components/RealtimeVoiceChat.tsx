"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, PhoneCall, Send, Loader2, Sparkles } from "lucide-react";
import { useWebRTCRealtime } from "@/hooks/use-webrtc-realtime";
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
  const [textInput, setTextInput] = useState("");
  const { toast } = useToast();

  const instructions = useMemo(
    () => `JOB CONTEXT:
${jobDescription.slice(0, 1500)}

CANDIDATE PROFILE SUMMARY:
${cvText.slice(0, 1200)}

You will conduct a conversational behavioral interview. Follow the question plan sequentially.`,
    [jobDescription, cvText]
  );

  const handleError = useCallback(
    (error: Error) => {
      toast({
        title: "Voice Interview Error",
        description: error.message,
        variant: "destructive",
      });
    },
    [toast]
  );

  const {
    isConnected,
    isConnecting,
    isMuted,
    transcripts,
    activeInterviewerTranscript,
    activeUserTranscript,
    connect,
    disconnect,
    toggleMute,
    sendTextMessage,
    persistTranscriptsToSession,
  } = useWebRTCRealtime({
    sessionId,
    instructions,
    onError: handleError,
  });

  const handleEndInterview = async () => {
    disconnect();
    await persistTranscriptsToSession();
    onComplete();
  };

  const handleTextSend = () => {
    if (!textInput.trim()) return;
    sendTextMessage(textInput);
    setTextInput("");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white">Live Voice Interview</h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> WebRTC Audio
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Spoken conversation: <strong>OpenAI Realtime</strong> | Question Plan & Evaluation: <strong>NVIDIA Nemotron</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!isConnected ? (
              <Button
                onClick={connect}
                disabled={isConnecting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting WebRTC...
                  </>
                ) : (
                  <>
                    <PhoneCall className="w-4 h-4 mr-2" />
                    Start Voice Interview
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={toggleMute}
                  className={`border-white/20 ${
                    isMuted ? "bg-red-500/20 text-red-300" : "text-white"
                  }`}
                >
                  {isMuted ? (
                    <>
                      <MicOff className="w-4 h-4 mr-2 text-red-400" />
                      Unmute
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2 text-green-400" />
                      Mute Mic
                    </>
                  )}
                </Button>

                <Button
                  variant="destructive"
                  onClick={handleEndInterview}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <PhoneOff className="w-4 h-4 mr-2" />
                  End & Evaluate
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Transcript Log */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {transcripts.length === 0 && !activeInterviewerTranscript && !activeUserTranscript && (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-12">
            <Mic className="w-12 h-12 text-gray-500 mb-3 animate-pulse" />
            <p className="text-base font-medium text-white">Click &quot;Start Voice Interview&quot; to begin</p>
            <p className="text-xs text-gray-400 max-w-md mt-1">
              Nemotron has prepared your personalized questions. You can speak naturally into your microphone and interrupt whenever needed.
            </p>
          </div>
        )}

        {transcripts.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <Card
              className={`max-w-[80%] p-4 ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-purple-500/30"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <p className="text-xs text-gray-400 mb-1 font-semibold">
                {msg.role === "user" ? "Candidate (You)" : "Interviewer (OpenAI Realtime)"}
              </p>
              <p className="text-sm text-white leading-relaxed">{msg.content}</p>
            </Card>
          </div>
        ))}

        {/* Live streaming interviewer voice transcript */}
        {activeInterviewerTranscript && (
          <div className="flex justify-start">
            <Card className="max-w-[80%] p-4 bg-blue-500/10 border-blue-500/20 animate-pulse">
              <p className="text-xs text-blue-300 mb-1 font-semibold">Interviewer (Speaking...)</p>
              <p className="text-sm text-white">{activeInterviewerTranscript}</p>
            </Card>
          </div>
        )}

        {/* Live speech detected from user */}
        {activeUserTranscript && (
          <div className="flex justify-end">
            <Card className="max-w-[80%] p-4 bg-purple-500/10 border-purple-500/20">
              <p className="text-xs text-purple-300 mb-1 font-semibold">You (speaking...)</p>
              <p className="text-sm text-white/80">{activeUserTranscript}</p>
            </Card>
          </div>
        )}
      </div>

      {/* Input Controls */}
      <div className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <Input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTextSend()}
            placeholder={
              isConnected
                ? "Type a response or speak freely via microphone..."
                : "Connect voice interview above to begin..."
            }
            disabled={!isConnected}
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
          <Button
            onClick={handleTextSend}
            disabled={!isConnected || !textInput.trim()}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
