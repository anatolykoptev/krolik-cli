/**
 * @module tests/commands/fix/recommendation-adapter.test
 * @description Tests for recommendation to quality issue adapter
 */

import { describe, expect, it } from 'vitest';
import {
  adaptRecommendation,
  adaptRecommendationsToIssues,
  getRecommendationStats,
  groupByFixer,
} from '../../../../src/commands/fix/recommendation-adapter';
import type { Recommendation } from '../../../../src/commands/refactor/core';

describe('recommendation-adapter', () => {
  // Helper to create test recommendations
  function createRecommendation(
    overrides: Partial<Recommendation> & { id: string },
  ): Recommendation {
    return {
      id: overrides.id,
      priority: overrides.priority ?? 1,
      category: overrides.category ?? 'duplication',
      title: overrides.title ?? 'Test recommendation',
      description: overrides.description ?? 'Test description',
      expectedImprovement: overrides.expectedImprovement ?? 10,
      effort: overrides.effort ?? 'low',
      affectedFiles: overrides.affectedFiles ?? ['src/file.ts'],
      autoFixable: overrides.autoFixable ?? true,
    };
  }

  describe('adaptRecommendation()', () => {
    it('maps duplication category to lint', () => {
      const rec = createRecommendation({
        id: 'dup-1',
        category: 'duplication',
      });

      const issue = adaptRecommendation(rec);

      expect(issue.category).toBe('lint');
      expect(issue.fixerId).toBe('duplicate');
    });

    it('maps structure category to refine', () => {
      const rec = createRecommendation({
        id: 'struct-1',
        category: 'structure',
      });

      const issue = adaptRecommendation(rec);

      expect(issue.category).toBe('refine');
      expect(issue.fixerId).toBe('refine');
    });

    it('maps architecture category to circular-dep', () => {
      const rec = createRecommendation({
        id: 'arch-1',
        category: 'architecture',
      });

      const issue = adaptRecommendation(rec);

      expect(issue.category).toBe('circular-dep');
      expect(issue.fixerId).toBe('architecture');
    });

    it('maps naming category to refine', () => {
      const rec = createRecommendation({
        id: 'name-1',
        category: 'naming',
      });

      const issue = adaptRecommendation(rec);

      expect(issue.category).toBe('refine');
      expect(issue.fixerId).toBe('refine');
    });

    it('maps documentation category to documentation', () => {
      const rec = createRecommendation({
        id: 'doc-1',
        category: 'documentation',
      });

      const issue = adaptRecommendation(rec);

      expect(issue.category).toBe('documentation');
      expect(issue.fixerId).toBe('documentation');
    });

    it('uses first affected file as primary file', () => {
      const rec = createRecommendation({
        id: 'test-1',
        affectedFiles: ['src/first.ts', 'src/second.ts', 'src/third.ts'],
      });

      const issue = adaptRecommendation(rec);

      expect(issue.file).toBe('src/first.ts');
    });

    it('uses title as message', () => {
      const rec = createRecommendation({
        id: 'test-1',
        title: 'Merge duplicate function: formatDate',
      });

      const issue = adaptRecommendation(rec);

      expect(issue.message).toBe('Merge duplicate function: formatDate');
    });

    it('maps effort to severity', () => {
      const lowEffort = createRecommendation({ id: 'low', effort: 'low' });
      const mediumEffort = createRecommendation({ id: 'med', effort: 'medium' });
      const highEffort = createRecommendation({ id: 'high', effort: 'high' });

      expect(adaptRecommendation(lowEffort).severity).toBe('info');
      expect(adaptRecommendation(mediumEffort).severity).toBe('warning');
      expect(adaptRecommendation(highEffort).severity).toBe('error');
    });

    it('builds suggestion with description and improvement', () => {
      const rec = createRecommendation({
        id: 'test-1',
        description: 'Consider merging these functions',
        expectedImprovement: 15,
      });

      const issue = adaptRecommendation(rec);

      expect(issue.suggestion).toContain('Consider merging these functions');
      expect(issue.suggestion).toContain('Expected improvement: +15 points');
    });

    it('includes affected files count in suggestion', () => {
      const rec = createRecommendation({
        id: 'test-1',
        description: 'Test',
        affectedFiles: ['a.ts', 'b.ts', 'c.ts'],
      });

      const issue = adaptRecommendation(rec);

      expect(issue.suggestion).toContain('Affects 3 files');
    });

    it('builds snippet for multiple affected files', () => {
      const rec = createRecommendation({
        id: 'test-1',
        affectedFiles: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
      });

      const issue = adaptRecommendation(rec);

      expect(issue.snippet).toContain('Affected files:');
      expect(issue.snippet).toContain('src/a.ts');
      expect(issue.snippet).toContain('src/b.ts');
      expect(issue.snippet).toContain('src/c.ts');
    });

    it('truncates snippet to 5 files with overflow indicator', () => {
      const rec = createRecommendation({
        id: 'test-1',
        affectedFiles: ['1.ts', '2.ts', '3.ts', '4.ts', '5.ts', '6.ts', '7.ts'],
      });

      const issue = adaptRecommendation(rec);

      expect(issue.snippet).toContain('... and 2 more');
    });

    it('does not include snippet for single file', () => {
      const rec = createRecommendation({
        id: 'test-1',
        affectedFiles: ['only.ts'],
      });

      const issue = adaptRecommendation(rec);

      expect(issue.snippet).toBeUndefined();
    });
  });

  describe('adaptRecommendationsToIssues()', () => {
    it('converts array of recommendations to issues', () => {
      const recs = [
        createRecommendation({ id: 'rec-1', autoFixable: true }),
        createRecommendation({ id: 'rec-2', autoFixable: true }),
      ];

      const issues = adaptRecommendationsToIssues(recs);

      expect(issues).toHaveLength(2);
    });

    it('filters non-auto-fixable by default', () => {
      const recs = [
        createRecommendation({ id: 'rec-1', autoFixable: true }),
        createRecommendation({ id: 'rec-2', autoFixable: false }),
        createRecommendation({ id: 'rec-3', autoFixable: true }),
      ];

      const issues = adaptRecommendationsToIssues(recs);

      expect(issues).toHaveLength(2);
    });

    it('includes all when includeAll is true', () => {
      const recs = [
        createRecommendation({ id: 'rec-1', autoFixable: true }),
        createRecommendation({ id: 'rec-2', autoFixable: false }),
      ];

      const issues = adaptRecommendationsToIssues(recs, { includeAll: true });

      expect(issues).toHaveLength(2);
    });
  });

  describe('groupByFixer()', () => {
    it('groups recommendations by fixer id', () => {
      const recs = [
        createRecommendation({ id: 'dup-1', category: 'duplication' }),
        createRecommendation({ id: 'dup-2', category: 'duplication' }),
        createRecommendation({ id: 'struct-1', category: 'structure' }),
        createRecommendation({ id: 'arch-1', category: 'architecture' }),
      ];

      const groups = groupByFixer(recs);

      expect(groups.get('duplicate')).toHaveLength(2);
      expect(groups.get('refine')).toHaveLength(1);
      expect(groups.get('architecture')).toHaveLength(1);
    });

    it('returns empty map for empty array', () => {
      const groups = groupByFixer([]);

      expect(groups.size).toBe(0);
    });
  });

  describe('getRecommendationStats()', () => {
    it('calculates statistics', () => {
      const recs = [
        createRecommendation({ id: 'rec-1', category: 'duplication', autoFixable: true }),
        createRecommendation({ id: 'rec-2', category: 'duplication', autoFixable: true }),
        createRecommendation({ id: 'rec-3', category: 'structure', autoFixable: false }),
        createRecommendation({ id: 'rec-4', category: 'architecture', autoFixable: false }),
      ];

      const stats = getRecommendationStats(recs);

      expect(stats.total).toBe(4);
      expect(stats.autoFixable).toBe(2);
      expect(stats.byCategory).toEqual({
        duplication: 2,
        structure: 1,
        architecture: 1,
      });
      expect(stats.byFixer).toEqual({
        duplicate: 2,
        refine: 1,
        architecture: 1,
      });
    });

    it('handles empty array', () => {
      const stats = getRecommendationStats([]);

      expect(stats.total).toBe(0);
      expect(stats.autoFixable).toBe(0);
      expect(stats.byCategory).toEqual({});
      expect(stats.byFixer).toEqual({});
    });
  });
});
