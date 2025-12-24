/**
 * @module tests/commands/fix/analyze-security
 * @description Security tests for analyzeQuality path validation
 */

import { describe, expect, it } from 'vitest';
import { analyzeQuality } from '../../../src/commands/fix/analyze';

describe('analyzeQuality - Security', () => {
  const projectRoot = '/tmp/test-project';

  describe('path traversal prevention', () => {
    it('rejects path traversal with ..', async () => {
      await expect(analyzeQuality(projectRoot, { path: '../etc/passwd' })).rejects.toThrow(
        'escapes project root',
      );
    });

    it('rejects path traversal from subdirectory', async () => {
      await expect(analyzeQuality(projectRoot, { path: 'src/../../etc/passwd' })).rejects.toThrow(
        'escapes project root',
      );
    });

    it('rejects absolute path outside project', async () => {
      await expect(analyzeQuality(projectRoot, { path: '/etc/passwd' })).rejects.toThrow(
        'escapes project root',
      );
    });

    it('rejects complex path traversal', async () => {
      await expect(
        analyzeQuality(projectRoot, {
          path: 'src/../../../../../../../etc/passwd',
        }),
      ).rejects.toThrow('escapes project root');
    });
  });

  describe('valid paths', () => {
    it('accepts relative path within project', async () => {
      // This will fail because the path doesn't exist, but it should pass validation
      await expect(analyzeQuality(projectRoot, { path: 'src/index.ts' })).resolves.toBeDefined();
    });

    it('accepts nested relative path', async () => {
      await expect(analyzeQuality(projectRoot, { path: 'src/lib/utils' })).resolves.toBeDefined();
    });

    it('accepts current directory', async () => {
      await expect(analyzeQuality(projectRoot, { path: '.' })).resolves.toBeDefined();
    });
  });
});
