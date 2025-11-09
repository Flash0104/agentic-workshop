export const RUBRIC = {
  content: "Factual accuracy, relevance, specificity to product/problem",
  communication: "Clarity, tone, fluency, politeness",
  structure: "Logical flow: intro → value → evidence → close",
  empathy: "Active listening, addressing concerns, mirroring language",
  goal: "Did the user achieve session goal (convince / pass HR)?",
} as const;

export interface Turn {
  role: "user" | "ai" | "system";
  content: string;
}

export function heuristicScore(turns: Turn[]): number {
  const userText = turns
    .filter((t) => t.role === "user")
    .map((t) => t.content)
    .join(" ");

  if (!userText.trim()) return 0;

  const tokens = userText.split(/\s+/).length;
  const hasNumbers = /\b\d{1,}\b/.test(userText);
  const hasQuestions = /\?/.test(userText);
  const hasIntro = /hello|hi|guten tag|grüß|good morning|gday/i.test(userText);
  const hasPoliteness = /please|thank|danke|bitte/i.test(userText);

  let score = 40;
  if (hasNumbers) score += 10;
  if (hasQuestions) score += 10;
  if (hasIntro) score += 5;
  if (hasPoliteness) score += 5;
  score += Math.min(15, Math.floor(tokens / 120));

  return Math.max(0, Math.min(90, score));
}

export function parseEvaluationResponse(rawResponse: string): {
  jsonBlock: string;
  markdownBlock: string;
} {
  // Extract JSON block from code fence or raw JSON
  const jsonMatch =
    rawResponse.match(/```json\s*\n([\s\S]*?)\n```/) ||
    rawResponse.match(/```\s*\n([\s\S]*?)\n```/) ||
    rawResponse.match(/(\{[\s\S]*?"total"[\s\S]*?\})/);

  if (!jsonMatch) {
    throw new Error("No JSON block found in evaluation response");
  }

  const jsonBlock = jsonMatch[1].trim();

  // Everything after the JSON block is markdown
  const jsonEndIndex = rawResponse.indexOf(jsonMatch[0]) + jsonMatch[0].length;
  const markdownBlock = rawResponse.substring(jsonEndIndex).trim();

  return { jsonBlock, markdownBlock };
}

export function calculateAcceptanceMetrics(surveys: {
  trust: number;
  usefulness: number;
  comfort: number;
  reuse: number;
}[]): {
  trustScore: number;
  satisfactionIndex: number;
  reuseIntention: number;
} {
  if (surveys.length === 0) {
    return { trustScore: 0, satisfactionIndex: 0, reuseIntention: 0 };
  }

  const trustScore =
    surveys.reduce((sum, s) => sum + s.trust, 0) / surveys.length;
  const satisfactionIndex =
    surveys.reduce((sum, s) => sum + s.usefulness + s.comfort, 0) /
    (surveys.length * 2);
  const reuseIntention =
    surveys.reduce((sum, s) => sum + s.reuse, 0) / surveys.length;

  return {
    trustScore: Math.round(trustScore * 100) / 100,
    satisfactionIndex: Math.round(satisfactionIndex * 100) / 100,
    reuseIntention: Math.round(reuseIntention * 100) / 100,
  };
}








