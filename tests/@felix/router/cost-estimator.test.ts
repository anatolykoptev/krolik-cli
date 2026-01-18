/**
 * @module tests/@ralph/router/cost-estimator
 * @description Tests for CostEstimator - pre-execution cost estimation
 */

import { describe, expect, it } from 'vitest';
import {
  estimateTaskCost,
  estimateTotalCost,
  formatCostEstimate,
  formatCostEstimateXml,
} from '@/lib/@felix/router/cost-estimator';
import { MODEL_INFO } from '@/lib/@felix/router/rules';
import type { TaskAttributes } from '@/lib/@felix/router/types';

describe('CostEstimator', () => {
  describe('estimateTaskCost', () => {
    it('should return cost estimate for a task', () => {
      const task: TaskAttributes = {
        id: 'test-task',
        complexity: 'moderate',
      };

      const estimate = estimateTaskCost(task);

      expect(estimate.taskId).toBe('test-task');
      expect(estimate.estimatedModel).toBeDefined();
      expect(estimate.estimatedTokens).toBeGreaterThan(0);
      expect(estimate.optimisticCost).toBeGreaterThan(0);
      expect(estimate.expectedCost).toBeGreaterThan(0);
      expect(estimate.pessimisticCost).toBeGreaterThan(0);
    });

    it('should have optimistic <= expected <= pessimistic', () => {
      const task: TaskAttributes = {
        id: 'test-order',
        complexity: 'moderate',
      };

      const estimate = estimateTaskCost(task);

      expect(estimate.optimisticCost).toBeLessThanOrEqual(estimate.expectedCost);
      expect(estimate.expectedCost).toBeLessThanOrEqual(estimate.pessimisticCost);
    });

    it('should assign free model for trivial tasks', () => {
      const task: TaskAttributes = {
        id: 'trivial-task',
        complexity: 'trivial',
      };

      const estimate = estimateTaskCost(task);

      // Trivial should get free tier model (llama-70b)
      const modelTier = MODEL_INFO[estimate.estimatedModel].tier;
      expect(modelTier).toBe('free');
      expect(estimate.estimatedModel).toBe('vibe-opus');
    });

    it('should assign premium model for epic tasks', () => {
      const task: TaskAttributes = {
        id: 'epic-task',
        complexity: 'epic',
      };

      const estimate = estimateTaskCost(task);

      expect(estimate.estimatedModel).toBe('opus');
    });

    it('should have escalation probability between 0 and 1', () => {
      const task: TaskAttributes = {
        id: 'task-with-risk',
        complexity: 'moderate',
      };

      const estimate = estimateTaskCost(task);

      expect(estimate.escalationProbability).toBeGreaterThanOrEqual(0);
      expect(estimate.escalationProbability).toBeLessThanOrEqual(1);
    });

    it('should estimate more tokens for complex tasks', () => {
      const simpleTask: TaskAttributes = {
        id: 'simple',
        complexity: 'simple',
      };
      const complexTask: TaskAttributes = {
        id: 'complex',
        complexity: 'complex',
      };

      const simpleEstimate = estimateTaskCost(simpleTask);
      const complexEstimate = estimateTaskCost(complexTask);

      expect(complexEstimate.estimatedTokens).toBeGreaterThan(simpleEstimate.estimatedTokens);
    });

    it('should estimate more tokens for tasks with more files', () => {
      const fewFiles: TaskAttributes = {
        id: 'few',
        complexity: 'moderate',
        filesAffected: ['a.ts'],
      };
      const manyFiles: TaskAttributes = {
        id: 'many',
        complexity: 'moderate',
        filesAffected: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'],
      };

      const fewEstimate = estimateTaskCost(fewFiles);
      const manyEstimate = estimateTaskCost(manyFiles);

      expect(manyEstimate.estimatedTokens).toBeGreaterThan(fewEstimate.estimatedTokens);
    });
  });

  describe('estimateTotalCost', () => {
    it('should aggregate costs for multiple tasks', () => {
      const tasks: TaskAttributes[] = [
        { id: 'task-1', complexity: 'simple' },
        { id: 'task-2', complexity: 'moderate' },
        { id: 'task-3', complexity: 'complex' },
      ];

      const total = estimateTotalCost(tasks);

      expect(total.breakdown.length).toBe(3);
      expect(total.optimistic).toBeGreaterThan(0);
      expect(total.expected).toBeGreaterThan(0);
      expect(total.pessimistic).toBeGreaterThan(0);
    });

    it('should have correct order: optimistic <= expected <= pessimistic', () => {
      const tasks: TaskAttributes[] = [
        { id: 'task-1', complexity: 'simple' },
        { id: 'task-2', complexity: 'epic' },
      ];

      const total = estimateTotalCost(tasks);

      expect(total.optimistic).toBeLessThanOrEqual(total.expected);
      expect(total.expected).toBeLessThanOrEqual(total.pessimistic);
    });

    it('should return zero for empty task list', () => {
      const total = estimateTotalCost([]);

      expect(total.optimistic).toBe(0);
      expect(total.expected).toBe(0);
      expect(total.pessimistic).toBe(0);
      expect(total.breakdown.length).toBe(0);
    });

    it('should sum individual task costs correctly', () => {
      const tasks: TaskAttributes[] = [
        { id: 'task-1', complexity: 'simple' },
        { id: 'task-2', complexity: 'simple' },
      ];

      const total = estimateTotalCost(tasks);
      const individual1 = estimateTaskCost(tasks[0]!);
      const individual2 = estimateTaskCost(tasks[1]!);

      // Expected should be close to sum of individual expected costs
      const sumExpected = individual1.expectedCost + individual2.expectedCost;
      expect(total.expected).toBeCloseTo(sumExpected, 4);
    });
  });

  describe('formatCostEstimate', () => {
    it('should format estimate as readable string', () => {
      const tasks: TaskAttributes[] = [{ id: 'task-1', complexity: 'simple' }];
      const estimate = estimateTotalCost(tasks);
      const formatted = formatCostEstimate(estimate);

      expect(formatted).toContain('Cost Estimate:');
      expect(formatted).toContain('Optimistic:');
      expect(formatted).toContain('Expected:');
      expect(formatted).toContain('Pessimistic:');
      expect(formatted).toContain('task-1');
    });
  });

  describe('formatCostEstimateXml', () => {
    it('should format estimate as XML', () => {
      const tasks: TaskAttributes[] = [{ id: 'xml-task', complexity: 'moderate' }];
      const estimate = estimateTotalCost(tasks);
      const xml = formatCostEstimateXml(estimate);

      expect(xml).toContain('<cost-estimate>');
      expect(xml).toContain('</cost-estimate>');
      expect(xml).toContain('<optimistic>');
      expect(xml).toContain('<expected>');
      expect(xml).toContain('<pessimistic>');
      expect(xml).toContain('id="xml-task"');
    });
  });
});
