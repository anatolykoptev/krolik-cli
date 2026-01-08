/**
 * @module tests/unit/commands/refactor/utils/typecheck
 * @description Tests for typecheck utility with timeout support
 */

import { spawn } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TYPECHECK_TIMEOUT,
  runTypecheck,
  type TypecheckResult,
} from '@/commands/refactor/utils/typecheck';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);

describe('runTypecheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('DEFAULT_TYPECHECK_TIMEOUT', () => {
    it('should be 30 seconds', () => {
      expect(DEFAULT_TYPECHECK_TIMEOUT).toBe(30_000);
    });
  });

  describe('successful typecheck', () => {
    it('should return success: true when typecheck passes', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild as ReturnType<typeof spawn>);

      const promise = runTypecheck('/test/project');

      // Simulate successful completion
      mockChild.emit('close', 0);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.errors).toBe(0);
      expect(result.timedOut).toBeUndefined();
    });

    it('should count TypeScript errors in output', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild as ReturnType<typeof spawn>);

      const promise = runTypecheck('/test/project');

      // Simulate output with errors
      mockChild.stdout.emit(
        'data',
        Buffer.from(`
error TS2322: Type 'string' is not assignable to type 'number'.
error TS2345: Argument of type 'string' is not assignable to parameter.
error TS7006: Parameter 'x' implicitly has an 'any' type.
      `),
      );
      mockChild.emit('close', 1);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.errors).toBe(3);
    });
  });

  describe('timeout handling', () => {
    it('should timeout after default timeout if not specified', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild as ReturnType<typeof spawn>);

      const promise = runTypecheck('/test/project');

      // Advance past default timeout
      vi.advanceTimersByTime(DEFAULT_TYPECHECK_TIMEOUT + 100);

      const result = await promise;

      expect(result.timedOut).toBe(true);
      expect(result.success).toBe(false);
      expect(result.errors).toBe(-1);
      expect(result.output).toContain('timed out');
    });

    it('should use custom timeout when provided', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild as ReturnType<typeof spawn>);

      const customTimeout = 5000;
      const promise = runTypecheck('/test/project', { timeout: customTimeout });

      // Advance just past custom timeout
      vi.advanceTimersByTime(customTimeout + 100);

      const result = await promise;

      expect(result.timedOut).toBe(true);
      expect(result.output).toContain(`${customTimeout / 1000}s`);
    });

    it('should complete successfully before timeout', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild as ReturnType<typeof spawn>);

      const promise = runTypecheck('/test/project', { timeout: 10000 });

      // Simulate completion before timeout
      mockChild.emit('close', 0);

      const result = await promise;

      expect(result.timedOut).toBeUndefined();
      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle spawn errors', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild as ReturnType<typeof spawn>);

      const promise = runTypecheck('/test/project');

      // Simulate spawn error
      mockChild.emit('error', new Error('Command not found'));

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.errors).toBe(-1);
      expect(result.output).toBe('Failed to run pnpm typecheck');
    });
  });

  describe('spawn options', () => {
    it('should spawn with detached option for process group killing', async () => {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild as ReturnType<typeof spawn>);

      runTypecheck('/test/project');

      expect(mockSpawn).toHaveBeenCalledWith('pnpm', ['run', 'typecheck'], {
        cwd: '/test/project',
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      });
    });
  });
});

/**
 * Helper to create a mock child process
 */
function createMockChild() {
  const events = new Map<string, ((...args: unknown[]) => void)[]>();
  const stdoutEvents = new Map<string, ((...args: unknown[]) => void)[]>();
  const stderrEvents = new Map<string, ((...args: unknown[]) => void)[]>();

  const createEmitter = (eventsMap: Map<string, ((...args: unknown[]) => void)[]>) => ({
    on: (event: string, handler: (...args: unknown[]) => void) => {
      const handlers = eventsMap.get(event) || [];
      handlers.push(handler);
      eventsMap.set(event, handlers);
    },
    emit: (event: string, ...args: unknown[]) => {
      const handlers = eventsMap.get(event) || [];
      for (const h of handlers) h(...args);
    },
  });

  const stdout = createEmitter(stdoutEvents);
  const stderr = createEmitter(stderrEvents);

  return {
    pid: 12345,
    stdout,
    stderr,
    on: (event: string, handler: (...args: unknown[]) => void) => {
      const handlers = events.get(event) || [];
      handlers.push(handler);
      events.set(event, handlers);
    },
    emit: (event: string, ...args: unknown[]) => {
      const handlers = events.get(event) || [];
      for (const h of handlers) h(...args);
    },
    kill: vi.fn(),
  };
}
