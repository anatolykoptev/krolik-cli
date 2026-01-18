/**
 * @module tests/@ralph/router/history
 * @description Tests for HistoryAnalyzer - signature creation and pattern analysis
 */

import { describe, expect, it } from 'vitest';
import { createTaskSignature } from '@/lib/@ralph/router/history';
import type { TaskAttributes } from '@/lib/@ralph/router/types';

describe('HistoryAnalyzer', () => {
  describe('createTaskSignature', () => {
    it('should create signature with correct complexity', () => {
      const task: TaskAttributes = {
        id: 'test-1',
        complexity: 'moderate',
      };

      const signature = createTaskSignature(task);

      expect(signature.complexity).toBe('moderate');
    });

    it('should default to moderate complexity when not specified', () => {
      const task: TaskAttributes = {
        id: 'test-2',
      };

      const signature = createTaskSignature(task);

      expect(signature.complexity).toBe('moderate');
    });

    it('should include sorted tags', () => {
      const task: TaskAttributes = {
        id: 'test-3',
        tags: ['security', 'api', 'architecture'],
      };

      const signature = createTaskSignature(task);

      expect(signature.tags).toEqual(['api', 'architecture', 'security']);
    });

    it('should have empty tags when none specified', () => {
      const task: TaskAttributes = {
        id: 'test-4',
      };

      const signature = createTaskSignature(task);

      expect(signature.tags).toEqual([]);
    });

    it('should calculate correct files range for few files', () => {
      const fewFiles: TaskAttributes = {
        id: 'few',
        filesAffected: ['a.ts'],
      };

      const signature = createTaskSignature(fewFiles);
      expect(signature.filesRange).toBe('few');
    });

    it('should calculate correct files range for some files', () => {
      const someFiles: TaskAttributes = {
        id: 'some',
        filesAffected: ['a.ts', 'b.ts', 'c.ts', 'd.ts'],
      };

      const signature = createTaskSignature(someFiles);
      expect(signature.filesRange).toBe('some');
    });

    it('should calculate correct files range for many files', () => {
      const manyFiles: TaskAttributes = {
        id: 'many',
        filesAffected: Array(10).fill('file.ts'),
      };

      const signature = createTaskSignature(manyFiles);
      expect(signature.filesRange).toBe('many');
    });

    it('should generate consistent hash for same inputs', () => {
      const task1: TaskAttributes = {
        id: 'task-a',
        complexity: 'simple',
        tags: ['api'],
        filesAffected: ['a.ts', 'b.ts'],
      };
      const task2: TaskAttributes = {
        id: 'task-b', // Different ID, but same signature
        complexity: 'simple',
        tags: ['api'],
        filesAffected: ['c.ts', 'd.ts'], // Different files, but same count
      };

      const sig1 = createTaskSignature(task1);
      const sig2 = createTaskSignature(task2);

      expect(sig1.hash).toBe(sig2.hash);
    });

    it('should generate different hash for different complexity', () => {
      const simple: TaskAttributes = {
        id: 'test',
        complexity: 'simple',
      };
      const complex: TaskAttributes = {
        id: 'test',
        complexity: 'complex',
      };

      const sig1 = createTaskSignature(simple);
      const sig2 = createTaskSignature(complex);

      expect(sig1.hash).not.toBe(sig2.hash);
    });

    it('should generate different hash for different tags', () => {
      const apiTask: TaskAttributes = {
        id: 'test',
        complexity: 'simple',
        tags: ['api'],
      };
      const securityTask: TaskAttributes = {
        id: 'test',
        complexity: 'simple',
        tags: ['security'],
      };

      const sig1 = createTaskSignature(apiTask);
      const sig2 = createTaskSignature(securityTask);

      expect(sig1.hash).not.toBe(sig2.hash);
    });

    it('should generate different hash for different files range', () => {
      const fewFiles: TaskAttributes = {
        id: 'test',
        complexity: 'simple',
        filesAffected: ['a.ts'],
      };
      const manyFiles: TaskAttributes = {
        id: 'test',
        complexity: 'simple',
        filesAffected: Array(10).fill('file.ts'),
      };

      const sig1 = createTaskSignature(fewFiles);
      const sig2 = createTaskSignature(manyFiles);

      expect(sig1.hash).not.toBe(sig2.hash);
    });

    it('should produce a non-empty hash string', () => {
      const task: TaskAttributes = {
        id: 'hash-test',
        complexity: 'moderate',
        tags: ['test'],
      };

      const signature = createTaskSignature(task);

      expect(typeof signature.hash).toBe('string');
      expect(signature.hash.length).toBeGreaterThan(0);
    });
  });
});
