/**
 * @module tests/unit/commands/audit/enrichment/impact-enrichment
 * @description Unit tests for impact enrichment
 */

import { describe, expect, it } from 'vitest';
import {
  enrichIssueWithImpact,
  ImpactEnricher,
} from '../../../../../src/commands/audit/enrichment/impact-enrichment';
import type { QualityIssue } from '../../../../../src/commands/fix/core';

describe('ImpactEnricher', () => {
  // Simple dependency graph for testing
  // src/lib/helpers.ts is depended on by utils.ts
  // src/core/utils.ts is depended on by main.ts and settings.ts
  // src/app/main.ts is depended on by main.test.ts
  const dependencyGraph: Record<string, string[]> = {
    'src/core/utils.ts': ['src/lib/helpers.ts'],
    'src/app/main.ts': ['src/core/utils.ts', 'src/lib/helpers.ts'],
    'src/app/settings.ts': ['src/core/utils.ts'],
    'src/tests/main.test.ts': ['src/app/main.ts'],
  };

  const createTestIssue = (file: string): QualityIssue => ({
    file,
    line: 10,
    severity: 'warning',
    category: 'type-safety',
    message: 'Using any type',
  });

  describe('constructor', () => {
    it('should build enricher from dependency graph', () => {
      const enricher = new ImpactEnricher('/test/project', dependencyGraph);
      const stats = enricher.getStats();

      expect(stats.nodeCount).toBeGreaterThan(0);
      expect(stats.edgeCount).toBeGreaterThan(0);
    });

    it('should handle empty dependency graph', () => {
      const enricher = new ImpactEnricher('/test/project', {});
      const stats = enricher.getStats();

      expect(stats.nodeCount).toBe(0);
      expect(stats.edgeCount).toBe(0);
    });
  });

  describe('enrichIssue', () => {
    it('should enrich issue with dependents count', () => {
      const enricher = new ImpactEnricher('/test/project', dependencyGraph);
      const issue = createTestIssue('src/core/utils.ts');

      const impact = enricher.enrichIssue(issue);

      // utils.ts is depended on by main.ts and settings.ts
      expect(impact.dependentsCount).toBe(2);
      expect(impact.dependents).toContain('src/app/main.ts');
      expect(impact.dependents).toContain('src/app/settings.ts');
    });

    it('should enrich issue with PageRank percentile', () => {
      const enricher = new ImpactEnricher('/test/project', dependencyGraph);
      const issue = createTestIssue('src/core/utils.ts');

      const impact = enricher.enrichIssue(issue);

      expect(impact.pageRankPercentile).toBeGreaterThanOrEqual(0);
      expect(impact.pageRankPercentile).toBeLessThanOrEqual(100);
    });

    it('should calculate risk level', () => {
      const enricher = new ImpactEnricher('/test/project', dependencyGraph);
      const issue = createTestIssue('src/core/utils.ts');

      const impact = enricher.enrichIssue(issue);

      expect(['critical', 'high', 'medium', 'low']).toContain(impact.riskLevel);
    });

    it('should provide risk reason', () => {
      const enricher = new ImpactEnricher('/test/project', dependencyGraph);
      const issue = createTestIssue('src/core/utils.ts');

      const impact = enricher.enrichIssue(issue);

      expect(impact.riskReason).toBeDefined();
      expect(typeof impact.riskReason).toBe('string');
      expect(impact.riskReason.length).toBeGreaterThan(0);
    });

    it('should handle file with no dependents', () => {
      const enricher = new ImpactEnricher('/test/project', dependencyGraph);
      const issue = createTestIssue('src/tests/main.test.ts');

      const impact = enricher.enrichIssue(issue);

      expect(impact.dependentsCount).toBe(0);
      expect(impact.dependents).toHaveLength(0);
    });

    it('should handle file not in dependency graph', () => {
      const enricher = new ImpactEnricher('/test/project', dependencyGraph);
      const issue = createTestIssue('src/unknown/file.ts');

      const impact = enricher.enrichIssue(issue);

      expect(impact.dependentsCount).toBe(0);
      expect(impact.dependents).toHaveLength(0);
      expect(impact.riskLevel).toBe('low');
    });

    it('should limit top dependents to 5', () => {
      // Create graph with many dependents
      const manyDependentsGraph: Record<string, string[]> = {};
      for (let i = 0; i < 20; i++) {
        manyDependentsGraph[`src/consumer${i}.ts`] = ['src/core.ts'];
      }

      const enricher = new ImpactEnricher('/test/project', manyDependentsGraph);
      const issue = createTestIssue('src/core.ts');

      const impact = enricher.enrichIssue(issue);

      expect(impact.dependentsCount).toBe(20);
      expect(impact.dependents.length).toBeLessThanOrEqual(5);
    });
  });

  describe('enrichIssues', () => {
    it('should enrich multiple issues efficiently', () => {
      const enricher = new ImpactEnricher('/test/project', dependencyGraph);
      const issues = [
        createTestIssue('src/core/utils.ts'),
        createTestIssue('src/lib/helpers.ts'),
        createTestIssue('src/core/utils.ts'), // Duplicate file
      ];

      const result = enricher.enrichIssues(issues);

      // Should deduplicate by file
      expect(result.size).toBe(2);
      expect(result.has('src/core/utils.ts')).toBe(true);
      expect(result.has('src/lib/helpers.ts')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return graph statistics', () => {
      const enricher = new ImpactEnricher('/test/project', dependencyGraph);
      const stats = enricher.getStats();

      expect(stats.nodeCount).toBeGreaterThan(0);
      expect(stats.edgeCount).toBeGreaterThan(0);
      expect(stats.maxDependents).toBeGreaterThanOrEqual(0);
      expect(stats.avgDependents).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('enrichIssueWithImpact', () => {
  const dependencyGraph: Record<string, string[]> = {
    'src/core/utils.ts': ['src/lib/helpers.ts'],
    'src/app/main.ts': ['src/core/utils.ts'],
  };

  it('should enrich single issue (convenience function)', () => {
    const issue: QualityIssue = {
      file: 'src/core/utils.ts',
      line: 10,
      severity: 'warning',
      category: 'type-safety',
      message: 'Using any type',
    };

    const impact = enrichIssueWithImpact(issue, '/test/project', dependencyGraph);

    expect(impact.dependentsCount).toBe(1);
    expect(impact.dependents).toContain('src/app/main.ts');
    expect(['critical', 'high', 'medium', 'low']).toContain(impact.riskLevel);
  });
});
