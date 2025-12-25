import { describe, expect, it } from 'vitest';
import { exec, execLines, tryExec } from '../../../src/lib';

describe('shell', () => {
  describe('tryExec', () => {
    it('should return success for valid command', () => {
      const result = tryExec('echo "hello"', { silent: true });
      expect(result.success).toBe(true);
      expect(result.output).toBe('hello');
    });

    it('should return failure for invalid command', () => {
      const result = tryExec('nonexistent-command-12345', { silent: true });
      expect(result.success).toBe(false);
    });

    it('should trim output', () => {
      const result = tryExec('echo "  spaced  "', { silent: true });
      expect(result.success).toBe(true);
      expect(result.output).toBe('spaced');
    });
  });

  describe('execLines', () => {
    it('should split output into lines', () => {
      const lines = execLines('echo "line1\nline2\nline3"', { silent: true });
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('line1');
      expect(lines[1]).toBe('line2');
      expect(lines[2]).toBe('line3');
    });

    it('should filter empty lines', () => {
      const lines = execLines('echo "line1\n\nline2"', { silent: true });
      expect(lines).toHaveLength(2);
    });

    it('should return empty array for failed command', () => {
      const lines = execLines('nonexistent-command-12345', { silent: true });
      expect(lines).toEqual([]);
    });
  });

  describe('exec', () => {
    it('should return output for successful command', () => {
      const output = exec('echo "test"', { silent: true });
      expect(output).toBe('test');
    });

    it('should throw error for failed command', () => {
      expect(() => exec('nonexistent-command-12345', { silent: true })).toThrow();
    });
  });
});
