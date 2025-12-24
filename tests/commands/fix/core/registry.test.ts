/**
 * @module tests/commands/fix/core/registry.test
 * @description Tests for FixerRegistry
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FixerRegistry } from '../../../../src/commands/fix/core/registry';
import { CATEGORY, createTestFixer, DIFFICULTY } from '../helpers';

describe('FixerRegistry', () => {
  let registry: FixerRegistry;

  beforeEach(() => {
    registry = new FixerRegistry();
  });

  describe('register()', () => {
    it('adds fixer to registry', () => {
      const fixer = createTestFixer('test-fixer');
      registry.register(fixer);

      expect(registry.has('test-fixer')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('overwrites existing fixer with same id', () => {
      const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const fixer1 = createTestFixer('test', { name: 'First' });
      const fixer2 = createTestFixer('test', { name: 'Second' });

      registry.register(fixer1);
      registry.register(fixer2);

      expect(registry.size).toBe(1);
      expect(registry.get('test')?.metadata.name).toBe('Second');
      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining("Fixer 'test' is already registered"),
      );

      mockWarn.mockRestore();
    });

    it('registers multiple fixers', () => {
      const fixer1 = createTestFixer('fixer1');
      const fixer2 = createTestFixer('fixer2');
      const fixer3 = createTestFixer('fixer3');

      registry.registerAll([fixer1, fixer2, fixer3]);

      expect(registry.size).toBe(3);
      expect(registry.has('fixer1')).toBe(true);
      expect(registry.has('fixer2')).toBe(true);
      expect(registry.has('fixer3')).toBe(true);
    });
  });

  describe('get()', () => {
    it('retrieves fixer by id', () => {
      const fixer = createTestFixer('console', { name: 'Console Fixer' });
      registry.register(fixer);

      const retrieved = registry.get('console');
      expect(retrieved).toBe(fixer);
      expect(retrieved?.metadata.name).toBe('Console Fixer');
    });

    it('returns undefined for non-existent fixer', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });
  });

  describe('has()', () => {
    it('returns true for registered fixer', () => {
      const fixer = createTestFixer('debugger');
      registry.register(fixer);

      expect(registry.has('debugger')).toBe(true);
    });

    it('returns false for unregistered fixer', () => {
      expect(registry.has('unregistered')).toBe(false);
    });
  });

  describe('all()', () => {
    it('returns empty array when no fixers registered', () => {
      expect(registry.all()).toEqual([]);
    });

    it('returns all registered fixers', () => {
      const fixer1 = createTestFixer('fixer1');
      const fixer2 = createTestFixer('fixer2');

      registry.register(fixer1);
      registry.register(fixer2);

      const all = registry.all();
      expect(all).toHaveLength(2);
      expect(all).toContain(fixer1);
      expect(all).toContain(fixer2);
    });
  });

  describe('ids()', () => {
    it('returns all fixer ids', () => {
      registry.register(createTestFixer('console'));
      registry.register(createTestFixer('debugger'));
      registry.register(createTestFixer('alert'));

      const ids = registry.ids();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('console');
      expect(ids).toContain('debugger');
      expect(ids).toContain('alert');
    });
  });

  describe('byCategory()', () => {
    beforeEach(() => {
      registry.register(createTestFixer('console', { category: CATEGORY.LINT }));
      registry.register(createTestFixer('debugger', { category: CATEGORY.LINT }));
      registry.register(createTestFixer('any-type', { category: CATEGORY.TYPE_SAFETY }));
      registry.register(createTestFixer('complexity', { category: CATEGORY.COMPLEXITY }));
    });

    it('filters fixers by category', () => {
      const lintFixers = registry.byCategory('lint');
      expect(lintFixers).toHaveLength(2);
      expect(lintFixers.map((f) => f.metadata.id)).toEqual(
        expect.arrayContaining(['console', 'debugger']),
      );
    });

    it('returns empty array for category with no fixers', () => {
      const srpFixers = registry.byCategory('srp');
      expect(srpFixers).toEqual([]);
    });
  });

  describe('byDifficulty()', () => {
    beforeEach(() => {
      registry.register(createTestFixer('console', { difficulty: DIFFICULTY.TRIVIAL }));
      registry.register(createTestFixer('debugger', { difficulty: DIFFICULTY.TRIVIAL }));
      registry.register(createTestFixer('any-type', { difficulty: DIFFICULTY.SAFE }));
      registry.register(createTestFixer('srp', { difficulty: DIFFICULTY.RISKY }));
    });

    it('filters fixers by difficulty level', () => {
      const trivialFixers = registry.byDifficulty('trivial');
      expect(trivialFixers).toHaveLength(2);
      expect(trivialFixers.map((f) => f.metadata.id)).toEqual(
        expect.arrayContaining(['console', 'debugger']),
      );
    });

    it('returns empty array for difficulty with no fixers', () => {
      // Clear and add only safe fixers
      registry.clear();
      registry.register(createTestFixer('test', { difficulty: DIFFICULTY.SAFE }));

      const riskyFixers = registry.byDifficulty('risky');
      expect(riskyFixers).toEqual([]);
    });
  });

  describe('byTag()', () => {
    beforeEach(() => {
      registry.register(createTestFixer('console', { tags: ['trivial', 'safe-to-autofix'] }));
      registry.register(createTestFixer('debugger', { tags: ['trivial', 'debugging'] }));
      registry.register(createTestFixer('any-type', { tags: ['safe-to-autofix'] }));
    });

    it('filters fixers by tag', () => {
      const trivialFixers = registry.byTag('trivial');
      expect(trivialFixers).toHaveLength(2);
      expect(trivialFixers.map((f) => f.metadata.id)).toEqual(
        expect.arrayContaining(['console', 'debugger']),
      );
    });

    it('returns fixers matching any tag', () => {
      const safeFixers = registry.byTag('safe-to-autofix');
      expect(safeFixers).toHaveLength(2);
      expect(safeFixers.map((f) => f.metadata.id)).toEqual(
        expect.arrayContaining(['console', 'any-type']),
      );
    });

    it('returns empty array for tag with no matches', () => {
      const result = registry.byTag('non-existent-tag');
      expect(result).toEqual([]);
    });
  });

  describe('trivial()', () => {
    it('returns all trivial difficulty fixers', () => {
      registry.register(createTestFixer('console', { difficulty: DIFFICULTY.TRIVIAL }));
      registry.register(createTestFixer('debugger', { difficulty: DIFFICULTY.TRIVIAL }));
      registry.register(createTestFixer('any-type', { difficulty: DIFFICULTY.SAFE }));

      const trivial = registry.trivial();
      expect(trivial).toHaveLength(2);
      expect(trivial.every((f) => f.metadata.difficulty === 'trivial')).toBe(true);
    });
  });

  describe('filter()', () => {
    beforeEach(() => {
      registry.register(
        createTestFixer('console', {
          category: CATEGORY.LINT,
          difficulty: DIFFICULTY.TRIVIAL,
          tags: ['trivial'],
        }),
      );
      registry.register(
        createTestFixer('debugger', {
          category: CATEGORY.LINT,
          difficulty: DIFFICULTY.TRIVIAL,
          tags: ['trivial'],
        }),
      );
      registry.register(
        createTestFixer('any-type', {
          category: CATEGORY.TYPE_SAFETY,
          difficulty: DIFFICULTY.SAFE,
          tags: ['safe'],
        }),
      );
      registry.register(
        createTestFixer('srp', {
          category: CATEGORY.SRP,
          difficulty: DIFFICULTY.RISKY,
          tags: ['risky'],
        }),
      );
    });

    it('filters by ids', () => {
      const result = registry.filter({ ids: ['console', 'debugger'] });
      expect(result).toHaveLength(2);
      expect(result.map((f) => f.metadata.id)).toEqual(
        expect.arrayContaining(['console', 'debugger']),
      );
    });

    it('filters by category', () => {
      const result = registry.filter({ category: 'lint' });
      expect(result).toHaveLength(2);
      expect(result.every((f) => f.metadata.category === 'lint')).toBe(true);
    });

    it('filters by difficulty', () => {
      const result = registry.filter({ difficulty: 'trivial' });
      expect(result).toHaveLength(2);
      expect(result.every((f) => f.metadata.difficulty === 'trivial')).toBe(true);
    });

    it('filters by tags', () => {
      const result = registry.filter({ tags: ['trivial'] });
      expect(result).toHaveLength(2);
      expect(result.every((f) => f.metadata.tags?.includes('trivial'))).toBe(true);
    });

    it('combines multiple filters', () => {
      const result = registry.filter({
        category: 'lint',
        difficulty: 'trivial',
        tags: ['trivial'],
      });
      expect(result).toHaveLength(2);
      expect(result.map((f) => f.metadata.id)).toEqual(
        expect.arrayContaining(['console', 'debugger']),
      );
    });

    it('returns all fixers when filter is empty', () => {
      const result = registry.filter({});
      expect(result).toHaveLength(4);
    });
  });

  describe('getEnabled()', () => {
    beforeEach(() => {
      registry.register(
        createTestFixer('console', { cliFlag: '--fix-console', negateFlag: '--no-console' }),
      );
      registry.register(
        createTestFixer('debugger', { cliFlag: '--fix-debugger', negateFlag: '--no-debugger' }),
      );
      registry.register(createTestFixer('alert', { cliFlag: '--fix-alert' }));
    });

    it('returns all fixers when no options set', () => {
      const enabled = registry.getEnabled({});
      expect(enabled).toHaveLength(3);
    });

    it('returns only explicitly enabled fixers', () => {
      const enabled = registry.getEnabled({ fixConsole: true });
      expect(enabled).toHaveLength(1);
      expect(enabled[0]?.metadata.id).toBe('console');
    });

    it('excludes explicitly disabled fixers', () => {
      // flagToOptionKey converts --no-console to 'console'
      // So we check options['console'] === true when negateFlag is used
      const enabled = registry.getEnabled({ console: true }); // --no-console becomes 'console: true'
      expect(enabled).toHaveLength(2);
      expect(enabled.map((f) => f.metadata.id)).not.toContain('console');
    });

    it('handles multiple enable flags', () => {
      const enabled = registry.getEnabled({
        fixConsole: true,
        fixDebugger: true,
      });
      expect(enabled).toHaveLength(2);
      expect(enabled.map((f) => f.metadata.id)).toEqual(
        expect.arrayContaining(['console', 'debugger']),
      );
    });

    it('disable flag overrides enable flag', () => {
      // When both flags are passed:
      // --fix-console sets fixConsole: true
      // --no-console sets console: true (negateFlag processed by flagToOptionKey)
      const enabled = registry.getEnabled({
        fixConsole: true,
        console: true, // --no-console becomes console: true after flagToOptionKey
      });
      expect(enabled.map((f) => f.metadata.id)).not.toContain('console');
    });

    it('handles kebab-case to camelCase conversion', () => {
      // flagToOptionKey converts --fix-console to fixConsole
      const enabled = registry.getEnabled({ fixConsole: true });
      expect(enabled).toHaveLength(1);
      expect(enabled[0]?.metadata.id).toBe('console');
    });
  });

  describe('getCLIOptions()', () => {
    it('generates CLI options from fixer metadata', () => {
      registry.register(
        createTestFixer('console', {
          cliFlag: '--fix-console',
          negateFlag: '--no-console',
        }),
      );
      registry.register(
        createTestFixer('debugger', {
          cliFlag: '--fix-debugger',
        }),
      );

      const options = registry.getCLIOptions();
      expect(options).toHaveLength(2);

      const consoleOption = options.find((o) => o.fixerId === 'console');
      expect(consoleOption).toMatchObject({
        flag: '--fix-console',
        negateFlag: '--no-console',
        fixerId: 'console',
      });

      const debuggerOption = options.find((o) => o.fixerId === 'debugger');
      expect(debuggerOption).toMatchObject({
        flag: '--fix-debugger',
        fixerId: 'debugger',
      });
    });
  });

  describe('getMetadata()', () => {
    it('returns metadata for all fixers', () => {
      registry.register(createTestFixer('fixer1', { name: 'Fixer One' }));
      registry.register(createTestFixer('fixer2', { name: 'Fixer Two' }));

      const metadata = registry.getMetadata();
      expect(metadata).toHaveLength(2);
      expect(metadata[0]).toHaveProperty('id');
      expect(metadata[0]).toHaveProperty('name');
      expect(metadata[0]).toHaveProperty('description');
    });
  });

  describe('clear()', () => {
    it('removes all fixers from registry', () => {
      registry.register(createTestFixer('fixer1'));
      registry.register(createTestFixer('fixer2'));

      expect(registry.size).toBe(2);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.all()).toEqual([]);
    });
  });

  describe('size', () => {
    it('returns count of registered fixers', () => {
      expect(registry.size).toBe(0);

      registry.register(createTestFixer('fixer1'));
      expect(registry.size).toBe(1);

      registry.register(createTestFixer('fixer2'));
      expect(registry.size).toBe(2);

      registry.clear();
      expect(registry.size).toBe(0);
    });
  });
});
