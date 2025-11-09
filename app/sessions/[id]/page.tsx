"use client";

import { ScoreRadar } from "@/components/ScoreRadar";
import { SurveyForm } from "@/components/SurveyForm";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Download, FileDown } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SessionData {
  session: {
    id: string;
    title: string;
    mode: string;
    language: string;
    scenario: string;
    created_at: string;
    ended_at: string | null;
  };
  turns: Array<{
    id: number;
    role: string;
    content: string;
    created_at: string;
  }>;
  evaluation: {
    scores: {
      content: number;
      communication: number;
      structure: number;
      empathy: number;
      goal: number;
    };
    total_score: number;
    highlights: string[];
    improvements: string[];
    report_markdown: string;
  } | null;
  survey: {
    trust: number;
    usefulness: number;
    comfort: number;
    difficulty: number;
    reuse: number;
    free_text: string | null;
  } | null;
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<SessionData | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);

  const sessionId = params.id as string;

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/sessions/${sessionId}`, {
        headers: session ? {
          "Authorization": `Bearer ${session.access_token}`
        } : {}
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to load session:", response.status, errorData);
        throw new Error(errorData.error || `Failed to load session: ${response.status}`);
      }

      const sessionData = await response.json();
      setData(sessionData);
      setShowSurvey(!sessionData.survey);
    } catch (error) {
      console.error("Error loading session:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load session",
        variant: "destructive",
      });
    }
  };

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) throw new Error("Evaluation failed");

      await loadSession();

      toast({
        title: "Evaluation complete",
        description: "Your session has been evaluated",
      });
    } catch (error) {
      console.error("Error evaluating:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to evaluate session",
        variant: "destructive",
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!data?.evaluation) return;

    const markdown = `# Session Report

**Session**: ${data.session.title}
**Date**: ${new Date(data.session.created_at).toLocaleDateString()}
**Mode**: ${data.session.mode}
**Language**: ${data.session.language}

## Scores

- **Total**: ${data.evaluation.total_score}/100
- **Content**: ${data.evaluation.scores.content}/20
- **Communication**: ${data.evaluation.scores.communication}/20
- **Structure**: ${data.evaluation.scores.structure}/20
- **Empathy**: ${data.evaluation.scores.empathy}/20
- **Goal**: ${data.evaluation.scores.goal}/20

${data.evaluation.report_markdown}

## Transcript

${data.turns.map((t) => `**${t.role.toUpperCase()}**: ${t.content}`).join("\n\n")}
`;

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    if (!data?.evaluation) return;

    try {
      const { default: jsPDF } = await import('jspdf');

      toast({
        title: "Generating PDF...",
        description: "Creating your report",
      });

      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 40;
      let yPos = margin;

      // Helper to check if we need a new page
      const checkPageBreak = (neededSpace: number) => {
        if (yPos + neededSpace > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      // Title
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text(data.session.title, margin, yPos);
      yPos += 35;

      // Date
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100);
      pdf.text(new Date(data.session.created_at).toLocaleString(), margin, yPos);
      yPos += 50;

      // Performance Overview
      pdf.setFontSize(20);
      pdf.setTextColor(0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Performance Overview', margin, yPos);
      yPos += 35;

      // Total Score - Large centered box
      pdf.setFillColor(245, 245, 245);
      pdf.rect(pageWidth / 2 - 80, yPos - 20, 160, 80, 'F');
      pdf.setFontSize(48);
      pdf.setTextColor(0);
      pdf.text(data.evaluation.total_score.toString(), pageWidth / 2, yPos + 30, { align: 'center' });
      yPos += 50;
      pdf.setFontSize(12);
      pdf.setTextColor(100);
      pdf.text('Total Score', pageWidth / 2, yPos, { align: 'center' });
      yPos += 60;

      // Score Breakdown - Manual table
      checkPageBreak(150);
      pdf.setFontSize(16);
      pdf.setTextColor(0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Score Breakdown', margin, yPos);
      yPos += 30;

      const scores = [
        ['Content', data.evaluation.scores.content],
        ['Communication', data.evaluation.scores.communication],
        ['Structure', data.evaluation.scores.structure],
        ['Empathy', data.evaluation.scores.empathy],
        ['Goal', data.evaluation.scores.goal],
      ];

      pdf.setFontSize(12);
      scores.forEach(([category, score]) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60);
        pdf.text(category, margin, yPos);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0);
        pdf.text(`${score}/20`, pageWidth - margin - 50, yPos);
        yPos += 25;
      });
      yPos += 30;

      // Highlights
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Highlights', margin, yPos);
      yPos += 20;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      data.evaluation.highlights.forEach((highlight) => {
        const lines = pdf.splitTextToSize(`✓ ${highlight}`, pageWidth - 2 * margin);
        pdf.text(lines, margin, yPos);
        yPos += lines.length * 15;
      });
      yPos += 20;

      // Improvements
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Areas for Improvement', margin, yPos);
      yPos += 20;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      data.evaluation.improvements.forEach((improvement) => {
        const lines = pdf.splitTextToSize(`→ ${improvement}`, pageWidth - 2 * margin);
        pdf.text(lines, margin, yPos);
        yPos += lines.length * 15;
      });

      // New page for detailed report
      pdf.addPage();
      yPos = margin;

      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Detailed Report', margin, yPos);
      yPos += 30;

      // Parse and add markdown content
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      const reportLines = data.evaluation.report_markdown.split('\n');
      reportLines.forEach((line) => {
        if (yPos > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage();
          yPos = margin;
        }

        if (line.startsWith('##')) {
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          const text = line.replace('##', '').trim();
          pdf.text(text, margin, yPos);
          yPos += 25;
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'normal');
        } else if (line.trim()) {
          const lines = pdf.splitTextToSize(line, pageWidth - 2 * margin);
          pdf.text(lines, margin, yPos);
          yPos += lines.length * 15;
        } else {
          yPos += 10;
        }
      });

      const filename = `interview-${new Date(data.session.created_at).toLocaleDateString().replace(/\//g, '-')}.pdf`;
      pdf.save(filename);

      toast({
        title: "PDF Downloaded!",
        description: `Saved as ${filename}`,
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "PDF Generation Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{data.session.title}</h1>
              <p className="text-sm text-muted-foreground">
                {new Date(data.session.created_at).toLocaleString()}
              </p>
            </div>
          </div>
          {data.evaluation && (
            <div className="flex gap-2">
              <Button onClick={handleExportMarkdown} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export MD
              </Button>
              <Button onClick={handleExportPDF} variant="outline">
                <FileDown className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-8">
          {!data.evaluation ? (
            <div className="text-center space-y-4 py-12">
              <h2 className="text-xl font-semibold">Ready for Evaluation</h2>
              <p className="text-muted-foreground">
                Get AI-powered feedback on your performance
              </p>
              <Button onClick={handleEvaluate} disabled={isEvaluating}>
                {isEvaluating ? "Evaluating..." : "Evaluate Session"}
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Performance Overview</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="rounded-lg border p-6">
                      <div className="text-center">
                        <div className="text-5xl font-bold mb-2">
                          {data.evaluation.total_score}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Total Score
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border p-6 space-y-4">
                      <div>
                        <h3 className="font-semibold mb-2">Highlights</h3>
                        <ul className="space-y-1 text-sm">
                          {data.evaluation.highlights.map((h, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-green-600">✓</span>
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h3 className="font-semibold mb-2">Improvements</h3>
                        <ul className="space-y-1 text-sm">
                          {data.evaluation.improvements.map((imp, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-amber-600">→</span>
                              <span>{imp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-6">
                    <h3 className="font-semibold mb-4">Score Breakdown</h3>
                    <ScoreRadar scores={data.evaluation.scores} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Detailed Report</h2>
                <div className="rounded-lg border p-6 prose prose-sm max-w-none dark:prose-invert">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: data.evaluation.report_markdown
                        .replace(/^# /gm, "## ")
                        .replace(/\n/g, "<br />"),
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {showSurvey && data.evaluation && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Feedback Survey</h2>
              <div className="rounded-lg border p-6">
                <SurveyForm
                  sessionId={sessionId}
                  onSubmit={() => {
                    setShowSurvey(false);
                    loadSession();
                  }}
                />
              </div>
            </div>
          )}

          {data.survey && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Your Feedback</h2>
              <div className="rounded-lg border p-6 grid md:grid-cols-5 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{data.survey.trust}</div>
                  <div className="text-xs text-muted-foreground">Trust</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {data.survey.usefulness}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Usefulness
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {data.survey.comfort}
                  </div>
                  <div className="text-xs text-muted-foreground">Comfort</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {data.survey.difficulty}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Difficulty
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{data.survey.reuse}</div>
                  <div className="text-xs text-muted-foreground">
                    Reuse Intent
                  </div>
                </div>
              </div>
              {data.survey.free_text && (
                <div className="rounded-lg border p-6">
                  <h3 className="font-semibold mb-2">Additional Comments</h3>
                  <p className="text-sm text-muted-foreground">
                    {data.survey.free_text}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Conversation Transcript</h2>
            <div className="space-y-3">
              {data.turns.map((turn) => (
                <div
                  key={turn.id}
                  className={`rounded-lg p-4 ${
                    turn.role === "user" ? "bg-primary/10" : "bg-muted"
                  }`}
                >
                  <div className="text-xs font-semibold uppercase mb-1 text-muted-foreground">
                    {turn.role}
                  </div>
                  <p className="text-sm">{turn.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}




