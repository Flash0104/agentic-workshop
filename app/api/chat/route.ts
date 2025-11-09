import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const {
      sessionId,
      message,
      questionIndex,
      questions,
      conversationHistory = [],
      jobDescription,
      cvText,
    } = await req.json();

    console.log("📝 Chat API - Current question index:", questionIndex);
    console.log("📝 Total questions:", questions.length);
    console.log("📝 User message:", message);

    // IMPORTANT: If user just answered question N, we should move to question N+1
    const justAnsweredQuestionIndex = questionIndex;
    const nextQuestionIndex = questionIndex + 1;
    const hasMoreQuestions = nextQuestionIndex < questions.length;

    console.log("📝 Just answered question:", justAnsweredQuestionIndex, questions[justAnsweredQuestionIndex]?.question);
    console.log("📝 Next question index:", nextQuestionIndex);
    console.log("📝 Has more questions:", hasMoreQuestions);

    // Build conversation context
    const systemPrompt = `You are a professional job interviewer conducting a structured interview.

CURRENT STATUS:
- Total questions: ${questions.length}
- Candidate just answered question ${justAnsweredQuestionIndex + 1}: "${questions[justAnsweredQuestionIndex]?.question}"
- Next up: ${hasMoreQuestions ? `Question ${nextQuestionIndex + 1}` : "Interview complete"}

YOUR RESPONSE:
1. BRIEFLY acknowledge their answer (1-2 words: "Thank you", "I see", "Good")
2. ${
      hasMoreQuestions
        ? `Then IMMEDIATELY ask question ${nextQuestionIndex + 1} EXACTLY as written: "${questions[nextQuestionIndex].question}"`
        : 'Then say: "Thank you. The interview is complete."'
    }

RULES:
- Keep acknowledgment VERY brief (1-2 words only)
- Ask the next question VERBATIM (word-for-word, exactly as written above)
- NO evaluation, NO feedback, NO follow-up questions
- Stay strictly on script`;

    // Build message history
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Add previous conversation history if exists
    if (conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    // Add current user message
    messages.push({ role: "user", content: message });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.3, // Lower temperature for more consistent behavior
      max_tokens: 120,
    });

    const reply = completion.choices[0].message.content || "Thank you.";
    
    console.log("🤖 AI reply:", reply);
    console.log("📝 Returning nextQuestionIndex:", nextQuestionIndex);

    return NextResponse.json({
      reply,
      nextQuestionIndex, // This should now be question N+1
      isComplete: nextQuestionIndex >= questions.length,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
