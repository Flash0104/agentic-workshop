"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DocumentUpload from "@/components/DocumentUpload";
import RealtimeVoiceChat from "@/components/RealtimeVoiceChat";
import { TextBasedVoiceChat } from "@/components/TextBasedVoiceChat";
import { Loader2, CheckCircle2, ArrowRight, Mic, MessageSquare } from "lucide-react";

type FlowStep = "upload" | "generating" | "review" | "interview-stt" | "interview-realtime" | "complete";

interface GeneratedQuestion {
  question: string;
  focus: string;
}

export default function Home() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [flowStep, setFlowStep] = useState<FlowStep>("upload");
  const [jobDescription, setJobDescription] = useState("");
  const [cvText, setCvText] = useState("");
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [sessionId, setSessionId] = useState("");
  const { toast } = useToast();
  const router = useRouter();

  // Persist flow state across refresh for easier testing
  const STORAGE_KEY = "awt_interview_flow_state";

  useEffect(() => {
    checkAuth();
    // Try to restore flow from localStorage (after auth check kicks off)
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const snap = JSON.parse(raw) as {
          flowStep: FlowStep;
          sessionId: string;
          jobDescription: string;
          cvText: string;
          questions: GeneratedQuestion[];
        };
        if (snap?.flowStep && snap.sessionId) {
          setFlowStep(snap.flowStep);
          setSessionId(snap.sessionId);
          setJobDescription(snap.jobDescription || "");
          setCvText(snap.cvText || "");
          setQuestions(Array.isArray(snap.questions) ? snap.questions : []);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Save snapshot whenever core state changes (except initial "upload" with no data)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (flowStep !== "upload") {
        const snap = JSON.stringify({
          flowStep,
          sessionId,
          jobDescription,
          cvText,
          questions,
        });
        localStorage.setItem(STORAGE_KEY, snap);
      } else {
        // Clear snapshot when going back to upload
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [flowStep, sessionId, jobDescription, cvText, questions]);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
    }
    setIsCheckingAuth(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    router.push("/login");
  };

  const handleDocumentsReady = async (data: {
    jobDescription: string;
    cvText: string;
    cvPdfBase64?: string;
  }) => {
    setJobDescription(data.jobDescription);
    setCvText(data.cvText);
    setFlowStep("generating");

    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (!authSession) {
        toast({
          title: "Not authenticated",
          description: "Please sign in again",
          variant: "destructive",
        });
        router.push("/login");
        return;
      }

      // Create session first
      const sessionResponse = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          mode: "normal",
          language: "en",
          scenario: "interview",
          title: `Interview - ${new Date().toLocaleDateString()}`,
        }),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({}));
        console.error("Session creation failed:", errorData);
        throw new Error(errorData.error || "Failed to create session");
      }

      const session = await sessionResponse.json();
      setSessionId(session.id);

      // Generate questions
      const questionsResponse = await fetch("/api/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          jobDescription: data.jobDescription,
          cvText: data.cvText,
          cvPdfBase64: data.cvPdfBase64,
          sessionId: session.id,
        }),
      });

      if (!questionsResponse.ok) {
        throw new Error("Failed to generate questions");
      }

      const { questions: generatedQuestions } =
        await questionsResponse.json();
      setQuestions(generatedQuestions);
      setFlowStep("review");

      toast({
        title: "Questions Generated!",
        description: "Review your personalized interview questions",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to generate questions",
        variant: "destructive",
      });
      setFlowStep("upload");
    }
  };

  const handleStartInterview = () => {
    setFlowStep("interview");
  };

  const handleInterviewComplete = async () => {
    setFlowStep("complete");
    
    // End the session
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (!authSession) return;

      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession.access_token}`,
        },
      });

      // Redirect to session page for evaluation
      setTimeout(() => {
        router.push(`/sessions/${sessionId}`);
      }, 2000);
    } catch (error) {
      console.error("Error ending session:", error);
    }
  };

  // Testing convenience: allow ending/clearing session to jump to upload
  const handleEndSessionNow = async () => {
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      if (authSession && sessionId) {
        await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authSession.access_token}`,
          },
        });
      }
    } catch (e) {
      // non-blocking
      console.error("End session (manual) error:", e);
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      // Reset local UI state
      setQuestions([]);
      setJobDescription("");
      setCvText("");
      setSessionId("");
      setFlowStep("upload");
      toast({
        title: "Session ended",
        description: "You can start a new interview now.",
      });
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b0b10] via-[#10121a] to-[#0b0b10]">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0f0f14]/80">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🤖</div>
            <div>
              <h1 className="text-xl font-bold text-white">
                Agentic Workshop Trainer
              </h1>
              <p className="text-sm text-gray-400">AI-powered interview training</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {flowStep !== "upload" && sessionId && (
              <Button onClick={handleEndSessionNow} variant="destructive" size="sm">
                End Session
              </Button>
            )}
            <Button onClick={handleSignOut} variant="outline" size="sm">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        {flowStep === "upload" && (
          <DocumentUpload onDocumentsReady={handleDocumentsReady} />
        )}

        {flowStep === "generating" && (
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-500/10 border border-purple-500/30 mb-4">
              <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
            </div>
            <h2 className="text-3xl font-bold text-white">
              Analyzing Your Profile...
            </h2>
            <p className="text-gray-400">
              Our AI is generating personalized interview questions based on your CV
              and the job description
            </p>
            <div className="flex flex-col gap-2 text-sm text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                <span>Analyzing job requirements...</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse delay-75" />
                <span>Reviewing your experience...</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse delay-150" />
                <span>Crafting personalized questions...</span>
              </div>
            </div>
          </div>
        )}

        {flowStep === "review" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center space-y-2 mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-white">
                Your Personalized Questions
              </h2>
              <p className="text-gray-400">
                Review the questions generated for your interview
              </p>
            </div>

            <div className="space-y-4">
              {questions.map((q, idx) => (
                <Card
                  key={idx}
                  className="p-6 bg-white/10 border-white/10"
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center font-bold text-purple-400">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium mb-2">{q.question}</p>
                      <p className="text-sm text-gray-400">
                        <span className="font-semibold">Focus:</span> {q.focus}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Interview Mode Selection */}
            <div className="max-w-3xl mx-auto mt-8">
              <h3 className="text-xl font-semibold text-center mb-6">Choose Interview Mode</h3>
              <div className="grid md:grid-cols-2 gap-6">
                {/* STT/TTS Mode */}
                <Card className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20 hover:border-green-500/40 transition-all cursor-pointer" onClick={() => setFlowStep("interview-stt")}>
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 mb-2">
                      <Mic className="w-8 h-8 text-green-400" />
                    </div>
                    <h4 className="text-lg font-semibold text-white">STT/TTS Mode</h4>
                    <p className="text-sm text-gray-400">
                      Voice interview using Speech-to-Text and Text-to-Speech. More reliable and cost-effective.
                    </p>
                    <Button className="w-full bg-green-600 hover:bg-green-700">
                      Start with STT/TTS
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </Card>

                {/* Realtime Mode */}
                <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20 hover:border-purple-500/40 transition-all cursor-pointer" onClick={() => setFlowStep("interview-realtime")}>
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/20 border border-purple-500/30 mb-2">
                      <MessageSquare className="w-8 h-8 text-purple-400" />
                    </div>
                    <h4 className="text-lg font-semibold text-white">Realtime API</h4>
                    <p className="text-sm text-gray-400">
                      Real-time bidirectional voice conversation using OpenAI Realtime API.
                    </p>
                    <Button className="w-full bg-purple-600 hover:bg-purple-700">
                      Start with Realtime
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {flowStep === "interview-stt" && (
          <TextBasedVoiceChat
            sessionId={sessionId}
            questions={questions}
            jobDescription={jobDescription}
            cvText={cvText}
          />
        )}

        {flowStep === "interview-realtime" && (
          <div className="max-w-6xl mx-auto">
            <Card className="bg-white/10 border-white/10 h-[700px]">
              <RealtimeVoiceChat
                sessionId={sessionId}
                questions={questions}
                jobDescription={jobDescription}
                cvText={cvText}
                onComplete={handleInterviewComplete}
              />
            </Card>
          </div>
        )}

        {flowStep === "complete" && (
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-3xl font-bold text-white">Interview Complete!</h2>
            <p className="text-gray-400">
              Great job! We're now preparing your detailed evaluation and feedback...
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Redirecting to results...</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}


