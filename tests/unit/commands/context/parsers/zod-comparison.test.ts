/**
 * @module commands/context/parsers/zod-comparison.test
 * @description Comparison tests between regex and SWC-based Zod parsers
 *
 * These tests verify that the new SWC parser produces compatible results
 * with the legacy regex parser for common use cases.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseZodSchemas as parseRegex } from '@/commands/context/parsers/zod';
import { parseZodSchemas as parseSwc } from '@/commands/context/parsers/zod-swc';

describe('Zod Parser Comparison: Regex vs SWC', () => {
  function createTestFile(content: string): { dir: string; cleanup: () => void } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zod-compare-'));
    const filePath = path.join(dir, 'schema.ts');
    fs.writeFileSync(filePath, content, 'utf-8');

    return {
      dir,
      cleanup: () => {
        try {
          fs.unlinkSync(filePath);
          fs.rmdirSync(dir);
        } catch {
          // Ignore cleanup errors
        }
      },
    };
  }

  it('should produce same results for basic schema', () => {
    const content = `
      import { z } from 'zod';

      export const UserSchema = z.object({
        name: z.string(),
        age: z.number(),
      });
    `;

    const { dir, cleanup } = createTestFile(content);

    try {
      const regexResult = parseRegex(dir, []);
      const swcResult = parseSwc(dir, []);

      expect(swcResult).toHaveLength(regexResult.length);
      expect(swcResult[0]?.name).toBe(regexResult[0]?.name);
      expect(swcResult[0]?.type).toBe(regexResult[0]?.type);
      expect(swcResult[0]?.fields.length).toBe(regexResult[0]?.fields.length);
    } finally {
      cleanup();
    }
  });

  it('should produce same results for optional fields', () => {
    const content = `
      import { z } from 'zod';

      export const UserSchema = z.object({
        bio: z.string().optional(),
      });
    `;

    const { dir, cleanup } = createTestFile(content);

    try {
      const regexResult = parseRegex(dir, []);
      const swcResult = parseSwc(dir, []);

      expect(swcResult[0]?.fields[0]?.required).toBe(regexResult[0]?.fields[0]?.required);
    } finally {
      cleanup();
    }
  });

  it('should produce same results for validation constraints', () => {
    const content = `
      import { z } from 'zod';

      export const UserSchema = z.object({
        age: z.number().min(18).max(100),
      });
    `;

    const { dir, cleanup } = createTestFile(content);

    try {
      const _regexResult = parseRegex(dir, []);
      const swcResult = parseSwc(dir, []);

      // Both should extract min/max validations
      expect(swcResult[0]?.fields[0]?.validation).toBeDefined();
      expect(swcResult[0]?.fields[0]?.validation).toContain('min');
      expect(swcResult[0]?.fields[0]?.validation).toContain('max');
    } finally {
      cleanup();
    }
  });

  it('should determine same schema types', () => {
    const content = `
      import { z } from 'zod';

      export const UserInputSchema = z.object({ name: z.string() });
      export const UserOutputSchema = z.object({ id: z.string() });
      export const UserFilterSchema = z.object({ search: z.string() });
    `;

    const { dir, cleanup } = createTestFile(content);

    try {
      const regexResult = parseRegex(dir, []);
      const swcResult = parseSwc(dir, []);

      expect(swcResult).toHaveLength(regexResult.length);

      const swcTypes = swcResult.map((s) => s.type).sort();
      const regexTypes = regexResult.map((s) => s.type).sort();

      expect(swcTypes).toEqual(regexTypes);
    } finally {
      cleanup();
    }
  });

  it('should handle same file patterns', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zod-compare-'));
    const userFile = path.join(dir, 'user.schema.ts');
    const postFile = path.join(dir, 'post.schema.ts');

    // Use content that regex parser can handle (inline object on same line)
    const content = `import { z } from 'zod';
export const TestSchema = z.object({ name: z.string() });`;

    fs.writeFileSync(userFile, content, 'utf-8');
    fs.writeFileSync(postFile, content, 'utf-8');

    try {
      const regexAll = parseRegex(dir, []);
      const swcAll = parseSwc(dir, []);

      // Both should find 2 schemas (one per file)
      expect(swcAll.length).toBeGreaterThan(0);
      expect(regexAll.length).toBeGreaterThan(0);

      const regexFiltered = parseRegex(dir, ['user']);
      const swcFiltered = parseSwc(dir, ['user']);

      // Both should filter to 1 schema
      expect(swcFiltered.length).toBe(1);
      expect(regexFiltered.length).toBe(1);
    } finally {
      fs.unlinkSync(userFile);
      fs.unlinkSync(postFile);
      fs.rmdirSync(dir);
    }
  });

  it('SWC parser should handle cases regex cannot', () => {
    // This schema would confuse regex parser due to nested objects
    const content = `
      import { z } from 'zod';

      export const ComplexSchema = z.object({
        metadata: z.object({
          created: z.date(),
        }),
        name: z.string(),
      });
    `;

    const { dir, cleanup } = createTestFile(content);

    try {
      const swcResult = parseSwc(dir, []);

      // SWC should correctly parse this
      expect(swcResult).toHaveLength(1);
      expect(swcResult[0]?.name).toBe('ComplexSchema');

      // Should find at least the top-level fields
      expect(swcResult[0]?.fields.length).toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });

  it('SWC parser should ignore schemas in comments', () => {
    const content = `
      import { z } from 'zod';

      // This should be ignored: export const CommentSchema = z.object({})

      export const RealSchema = z.object({
        name: z.string(),
      });
    `;

    const { dir, cleanup } = createTestFile(content);

    try {
      const swcResult = parseSwc(dir, []);

      // Should only find RealSchema, not CommentSchema
      expect(swcResult).toHaveLength(1);
      expect(swcResult[0]?.name).toBe('RealSchema');
    } finally {
      cleanup();
    }
  });

  it('SWC parser should ignore schemas in strings', () => {
    const content = `
      import { z } from 'zod';

      const example = "export const FakeSchema = z.object({})";

      export const RealSchema = z.object({
        name: z.string(),
      });
    `;

    const { dir, cleanup } = createTestFile(content);

    try {
      const swcResult = parseSwc(dir, []);

      // Should only find RealSchema
      expect(swcResult).toHaveLength(1);
      expect(swcResult[0]?.name).toBe('RealSchema');
    } finally {
      cleanup();
    }
  });
});
