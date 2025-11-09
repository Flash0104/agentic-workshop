"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";

interface TextInterviewProps {
  sessionId: string;
  questions: { question: string; focus: string }[];
  jobDescription: string;
  cvText: string;
  onComplete: () => void;
}

export default function TextInterview({
  sessionId,
  questions,
  jobDescription,
  cvText,
  onComplete,
}: TextInterviewProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(questions.length).fill(""));
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim()) return;

    setIsSubmitting(true);
    
    // Save the answer
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = currentAnswer;
    setAnswers(newAnswers);

    // Move to next question or complete
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentAnswer("");
      setIsSubmitting(false);
    } else {
      // All questions answered, complete the interview
      setTimeout(() => {
        onComplete();
      }, 1000);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-gray-300">Interview in Progress</span>
        </div>
        <h2 className="text-3xl font-bold text-white">AI Interview</h2>
        <p className="text-gray-400">Answer each question thoughtfully</p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <Card className="bg-white/5 backdrop-blur-xl border-white/10 p-8">
        <div className="space-y-6">
          {/* Current Question */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex-shrink-0">
                <span className="text-lg font-bold text-blue-400">Q{currentQuestionIndex + 1}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {currentQuestion.question}
                </h3>
                <p className="text-sm text-gray-400">
                  Focus: {currentQuestion.focus}
                </p>
              </div>
            </div>
          </div>

          {/* Answer Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300">Your Answer</label>
            <Textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Type your answer here... Be specific and provide examples where relevant."
              className="min-h-[200px] bg-gray-900/50 border-gray-700 text-white placeholder:text-gray-500 resize-none"
              disabled={isSubmitting}
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">
                {currentAnswer.length} characters
              </span>
              <Button
                onClick={handleSubmitAnswer}
                disabled={!currentAnswer.trim() || isSubmitting}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {currentQuestionIndex === questions.length - 1 ? "Completing..." : "Submitting..."}
                  </>
                ) : (
                  <>
                    {currentQuestionIndex === questions.length - 1 ? "Complete Interview" : "Next Question"}
                    <Send className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Previous Answers Summary */}
          {currentQuestionIndex > 0 && (
            <div className="pt-6 border-t border-gray-700">
              <p className="text-sm text-gray-400 mb-3">
                You've answered {currentQuestionIndex} question{currentQuestionIndex > 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                {answers.slice(0, currentQuestionIndex).map((_, idx) => (
                  <div
                    key={idx}
                    className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center"
                  >
                    <span className="text-xs text-green-400">✓</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Tips */}
      <Card className="bg-blue-500/10 border-blue-500/30 p-4">
        <p className="text-sm text-blue-300">
          💡 <strong>Tip:</strong> Take your time to provide detailed answers. Include specific examples from your experience that relate to the question.
        </p>
      </Card>
    </div>
  );
}

