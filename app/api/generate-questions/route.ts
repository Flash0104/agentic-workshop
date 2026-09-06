import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, validatePayloadSize, safeLogger } from "@/lib/auth-helpers";
import { callNemotronStructured } from "@/lib/nemotron-parser";
import { NEMOTRON_QUESTION_GEN_PROMPT } from "@/lib/prompts";
import { GeneratedQuestionsListSchema } from "@/lib/schemas";
import { extractText } from "unpdf";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const sizeCheck = validatePayloadSize(rawBody, 500 * 1024); // 500KB max
    if (!sizeCheck.valid) {
      return NextResponse.json({ error: sizeCheck.error }, { status: 413 });
    }

    const authResult = await authenticateRequest(req);
    if ("response" in authResult) {
      return authResult.response;
    }
    const { user, supabase } = authResult;

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { jobDescription, cvText, cvPdfBase64, sessionId } = body;

    if (!jobDescription || (!cvText && !cvPdfBase64)) {
      return NextResponse.json(
        { error: "Job description and CV content are required" },
        { status: 400 }
      );
    }

    // Extract text from PDF if provided
    let finalCvText = cvText || "";
    if (cvPdfBase64) {
      try {
        const binaryString = Buffer.from(cvPdfBase64, "base64");
        const uint8Array = new Uint8Array(binaryString);
        const result = await extractText(uint8Array);

        let extracted = "";
        if (Array.isArray(result.text)) {
          extracted = result.text.join("\n\n");
        } else if (typeof result.text === "string") {
          extracted = result.text;
        } else {
          extracted = String(result);
        }

        if (!extracted || extracted.trim().length === 0) {
          return NextResponse.json(
            { error: "Could not extract text from PDF. Please paste plain text." },
            { status: 400 }
          );
        }
        finalCvText = extracted.trim();
      } catch (pdfErr) {
        safeLogger.error("PDF extraction failed", { userId: user.id });
        return NextResponse.json(
          { error: "Failed to parse PDF document. Please paste plain text." },
          { status: 400 }
        );
      }
    }

    safeLogger.info("Generating interview questions with Nemotron", {
      userId: user.id,
      sessionId,
      cvLength: finalCvText.length,
      jobLength: jobDescription.length,
    });

    const userContent = `JOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE'S CV:\n${finalCvText}`;

    // Call Nemotron with structured validation and bounded retry
    const result = await callNemotronStructured({
      messages: [
        { role: "system", content: NEMOTRON_QUESTION_GEN_PROMPT },
        { role: "user", content: userContent },
      ],
      schema: GeneratedQuestionsListSchema,
      temperature: 0.3,
      maxTokens: 2500,
      maxRetries: 2,
    });

    const questions = result.data;

    // Update session if sessionId provided
    if (sessionId) {
      const { error: updateError } = await supabase
        .from("sessions")
        .update({
          job_description: jobDescription,
          cv_text: finalCvText,
          generated_questions: questions,
        })
        .eq("id", sessionId)
        .eq("user_id", user.id);

      if (updateError) {
        safeLogger.error("Failed to save questions to session", {
          sessionId,
          userId: user.id,
        });
        return NextResponse.json(
          { error: "Failed to save questions to session" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      questions,
      metadata: {
        provider: result.metadata.provider,
        model: result.metadata.model,
        promptVersion: "nemotron-v1.0",
        usage: result.metadata.usage,
      },
    });
  } catch (error: any) {
    safeLogger.error("Question generation failed", {
      message: error?.message,
    });
    return NextResponse.json(
      { error: error?.message || "Failed to generate questions with Nemotron" },
      { status: 500 }
    );
  }
}
