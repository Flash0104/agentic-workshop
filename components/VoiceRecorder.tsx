"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Mic, Square } from "lucide-react";
import { useRef, useState } from "react";

interface VoiceRecorderProps {
  sessionId: string;
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceRecorder({
  sessionId,
  onTranscript,
  disabled,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());

        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Error",
        description: "Failed to access microphone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("sessionId", sessionId);
      formData.append("audioMime", "audio/webm");

      const response = await fetch("/api/stt", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Transcription failed:", response.status, errorData);
        throw new Error(errorData.error || "Transcription failed");
      }

      const { text } = await response.json();
      if (text) {
        onTranscript(text);
      }
    } catch (error) {
      console.error("Error transcribing audio:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to transcribe audio",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!isRecording ? (
        <Button
          onClick={startRecording}
          disabled={disabled || isProcessing}
          variant="outline"
          size="icon"
          title="Start recording"
          className="h-12 w-12 rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-white/20 dark:border-white/10 hover:bg-white/80 dark:hover:bg-slate-800/80 shadow-lg transition-all hover:scale-105"
        >
          <Mic className="h-5 w-5" />
        </Button>
      ) : (
        <Button
          onClick={stopRecording}
          disabled={isProcessing}
          size="icon"
          title="Stop recording"
          className="h-12 w-12 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 shadow-lg shadow-red-500/50 animate-pulse transition-all"
        >
          <Square className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}




