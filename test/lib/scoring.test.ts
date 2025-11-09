import { describe, it, expect } from 'vitest';
import { heuristicScore, parseEvaluationResponse, calculateAcceptanceMetrics } from '@/lib/scoring';

describe('scoring', () => {
  describe('heuristicScore', () => {
    it('returns 0 for empty conversation', () => {
      expect(heuristicScore([])).toBe(0);
    });

    it('returns base score for minimal conversation', () => {
      const turns = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'ai' as const, content: 'Hi there' },
      ];
      const score = heuristicScore(turns);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(90);
    });

    it('increases score for numbers (evidence)', () => {
      const withoutNumbers = heuristicScore([
        { role: 'user' as const, content: 'I have experience' },
      ]);
      const withNumbers = heuristicScore([
        { role: 'user' as const, content: 'I have 5 years experience' },
      ]);
      expect(withNumbers).toBeGreaterThan(withoutNumbers);
    });

    it('increases score for questions (engagement)', () => {
      const withoutQuestion = heuristicScore([
        { role: 'user' as const, content: 'I am interested' },
      ]);
      const withQuestion = heuristicScore([
        { role: 'user' as const, content: 'I am interested. What are the next steps?' },
      ]);
      expect(withQuestion).toBeGreaterThan(withoutQuestion);
    });

    it('caps score at 90', () => {
      const turns = Array.from({ length: 100 }, (_, i) => ({
        role: 'user' as const,
        content: `Hello ${i}? I have 100 years experience. Thank you please.`,
      }));
      const score = heuristicScore(turns);
      expect(score).toBeLessThanOrEqual(90);
    });
  });

  describe('parseEvaluationResponse', () => {
    it('extracts JSON and markdown from valid response', () => {
      const response = `\`\`\`json
{
  "scores": { "content": 15, "communication": 18, "structure": 16, "empathy": 14, "goal": 17 },
  "total": 80,
  "highlights": ["Good clarity"],
  "improvements": ["Add more examples"]
}
\`\`\`

# Report
This is the markdown section.`;

      const { jsonBlock, markdownBlock } = parseEvaluationResponse(response);
      expect(JSON.parse(jsonBlock)).toHaveProperty('total', 80);
      expect(markdownBlock).toContain('# Report');
    });

    it('throws error for invalid response', () => {
      expect(() => parseEvaluationResponse('No JSON here')).toThrow();
    });
  });

  describe('calculateAcceptanceMetrics', () => {
    it('returns zeros for empty array', () => {
      const metrics = calculateAcceptanceMetrics([]);
      expect(metrics).toEqual({
        trustScore: 0,
        satisfactionIndex: 0,
        reuseIntention: 0,
      });
    });

    it('calculates metrics correctly', () => {
      const surveys = [
        { trust: 5, usefulness: 4, comfort: 5, reuse: 5 },
        { trust: 4, usefulness: 5, comfort: 4, reuse: 4 },
      ];
      const metrics = calculateAcceptanceMetrics(surveys);
      
      expect(metrics.trustScore).toBe(4.5);
      expect(metrics.satisfactionIndex).toBe(4.5); // (4+5+5+4) / 4
      expect(metrics.reuseIntention).toBe(4.5);
    });

    it('rounds to 2 decimal places', () => {
      const surveys = [
        { trust: 5, usefulness: 3, comfort: 4, reuse: 3 },
        { trust: 3, usefulness: 4, comfort: 3, reuse: 4 },
        { trust: 4, usefulness: 5, comfort: 5, reuse: 5 },
      ];
      const metrics = calculateAcceptanceMetrics(surveys);
      
      // Trust: (5+3+4)/3 = 4
      expect(metrics.trustScore).toBe(4);
      // Satisfaction: (3+4+4+3+5+5)/6 = 4
      expect(metrics.satisfactionIndex).toBe(4);
      // Reuse: (3+4+5)/3 = 4
      expect(metrics.reuseIntention).toBe(4);
    });
  });
});

