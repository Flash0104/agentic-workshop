// OpenAI Realtime API client utilities

export interface RealtimeMessage {
  type: string;
  [key: string]: unknown;
}

export interface RealtimeConfig {
  apiKey: string;
  model?: string;
  voice?: "alloy" | "echo" | "shimmer";
  instructions?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onAudioResponse?: (audio: ArrayBuffer) => void;
  onTranscript?: (text: string, role: "user" | "assistant") => void;
  onFunctionCall?: (name: string, args: unknown) => void;
}

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private config: RealtimeConfig;
  private audioContext: AudioContext | null = null;
  private connected = false;
       private hasLoggedError = false;
       private isConnecting = false;
       private retryTimer: number | null = null;
       private errorCount = 0;

        constructor(config: RealtimeConfig) {
    this.config = {
      model: "gpt-realtime", // GA model name
      voice: "alloy",
      ...config,
    };
  }

  async connect() {
    if (this.connected || this.isConnecting) {
      console.warn("Already connected to Realtime API");
      return;
    }

    this.isConnecting = true;

    // Connect to our WebSocket proxy server instead of directly to OpenAI
    // The proxy handles authentication and forwards messages bidirectionally
    const proxyUrl = process.env.NEXT_PUBLIC_WS_PROXY_URL || 'ws://localhost:8080';
    
    console.log("🔗 Connecting to WebSocket proxy:", proxyUrl);
    console.log("📋 Model:", this.config.model);
    console.log("🎤 Voice:", this.config.voice);

    try {
      this.ws = new WebSocket(proxyUrl);
      console.log("📡 WebSocket object created");
      console.log("📡 WebSocket URL:", this.ws.url);
      console.log("📡 WebSocket readyState:", this.ws.readyState, "(0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)");
      console.log("📡 WebSocket protocol:", this.ws.protocol);
      // Prefer ArrayBuffer for binary audio frames
      this.ws.binaryType = "arraybuffer";
      this.hasLoggedError = false;
      this.errorCount = 0;
    } catch (error) {
      console.error("❌ Failed to create WebSocket:", error);
      this.isConnecting = false;
      this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    this.ws.onopen = () => {
      console.log("✅ Connected to WebSocket proxy at", proxyUrl);
      console.log("📤 Sending initialization to OpenAI...");
      this.hasLoggedError = false;
      this.isConnecting = false;
      this.errorCount = 0;
      
      // Send init message to proxy with configuration (GA format)
      this.send({
        type: "init",
        model: this.config.model,
        sessionConfig: {
          type: "realtime", // Required for GA interface
          voice: this.config.voice,
          instructions: this.config.instructions || "",
        },
      });
    };

    this.ws.onmessage = (event) => {
      try {
        // Handle binary audio data
        if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
          console.log("📦 Received binary audio data");
          // Convert Blob to ArrayBuffer if needed
          if (event.data instanceof Blob) {
            event.data.arrayBuffer().then((buffer) => {
              this.config.onAudioResponse?.(buffer);
            });
          } else {
            this.config.onAudioResponse?.(event.data);
          }
          return;
        }
        
        // Handle JSON messages
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    this.ws.onerror = (error) => {
      // Avoid flooding the console with redundant errors on dev HMR/strict mode
      if (this.hasLoggedError) return;
      this.hasLoggedError = true;
      this.errorCount += 1;
      const state = this.ws?.readyState;
      const wsError = error as any;
      const msg = wsError?.message ? String(wsError.message) : "WebSocket error";
      console.warn(`Realtime WS warning: ${msg} (state=${state})`);
      if (wsError?.code) console.warn("Code:", wsError.code);

      // Early errors are common during dev reload; attempt quick retry
      if (!this.connected && this.retryTimer == null) {
        this.retryTimer = (setTimeout(() => {
          this.retryTimer = null;
          this.disconnect();
          this.connect().catch(() => {});
        }, 400) as unknown) as number;
        return;
      }

      // Surface an error only after multiple failures
      if (this.errorCount >= 2) {
        this.config.onError?.(new Error("Realtime connection problem. Please retry."));
      }
    };
    
    this.ws.onclose = (event) => {
      console.warn("🔌 WebSocket closed:", event.code, event.reason || "(no reason)");
      this.connected = false;
      this.isConnecting = false;
      // Only auto-retry on 1006 (abnormal closure), not 1005 (normal close without status)
      if (event.code === 1006 && this.retryTimer == null) {
        console.log("⚠️ Abnormal closure, retrying in 1s...");
        this.retryTimer = (setTimeout(() => {
          this.retryTimer = null;
          this.connect().catch(() => {});
        }, 1000) as unknown) as number;
      }
      this.config.onDisconnect?.();
    };
  }

  private handleMessage(message: RealtimeMessage) {
    switch (message.type) {
      case "connected":
        // Proxy has connected to OpenAI
        console.log("Proxy connected to OpenAI Realtime API");
        this.connected = true;
        this.config.onConnect?.();
        break;
        
      case "session.created":
      case "session.updated":
        console.log("Session configured:", message);
        break;

      case "conversation.item.created":
        console.log("Conversation item created:", message);
        break;

      case "response.audio.delta":
      case "response.output_audio.delta": // GA event name
        // Received audio chunk from assistant
        if (message.delta && typeof message.delta === "string") {
          const audioData = this.base64ToArrayBuffer(message.delta);
          this.config.onAudioResponse?.(audioData);
        }
        break;

      case "response.audio_transcript.delta":
      case "response.output_audio_transcript.delta": // GA event name
        // Received transcript chunk
        if (message.delta && typeof message.delta === "string") {
          this.config.onTranscript?.(message.delta, "assistant");
        }
        break;
      
      case "response.text.delta":
      case "response.output_text.delta": // GA event name
        // Received text chunk
        if (message.delta && typeof message.delta === "string") {
          this.config.onTranscript?.(message.delta, "assistant");
        }
        break;

      case "input_audio_buffer.speech_started":
        console.log("User started speaking");
        break;

      case "input_audio_buffer.speech_stopped":
        console.log("User stopped speaking");
        break;

      case "conversation.item.input_audio_transcription.completed":
        // User's speech was transcribed
        if (message.transcript && typeof message.transcript === "string") {
          this.config.onTranscript?.(message.transcript, "user");
        }
        break;

      case "response.done":
        console.log("Response complete:", message);
        break;

      case "error":
        console.error("Realtime API error:", message);
        this.config.onError?.(new Error((message.error as any)?.message || "Unknown error"));
        break;

      default:
        // console.log("Unhandled message type:", message.type);
        break;
    }
  }

  send(message: RealtimeMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Demote to warn to avoid noisy "issues" when UI renders before connect
      console.warn("Realtime not ready (state=", this.ws?.readyState, ") - skipping send");
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  sendAudio(audioData: ArrayBuffer) {
    const base64 = this.arrayBufferToBase64(audioData);
    this.send({
      type: "input_audio_buffer.append",
      audio: base64,
    });
  }

  commitAudio() {
    this.send({
      type: "input_audio_buffer.commit",
    });
  }

  createResponse() {
    this.send({
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
      },
    });
  }

  sendText(text: string) {
    this.send({
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
    });
    
    this.createResponse();
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}


