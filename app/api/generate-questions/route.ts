import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { openai } from "@/lib/llm";
import { extractText } from "unpdf";

const QUESTION_GENERATION_PROMPT = `You are an expert interview coach. Your task is to generate 5 personalized interview questions based on the candidate's CV and the job description they're applying for.

Generate questions that:
1. Are specific to the job requirements
2. Relate to the candidate's experience and skills mentioned in their CV
3. Progress from general to more specific/technical
4. Test both technical skills and soft skills
5. Are open-ended and require thoughtful answers

Return ONLY a JSON array of exactly 5 questions in this format:
[
  {
    "question": "The interview question",
    "focus": "Brief explanation of what this question evaluates (e.g., 'Technical knowledge of React', 'Leadership experience')"
  }
]

Do not include any other text, explanations, or markdown formatting.`;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    const supabase = await createClient(token);
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { jobDescription, cvText, cvPdfBase64, sessionId } = body;

    if (!jobDescription || (!cvText && !cvPdfBase64)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Extract text from PDF if provided
    let finalCvText = cvText;
    
    if (cvPdfBase64) {
      try {
        // Convert base64 to Uint8Array
        const binaryString = Buffer.from(cvPdfBase64, 'base64');
        const uint8Array = new Uint8Array(binaryString);
        
        // Extract text from PDF
        const result = await extractText(uint8Array);
        
        // unpdf returns { totalPages, text: string[] } - text is an array of pages
        let extractedText = '';
        if (Array.isArray(result.text)) {
          extractedText = result.text.join('\n\n');
        } else if (typeof result.text === 'string') {
          extractedText = result.text;
        } else {
          extractedText = String(result);
        }
        
        if (!extractedText || extractedText.trim().length === 0) {
          return NextResponse.json(
            { error: "Could not extract text from PDF. Please try copying and pasting the text instead." },
            { status: 400 }
          );
        }
        
        finalCvText = extractedText.trim();
      } catch (pdfError) {
        console.error("PDF extraction error:", pdfError);
        return NextResponse.json(
          { error: "Failed to extract text from PDF. Please try copying and pasting the text instead." },
          { status: 400 }
        );
      }
    }
    
    // Build user message content
    const userContent = `JOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE'S CV:\n${finalCvText}`;

    // Generate questions using GPT-4o
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: QUESTION_GENERATION_PROMPT,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content?.trim() || "[]";
    
    // Parse the JSON response
    let questions: { question: string; focus: string }[];
    try {
      questions = JSON.parse(content);
      
      // Validate structure
      if (!Array.isArray(questions) || questions.length !== 5) {
        throw new Error("Invalid questions format");
      }
      
      // Validate each question has required fields
      for (const q of questions) {
        if (!q.question || !q.focus) {
          throw new Error("Missing question fields");
        }
      }
    } catch (parseError) {
      console.error("Failed to parse questions:", content);
      return NextResponse.json(
        { error: "Failed to generate valid questions" },
        { status: 500 }
      );
    }

    // Update session with generated questions if sessionId provided
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
        console.error("Error updating session:", updateError);
        return NextResponse.json(
          { error: "Failed to save questions" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      questions,
      usage: {
        tokens: response.usage?.total_tokens || 0,
        cost: ((response.usage?.total_tokens || 0) / 1000000) * 5, // ~$5/1M tokens for GPT-4o
      },
    });
  } catch (error) {
    console.error("Error generating questions:", error);
    return NextResponse.json(
      { error: "Failed to generate questions" },
      { status: 500 }
    );
  }
}


