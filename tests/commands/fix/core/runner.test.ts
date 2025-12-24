/**
 * @module tests/commands/fix/core/runner.test
 * @description Tests for FixerRunner
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  runFixerAnalysis,
  runTrivialFixers,
  runSafeFixers,
  runSpecificFixers,
  getFixerSummary,
} from '../../../../src/commands/fix/core/runner';
import { FixerRegistry } from '../../../../src/commands/fix/core/registry';
import { registry as globalRegistry } from '../../../../src/commands/fix/core/registry';
import { createTestFixer, createTestIssue, CATEGORY, DIFFICULTY } from '../helpers';
import type { QualityIssue } from '../../../../src/commands/fix/core/types';

describe('runner', () => {
  let testRegistry: FixerRegistry;

  beforeEach(() => {
    // Clear global registry for isolation
    globalRegistry.clear();
  });

  afterEach(() => {
    // Restore console methods
    vi.restoreAllMocks();
  });

  describe('runFixerAnalysis()', () => {
    it('runs all fixers and returns combined issues', () => {
      const consoleFixer = createTestFixer('console', {
        analyze: (content: string, file: string) => [
          createTestIssue({ file, line: 1, message: 'console.log found' }),
        ],
      });

      const debuggerFixer = createTestFixer('debugger', {
        analyze: (content: string, file: string) => [
          createTestIssue({ file, line: 2, message: 'debugger found' }),
        ],
      });

      globalRegistry.register(consoleFixer);
      globalRegistry.register(debuggerFixer);

      const content = 'console.log("test");\ndebugger;';
      const result = runFixerAnalysis(content, 'test.ts');

      expect(result.issues).toHaveLength(2);
      expect(result.fixersRun).toEqual(expect.arrayContaining(['console', 'debugger']));
      expect(result.fixersSkipped).toEqual([]);
    });

    it('sets fixerId on all returned issues', () => {
      const fixer = createTestFixer('test-fixer', {
        analyze: (content: string, file: string) => [
          createTestIssue({ file, line: 1, message: 'issue 1' }),
          createTestIssue({ file, line: 2, message: 'issue 2' }),
        ],
      });

      globalRegistry.register(fixer);

      const result = runFixerAnalysis('test', 'test.ts');

      expect(result.issues).toHaveLength(2);
      expect(result.issues.every(i => i.fixerId === 'test-fixer')).toBe(true);
    });

    it('filters issues using shouldSkip', () => {
      const fixer = createTestFixer('console', {
        analyze: (content: string, file: string) => [
          createTestIssue({ file: 'src/code.ts', line: 1, message: 'console' }),
          createTestIssue({ file: 'src/test.spec.ts', line: 1, message: 'console' }),
        ],
        shouldSkip: (issue: QualityIssue) => issue.file.includes('.spec.'),
      });

      globalRegistry.register(fixer);

      const result = runFixerAnalysis('console.log()', 'test.ts');

      // Both issues are returned from analyze, but one should be filtered
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.file).toBe('src/code.ts');
    });

    it('filters by fixerIds option', () => {
      globalRegistry.register(createTestFixer('console', {
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'console' })],
      }));
      globalRegistry.register(createTestFixer('debugger', {
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'debugger' })],
      }));
      globalRegistry.register(createTestFixer('alert', {
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'alert' })],
      }));

      const result = runFixerAnalysis('test', 'test.ts', {
        fixerIds: ['console', 'debugger'],
      });

      expect(result.fixersRun).toEqual(expect.arrayContaining(['console', 'debugger']));
      expect(result.fixersRun).not.toContain('alert');
      expect(result.issues).toHaveLength(2);
    });

    it('filters by category option', () => {
      globalRegistry.register(createTestFixer('console', {
        category: CATEGORY.LINT,
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'lint' })],
      }));
      globalRegistry.register(createTestFixer('any-type', {
        category: CATEGORY.TYPE_SAFETY,
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'type-safety' })],
      }));

      const result = runFixerAnalysis('test', 'test.ts', {
        category: 'lint',
      });

      expect(result.fixersRun).toEqual(['console']);
      expect(result.issues).toHaveLength(1);
    });

    it('filters by difficulty option', () => {
      globalRegistry.register(createTestFixer('console', {
        difficulty: DIFFICULTY.TRIVIAL,
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'trivial' })],
      }));
      globalRegistry.register(createTestFixer('srp', {
        difficulty: DIFFICULTY.RISKY,
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'risky' })],
      }));

      const result = runFixerAnalysis('test', 'test.ts', {
        difficulty: 'trivial',
      });

      expect(result.fixersRun).toEqual(['console']);
      expect(result.issues).toHaveLength(1);
    });

    it('excludes risky fixers by default', () => {
      globalRegistry.register(createTestFixer('console', {
        difficulty: DIFFICULTY.TRIVIAL,
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'trivial' })],
      }));
      globalRegistry.register(createTestFixer('srp', {
        difficulty: DIFFICULTY.RISKY,
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'risky' })],
      }));

      const result = runFixerAnalysis('test', 'test.ts');

      expect(result.fixersRun).toEqual(['console']);
      expect(result.fixersRun).not.toContain('srp');
    });

    it('includes risky fixers when includeRisky is true', () => {
      globalRegistry.register(createTestFixer('srp', {
        difficulty: DIFFICULTY.RISKY,
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'risky' })],
      }));

      const result = runFixerAnalysis('test', 'test.ts', {
        includeRisky: true,
      });

      expect(result.fixersRun).toContain('srp');
    });

    it('uses cliOptions to filter enabled fixers', () => {
      globalRegistry.register(createTestFixer('console', {
        cliFlag: '--fix-console',
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'console' })],
      }));
      globalRegistry.register(createTestFixer('debugger', {
        cliFlag: '--fix-debugger',
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'debugger' })],
      }));

      const result = runFixerAnalysis('test', 'test.ts', {
        cliOptions: { fixConsole: true },
      });

      expect(result.fixersRun).toEqual(['console']);
    });

    it('handles fixer errors gracefully', () => {
      const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const errorFixer = createTestFixer('error-fixer', {
        analyze: () => {
          throw new Error('Analysis failed');
        },
      });

      const goodFixer = createTestFixer('good-fixer', {
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'good' })],
      });

      globalRegistry.register(errorFixer);
      globalRegistry.register(goodFixer);

      const result = runFixerAnalysis('test', 'test.ts');

      expect(result.fixersSkipped).toContain('error-fixer');
      expect(result.fixersRun).toContain('good-fixer');
      expect(result.issues).toHaveLength(1);
      expect(mockWarn).toHaveBeenCalled();

      mockWarn.mockRestore();
    });

    it('returns empty arrays when no fixers registered', () => {
      const result = runFixerAnalysis('test', 'test.ts');

      expect(result.issues).toEqual([]);
      expect(result.fixersRun).toEqual([]);
      expect(result.fixersSkipped).toEqual([]);
    });
  });

  describe('runTrivialFixers()', () => {
    it('runs only trivial difficulty fixers', () => {
      globalRegistry.register(createTestFixer('console', {
        difficulty: DIFFICULTY.TRIVIAL,
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'trivial' })],
      }));
      globalRegistry.register(createTestFixer('any-type', {
        difficulty: DIFFICULTY.SAFE,
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'safe' })],
      }));
      globalRegistry.register(createTestFixer('srp', {
        difficulty: DIFFICULTY.RISKY,
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'risky' })],
      }));

      const result = runTrivialFixers('test', 'test.ts');

      expect(result.fixersRun).toEqual(['console']);
      expect(result.issues).toHaveLength(1);
    });
  });

  describe('runSafeFixers()', () => {
    it('runs trivial and safe difficulty fixers', () => {
      globalRegistry.register(createTestFixer('console', {
        difficulty: DIFFICULTY.TRIVIAL,
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'trivial' })],
      }));
      globalRegistry.register(createTestFixer('any-type', {
        difficulty: DIFFICULTY.SAFE,
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'safe' })],
      }));
      globalRegistry.register(createTestFixer('srp', {
        difficulty: DIFFICULTY.RISKY,
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'risky' })],
      }));

      const result = runSafeFixers('test', 'test.ts');

      expect(result.fixersRun).toEqual(expect.arrayContaining(['console', 'any-type']));
      expect(result.fixersRun).not.toContain('srp');
      expect(result.issues).toHaveLength(2);
    });
  });

  describe('runSpecificFixers()', () => {
    it('runs only specified fixers by id', () => {
      globalRegistry.register(createTestFixer('console', {
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'console' })],
      }));
      globalRegistry.register(createTestFixer('debugger', {
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'debugger' })],
      }));
      globalRegistry.register(createTestFixer('alert', {
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'alert' })],
      }));

      const result = runSpecificFixers('test', 'test.ts', ['console', 'debugger']);

      expect(result.fixersRun).toEqual(expect.arrayContaining(['console', 'debugger']));
      expect(result.fixersRun).not.toContain('alert');
    });

    it('includes risky fixers when explicitly specified', () => {
      globalRegistry.register(createTestFixer('srp', {
        difficulty: DIFFICULTY.RISKY,
        analyze: () => [createTestIssue({ file: 'test.ts', message: 'risky' })],
      }));

      const result = runSpecificFixers('test', 'test.ts', ['srp']);

      expect(result.fixersRun).toContain('srp');
    });
  });

  describe('getFixerSummary()', () => {
    beforeEach(() => {
      globalRegistry.register(createTestFixer('console', { difficulty: DIFFICULTY.TRIVIAL }));
      globalRegistry.register(createTestFixer('debugger', { difficulty: DIFFICULTY.TRIVIAL }));
      globalRegistry.register(createTestFixer('any-type', { difficulty: DIFFICULTY.SAFE }));
      globalRegistry.register(createTestFixer('srp', { difficulty: DIFFICULTY.RISKY }));
    });

    it('returns all non-risky fixers by default', () => {
      const summary = getFixerSummary();

      expect(summary.willRun).toEqual(expect.arrayContaining(['console', 'debugger', 'any-type']));
      expect(summary.willSkip).toEqual(['srp']);
    });

    it('includes risky fixers when includeRisky is true', () => {
      const summary = getFixerSummary({ includeRisky: true });

      expect(summary.willRun).toEqual(expect.arrayContaining(['console', 'debugger', 'any-type', 'srp']));
      expect(summary.willSkip).toEqual([]);
    });

    it('filters by fixerIds', () => {
      const summary = getFixerSummary({
        fixerIds: ['console', 'debugger'],
        includeRisky: false,
      });

      expect(summary.willRun).toEqual(expect.arrayContaining(['console', 'debugger']));
      expect(summary.willRun).not.toContain('any-type');
    });

    it('shows risky fixers in willSkip when not included', () => {
      const summary = getFixerSummary({
        fixerIds: ['srp', 'console'],
        includeRisky: false,
      });

      expect(summary.willRun).toEqual(['console']);
      expect(summary.willSkip).toEqual(['srp']);
    });

    it('uses cliOptions to determine enabled fixers', () => {
      globalRegistry.clear();
      globalRegistry.register(createTestFixer('console', {
        cliFlag: '--fix-console',
        difficulty: DIFFICULTY.TRIVIAL,
      }));
      globalRegistry.register(createTestFixer('debugger', {
        cliFlag: '--fix-debugger',
        difficulty: DIFFICULTY.TRIVIAL,
      }));

      const summary = getFixerSummary({
        cliOptions: { fixConsole: true },
      });

      expect(summary.willRun).toEqual(['console']);
    });
  });
});
