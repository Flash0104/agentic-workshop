import type { Message } from "@/lib/schemas";
import { create } from "zustand";

export type Mode = "easy" | "normal" | "hard";
export type Language = "en" | "de";
export type Scenario = "interview" | "sales";

interface SessionState {
  sessionId: string | null;
  messages: Message[];
  mode: Mode;
  language: Language;
  scenario: Scenario;
  isRecording: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  
  setSessionId: (id: string) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setMode: (mode: Mode) => void;
  setLanguage: (language: Language) => void;
  setScenario: (scenario: Scenario) => void;
  setIsRecording: (recording: boolean) => void;
  setIsSpeaking: (speaking: boolean) => void;
  setIsProcessing: (processing: boolean) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  messages: [],
  mode: "normal",
  language: "en",
  scenario: "interview",
  isRecording: false,
  isSpeaking: false,
  isProcessing: false,

  setSessionId: (id) => set({ sessionId: id }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
  setMode: (mode) => set({ mode }),
  setLanguage: (language) => set({ language }),
  setScenario: (scenario) => set({ scenario }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  reset: () =>
    set({
      sessionId: null,
      messages: [],
      mode: "normal",
      language: "en",
      scenario: "interview",
      isRecording: false,
      isSpeaking: false,
      isProcessing: false,
    }),
}));








