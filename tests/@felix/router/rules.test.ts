/**
 * @module tests/@ralph/router/rules
 * @description Tests for RuleEngine - task scoring and model selection
 */

import { describe, expect, it } from 'vitest';
import {
  calculateTaskScore,
  compareTiers,
  DEFAULT_MODELS,
  getEscalationPath,
  MODEL_INFO,
  scoreToTier,
} from '@/lib/@felix/router/rules';
import type { TaskAttributes } from '@/lib/@felix/router/types';

describe('RuleEngine', () => {
  describe('calculateTaskScore', () => {
    it('should score trivial task as free tier', () => {
      const task: TaskAttributes = {
        id: 'test-1',
        complexity: 'trivial',
      };
      const result = calculateTaskScore(task);

      expect(result.score).toBe(10); // trivial base score
      expect(result.tier).toBe('free');
      expect(result.suggestedModel).toBe('vibe-opus');
    });

    it('should score simple task as cheap tier', () => {
      const task: TaskAttributes = {
        id: 'test-2',
        complexity: 'simple',
      };
      const result = calculateTaskScore(task);

      expect(result.score).toBe(25); // simple base score
      expect(result.tier).toBe('cheap');
    });

    it('should score moderate task as mid tier', () => {
      const task: TaskAttributes = {
        id: 'test-3',
        complexity: 'moderate',
      };
      const result = calculateTaskScore(task);

      expect(result.score).toBe(50); // moderate base score
      expect(result.tier).toBe('mid');
    });

    it('should score complex task as premium tier', () => {
      const task: TaskAttributes = {
        id: 'test-4',
        complexity: 'complex',
      };
      const result = calculateTaskScore(task);

      // complex = 75 base score, which is > 65 = premium
      expect(result.score).toBe(75);
      expect(result.tier).toBe('premium');
    });

    it('should score epic task as premium tier', () => {
      const task: TaskAttributes = {
        id: 'test-5',
        complexity: 'epic',
      };
      const result = calculateTaskScore(task);

      expect(result.score).toBe(95); // epic base score
      expect(result.tier).toBe('premium');
      expect(result.suggestedModel).toBe('opus');
    });

    it('should boost score for multiple files affected', () => {
      const baseTask: TaskAttributes = {
        id: 'test-6',
        complexity: 'simple',
      };
      const taskWithFiles: TaskAttributes = {
        id: 'test-7',
        complexity: 'simple',
        filesAffected: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'],
      };

      const baseResult = calculateTaskScore(baseTask);
      const filesResult = calculateTaskScore(taskWithFiles);

      // 5 files - 2 = 3 files over threshold, 3 * 5 = 15 boost
      expect(filesResult.score).toBe(baseResult.score + 15);
      expect(filesResult.breakdown.filesBoost).toBe(15);
    });

    it('should boost score for multiple acceptance criteria', () => {
      const baseTask: TaskAttributes = {
        id: 'test-8',
        complexity: 'simple',
      };
      const taskWithCriteria: TaskAttributes = {
        id: 'test-9',
        complexity: 'simple',
        acceptanceCriteria: ['crit1', 'crit2', 'crit3', 'crit4', 'crit5'],
      };

      const baseResult = calculateTaskScore(baseTask);
      const criteriaResult = calculateTaskScore(taskWithCriteria);

      // 5 criteria - 2 = 3 over threshold, 3 * 3 = 9 boost
      expect(criteriaResult.score).toBe(baseResult.score + 9);
      expect(criteriaResult.breakdown.criteriaBoost).toBe(9);
    });

    it('should boost score for architecture tag', () => {
      const task: TaskAttributes = {
        id: 'test-10',
        complexity: 'simple',
        tags: ['architecture'],
      };
      const result = calculateTaskScore(task);

      expect(result.breakdown.tagsBoost).toBe(20);
      expect(result.score).toBe(25 + 20); // simple + architecture boost
    });

    it('should reduce score for lint tag', () => {
      const task: TaskAttributes = {
        id: 'test-11',
        complexity: 'moderate',
        tags: ['lint'],
      };
      const result = calculateTaskScore(task);

      expect(result.breakdown.tagsBoost).toBe(-15);
      expect(result.score).toBe(50 - 15); // moderate - lint reduction
    });

    it('should reduce score for typo tag', () => {
      const task: TaskAttributes = {
        id: 'test-12',
        complexity: 'moderate',
        tags: ['typo'],
      };
      const result = calculateTaskScore(task);

      expect(result.breakdown.tagsBoost).toBe(-25);
      expect(result.score).toBe(50 - 25); // moderate - typo reduction
    });

    it('should combine multiple tag boosts', () => {
      const task: TaskAttributes = {
        id: 'test-13',
        complexity: 'simple',
        tags: ['architecture', 'security'],
      };
      const result = calculateTaskScore(task);

      expect(result.breakdown.tagsBoost).toBe(35); // 20 + 15
      expect(result.score).toBe(25 + 35); // simple + combined boosts
    });

    it('should clamp score to minimum 0', () => {
      const task: TaskAttributes = {
        id: 'test-14',
        complexity: 'trivial', // base 10
        tags: ['typo', 'lint'], // -25 + -15 = -40
      };
      const result = calculateTaskScore(task);

      // 10 - 40 = -30, clamped to 0
      expect(result.score).toBe(0);
    });

    it('should clamp score to maximum 100', () => {
      const task: TaskAttributes = {
        id: 'test-15',
        complexity: 'epic', // base 95
        filesAffected: Array(20).fill('file.ts'), // +90
        acceptanceCriteria: Array(20).fill('criterion'), // +54
        tags: ['architecture', 'security', 'api'], // +40
      };
      const result = calculateTaskScore(task);

      expect(result.score).toBe(100); // clamped
    });

    it('should default to moderate complexity when not specified', () => {
      const task: TaskAttributes = {
        id: 'test-16',
      };
      const result = calculateTaskScore(task);

      expect(result.breakdown.base).toBe(50); // moderate base score
    });
  });

  describe('scoreToTier', () => {
    it('should return free for score 0-20', () => {
      expect(scoreToTier(0)).toBe('free');
      expect(scoreToTier(10)).toBe('free');
      expect(scoreToTier(20)).toBe('free');
    });

    it('should return cheap for score 21-40', () => {
      expect(scoreToTier(21)).toBe('cheap');
      expect(scoreToTier(30)).toBe('cheap');
      expect(scoreToTier(40)).toBe('cheap');
    });

    it('should return mid for score 41-65', () => {
      expect(scoreToTier(41)).toBe('mid');
      expect(scoreToTier(50)).toBe('mid');
      expect(scoreToTier(65)).toBe('mid');
    });

    it('should return premium for score 66+', () => {
      expect(scoreToTier(66)).toBe('premium');
      expect(scoreToTier(80)).toBe('premium');
      expect(scoreToTier(100)).toBe('premium');
    });
  });

  describe('compareTiers', () => {
    it('should return 0 for same tier', () => {
      expect(compareTiers('free', 'free')).toBe(0);
      expect(compareTiers('cheap', 'cheap')).toBe(0);
      expect(compareTiers('mid', 'mid')).toBe(0);
      expect(compareTiers('premium', 'premium')).toBe(0);
    });

    it('should return negative when first tier is lower', () => {
      expect(compareTiers('free', 'cheap')).toBeLessThan(0);
      expect(compareTiers('free', 'mid')).toBeLessThan(0);
      expect(compareTiers('cheap', 'mid')).toBeLessThan(0);
      expect(compareTiers('cheap', 'premium')).toBeLessThan(0);
      expect(compareTiers('mid', 'premium')).toBeLessThan(0);
    });

    it('should return positive when first tier is higher', () => {
      expect(compareTiers('cheap', 'free')).toBeGreaterThan(0);
      expect(compareTiers('mid', 'cheap')).toBeGreaterThan(0);
      expect(compareTiers('premium', 'cheap')).toBeGreaterThan(0);
      expect(compareTiers('premium', 'mid')).toBeGreaterThan(0);
    });
  });

  describe('getEscalationPath', () => {
    it('should return escalation path for flash', () => {
      const path = getEscalationPath('flash');
      // Flash: haiku (same tier), then mid tier, then premium
      expect(path).toContain('haiku');
      expect(path).toContain('sonnet');
      expect(path).toContain('pro');
      expect(path).toContain('opus');
    });

    it('should return escalation path for haiku', () => {
      const path = getEscalationPath('haiku');
      expect(path).toContain('flash');
      expect(path).toContain('sonnet');
      expect(path).toContain('opus');
    });

    it('should return escalation path for sonnet', () => {
      const path = getEscalationPath('sonnet');
      // Sonnet: pro (same tier), then opus
      expect(path).toContain('pro');
      expect(path).toContain('opus');
    });

    it('should return escalation path for pro', () => {
      const path = getEscalationPath('pro');
      expect(path).toContain('sonnet');
      expect(path).toContain('opus');
    });

    it('should return empty path for opus', () => {
      const path = getEscalationPath('opus');
      expect(path).toEqual([]);
    });
  });

  describe('DEFAULT_MODELS', () => {
    it('should have correct default models for each tier', () => {
      expect(DEFAULT_MODELS.free).toBe('vibe-opus');
      expect(DEFAULT_MODELS.cheap).toBe('flash');
      expect(DEFAULT_MODELS.mid).toBe('pro');
      expect(DEFAULT_MODELS.premium).toBe('opus');
    });
  });

  describe('MODEL_INFO', () => {
    it('should have info for all models', () => {
      expect(MODEL_INFO['vibe-opus']).toBeDefined();
      expect(MODEL_INFO.haiku).toBeDefined();
      expect(MODEL_INFO.flash).toBeDefined();
      expect(MODEL_INFO.sonnet).toBeDefined();
      expect(MODEL_INFO.pro).toBeDefined();
      expect(MODEL_INFO.opus).toBeDefined();
    });

    it('should have correct tier assignments', () => {
      expect(MODEL_INFO['vibe-opus'].tier).toBe('free');
      expect(MODEL_INFO.haiku.tier).toBe('cheap');
      expect(MODEL_INFO.flash.tier).toBe('cheap');
      expect(MODEL_INFO.sonnet.tier).toBe('mid');
      expect(MODEL_INFO.pro.tier).toBe('mid');
      expect(MODEL_INFO.opus.tier).toBe('premium');
    });

    it('should have valid pricing (free tier can be 0)', () => {
      for (const model of Object.values(MODEL_INFO)) {
        expect(model.inputCostPer1M).toBeGreaterThanOrEqual(0);
        expect(model.outputCostPer1M).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have 0 cost for free tier models', () => {
      expect(MODEL_INFO['vibe-opus'].inputCostPer1M).toBe(0);
      expect(MODEL_INFO['vibe-opus'].outputCostPer1M).toBe(0);
    });
  });
});
