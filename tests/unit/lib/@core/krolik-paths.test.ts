/**
 * @module tests/lib/@core/krolik-paths.test
 * @description Comprehensive tests for krolik-paths module
 */

import * as fs from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fsUtils from '../../../../src/lib/@core/fs';
import {
  clearKrolikPathCache,
  ensureKrolikDir,
  getKrolikDir,
  getKrolikFilePath,
  getProjectKrolikDir,
  getUserKrolikDir,
  resolveProjectRoot,
  saveToKrolik,
} from '../../../../src/lib/@core/krolik-paths';
import * as logger from '../../../../src/lib/@core/logger';

// Mock dependencies
vi.mock('../../../../src/lib/@discovery/project');
vi.mock('../../../../src/lib/@core/fs');
vi.mock('../../../../src/lib/@core/logger');

describe('krolik-paths', () => {
  const mockProjectRoot = '/mock/project';
  const mockStartDir = '/mock/project/subdir';

  beforeEach(() => {
    vi.clearAllMocks();
    clearKrolikPathCache();
  });

  afterEach(() => {
    clearKrolikPathCache();
  });

  describe('resolveProjectRoot()', () => {
    describe('with explicit projectRoot', () => {
      it('returns resolved path when valid', async () => {
        const { findProjectRoot } = await import('../../../../src/lib/@discovery/project');
        vi.mocked(fsUtils.exists).mockReturnValue(true);
        vi.mocked(fsUtils.isDirectory).mockReturnValue(true);

        const result = resolveProjectRoot({ projectRoot: mockProjectRoot });

        expect(result).toBe(mockProjectRoot);
        expect(findProjectRoot).not.toHaveBeenCalled();
      });

      it('validates directory exists', () => {
        vi.mocked(fsUtils.exists).mockReturnValue(false);

        expect(() => resolveProjectRoot({ projectRoot: mockProjectRoot })).toThrow(
          /not a directory or missing package\.json/,
        );
      });

      it('validates path is directory', () => {
        vi.mocked(fsUtils.exists).mockImplementation((p) => {
          // Path exists but is not a directory
          return p === mockProjectRoot;
        });
        vi.mocked(fsUtils.isDirectory).mockReturnValue(false);

        expect(() => resolveProjectRoot({ projectRoot: mockProjectRoot })).toThrow(
          /not a directory or missing package\.json/,
        );
      });

      it('validates package.json or .git exists', () => {
        vi.mocked(fsUtils.exists).mockImplementation((p) => {
          // Directory exists but no package.json or .git
          return p === mockProjectRoot;
        });
        vi.mocked(fsUtils.isDirectory).mockReturnValue(true);

        expect(() => resolveProjectRoot({ projectRoot: mockProjectRoot })).toThrow(
          /not a directory or missing package\.json/,
        );
      });

      it('accepts path with package.json', () => {
        vi.mocked(fsUtils.exists).mockImplementation((p) => {
          return p === mockProjectRoot || p === path.join(mockProjectRoot, 'package.json');
        });
        vi.mocked(fsUtils.isDirectory).mockReturnValue(true);

        const result = resolveProjectRoot({ projectRoot: mockProjectRoot });

        expect(result).toBe(mockProjectRoot);
      });

      it('accepts path with .git', () => {
        vi.mocked(fsUtils.exists).mockImplementation((p) => {
          return p === mockProjectRoot || p === path.join(mockProjectRoot, '.git');
        });
        vi.mocked(fsUtils.isDirectory).mockReturnValue(true);

        const result = resolveProjectRoot({ projectRoot: mockProjectRoot });

        expect(result).toBe(mockProjectRoot);
      });

      it('skips validation when validate=false', () => {
        vi.mocked(fsUtils.exists).mockReturnValue(false);

        const result = resolveProjectRoot({ projectRoot: mockProjectRoot, validate: false });

        expect(result).toBe(mockProjectRoot);
      });
    });

    describe('auto-detection', () => {
      it('delegates to findProjectRoot', async () => {
        const { findProjectRoot } = await import('../../../../src/lib/@discovery/project');
        vi.mocked(findProjectRoot).mockReturnValue(mockProjectRoot);
        vi.mocked(fsUtils.exists).mockReturnValue(true);
        vi.mocked(fsUtils.isDirectory).mockReturnValue(true);

        const result = resolveProjectRoot({ startDir: mockStartDir });

        expect(findProjectRoot).toHaveBeenCalledWith(mockStartDir);
        expect(result).toBe(mockProjectRoot);
      });

      it('uses process.cwd() as default startDir', async () => {
        const { findProjectRoot } = await import('../../../../src/lib/@discovery/project');
        const mockCwd = '/current/working/dir';
        vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
        vi.mocked(findProjectRoot).mockReturnValue(mockProjectRoot);
        vi.mocked(fsUtils.exists).mockReturnValue(true);
        vi.mocked(fsUtils.isDirectory).mockReturnValue(true);

        resolveProjectRoot();

        expect(findProjectRoot).toHaveBeenCalledWith(undefined);
      });

      it('validates fallback result', async () => {
        const { findProjectRoot } = await import('../../../../src/lib/@discovery/project');
        vi.spyOn(process, 'cwd').mockReturnValue(mockStartDir);
        vi.mocked(findProjectRoot).mockReturnValue(mockStartDir); // Fallback
        vi.mocked(fsUtils.exists).mockImplementation((p) => p === mockStartDir);
        vi.mocked(fsUtils.isDirectory).mockReturnValue(true);

        expect(() => resolveProjectRoot({ startDir: mockStartDir })).toThrow(
          /No package\.json or \.git found/,
        );
      });

      it('skips validation if findProjectRoot found actual root', async () => {
        const { findProjectRoot } = await import('../../../../src/lib/@discovery/project');
        const foundRoot = '/found/root';
        vi.spyOn(process, 'cwd').mockReturnValue(mockStartDir);
        vi.mocked(findProjectRoot).mockReturnValue(foundRoot); // Different from startDir
        vi.mocked(fsUtils.exists).mockReturnValue(false); // No package.json

        // Should NOT throw because findProjectRoot returned different path
        const result = resolveProjectRoot({ startDir: mockStartDir });

        expect(result).toBe(foundRoot);
      });
    });
  });

  describe('getProjectKrolikDir()', () => {
    it('returns {projectRoot}/.krolik', async () => {
      const { findProjectRoot } = await import('../../../../src/lib/@discovery/project');
      vi.mocked(findProjectRoot).mockReturnValue(mockProjectRoot);
      vi.mocked(fsUtils.exists).mockReturnValue(true);
      vi.mocked(fsUtils.isDirectory).mockReturnValue(true);

      const result = getProjectKrolikDir({ startDir: mockStartDir });

      expect(result).toBe(path.join(mockProjectRoot, '.krolik'));
    });

    it('passes options to resolveProjectRoot', () => {
      vi.mocked(fsUtils.exists).mockReturnValue(true);
      vi.mocked(fsUtils.isDirectory).mockReturnValue(true);

      const result = getProjectKrolikDir({ projectRoot: mockProjectRoot });

      expect(result).toBe(path.join(mockProjectRoot, '.krolik'));
    });
  });

  describe('getUserKrolikDir()', () => {
    it('returns ~/.krolik', () => {
      const result = getUserKrolikDir();

      expect(result).toBe(path.join(homedir(), '.krolik'));
    });

    it('caches result', () => {
      const result1 = getUserKrolikDir();
      const result2 = getUserKrolikDir();

      expect(result1).toBe(result2);
      expect(result1).toBe(path.join(homedir(), '.krolik'));
    });

    it('clears cache with clearKrolikPathCache', () => {
      const result1 = getUserKrolikDir();
      clearKrolikPathCache();
      const result2 = getUserKrolikDir();

      expect(result1).toBe(result2);
      expect(result2).toBe(path.join(homedir(), '.krolik'));
    });
  });

  describe('getKrolikDir()', () => {
    beforeEach(() => {
      vi.mocked(fsUtils.exists).mockReturnValue(true);
      vi.mocked(fsUtils.isDirectory).mockReturnValue(true);
    });

    it('returns project dir for scope=project', async () => {
      const { findProjectRoot } = await import('../../../../src/lib/@discovery/project');
      vi.mocked(findProjectRoot).mockReturnValue(mockProjectRoot);

      const result = getKrolikDir('project', { startDir: mockStartDir });

      expect(result).toBe(path.join(mockProjectRoot, '.krolik'));
    });

    it('returns user dir for scope=user', () => {
      const result = getKrolikDir('user');

      expect(result).toBe(path.join(homedir(), '.krolik'));
    });
  });

  describe('ensureKrolikDir()', () => {
    beforeEach(() => {
      vi.mocked(fsUtils.exists).mockReturnValue(true);
      vi.mocked(fsUtils.isDirectory).mockReturnValue(true);
    });

    it('creates directory if missing', async () => {
      const { findProjectRoot } = await import('../../../../src/lib/@discovery/project');
      vi.mocked(findProjectRoot).mockReturnValue(mockProjectRoot);
      vi.mocked(fsUtils.ensureDir).mockReturnValue(true);

      const result = ensureKrolikDir('project', { startDir: mockStartDir });

      expect(fsUtils.ensureDir).toHaveBeenCalledWith(path.join(mockProjectRoot, '.krolik'));
      expect(result).toBe(path.join(mockProjectRoot, '.krolik'));
    });

    it('throws if directory creation fails', async () => {
      const { findProjectRoot } = await import('../../../../src/lib/@discovery/project');
      vi.mocked(findProjectRoot).mockReturnValue(mockProjectRoot);
      vi.mocked(fsUtils.ensureDir).mockReturnValue(false);

      expect(() => ensureKrolikDir('project', { startDir: mockStartDir })).toThrow(
        /Failed to create \.krolik directory/,
      );
    });

    it('works with user scope', () => {
      vi.mocked(fsUtils.ensureDir).mockReturnValue(true);

      const result = ensureKrolikDir('user');

      expect(fsUtils.ensureDir).toHaveBeenCalledWith(path.join(homedir(), '.krolik'));
      expect(result).toBe(path.join(homedir(), '.krolik'));
    });
  });

  describe('saveToKrolik()', () => {
    const testFilename = 'CONTEXT.xml';
    const testContent = '<context>test</context>';

    beforeEach(() => {
      vi.mocked(fsUtils.exists).mockReturnValue(true);
      vi.mocked(fsUtils.isDirectory).mockReturnValue(true);
      vi.mocked(fsUtils.ensureDir).mockReturnValue(true);
    });

    it('saves file to project .krolik by default', async () => {
      const { findProjectRoot } = await import('../../../../src/lib/@discovery/project');
      vi.mocked(findProjectRoot).mockReturnValue(mockProjectRoot);
      vi.mocked(fsUtils.writeFile).mockReturnValue(true);

      const result = saveToKrolik(testFilename, testContent);

      expect(fsUtils.ensureDir).toHaveBeenCalledWith(path.join(mockProjectRoot, '.krolik'));
      expect(fsUtils.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectRoot, '.krolik', testFilename),
        testContent,
      );
      expect(result).toBe(true);
    });

    it('saves to user .krolik with scope=user', () => {
      vi.mocked(fsUtils.writeFile).mockReturnValue(true);

      const result = saveToKrolik(testFilename, testContent, { scope: 'user' });

      expect(fsUtils.writeFile).toHaveBeenCalledWith(
        path.join(homedir(), '.krolik', testFilename),
        testContent,
      );
      expect(result).toBe(true);
    });

    it('accepts explicit projectRoot', () => {
      vi.mocked(fsUtils.writeFile).mockReturnValue(true);

      const result = saveToKrolik(testFilename, testContent, { projectRoot: mockProjectRoot });

      expect(fsUtils.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectRoot, '.krolik', testFilename),
        testContent,
      );
      expect(result).toBe(true);
    });

    it('returns false on error', async () => {
      const { findProjectRoot } = await import('../../../../src/lib/@discovery/project');
      vi.mocked(findProjectRoot).mockReturnValue(mockProjectRoot);
      vi.mocked(fsUtils.ensureDir).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = saveToKrolik(testFilename, testContent);

      expect(result).toBe(false);
      expect(logger.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied'),
      );
    });

    it('logs error but does not throw', () => {
      vi.mocked(fsUtils.ensureDir).mockImplementation(() => {
        throw new Error('Test error');
      });

      expect(() => saveToKrolik(testFilename, testContent)).not.toThrow();
    });
  });

  describe('getKrolikFilePath()', () => {
    beforeEach(() => {
      vi.mocked(fsUtils.exists).mockReturnValue(true);
      vi.mocked(fsUtils.isDirectory).mockReturnValue(true);
    });

    it('returns path without creating directory', async () => {
      const { findProjectRoot } = await import('../../../../src/lib/@discovery/project');
      vi.mocked(findProjectRoot).mockReturnValue(mockProjectRoot);

      const result = getKrolikFilePath('test.xml');

      expect(fsUtils.ensureDir).not.toHaveBeenCalled();
      expect(result).toBe(path.join(mockProjectRoot, '.krolik', 'test.xml'));
    });

    it('works with user scope', () => {
      const result = getKrolikFilePath('memories.db', 'user');

      expect(result).toBe(path.join(homedir(), '.krolik', 'memories.db'));
    });

    it('accepts options for project scope', () => {
      const result = getKrolikFilePath('test.xml', 'project', { projectRoot: mockProjectRoot });

      expect(result).toBe(path.join(mockProjectRoot, '.krolik', 'test.xml'));
    });
  });

  describe('clearKrolikPathCache()', () => {
    it('clears user directory cache', () => {
      const dir1 = getUserKrolikDir();
      clearKrolikPathCache();
      const dir2 = getUserKrolikDir();

      // Should still return same value (homedir doesn't change)
      expect(dir1).toBe(dir2);
    });
  });

  describe('Edge Cases', () => {
    it('handles symlinks in project root', () => {
      const symlinkPath = '/link/to/project';
      const realPath = '/real/project';

      vi.mocked(fsUtils.exists).mockImplementation((p) => {
        return p === symlinkPath || p === path.join(symlinkPath, 'package.json');
      });
      vi.mocked(fsUtils.isDirectory).mockReturnValue(true);

      // Should work with symlinked path
      const result = resolveProjectRoot({ projectRoot: symlinkPath });

      expect(result).toBe(symlinkPath);
    });

    it('validates file path not accepted as project root', () => {
      const filePath = '/path/to/package.json';

      vi.mocked(fsUtils.exists).mockReturnValue(true);
      vi.mocked(fsUtils.isDirectory).mockReturnValue(false); // It's a file

      expect(() => resolveProjectRoot({ projectRoot: filePath })).toThrow(/not a directory/);
    });
  });
});
