/**
 * @module tests/@ralph/router/router
 * @description Tests for ModelRouter - main routing logic
 */

import { describe, expect, it } from 'vitest';
import {
  formatRoutingDecision,
  formatRoutingDecisionsXml,
  getRoutingPlanSummary,
  routeTask,
  routeTasks,
} from '@/lib/@ralph/router/router';
import type { ModelPreference, TaskAttributes } from '@/lib/@ralph/router/types';

describe('ModelRouter', () => {
  const testProjectPath = '/tmp/test-project';

  describe('routeTask', () => {
    it('should route trivial task to cheap tier', () => {
      const task: TaskAttributes = {
        id: 'trivial-task',
        complexity: 'trivial',
      };

      const decision = routeTask({
        task,
        projectPath: testProjectPath,
      });

      expect(decision.tier).toBe('cheap');
      expect(['haiku', 'flash']).toContain(decision.selectedModel);
      expect(decision.source).toBe('rule');
    });

    it('should route epic task to premium tier', () => {
      const task: TaskAttributes = {
        id: 'epic-task',
        complexity: 'epic',
      };

      const decision = routeTask({
        task,
        projectPath: testProjectPath,
      });

      expect(decision.tier).toBe('premium');
      expect(decision.selectedModel).toBe('opus');
    });

    it('should respect explicit model preference', () => {
      const task: TaskAttributes = {
        id: 'test-task',
        complexity: 'simple',
      };
      const preference: ModelPreference = {
        model: 'sonnet',
      };

      const decision = routeTask({
        task,
        preference,
        projectPath: testProjectPath,
      });

      expect(decision.selectedModel).toBe('sonnet');
      expect(decision.source).toBe('preference');
      expect(decision.score).toBe(100); // Max score for explicit preference
    });

    it('should respect minTier preference', () => {
      const task: TaskAttributes = {
        id: 'simple-task',
        complexity: 'simple', // Would normally route to cheap
      };
      const preference: ModelPreference = {
        minTier: 'mid',
      };

      const decision = routeTask({
        task,
        preference,
        projectPath: testProjectPath,
      });

      expect(decision.tier).not.toBe('cheap');
      expect(['mid', 'premium']).toContain(decision.tier);
    });

    it('should disable cascade when noCascade is true', () => {
      const task: TaskAttributes = {
        id: 'no-cascade-task',
        complexity: 'simple',
      };
      const preference: ModelPreference = {
        model: 'flash',
        noCascade: true,
      };

      const decision = routeTask({
        task,
        preference,
        projectPath: testProjectPath,
      });

      expect(decision.canEscalate).toBe(false);
      expect(decision.escalationPath).toEqual([]);
    });

    it('should allow escalation by default', () => {
      const task: TaskAttributes = {
        id: 'escalatable-task',
        complexity: 'simple',
      };

      const decision = routeTask({
        task,
        projectPath: testProjectPath,
      });

      expect(decision.canEscalate).toBe(true);
      expect(decision.escalationPath.length).toBeGreaterThan(0);
    });

    it('should not allow escalation for opus', () => {
      const task: TaskAttributes = {
        id: 'opus-task',
        complexity: 'epic',
      };

      const decision = routeTask({
        task,
        projectPath: testProjectPath,
      });

      expect(decision.selectedModel).toBe('opus');
      expect(decision.canEscalate).toBe(false);
    });
  });

  describe('routeTasks', () => {
    it('should route multiple tasks', () => {
      const tasks: TaskAttributes[] = [
        { id: 'task-1', complexity: 'simple' },
        { id: 'task-2', complexity: 'moderate' },
        { id: 'task-3', complexity: 'complex' },
      ];

      const decisions = routeTasks(tasks, testProjectPath);

      expect(decisions.length).toBe(3);
      expect(decisions[0]!.taskId).toBe('task-1');
      expect(decisions[1]!.taskId).toBe('task-2');
      expect(decisions[2]!.taskId).toBe('task-3');
    });

    it('should apply default preference to all tasks', () => {
      const tasks: TaskAttributes[] = [
        { id: 'task-1', complexity: 'simple' },
        { id: 'task-2', complexity: 'simple' },
      ];
      const preference: ModelPreference = {
        minTier: 'mid',
      };

      const decisions = routeTasks(tasks, testProjectPath, preference);

      for (const decision of decisions) {
        expect(['mid', 'premium']).toContain(decision.tier);
      }
    });

    it('should return empty array for empty input', () => {
      const decisions = routeTasks([], testProjectPath);

      expect(decisions).toEqual([]);
    });
  });

  describe('formatRoutingDecision', () => {
    it('should format decision as readable string', () => {
      const task: TaskAttributes = {
        id: 'format-test',
        complexity: 'moderate',
      };

      const decision = routeTask({
        task,
        projectPath: testProjectPath,
      });

      const formatted = formatRoutingDecision(decision);

      expect(formatted).toContain('Task: format-test');
      expect(formatted).toContain('Model:');
      expect(formatted).toContain('Source:');
      expect(formatted).toContain('Score:');
      expect(formatted).toContain('Can escalate:');
    });
  });

  describe('formatRoutingDecisionsXml', () => {
    it('should format decisions as XML', () => {
      const tasks: TaskAttributes[] = [
        { id: 'xml-task-1', complexity: 'simple' },
        { id: 'xml-task-2', complexity: 'complex' },
      ];

      const decisions = routeTasks(tasks, testProjectPath);
      const xml = formatRoutingDecisionsXml(decisions);

      expect(xml).toContain('<routing-plan>');
      expect(xml).toContain('</routing-plan>');
      expect(xml).toContain('id="xml-task-1"');
      expect(xml).toContain('id="xml-task-2"');
      expect(xml).toContain('<model>');
      expect(xml).toContain('<tier>');
      expect(xml).toContain('<source>');
    });

    it('should include escalation path in XML', () => {
      const tasks: TaskAttributes[] = [{ id: 'path-task', complexity: 'simple' }];

      const decisions = routeTasks(tasks, testProjectPath);
      const xml = formatRoutingDecisionsXml(decisions);

      expect(xml).toContain('<escalation-path>');
    });
  });

  describe('getRoutingPlanSummary', () => {
    it('should summarize routing decisions', () => {
      const tasks: TaskAttributes[] = [
        { id: 'task-1', complexity: 'simple' },
        { id: 'task-2', complexity: 'moderate' },
        { id: 'task-3', complexity: 'epic' },
      ];

      const decisions = routeTasks(tasks, testProjectPath);
      const summary = getRoutingPlanSummary(decisions);

      expect(summary.totalTasks).toBe(3);
      expect(summary.byTier).toBeDefined();
      expect(summary.byModel).toBeDefined();
      expect(summary.bySource).toBeDefined();
      expect(summary.escalatable).toBeGreaterThanOrEqual(0);
    });

    it('should count tasks by tier', () => {
      const tasks: TaskAttributes[] = [
        { id: 'cheap-1', complexity: 'trivial' },
        { id: 'cheap-2', complexity: 'simple' },
        { id: 'premium-1', complexity: 'epic' },
      ];

      const decisions = routeTasks(tasks, testProjectPath);
      const summary = getRoutingPlanSummary(decisions);

      expect(summary.byTier.cheap).toBe(2);
      expect(summary.byTier.premium).toBe(1);
    });

    it('should count escalatable tasks', () => {
      const tasks: TaskAttributes[] = [
        { id: 'task-1', complexity: 'simple' }, // Can escalate
        { id: 'task-2', complexity: 'epic' }, // Cannot escalate (opus)
      ];

      const decisions = routeTasks(tasks, testProjectPath);
      const summary = getRoutingPlanSummary(decisions);

      expect(summary.escalatable).toBe(1);
    });

    it('should return zeros for empty decisions', () => {
      const summary = getRoutingPlanSummary([]);

      expect(summary.totalTasks).toBe(0);
      expect(summary.escalatable).toBe(0);
      expect(Object.keys(summary.byTier).length).toBe(0);
    });
  });
});
