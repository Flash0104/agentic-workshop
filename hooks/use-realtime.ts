import { RealtimeClient } from "@/lib/realtime";
import { useCallback, useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface UseRealtimeProps {
  apiKey: string;
  instructions: string;
  onError?: (error: Error) => void;
}

export function useRealtime({ apiKey, instructions, onError }: UseRealtimeProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  
  const clientRef = useRef<RealtimeClient | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sinkGainRef = useRef<GainNode | null>(null);
  const prevInstructionsRef = useRef<string>(instructions);
  
  // Store onError in a ref to avoid recreating the client when it changes
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Initialize Realtime client - create once, don't recreate unless instructions actually change
  useEffect(() => {
    console.log("📌 useEffect triggered. API key:", !!apiKey, "Has client:", !!clientRef.current);
    
    if (!apiKey) {
      console.log("❌ No API key, skipping init");
      return; // No API key
    }

    // Skip if we already have a connected client AND instructions haven't changed
    if (clientRef.current?.isConnected() && prevInstructionsRef.current === instructions) {
      console.log("✅ Client connected and instructions unchanged, skipping init");
      return;
    }

    // Instructions changed or first init - clean up old client if exists
    if (clientRef.current) {
      console.log("🔄 Cleaning up old client...");
      clientRef.current.disconnect();
      clientRef.current = null;
      // Wait a bit for cleanup to complete
      return;
    }

    prevInstructionsRef.current = instructions;
    console.log("🚀 Initializing RealtimeClient (timestamp:", Date.now(), ")");
    console.log("Instructions length:", instructions.length);
    
    const client = new RealtimeClient({
      apiKey,
      model: "gpt-realtime",
      voice: "alloy",
      instructions,
      onConnect: () => {
        console.log("Realtime API connected");
        setIsConnected(true);
      },
      onDisconnect: () => {
        console.log("Realtime API disconnected");
        setIsConnected(false);
      },
      onError: (error) => {
        console.error("Realtime error:", error);
        onErrorRef.current?.(error);
      },
      onAudioResponse: (audio) => {
        console.log("🎤 onAudioResponse called with", audio.byteLength, "bytes");
        audioQueueRef.current.push(audio);
        console.log("📥 Added to queue, new queue length:", audioQueueRef.current.length);
        if (!isPlayingRef.current) {
          console.log("▶️ Starting playback (was not already playing)");
          playNextAudio();
        } else {
          console.log("⏩ Already playing, will queue this chunk");
        }
      },
      onTranscript: (text, role) => {
        if (role === "user") {
          setCurrentTranscript((prev) => prev + text);
        } else {
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === "assistant" && Date.now() - lastMsg.timestamp < 1000) {
              return [
                ...prev.slice(0, -1),
                { ...lastMsg, content: lastMsg.content + text },
              ];
            }
            return [...prev, { role, content: text, timestamp: Date.now() }];
          });
        }
      },
    });

    clientRef.current = client;
    client.connect().catch((error) => {
      console.error("Failed to connect:", error);
      onErrorRef.current?.(error);
    });

    return () => {
      console.log("🧹 Cleaning up RealtimeClient");
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [apiKey]); // Only depend on apiKey, instructions checked manually above

  // Play audio queue
  const playNextAudio = useCallback(async () => {
    console.log("🎵 playNextAudio called, queue length:", audioQueueRef.current.length);
    
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      console.log("⏸️ Audio queue empty, stopping playback");
      return;
    }

    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift()!;
    console.log("🔊 Processing audio chunk:", audioData.byteLength, "bytes");
    
    if (!audioData || audioData.byteLength === 0) {
      console.warn("⚠️ Empty audio data, skipping");
      isPlayingRef.current = false;
      return;
    }

    if (!audioContextRef.current) {
      console.log("🎧 Creating AudioContext (24kHz)");
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }

    try {
      // OpenAI Realtime outputs raw PCM16 when configured with output_audio_format: "pcm16"
      // decodeAudioData expects encoded formats (mp3/wav). Manually convert PCM16 -> AudioBuffer.
      const aligned =
        audioData.byteLength % 2 === 0
          ? audioData
          : audioData.slice(0, audioData.byteLength - 1);
      const pcm16 = new Int16Array(aligned);
      console.log("📊 PCM16 samples:", pcm16.length, "First values:", pcm16.slice(0, 5));
      
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        // Convert signed 16-bit PCM to normalized float32 [-1, 1]
        float32[i] = Math.max(-1, Math.min(1, pcm16[i] / 32768));
      }

      // Server sends output at 24000 Hz; build buffer at 24000 to avoid artifacts
      const sampleRate = 24000;
      const numChannels = 1; // PCM16 is mono by default from Realtime API
      const audioBuffer = audioContextRef.current.createBuffer(
        numChannels,
        float32.length,
        sampleRate
      );
      audioBuffer.copyToChannel(float32, 0);

      console.log("🎵 Audio buffer created, duration:", audioBuffer.duration.toFixed(2), "seconds");

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        console.log("✅ Audio chunk finished playing");
        playNextAudio();
      };
      
      source.start();
    } catch (error) {
      console.error("Unable to decode audio data", error);
      playNextAudio();
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    // Resume AudioContext on user gesture (required by browsers)
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      console.log("🎧 Resuming AudioContext (user gesture)...");
      await audioContextRef.current.resume();
      console.log("✅ AudioContext resumed, state:", audioContextRef.current.state);
      // Start playing queued audio now that we have user permission
      if (audioQueueRef.current.length > 0 && !isPlayingRef.current) {
        console.log("🔊 Playing queued audio chunks:", audioQueueRef.current.length);
        playNextAudio();
      }
    }
    
    // Wait up to 3 seconds for connection if not connected yet
    let retries = 15; // 15 * 200ms = 3s
    while (!clientRef.current?.isConnected() && retries > 0) {
      console.log("Waiting for Realtime API connection...");
      await new Promise(resolve => setTimeout(resolve, 200));
      retries--;
    }
    
    if (!clientRef.current?.isConnected()) {
      console.error("Not connected to Realtime API after waiting");
      onErrorRef.current?.(new Error("Failed to connect. Please refresh and try again."));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }

      const audioCtx = audioContextRef.current;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // Create a silent sink so the processor runs without feedback
      const sinkGain = audioCtx.createGain();
      sinkGain.gain.value = 0;
      sinkGainRef.current = sinkGain;

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(sinkGain);
      sinkGain.connect(audioCtx.destination);

      let audioChunkCount = 0;
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0); // float32 [-1,1]
        // Convert to PCM16 little-endian
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          let s = Math.max(-1, Math.min(1, input[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        clientRef.current?.sendAudio(pcm.buffer);
        audioChunkCount++;
        if (audioChunkCount % 50 === 0) {
          console.log(`🎤 Sent ${audioChunkCount} audio chunks (${(pcm.buffer.byteLength / 1024).toFixed(1)} KB total)`);
        }
      };

      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      onError?.(error as Error);
    }
  }, [onError]);

  // Stop recording
  const stopRecording = useCallback(() => {
    console.log("🛑 Stopping recording...");
    
    // Teardown Web Audio graph
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (sinkGainRef.current) {
      sinkGainRef.current.disconnect();
      sinkGainRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    setIsRecording(false);

    // Manually request response after stopping recording
    // This is more reliable than relying on server VAD for button-based interaction
    if (clientRef.current) {
      console.log("📤 Requesting AI response...");
      clientRef.current.createResponse();
    }

    // Save user transcript
    if (currentTranscript) {
      console.log("💬 User transcript:", currentTranscript);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: currentTranscript, timestamp: Date.now() },
      ]);
      setCurrentTranscript("");
    } else {
      console.warn("⚠️ No transcript received from OpenAI");
    }
  }, [currentTranscript]);

  // Send text message
  const sendMessage = useCallback((text: string) => {
    if (!clientRef.current?.isConnected()) {
      console.error("Not connected to Realtime API");
      return;
    }

    clientRef.current.sendText(text);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: Date.now() },
    ]);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    isRecording,
    messages,
    currentTranscript,
    startRecording,
    stopRecording,
    sendMessage,
  };
}


