"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useState } from "react";

interface SurveyFormProps {
  sessionId: string;
  onSubmit?: () => void;
}

export function SurveyForm({ sessionId, onSubmit }: SurveyFormProps) {
  const [trust, setTrust] = useState(3);
  const [usefulness, setUsefulness] = useState(3);
  const [comfort, setComfort] = useState(3);
  const [difficulty, setDifficulty] = useState(3);
  const [reuse, setReuse] = useState(3);
  const [freeText, setFreeText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/survey", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          sessionId,
          trust,
          usefulness,
          comfort,
          difficulty,
          reuse,
          freeText: freeText || undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit survey");

      toast({
        title: "Survey submitted",
        description: "Thank you for your feedback!",
      });

      onSubmit?.();
    } catch (error) {
      console.error("Error submitting survey:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit survey",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Trust: {trust}/5</Label>
          <Slider
            value={[trust]}
            onValueChange={([v]) => setTrust(v)}
            min={1}
            max={5}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            How much do you trust the AI trainer?
          </p>
        </div>

        <div className="space-y-2">
          <Label>Usefulness: {usefulness}/5</Label>
          <Slider
            value={[usefulness]}
            onValueChange={([v]) => setUsefulness(v)}
            min={1}
            max={5}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            How useful was this training session?
          </p>
        </div>

        <div className="space-y-2">
          <Label>Comfort: {comfort}/5</Label>
          <Slider
            value={[comfort]}
            onValueChange={([v]) => setComfort(v)}
            min={1}
            max={5}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            How comfortable did you feel during the session?
          </p>
        </div>

        <div className="space-y-2">
          <Label>Difficulty: {difficulty}/5</Label>
          <Slider
            value={[difficulty]}
            onValueChange={([v]) => setDifficulty(v)}
            min={1}
            max={5}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            How challenging was the session? (1=too easy, 5=too hard)
          </p>
        </div>

        <div className="space-y-2">
          <Label>Reuse Intention: {reuse}/5</Label>
          <Slider
            value={[reuse]}
            onValueChange={([v]) => setReuse(v)}
            min={1}
            max={5}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            How likely are you to use this trainer again?
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="freeText">Additional Feedback (Optional)</Label>
          <textarea
            id="freeText"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Share any additional thoughts..."
            className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Submitting..." : "Submit Survey"}
      </Button>
    </form>
  );
}




