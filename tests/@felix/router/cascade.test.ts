/**
 * @module tests/@ralph/router/cascade
 * @description Tests for CascadeExecutor - error classification and escalation
 */

import { describe, expect, it } from 'vitest';
import {
  canEscalate,
  classifyError,
  createCascadeDecision,
  DEFAULT_CASCADE_CONFIG,
  getNextTier,
} from '@/lib/@felix/router/cascade';
import type { ErrorCategory } from '@/lib/@felix/router/types';

describe('CascadeExecutor', () => {
  describe('classifyError', () => {
    it('should classify syntax errors', () => {
      expect(classifyError('SyntaxError: Unexpected token')).toBe('syntax');
      expect(classifyError('Parse error at line 5')).toBe('syntax');
      expect(classifyError('Unexpected token at position 42')).toBe('syntax');
    });

    it('should classify validation errors', () => {
      expect(classifyError('Validation failed: missing field')).toBe('validation');
      expect(classifyError('Invalid input for parameter X')).toBe('validation');
      expect(classifyError('Missing required field: name')).toBe('validation');
    });

    it('should classify capability errors', () => {
      expect(classifyError('This request is too complex')).toBe('capability');
      expect(classifyError('Context too long for this model')).toBe('capability');
      expect(classifyError('Cannot handle this type of request')).toBe('capability');
      expect(classifyError('Exceeds context window')).toBe('capability');
      expect(classifyError('Rate limit exceeded')).toBe('capability');
      expect(classifyError('Model overloaded')).toBe('capability');
    });

    it('should classify timeout errors', () => {
      expect(classifyError('Request timed out')).toBe('timeout');
      expect(classifyError('Operation timed out after 30s')).toBe('timeout');
      expect(classifyError('Deadline exceeded')).toBe('timeout');
    });

    it('should classify unknown errors', () => {
      expect(classifyError('Something went wrong')).toBe('unknown');
      expect(classifyError('Random error message')).toBe('unknown');
      expect(classifyError(new Error('Generic error'))).toBe('unknown');
    });

    it('should handle Error objects', () => {
      // Uses 'unexpected token' pattern which is matched
      const syntaxError = new Error('Unexpected token at position 5');
      expect(classifyError(syntaxError)).toBe('syntax');

      const timeoutError = new Error('Request timed out');
      expect(classifyError(timeoutError)).toBe('timeout');
    });
  });

  describe('canEscalate', () => {
    it('should return true for cheap tier models', () => {
      expect(canEscalate('flash')).toBe(true);
      expect(canEscalate('haiku')).toBe(true);
    });

    it('should return true for mid tier models', () => {
      expect(canEscalate('sonnet')).toBe(true);
      expect(canEscalate('pro')).toBe(true);
    });

    it('should return false for premium tier models', () => {
      expect(canEscalate('opus')).toBe(false);
    });
  });

  describe('getNextTier', () => {
    it('should return mid for cheap tier', () => {
      expect(getNextTier('cheap')).toBe('mid');
    });

    it('should return premium for mid tier', () => {
      expect(getNextTier('mid')).toBe('premium');
    });

    it('should return null for premium tier', () => {
      expect(getNextTier('premium')).toBe(null);
    });
  });

  describe('createCascadeDecision', () => {
    it('should create decision for cheap tier model', () => {
      const decision = createCascadeDecision('task-1', 'flash', 'rule', 25);

      expect(decision.taskId).toBe('task-1');
      expect(decision.selectedModel).toBe('flash');
      expect(decision.tier).toBe('cheap');
      expect(decision.source).toBe('rule');
      expect(decision.score).toBe(25);
      expect(decision.canEscalate).toBe(true);
      expect(decision.escalationPath.length).toBeGreaterThan(0);
    });

    it('should create decision for mid tier model', () => {
      const decision = createCascadeDecision('task-2', 'sonnet', 'history', 50);

      expect(decision.selectedModel).toBe('sonnet');
      expect(decision.tier).toBe('mid');
      expect(decision.canEscalate).toBe(true);
    });

    it('should create decision for premium tier model', () => {
      const decision = createCascadeDecision('task-3', 'opus', 'preference', 90);

      expect(decision.selectedModel).toBe('opus');
      expect(decision.tier).toBe('premium');
      expect(decision.canEscalate).toBe(false);
      expect(decision.escalationPath).toEqual([]);
    });

    it('should disable escalation when noCascade is true', () => {
      const decision = createCascadeDecision('task-4', 'flash', 'rule', 20, true);

      expect(decision.canEscalate).toBe(false);
      expect(decision.escalationPath).toEqual([]);
    });

    it('should include correct escalation path for haiku', () => {
      const decision = createCascadeDecision('task-5', 'haiku', 'rule', 15);

      expect(decision.escalationPath).toContain('flash');
      expect(decision.escalationPath).toContain('sonnet');
      expect(decision.escalationPath).toContain('opus');
    });
  });

  describe('DEFAULT_CASCADE_CONFIG', () => {
    it('should have correct maxRetries', () => {
      expect(DEFAULT_CASCADE_CONFIG.maxRetries).toBe(3);
    });

    it('should retry on correct error categories', () => {
      expect(DEFAULT_CASCADE_CONFIG.retrySameModel).toContain('syntax');
      expect(DEFAULT_CASCADE_CONFIG.retrySameModel).toContain('validation');
    });

    it('should escalate on capability and timeout errors', () => {
      expect(DEFAULT_CASCADE_CONFIG.escalateOn).toContain('capability');
      expect(DEFAULT_CASCADE_CONFIG.escalateOn).toContain('timeout');
    });

    it('should have escalation paths for all tiers', () => {
      expect(DEFAULT_CASCADE_CONFIG.escalationPath.cheap).toBeDefined();
      expect(DEFAULT_CASCADE_CONFIG.escalationPath.mid).toBeDefined();
      expect(DEFAULT_CASCADE_CONFIG.escalationPath.premium).toBeDefined();
    });

    it('should have opus in escalation path for cheap tier', () => {
      expect(DEFAULT_CASCADE_CONFIG.escalationPath.cheap).toContain('opus');
    });

    it('should have opus in escalation path for mid tier', () => {
      expect(DEFAULT_CASCADE_CONFIG.escalationPath.mid).toContain('opus');
    });

    it('should have only opus in premium escalation path', () => {
      expect(DEFAULT_CASCADE_CONFIG.escalationPath.premium).toEqual(['opus']);
    });
  });
});
