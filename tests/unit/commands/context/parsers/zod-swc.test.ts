/**
 * @module commands/context/parsers/zod-swc.test
 * @description Tests for SWC-based Zod schema parser
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseZodSchemas } from '@/commands/context/parsers/zod-swc';

describe('parseZodSchemas (SWC-based)', () => {
  // Helper to create a temporary test file
  function createTestFile(content: string): { dir: string; cleanup: () => void } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zod-swc-test-'));
    const filePath = path.join(dir, 'test-schema.ts');
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

  it('should parse basic schema with string field', () => {
    const content = `
      import { z } from 'zod';

      export const UserSchema = z.object({
        name: z.string(),
      });
    `;

    const { dir, cleanup } = createTestFile(content);

    try {
      const schemas = parseZodSchemas(dir, []);
      expect(schemas).toHaveLength(1);
      expect(schemas[0]?.name).toBe('UserSchema');
      expect(schemas[0]?.fields).toHaveLength(1);
      expect(schemas[0]?.fields[0]).toMatchObject({
        name: 'name',
        type: 'string',
        required: true,
      });
    } finally {
      cleanup();
    }
  });

  it('should parse schema with optional field', () => {
    const content = `
      import { z } from 'zod';

      export const UserSchema = z.object({
        email: z.string().optional(),
      });
    `;

    const { dir, cleanup } = createTestFile(content);

    try {
      const schemas = parseZodSchemas(dir, []);
      expect(schemas[0]?.fields[0]).toMatchObject({
        name: 'email',
        type: 'string',
        required: false,
      });
    } finally {
      cleanup();
    }
  });

  it('should parse schema with validation constraints', () => {
    const content = `
      import { z } from 'zod';

      export const UserSchema = z.object({
        age: z.number().min(18).max(100),
      });
    `;

    const { dir, cleanup } = createTestFile(content);

    try {
      const schemas = parseZodSchemas(dir, []);
      expect(schemas[0]?.fields[0]).toMatchObject({
        name: 'age',
        type: 'number',
        required: true,
        validation: 'min: 18, max: 100',
      });
    } finally {
      cleanup();
    }
  });

  it('should parse schema with multiple fields', () => {
    const content = `
      import { z } from 'zod';

      export const UserSchema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        age: z.number().optional(),
      });
    `;

    const { dir, cleanup } = createTestFile(content);

    try {
      const schemas = parseZodSchemas(dir, []);
      expect(schemas[0]?.fields).toHaveLength(3);
    } finally {
      cleanup();
    }
  });

  it('should determine schema type from name', () => {
    const content = `
      import { z } from 'zod';

      export const CreateUserInputSchema = z.object({
        name: z.string(),
      });

      export const UserOutputSchema = z.object({
        id: z.string(),
      });

      export const UserFilterSchema = z.object({
        search: z.string(),
      });
    `;

    const { dir, cleanup } = createTestFile(content);

    try {
      const schemas = parseZodSchemas(dir, []);
      expect(schemas).toHaveLength(3);
      expect(schemas.find((s) => s.name === 'CreateUserInputSchema')?.type).toBe('input');
      expect(schemas.find((s) => s.name === 'UserOutputSchema')?.type).toBe('output');
      expect(schemas.find((s) => s.name === 'UserFilterSchema')?.type).toBe('filter');
    } finally {
      cleanup();
    }
  });

  it('should handle nullable fields', () => {
    const content = `
      import { z } from 'zod';

      export const UserSchema = z.object({
        bio: z.string().nullable(),
      });
    `;

    const { dir, cleanup } = createTestFile(content);

    try {
      const schemas = parseZodSchemas(dir, []);
      expect(schemas[0]?.fields[0]).toMatchObject({
        name: 'bio',
        type: 'string',
        required: false,
      });
    } finally {
      cleanup();
    }
  });

  it('should skip test files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zod-swc-test-'));
    const testFilePath = path.join(dir, 'test-schema.test.ts');
    const specFilePath = path.join(dir, 'test-schema.spec.ts');

    const content = `
      import { z } from 'zod';
      export const TestSchema = z.object({ name: z.string() });
    `;

    fs.writeFileSync(testFilePath, content, 'utf-8');
    fs.writeFileSync(specFilePath, content, 'utf-8');

    try {
      const schemas = parseZodSchemas(dir, []);
      expect(schemas).toHaveLength(0);
    } finally {
      fs.unlinkSync(testFilePath);
      fs.unlinkSync(specFilePath);
      fs.rmdirSync(dir);
    }
  });

  it('should filter by patterns', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zod-swc-test-'));
    const userFile = path.join(dir, 'user-schema.ts');
    const postFile = path.join(dir, 'post-schema.ts');

    const content = `
      import { z } from 'zod';
      export const Schema = z.object({ name: z.string() });
    `;

    fs.writeFileSync(userFile, content, 'utf-8');
    fs.writeFileSync(postFile, content, 'utf-8');

    try {
      const schemas = parseZodSchemas(dir, ['user']);
      expect(schemas).toHaveLength(1);
    } finally {
      fs.unlinkSync(userFile);
      fs.unlinkSync(postFile);
      fs.rmdirSync(dir);
    }
  });

  it('should handle non-existent directory', () => {
    const schemas = parseZodSchemas('/non/existent/path', []);
    expect(schemas).toHaveLength(0);
  });

  it('should handle string literal field names', () => {
    const content = `
      import { z } from 'zod';

      export const UserSchema = z.object({
        'full-name': z.string(),
      });
    `;

    const { dir, cleanup } = createTestFile(content);

    try {
      const schemas = parseZodSchemas(dir, []);
      expect(schemas[0]?.fields[0]).toMatchObject({
        name: 'full-name',
        type: 'string',
      });
    } finally {
      cleanup();
    }
  });
});
