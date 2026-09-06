"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface RealtimeTranscriptItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface UseWebRTCRealtimeProps {
  sessionId: string;
  instructions: string;
  onError?: (error: Error) => void;
  onInterviewComplete?: () => void;
}

export function useWebRTCRealtime({
  sessionId,
  instructions,
  onError,
  onInterviewComplete,
}: UseWebRTCRealtimeProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<RealtimeTranscriptItem[]>([]);
  const [activeInterviewerTranscript, setActiveInterviewerTranscript] = useState("");
  const [activeUserTranscript, setActiveUserTranscript] = useState("");

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localMediaStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const seenItemIdsRef = useRef<Set<string>>(new Set());

  // Error callback ref to keep identity stable
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const onInterviewCompleteRef = useRef(onInterviewComplete);
  useEffect(() => {
    onInterviewCompleteRef.current = onInterviewComplete;
  }, [onInterviewComplete]);

  // Teardown all media and connections
  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up WebRTC Realtime connection...");
    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch {}
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }

    if (localMediaStreamRef.current) {
      localMediaStreamRef.current.getTracks().forEach((track) => track.stop());
      localMediaStreamRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const connect = useCallback(async () => {
    if (isConnected || isConnecting) return;

    setIsConnecting(true);
    console.log("🚀 Starting WebRTC Realtime setup for session:", sessionId);

    try {
      // 1. Get Supabase auth token
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (!authSession?.access_token) {
        throw new Error("Authentication required to start live voice session.");
      }

      // 2. Request ephemeral key from server
      const sessionRes = await fetch("/api/realtime/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
          instructions,
        }),
      });

      if (!sessionRes.ok) {
        const errJson = await sessionRes.json().catch(() => ({}));
        throw new Error(
          errJson.error || `Failed to create voice session: HTTP ${sessionRes.status}`
        );
      }

      const { clientSecret, model } = await sessionRes.json();
      if (!clientSecret) {
        throw new Error("Server did not return a valid ephemeral token.");
      }

      console.log("🔑 Ephemeral key received. Initializing RTCPeerConnection...");

      // 3. Request microphone access
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localMediaStreamRef.current = localStream;

      // 4. Create RTCPeerConnection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Remote audio output
      if (!audioElementRef.current) {
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audioElementRef.current = audio;
      }

      pc.ontrack = (event) => {
        console.log("🔊 Received remote audio track from OpenAI Realtime");
        if (audioElementRef.current && event.streams[0]) {
          audioElementRef.current.srcObject = event.streams[0];
        }
      };

      // Add local audio track
      localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      // 5. Create Data Channel for events
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log("✅ DataChannel open - WebRTC connected to OpenAI Realtime");
        setIsConnected(true);
        setIsConnecting(false);
      };

      dc.onclose = () => {
        console.log("🔌 DataChannel closed");
        setIsConnected(false);
      };

      dc.onmessage = (event) => {
        try {
          const realtimeEvent = JSON.parse(event.data);
          handleRealtimeEvent(realtimeEvent);
        } catch (e) {
          console.error("Error parsing realtime event", e);
        }
      };

      // 6. Create SDP Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 7. Send SDP Offer to OpenAI Realtime endpoint using ephemeral key
      // GA WebRTC endpoint is https://api.openai.com/v1/realtime/calls
      let sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          "Content-Type": "application/sdp",
        },
      });

      // Fallback to legacy preview endpoint if calls returns 404
      if (sdpResponse.status === 404) {
        const baseUrl = "https://api.openai.com/v1/realtime";
        sdpResponse = await fetch(`${baseUrl}?model=${model || "gpt-realtime"}`, {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${clientSecret}`,
            "Content-Type": "application/sdp",
          },
        });
      }

      if (!sdpResponse.ok) {
        const errText = await sdpResponse.text();
        throw new Error(`OpenAI WebRTC handshake failed (${sdpResponse.status}): ${errText}`);
      }

      const answerSdp = await sdpResponse.text();
      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: answerSdp,
      };

      await pc.setRemoteDescription(answer);
      console.log("🤝 WebRTC handshake completed successfully");
    } catch (err: any) {
      console.error("WebRTC connection failed:", err);
      cleanup();
      onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [sessionId, instructions, isConnected, isConnecting, cleanup]);

  // Handle incoming OpenAI Realtime events
  const handleRealtimeEvent = useCallback((event: any) => {
    switch (event.type) {
      case "response.audio_transcript.delta":
      case "response.output_audio_transcript.delta":
        if (event.delta) {
          setActiveInterviewerTranscript((prev) => prev + event.delta);
        }
        break;

      case "response.output_item.done":
      case "response.done": {
        if (activeInterviewerTranscript.trim()) {
          const text = activeInterviewerTranscript.trim();
          const itemId = event.item?.id || `assistant-${Date.now()}`;

          if (!seenItemIdsRef.current.has(itemId)) {
            seenItemIdsRef.current.add(itemId);
            setTranscripts((prev) => [
              ...prev,
              {
                id: itemId,
                role: "assistant",
                content: text,
                timestamp: Date.now(),
              },
            ]);
          }
          setActiveInterviewerTranscript("");

          // Check if completion was signaled
          if (text.toLowerCase().includes("interview is now complete")) {
            setTimeout(() => {
              onInterviewCompleteRef.current?.();
            }, 2500);
          }
        }
        break;
      }

      case "conversation.item.input_audio_transcription.completed": {
        if (event.transcript) {
          const text = event.transcript.trim();
          const itemId = event.item_id || `user-${Date.now()}`;

          if (!seenItemIdsRef.current.has(itemId)) {
            seenItemIdsRef.current.add(itemId);
            setTranscripts((prev) => [
              ...prev,
              {
                id: itemId,
                role: "user",
                content: text,
                timestamp: Date.now(),
              },
            ]);
          }
          setActiveUserTranscript("");
        }
        break;
      }

      case "input_audio_buffer.speech_started":
        console.log("🎤 User started speaking (interruption detected)");
        setActiveUserTranscript("Speaking...");
        break;

      case "input_audio_buffer.speech_stopped":
        setActiveUserTranscript("");
        break;

      case "error":
        console.error("OpenAI Realtime protocol error:", event.error);
        onErrorRef.current?.(new Error(event.error?.message || "Realtime voice error"));
        break;

      default:
        break;
    }
  }, [activeInterviewerTranscript]);

  // Toggle microphone mute
  const toggleMute = useCallback(() => {
    if (localMediaStreamRef.current) {
      const audioTracks = localMediaStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  }, []);

  // Send textual message over data channel if needed
  const sendTextMessage = useCallback((text: string) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === "open") {
      const event = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text,
            },
          ],
        },
      };
      dataChannelRef.current.send(JSON.stringify(event));

      // Trigger response
      dataChannelRef.current.send(
        JSON.stringify({
          type: "response.create",
          response: { modalities: ["audio", "text"] },
        })
      );

      setTranscripts((prev) => [
        ...prev,
        {
          id: `manual-user-${Date.now()}`,
          role: "user",
          content: text,
          timestamp: Date.now(),
        },
      ]);
    }
  }, []);

  // Auto-persist transcripts on session end
  const persistTranscriptsToSession = useCallback(async () => {
    if (transcripts.length === 0) return;

    try {
      const { supabase } = await import("@/lib/supabase");
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (!authSession?.access_token) return;

      console.log("💾 Persisting finalized WebRTC transcript to session:", transcripts.length);

      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          transcript: JSON.stringify(transcripts),
        }),
      });
    } catch (e) {
      console.error("Failed to save realtime transcript:", e);
    }
  }, [sessionId, transcripts]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isConnected,
    isConnecting,
    isMuted,
    transcripts,
    activeInterviewerTranscript,
    activeUserTranscript,
    connect,
    disconnect: cleanup,
    toggleMute,
    sendTextMessage,
    persistTranscriptsToSession,
  };
}
