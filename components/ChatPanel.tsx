"use client";

import { Button } from "@/components/ui/button";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/lib/schemas";
import { useSessionStore } from "@/store/useSessionStore";
import { Send, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const {
    sessionId,
    messages,
    mode,
    language,
    scenario,
    isProcessing,
    setIsProcessing,
    addMessage,
  } = useSessionStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || !sessionId || isProcessing) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    };

    addMessage(userMessage);
    setInput("");
    setIsProcessing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          sessionId,
          messages: [...messages, userMessage],
          mode,
          language,
          scenario,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const { reply } = await response.json();

      const aiMessage: Message = {
        role: "ai",
        content: reply,
      };

      addMessage(aiMessage);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTranscript = (text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
  };

  const handlePlayAudio = async (text: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ text, language }),
      });

      if (!response.ok) throw new Error("TTS failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Clean up old URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      setAudioUrl(url);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch((err) => {
          // Ignore if play was interrupted (user navigated away)
          if (err.name !== 'AbortError') {
            console.error("Audio play error:", err);
          }
        });
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate audio",
        variant: "destructive",
      });
    }
  };

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Start a new session to begin
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 dark:border-white/10">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-lg backdrop-blur-xl border ${
                message.role === "user"
                  ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white border-white/20 shadow-blue-500/50"
                  : "bg-white/80 dark:bg-slate-800/80 border-white/20 dark:border-white/10"
              }`}
            >
              <div className="flex items-start gap-2">
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {message.role === "ai" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => handlePlayAudio(message.content)}
                  >
                    <Volume2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/20 dark:border-white/10 p-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-b-3xl">
        <div className="flex gap-2">
          <VoiceRecorder
            sessionId={sessionId}
            onTranscript={handleTranscript}
            disabled={isProcessing}
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Type your message..."
            disabled={isProcessing}
            className="flex-1 rounded-2xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl px-4 py-3 text-sm shadow-lg placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isProcessing}
            size="icon"
            className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-purple-500/50 transition-all hover:scale-105 active:scale-95"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}




