/**
 * @module commands/context/parsers/zod
 * @description Zod schema file parser
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ZodField, ZodSchemaInfo } from "./types";

/**
 * Parse Zod field definitions
 */
function parseZodFields(fieldsBlock: string): ZodField[] {
  const fields: ZodField[] = [];

  // Match: fieldName: z.string().min(1).max(100).optional()
  const fieldRegex = /(\w+):\s*z\.(\w+)\((.*?)\)([^,\n]*)/g;
  let match: RegExpExecArray | null;

  while ((match = fieldRegex.exec(fieldsBlock)) !== null) {
    const name = match[1];
    const baseType = match[2];
    const chain = match[4] ?? "";

    if (!name || !baseType) continue;

    const isOptional =
      chain.includes(".optional()") || chain.includes(".nullable()");

    // Extract validation constraints
    const validations: string[] = [];
    const minMatch = chain.match(/\.min\((\d+)\)/);
    const maxMatch = chain.match(/\.max\((\d+)\)/);
    const lengthMatch = chain.match(/\.length\((\d+)\)/);

    if (minMatch) validations.push(`min: ${minMatch[1]}`);
    if (maxMatch) validations.push(`max: ${maxMatch[1]}`);
    if (lengthMatch) validations.push(`length: ${lengthMatch[1]}`);

    const field: ZodField = {
      name,
      type: baseType,
      required: !isOptional,
    };
    if (validations.length > 0) {
      field.validation = validations.join(", ");
    }
    fields.push(field);
  }

  return fields;
}

/**
 * Determine schema type from name
 */
function getSchemaType(
  schemaName: string,
): "input" | "output" | "filter" {
  const lower = schemaName.toLowerCase();
  if (lower.includes("output") || lower.includes("response")) {
    return "output";
  }
  if (lower.includes("filter") || lower.includes("query")) {
    return "filter";
  }
  return "input";
}

/**
 * Parse a single schema file
 */
function parseSchemaFile(filePath: string): ZodSchemaInfo[] {
  const schemas: ZodSchemaInfo[] = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return schemas;
  }

  const fileName = path.basename(filePath);
  const schemaRegex =
    /export\s+const\s+(\w+Schema)\s*=\s*z\.object\(\{([^}]+)\}\)/gs;
  let match: RegExpExecArray | null;

  while ((match = schemaRegex.exec(content)) !== null) {
    const schemaName = match[1];
    const fieldsBlock = match[2];
    if (!schemaName || !fieldsBlock) continue;

    schemas.push({
      name: schemaName,
      type: getSchemaType(schemaName),
      fields: parseZodFields(fieldsBlock),
      file: fileName,
    });
  }

  return schemas;
}

/**
 * Check if file matches patterns
 */
function matchesPatterns(fileName: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;
  const nameLower = fileName.toLowerCase();
  return patterns.some((p) => nameLower.includes(p.toLowerCase()));
}

/**
 * Parse Zod schema files to extract input/output schemas
 */
export function parseZodSchemas(
  schemasDir: string,
  patterns: string[],
): ZodSchemaInfo[] {
  const results: ZodSchemaInfo[] = [];

  if (!fs.existsSync(schemasDir)) return results;

  function scanDir(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        scanDir(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      if (!matchesPatterns(entry.name, patterns)) continue;

      results.push(...parseSchemaFile(fullPath));
    }
  }

  scanDir(schemasDir);
  return results;
}
