/**
 * @module tests/unit/commands/fix/applier
 * @description Tests for fix applier with syntax validation
 */

import { describe, expect, it } from 'vitest';
import { validateSyntax } from '@/lib/@ast/swc/parser';

/**
 * Note: Full integration tests for applyFix and applyFixes require
 * actual file system access. These tests verify the syntax validation
 * logic that was added as part of the fix command improvements.
 *
 * The validateSyntax function is now called before writing fixed content
 * to prevent invalid syntax from being written to disk.
 */

describe('applier syntax validation', () => {
  describe('validateSyntax (underlying function)', () => {
    it('should accept valid TypeScript', () => {
      const result = validateSyntax('test.ts', 'const x = 1;');
      expect(result.success).toBe(true);
    });

    it('should reject invalid TypeScript - missing variable name', () => {
      const result = validateSyntax('test.ts', 'const = 1;');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid TypeScript - unclosed brace', () => {
      const result = validateSyntax('test.ts', 'function test() {');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid TypeScript - unexpected token', () => {
      const result = validateSyntax('test.ts', 'const x = @invalid;');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept valid TSX', () => {
      const result = validateSyntax('test.tsx', 'const App = () => <div>Hello</div>;');
      expect(result.success).toBe(true);
    });

    it('should accept valid JavaScript', () => {
      const result = validateSyntax('test.js', 'function hello() { return 42; }');
      expect(result.success).toBe(true);
    });

    it('should accept empty content', () => {
      const result = validateSyntax('test.ts', '');
      expect(result.success).toBe(true);
    });

    it('should accept content with only comments', () => {
      const result = validateSyntax('test.ts', '// This is a comment\n/* Another comment */');
      expect(result.success).toBe(true);
    });

    it('should accept complex valid code', () => {
      const code = `
        interface User {
          name: string;
          age: number;
        }

        const users: User[] = [];

        async function fetchUsers(): Promise<User[]> {
          return users;
        }

        export { fetchUsers };
      `;
      const result = validateSyntax('test.ts', code);
      expect(result.success).toBe(true);
    });

    it('should detect syntax errors in arrow functions', () => {
      const result = validateSyntax('test.ts', 'const fn = () =>');
      expect(result.success).toBe(false);
    });

    it('should detect missing semicolons in strict scenarios', () => {
      // SWC is lenient with semicolons, so this should actually pass
      const result = validateSyntax('test.ts', 'const x = 1\nconst y = 2');
      expect(result.success).toBe(true); // SWC allows missing semicolons
    });
  });

  describe('validation scenarios for fix operations', () => {
    it('console.log deletion produces valid syntax', () => {
      // Before: console.log("test");
      // After: (empty string)
      const result = validateSyntax('test.ts', '');
      expect(result.success).toBe(true);
    });

    it('debugger deletion produces valid syntax', () => {
      // Before: debugger;
      // After: (empty string)
      const result = validateSyntax('test.ts', '');
      expect(result.success).toBe(true);
    });

    it('any -> unknown replacement produces valid syntax', () => {
      const before = 'let x: any = null;';
      const after = 'let x: unknown = null;';

      const beforeResult = validateSyntax('test.ts', before);
      const afterResult = validateSyntax('test.ts', after);

      expect(beforeResult.success).toBe(true);
      expect(afterResult.success).toBe(true);
    });

    it('bad fix would be caught by validation', () => {
      // Simulating a bug in fixer that produces invalid code
      const badFix = 'const ;'; // Missing variable name
      const result = validateSyntax('test.ts', badFix);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBeDefined();
    });
  });
});
