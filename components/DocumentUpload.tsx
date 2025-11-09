"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Briefcase, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DocumentUploadProps {
  onDocumentsReady: (data: {
    jobDescription: string;
    cvText: string;
    cvPdfBase64?: string;
  }) => void;
}

export default function DocumentUpload({ onDocumentsReady }: DocumentUploadProps) {
  const [jobDescription, setJobDescription] = useState("");
  const [cvText, setCvText] = useState("");
  const [cvPdfBase64, setCvPdfBase64] = useState<string | null>(null);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleCvFile = useCallback(async (file: File) => {
    // Accept PDF and TXT files
    const validTypes = ["application/pdf", "text/plain"];
    const validExtensions = [".pdf", ".txt"];
    
    if (!validTypes.includes(file.type) && !validExtensions.some(ext => file.name.endsWith(ext))) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or TXT file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      // Handle TXT files directly
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        const text = await file.text();
        setCvText(text);
        setCvPdfBase64(null);
        setCvFileName(file.name);
        
        toast({
          title: "CV uploaded",
          description: `${file.name} loaded successfully`,
        });
      } 
      // Handle PDF files - convert to base64
      else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        
        setCvPdfBase64(base64);
        setCvText("PDF file attached");
        setCvFileName(file.name);
        
        toast({
          title: "PDF uploaded",
          description: `${file.name} will be analyzed by GPT-4o`,
        });
      }
    } catch (error) {
      console.error("Error processing file:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process your file. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        await handleCvFile(file);
      }
    },
    [handleCvFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleCvFile(file);
      }
    },
    [handleCvFile]
  );

  const handleClearFile = useCallback(() => {
    setCvText("");
    setCvPdfBase64(null);
    setCvFileName(null);
  }, []);


  const handleProceed = () => {
    if (!jobDescription.trim()) {
      toast({
        title: "Missing job description",
        description: "Please enter the job description",
        variant: "destructive",
      });
      return;
    }

    if (!cvText.trim() && !cvPdfBase64) {
      toast({
        title: "Missing CV",
        description: "Please upload your CV",
        variant: "destructive",
      });
      return;
    }

    onDocumentsReady({
      jobDescription: jobDescription.trim(),
      cvText: cvText.trim(),
      cvPdfBase64: cvPdfBase64 || undefined,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-xl border border-white/20 mb-4">
          <Briefcase className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Prepare Your Interview
        </h2>
        <p className="text-gray-400">
          Provide your CV and job description to get personalized interview questions
        </p>
      </div>

      {/* Job Description */}
      <Card className="p-6 bg-white/5 backdrop-blur-xl border-white/10">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30">
              <Briefcase className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Job Description</h3>
              <p className="text-sm text-gray-400">
                Paste the job posting you're applying for
              </p>
            </div>
          </div>

          <Textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here..."
            className="min-h-[200px] bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500/50 focus:ring-purple-500/20"
          />
        </div>
      </Card>

      {/* CV/Resume Input */}
      <Card className="p-6 bg-white/5 backdrop-blur-xl border-white/10">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Your CV / Resume</h3>
              <p className="text-sm text-gray-400">
                Drag & drop PDF/TXT or paste your CV content below
              </p>
            </div>
          </div>

          {/* Drag and Drop Zone */}
          {!cvFileName && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                isDragging
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-white/20 hover:border-purple-500/50"
              }`}
            >
              <input
                type="file"
                id="cv-upload"
                className="hidden"
                accept=".pdf,.txt"
                onChange={handleFileInput}
              />
              <label
                htmlFor="cv-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/30">
                  <Upload className="w-6 h-6 text-purple-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium">
                    Drop your CV here or click to browse
                  </p>
                  <p className="text-xs text-gray-400">PDF or TXT files, max 5MB</p>
                </div>
              </label>
            </div>
          )}

          {/* File Info */}
          {cvFileName && (
            <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-400" />
                <span className="text-sm text-white font-medium">{cvFileName}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearFile}
                className="text-gray-400 hover:text-white h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Text Area */}
          <Textarea
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
            placeholder="Or paste your CV/resume content here...&#10;&#10;Include:&#10;- Work experience&#10;- Skills & technologies&#10;- Education&#10;- Projects&#10;- Any relevant accomplishments"
            className="min-h-[200px] bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500/50 focus:ring-purple-500/20"
          />
          
          {cvText && (
            <p className="text-xs text-gray-500">
              {cvText.length} characters • ~{Math.ceil(cvText.split(/\s+/).length / 100)} min read
            </p>
          )}
        </div>
      </Card>

      {/* Proceed Button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleProceed}
          disabled={!jobDescription.trim() || !cvText.trim()}
          className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-8 py-6 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate Interview Questions →
        </Button>
      </div>
    </div>
  );
}


