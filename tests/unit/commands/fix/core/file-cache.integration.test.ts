/**
 * @module commands/fix/core/__tests__/file-cache.integration
 * @description Integration tests demonstrating cache performance benefits
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fileCache } from '../../../../../src/lib/@cache/file-cache';

describe('FileCache Integration', () => {
  let tempDir: string;
  let testFiles: string[];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-integration-'));
    testFiles = [];

    // Create 10 test files with sample TypeScript code
    for (let i = 0; i < 10; i++) {
      const file = path.join(tempDir, `file${i}.ts`);
      const content = `
// File ${i}
export function test${i}() {
  console.log('test ${i}');
  const value = ${i * 42};
  return value;
}
      `.trim();
      fs.writeFileSync(file, content);
      testFiles.push(file);
    }

    fileCache.clear();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fileCache.clear();
  });

  it('reduces I/O by caching file reads', () => {
    // Simulate the fix command workflow:
    // 1. Analysis phase reads all files
    // 2. Plan generation re-reads files for context
    // 3. Apply phase reads files again
    // 4. Validation re-reads files

    // Phase 1: Initial analysis
    const analysisReads = testFiles.map((f) => fileCache.get(f));
    expect(analysisReads).toHaveLength(10);

    // Phase 2: Plan generation (re-read for context)
    const planReads = testFiles.map((f) => fileCache.get(f));
    expect(planReads).toHaveLength(10);

    // Phase 3: Apply fixes (read again)
    const applyReads = testFiles.map((f) => fileCache.get(f));
    expect(applyReads).toHaveLength(10);

    // Phase 4: Validation (read again)
    const validateReads = testFiles.map((f) => fileCache.get(f));
    expect(validateReads).toHaveLength(10);

    // Check statistics
    const stats = fileCache.getStats();

    // Without cache: 40 reads (10 files × 4 phases)
    // With cache: 10 misses (first phase) + 30 hits (remaining phases)
    expect(stats.misses).toBe(10); // Only first read per file
    expect(stats.hits).toBe(30); // All subsequent reads are cached
    expect(stats.size).toBe(10); // 10 unique files cached

    // Hit rate should be 75% (30 hits out of 40 total accesses)
    const hitRate = (stats.hits / (stats.hits + stats.misses)) * 100;
    expect(hitRate).toBe(75);
  });

  it('maintains cache consistency across updates', () => {
    const file = testFiles[0];

    // Read original content
    const original = fileCache.get(file);
    expect(original).toContain('File 0');

    // Simulate fix application: update cache
    const modified = original.replace('console.log', '// console.log');
    fileCache.set(file, modified);

    // Subsequent reads should get modified content from cache
    const cached = fileCache.get(file);
    expect(cached).toBe(modified);
    expect(cached).toContain('// console.log');

    // Verify it was a cache hit
    const stats = fileCache.getStats();
    expect(stats.hits).toBe(1);
  });

  it('warmup improves performance for known file sets', () => {
    // Pre-warm cache with all files
    fileCache.warmup(testFiles);

    const stats1 = fileCache.getStats();
    expect(stats1.size).toBe(10);
    expect(stats1.misses).toBe(10);
    expect(stats1.hits).toBe(0);

    // All subsequent reads should be hits
    testFiles.forEach((f) => fileCache.get(f));

    const stats2 = fileCache.getStats();
    expect(stats2.hits).toBe(10);
    expect(stats2.misses).toBe(10); // No additional misses
  });

  it('handles real-world fix workflow', () => {
    // Simulate krolik fix workflow
    const file = testFiles[0];

    // Step 1: analyzeQuality reads file
    const content1 = fileCache.get(file);

    // Step 2: analyzeFile reads same file again (legacy analyzer)
    const content2 = fileCache.get(file);

    // Step 3: checkRecommendations reads again
    const content3 = fileCache.get(file);

    // Step 4: applyFix reads again
    const content4 = fileCache.get(file);

    // All reads should return same content
    expect(content1).toBe(content2);
    expect(content2).toBe(content3);
    expect(content3).toBe(content4);

    // Without cache: 4 disk reads
    // With cache: 1 disk read + 3 cache hits
    const stats = fileCache.getStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(3);

    // 75% reduction in disk I/O for this file!
    const ioReduction = (stats.hits / (stats.hits + stats.misses)) * 100;
    expect(ioReduction).toBe(75);
  });
});
