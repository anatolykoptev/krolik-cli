/**
 * @module tests/commands/fix/refactor-reader.test
 * @description Tests for refactor data reader
 */

import * as fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatRefactorAge,
  getRefactorDataAge,
  getRefactorDataPath,
  hasRefactorData,
  isRefactorDataStale,
  type RefactorDataCache,
  readRefactorData,
} from '../../../../src/commands/fix/refactor-reader';

// Mock fs module
vi.mock('node:fs');

// We don't mock recommendation-adapter - it's a pure function that works fine

describe('refactor-reader', () => {
  const mockProjectRoot = '/test/project';
  const expectedPath = '/test/project/.krolik/refactor-data.json';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRefactorDataPath()', () => {
    it('returns correct path', () => {
      const result = getRefactorDataPath(mockProjectRoot);
      expect(result).toBe(expectedPath);
    });
  });

  describe('hasRefactorData()', () => {
    it('returns true when file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = hasRefactorData(mockProjectRoot);

      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
    });

    it('returns false when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = hasRefactorData(mockProjectRoot);

      expect(result).toBe(false);
    });
  });

  describe('getRefactorDataAge()', () => {
    it('returns age in milliseconds', () => {
      const now = Date.now();
      const oneHourAgo = new Date(now - 3600000).toISOString();

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          timestamp: oneHourAgo,
          path: 'src',
          recommendations: [],
        }),
      );

      const result = getRefactorDataAge(mockProjectRoot);

      expect(result).toBeGreaterThanOrEqual(3600000);
      expect(result).toBeLessThan(3700000); // Allow some tolerance
    });

    it('returns null when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = getRefactorDataAge(mockProjectRoot);

      expect(result).toBeNull();
    });

    it('returns null on parse error', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      const result = getRefactorDataAge(mockProjectRoot);

      expect(result).toBeNull();
    });
  });

  describe('readRefactorData()', () => {
    it('returns success with issues when file exists', () => {
      const mockCache: RefactorDataCache = {
        timestamp: new Date().toISOString(),
        path: 'src',
        recommendations: [
          {
            id: 'rec-1',
            priority: 1,
            category: 'duplication',
            title: 'Merge duplicate function',
            description: 'Function foo is duplicated',
            expectedImprovement: 10,
            effort: 'low',
            affectedFiles: ['src/a.ts', 'src/b.ts'],
            autoFixable: true,
          },
        ],
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockCache));

      const result = readRefactorData(mockProjectRoot);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recommendations).toHaveLength(1);
        expect(result.issues).toHaveLength(1);
        expect(result.cache).toEqual(mockCache);
        expect(result.age).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns error when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = readRefactorData(mockProjectRoot);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('No refactor data found');
      }
    });

    it('returns error on parse failure', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('not json');

      const result = readRefactorData(mockProjectRoot);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed to parse');
      }
    });

    it('filters non-auto-fixable by default', () => {
      const mockCache: RefactorDataCache = {
        timestamp: new Date().toISOString(),
        path: 'src',
        recommendations: [
          {
            id: 'rec-1',
            priority: 1,
            category: 'duplication',
            title: 'Auto-fixable',
            description: 'Can be fixed',
            expectedImprovement: 10,
            effort: 'low',
            affectedFiles: ['src/a.ts'],
            autoFixable: true,
          },
          {
            id: 'rec-2',
            priority: 2,
            category: 'architecture',
            title: 'Not auto-fixable',
            description: 'Needs manual fix',
            expectedImprovement: 20,
            effort: 'high',
            affectedFiles: ['src/b.ts'],
            autoFixable: false,
          },
        ],
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockCache));

      const result = readRefactorData(mockProjectRoot, true);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recommendations).toHaveLength(1);
        expect(result.recommendations[0].id).toBe('rec-1');
      }
    });

    it('includes all when autoFixableOnly is false', () => {
      const mockCache: RefactorDataCache = {
        timestamp: new Date().toISOString(),
        path: 'src',
        recommendations: [
          {
            id: 'rec-1',
            priority: 1,
            category: 'duplication',
            title: 'Auto-fixable',
            description: 'Can be fixed',
            expectedImprovement: 10,
            effort: 'low',
            affectedFiles: ['src/a.ts'],
            autoFixable: true,
          },
          {
            id: 'rec-2',
            priority: 2,
            category: 'architecture',
            title: 'Not auto-fixable',
            description: 'Needs manual fix',
            expectedImprovement: 20,
            effort: 'high',
            affectedFiles: ['src/b.ts'],
            autoFixable: false,
          },
        ],
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockCache));

      const result = readRefactorData(mockProjectRoot, false);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recommendations).toHaveLength(2);
      }
    });
  });

  describe('formatRefactorAge()', () => {
    it('formats seconds as "just now"', () => {
      expect(formatRefactorAge(5000)).toBe('just now');
      expect(formatRefactorAge(30000)).toBe('just now');
    });

    it('formats minutes', () => {
      expect(formatRefactorAge(60000)).toBe('1m ago');
      expect(formatRefactorAge(300000)).toBe('5m ago');
    });

    it('formats hours', () => {
      expect(formatRefactorAge(3600000)).toBe('1h ago');
      expect(formatRefactorAge(7200000)).toBe('2h ago');
    });

    it('formats days', () => {
      expect(formatRefactorAge(86400000)).toBe('1d ago');
      expect(formatRefactorAge(172800000)).toBe('2d ago');
    });
  });

  describe('isRefactorDataStale()', () => {
    it('returns true when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = isRefactorDataStale(mockProjectRoot);

      expect(result).toBe(true);
    });

    it('returns true when older than threshold', () => {
      const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          timestamp: twoHoursAgo,
          path: 'src',
          recommendations: [],
        }),
      );

      const result = isRefactorDataStale(mockProjectRoot, 60); // 60 minutes

      expect(result).toBe(true);
    });

    it('returns false when newer than threshold', () => {
      const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString();

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          timestamp: fiveMinutesAgo,
          path: 'src',
          recommendations: [],
        }),
      );

      const result = isRefactorDataStale(mockProjectRoot, 60);

      expect(result).toBe(false);
    });
  });
});
