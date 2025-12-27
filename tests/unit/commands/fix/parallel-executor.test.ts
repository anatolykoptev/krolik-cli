/**
 * @module tests/unit/commands/fix/parallel-executor
 * @description Tests for parallel fix execution
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock file system and applier before imports
vi.mock('node:fs', () => ({
  default: {
    writeFileSync: vi.fn(),
    readFileSync: vi.fn((path: string) => `content of ${path}`),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  },
  writeFileSync: vi.fn(),
  readFileSync: vi.fn((path: string) => `content of ${path}`),
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
}));

vi.mock('@/lib', () => ({
  fileCache: {
    get: vi.fn((path: string) => `content of ${path}`),
    set: vi.fn(),
    clear: vi.fn(),
    getStats: vi.fn(() => ({ hits: 0, misses: 0, size: 0 })),
  },
  formatCacheStats: vi.fn(() => ''),
}));

import {
  createConcurrencyLimiter,
  estimateExecutionTime,
  executeParallel,
  type FileFixResult,
  groupByDirectory,
  type ParallelExecutionOptions,
} from '../../../../src/commands/fix/parallel-executor';
import type { FixPlan } from '../../../../src/commands/fix/plan';
import type { FixOperation, QualityIssue } from '../../../../src/commands/fix/types';

// ============================================================================
// TEST UTILITIES
// ============================================================================

function createMockIssue(file: string, line: number): QualityIssue {
  return {
    file,
    line,
    severity: 'warning',
    category: 'lint',
    message: `console.log at line ${line}`,
    fixerId: 'console-fixer',
  };
}

function createMockOperation(file: string, line: number): FixOperation {
  return {
    action: 'delete-line',
    file,
    line,
  };
}

function createMockPlan(file: string, lines: number[]): FixPlan {
  return {
    file,
    fixes: lines.map((line) => ({
      issue: createMockIssue(file, line),
      operation: createMockOperation(file, line),
      difficulty: 'trivial' as const,
    })),
  };
}

// ============================================================================
// CONCURRENCY LIMITER TESTS
// ============================================================================

describe('createConcurrencyLimiter', () => {
  it('should limit concurrent executions', async () => {
    const limiter = createConcurrencyLimiter(2);
    const executionOrder: number[] = [];
    const startTimes: number[] = [];

    const createTask = (id: number, delay: number) => async () => {
      startTimes.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, delay));
      executionOrder.push(id);
      return id;
    };

    const start = Date.now();
    const results = await Promise.all([
      limiter.run(createTask(1, 50)),
      limiter.run(createTask(2, 50)),
      limiter.run(createTask(3, 50)),
      limiter.run(createTask(4, 50)),
    ]);

    // All tasks should complete
    expect(results).toEqual([1, 2, 3, 4]);

    // With concurrency 2 and 50ms tasks, total time should be ~100ms (2 batches)
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some margin
    expect(elapsed).toBeLessThan(250); // Should not be sequential (4 * 50 = 200)
  });

  it('should handle errors without blocking queue', async () => {
    const limiter = createConcurrencyLimiter(1);

    const failingTask = async () => {
      throw new Error('Task failed');
    };

    const successTask = async () => 'success';

    const [result1, result2] = await Promise.allSettled([
      limiter.run(failingTask),
      limiter.run(successTask),
    ]);

    expect(result1.status).toBe('rejected');
    expect(result2.status).toBe('fulfilled');
    if (result2.status === 'fulfilled') {
      expect(result2.value).toBe('success');
    }
  });

  it('should track active and pending counts', async () => {
    const limiter = createConcurrencyLimiter(1);

    // Start a long task
    const longTask = limiter.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return 'done';
    });

    // Queue another task
    const queuedTask = limiter.run(async () => 'queued');

    // Check counts immediately
    expect(limiter.activeCount).toBe(1);
    expect(limiter.pendingCount).toBe(1);

    await Promise.all([longTask, queuedTask]);

    // After completion
    expect(limiter.activeCount).toBe(0);
    expect(limiter.pendingCount).toBe(0);
  });
});

// ============================================================================
// PARALLEL EXECUTOR TESTS
// ============================================================================

describe('executeParallel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute plans for multiple files in parallel', async () => {
    const plans: FixPlan[] = [
      createMockPlan('/project/src/file1.ts', [10, 20, 30]),
      createMockPlan('/project/src/file2.ts', [5, 15]),
      createMockPlan('/project/src/file3.ts', [1]),
    ];

    const filesStarted: string[] = [];
    const filesCompleted: string[] = [];

    const result = await executeParallel(plans, {
      concurrency: 2,
      dryRun: true,
      progress: {
        onFileStart: (file) => filesStarted.push(file),
        onFileComplete: (file) => filesCompleted.push(file),
      },
    });

    // All files should be processed
    expect(result.fileResults).toHaveLength(3);
    expect(filesStarted).toHaveLength(3);
    expect(filesCompleted).toHaveLength(3);

    // Check aggregation
    expect(result.successfulFiles).toHaveLength(3);
    expect(result.failedFiles).toHaveLength(0);
    expect(result.allSuccessful).toBe(true);
  });

  it('should report progress callbacks', async () => {
    const plans: FixPlan[] = [createMockPlan('/project/src/test.ts', [1, 2, 3])];

    const onFileStart = vi.fn();
    const onFileComplete = vi.fn();
    const onFixApplied = vi.fn();

    await executeParallel(plans, {
      dryRun: true,
      progress: {
        onFileStart,
        onFileComplete,
        onFixApplied,
      },
    });

    expect(onFileStart).toHaveBeenCalledTimes(1);
    expect(onFileStart).toHaveBeenCalledWith('/project/src/test.ts', 0, 1);

    expect(onFileComplete).toHaveBeenCalledTimes(1);
    expect(onFileComplete).toHaveBeenCalledWith(
      '/project/src/test.ts',
      expect.objectContaining({ file: '/project/src/test.ts', success: true }),
      0,
      1,
    );

    // 3 fixes in the plan
    expect(onFixApplied).toHaveBeenCalledTimes(3);
  });

  it('should aggregate results correctly', async () => {
    const plans: FixPlan[] = [
      createMockPlan('/project/a.ts', [1, 2]),
      createMockPlan('/project/b.ts', [1]),
    ];

    const result = await executeParallel(plans, { dryRun: true });

    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(0);
    expect(result.totalDuration).toBeGreaterThanOrEqual(0);
  });

  it('should respect concurrency limit', async () => {
    const plans: FixPlan[] = Array.from({ length: 10 }, (_, i) =>
      createMockPlan(`/project/file${i}.ts`, [1]),
    );

    const activeCounts: number[] = [];
    let maxActive = 0;

    // Track concurrent executions via timing
    const result = await executeParallel(plans, {
      concurrency: 3,
      dryRun: true,
      progress: {
        onFileStart: () => {
          activeCounts.push(1);
          maxActive = Math.max(maxActive, activeCounts.length);
        },
        onFileComplete: () => {
          activeCounts.pop();
        },
      },
    });

    expect(result.fileResults).toHaveLength(10);
    // Max concurrent should not exceed concurrency limit
    expect(maxActive).toBeLessThanOrEqual(3);
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('groupByDirectory', () => {
  it('should group plans by directory', () => {
    const plans: FixPlan[] = [
      createMockPlan('/project/src/components/Button.tsx', [1]),
      createMockPlan('/project/src/components/Input.tsx', [2]),
      createMockPlan('/project/src/hooks/useAuth.ts', [3]),
      createMockPlan('/project/src/hooks/useForm.ts', [4]),
    ];

    const groups = groupByDirectory(plans);

    expect(groups.size).toBe(2);
    expect(groups.get('/project/src/components')).toHaveLength(2);
    expect(groups.get('/project/src/hooks')).toHaveLength(2);
  });

  it('should handle single file', () => {
    const plans: FixPlan[] = [createMockPlan('/project/index.ts', [1])];

    const groups = groupByDirectory(plans);

    expect(groups.size).toBe(1);
    expect(groups.get('/project')).toHaveLength(1);
  });
});

describe('estimateExecutionTime', () => {
  it('should calculate total fixes and estimated time', () => {
    const plans: FixPlan[] = [
      createMockPlan('/a.ts', [1, 2, 3]), // 3 fixes
      createMockPlan('/b.ts', [1, 2]), // 2 fixes
      createMockPlan('/c.ts', [1]), // 1 fix
    ];

    const estimate = estimateExecutionTime(plans);

    expect(estimate.totalFixes).toBe(6);
    expect(estimate.estimatedMs).toBe(60); // 6 * 10ms
  });

  it('should return 0 for empty plans', () => {
    const estimate = estimateExecutionTime([]);

    expect(estimate.totalFixes).toBe(0);
    expect(estimate.estimatedMs).toBe(0);
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('error handling', () => {
  it('should continue processing other files when one fails', async () => {
    // This test would need to mock the applyFix function to simulate failure
    // For now, we test the structure is correct
    const plans: FixPlan[] = [
      createMockPlan('/project/ok1.ts', [1]),
      createMockPlan('/project/ok2.ts', [1]),
    ];

    const result = await executeParallel(plans, {
      dryRun: true,
      failFast: false,
    });

    // Both should be processed
    expect(result.fileResults).toHaveLength(2);
  });

  it('should handle empty plans array', async () => {
    const result = await executeParallel([], {});

    expect(result.fileResults).toHaveLength(0);
    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(0);
    expect(result.allSuccessful).toBe(true);
  });
});
