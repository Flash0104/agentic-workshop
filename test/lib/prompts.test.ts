import { describe, it, expect } from 'vitest';
import { SYSTEM_INTERVIEWER, SYSTEM_CUSTOMER, getSystemPrompt, EVALUATOR_PROMPT } from '@/lib/prompts';

describe('prompts', () => {
  describe('SYSTEM_INTERVIEWER', () => {
    it('generates English prompt correctly', () => {
      const prompt = SYSTEM_INTERVIEWER('normal', 'en');
      expect(prompt).toContain('professional HR interviewer');
      expect(prompt).toContain('English only');
      expect(prompt).toContain('guided practice');
    });

    it('generates German prompt correctly', () => {
      const prompt = SYSTEM_INTERVIEWER('normal', 'de');
      expect(prompt).toContain('professioneller HR-Interviewer');
      expect(prompt).toContain('nur auf Deutsch');
      expect(prompt).toContain('angeleitete Übung');
    });

    it('adapts to difficulty levels', () => {
      const easy = SYSTEM_INTERVIEWER('easy', 'en');
      const hard = SYSTEM_INTERVIEWER('hard', 'en');
      
      expect(easy).toContain('supportive training');
      expect(hard).toContain('real interview without hints');
    });

    it('includes job context when provided', () => {
      const prompt = SYSTEM_INTERVIEWER('normal', 'en', 'Senior React Developer');
      expect(prompt).toContain('Job Context');
      expect(prompt).toContain('Senior React Developer');
    });
  });

  describe('SYSTEM_CUSTOMER', () => {
    it('generates B2B customer prompt', () => {
      const prompt = SYSTEM_CUSTOMER('normal', 'en');
      expect(prompt).toContain('B2B customer');
      expect(prompt).toContain('SaaS product');
    });

    it('adapts behavior to difficulty', () => {
      const easy = SYSTEM_CUSTOMER('easy', 'en');
      const hard = SYSTEM_CUSTOMER('hard', 'en');
      
      expect(easy).toContain('straightforward');
      expect(hard).toContain('skeptical');
      expect(hard).toContain('ROI');
    });
  });

  describe('getSystemPrompt', () => {
    it('returns interviewer prompt for interview scenario', () => {
      const prompt = getSystemPrompt('interview', 'normal', 'en');
      expect(prompt).toContain('interviewer');
    });

    it('returns customer prompt for sales scenario', () => {
      const prompt = getSystemPrompt('sales', 'normal', 'en');
      expect(prompt).toContain('customer');
    });
  });

  describe('EVALUATOR_PROMPT', () => {
    it('generates English evaluator prompt', () => {
      const prompt = EVALUATOR_PROMPT('en');
      expect(prompt).toContain('evaluator');
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('Markdown');
    });

    it('generates German evaluator prompt', () => {
      const prompt = EVALUATOR_PROMPT('de');
      expect(prompt).toContain('Bewertung');
      expect(prompt).toContain('JSON');
      expect(prompt).toContain('Markdown');
    });

    it('includes scoring criteria', () => {
      const prompt = EVALUATOR_PROMPT('en');
      expect(prompt).toContain('content');
      expect(prompt).toContain('communication');
      expect(prompt).toContain('structure');
      expect(prompt).toContain('empathy');
      expect(prompt).toContain('goal');
    });
  });
});

