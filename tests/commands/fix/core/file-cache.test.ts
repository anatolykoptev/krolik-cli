/**
 * @module commands/fix/core/__tests__/file-cache
 * @description Tests for FileCache class
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileCache, formatCacheStats } from '../../../../src/commands/fix/core/file-cache';

describe('FileCache', () => {
  let cache: FileCache;
  let tempDir: string;
  let testFile: string;

  beforeEach(() => {
    cache = new FileCache();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-cache-test-'));
    testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'test content');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('get', () => {
    it('reads file from disk on first access (miss)', () => {
      const content = cache.get(testFile);
      expect(content).toBe('test content');

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(1);
    });

    it('returns cached content on second access (hit)', () => {
      cache.get(testFile);
      const content = cache.get(testFile);
      expect(content).toBe('test content');

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('normalizes paths to absolute', () => {
      const relativePath = path.relative(process.cwd(), testFile);
      process.chdir(path.dirname(testFile));

      cache.get(path.basename(testFile));
      const content = cache.get(path.basename(testFile));

      expect(content).toBe('test content');
      expect(cache.getStats().hits).toBe(1);
    });
  });

  describe('set', () => {
    it('updates cached content', () => {
      cache.get(testFile);
      cache.set(testFile, 'updated content');

      const content = cache.get(testFile);
      expect(content).toBe('updated content');

      const stats = cache.getStats();
      expect(stats.hits).toBe(1); // Second get is a hit
    });
  });

  describe('has', () => {
    it('returns false for uncached file', () => {
      expect(cache.has(testFile)).toBe(false);
    });

    it('returns true for cached file', () => {
      cache.get(testFile);
      expect(cache.has(testFile)).toBe(true);
    });
  });

  describe('invalidate', () => {
    it('removes file from cache', () => {
      cache.get(testFile);
      cache.invalidate(testFile);

      expect(cache.has(testFile)).toBe(false);
      cache.get(testFile); // Should be a miss

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });
  });

  describe('clear', () => {
    it('removes all files from cache and resets stats', () => {
      cache.get(testFile);
      cache.clear();

      expect(cache.has(testFile)).toBe(false);
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });
  });

  describe('warmup', () => {
    it('pre-loads multiple files', () => {
      const file2 = path.join(tempDir, 'test2.txt');
      const file3 = path.join(tempDir, 'test3.txt');
      fs.writeFileSync(file2, 'content 2');
      fs.writeFileSync(file3, 'content 3');

      cache.warmup([testFile, file2, file3]);

      const stats = cache.getStats();
      expect(stats.size).toBe(3);
      expect(stats.misses).toBe(3);
      expect(stats.hits).toBe(0);

      // Next access should be a hit
      cache.get(testFile);
      expect(cache.getStats().hits).toBe(1);
    });

    it('skips files that cannot be read', () => {
      cache.warmup([testFile, '/nonexistent/file.txt']);

      const stats = cache.getStats();
      expect(stats.size).toBe(1); // Only testFile cached
    });
  });

  describe('getStats', () => {
    it('calculates memory usage', () => {
      cache.get(testFile);
      const stats = cache.getStats();

      expect(stats.memoryBytes).toBeGreaterThan(0);
      // UTF-16 encoding: ~2 bytes per character
      expect(stats.memoryBytes).toBeGreaterThanOrEqual('test content'.length * 2);
    });

    it('returns accurate hit/miss counts', () => {
      cache.get(testFile); // miss
      cache.get(testFile); // hit
      cache.get(testFile); // hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });
  });
});

describe('formatCacheStats', () => {
  it('formats stats for display', () => {
    const stats = {
      hits: 10,
      misses: 5,
      size: 3,
      memoryBytes: 1024 * 1024, // 1 MB
    };

    const formatted = formatCacheStats(stats);

    expect(formatted).toContain('Files cached: 3');
    expect(formatted).toContain('Cache hits: 10');
    expect(formatted).toContain('Cache misses: 5');
    expect(formatted).toContain('Hit rate: 66.7%');
    expect(formatted).toContain('Memory usage: 1.00 MB');
  });

  it('handles zero hits/misses', () => {
    const stats = {
      hits: 0,
      misses: 0,
      size: 0,
      memoryBytes: 0,
    };

    const formatted = formatCacheStats(stats);
    expect(formatted).toContain('Hit rate: 0.0%');
  });
});
