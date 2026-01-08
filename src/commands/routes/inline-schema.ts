/**
 * @module commands/routes/inline-schema
 * @description Parser for inline Zod schemas in tRPC procedures
 */

/**
 * Field definition extracted from inline z.object schema
 */
export interface InlineField {
  name: string;
  type: string;
  required: boolean;
  validation?: string;
  defaultValue?: string;
}

/**
 * Parsed inline schema with fields
 */
export interface InlineSchema {
  fields: InlineField[];
  raw?: string;
}

/**
 * Extract inline z.object schema from procedure block
 * Handles multiline and nested structures
 */
export function extractInlineSchema(procBlock: string): InlineSchema | null {
  // Find .input(z.object({ ... }))
  const inputMatch = procBlock.match(/\.input\s*\(\s*z\.object\s*\(\s*\{/);
  if (!inputMatch) return null;

  const startIdx = inputMatch.index! + inputMatch[0].length - 1;

  // Find matching closing brace
  let depth = 1;
  let endIdx = startIdx + 1;
  while (depth > 0 && endIdx < procBlock.length) {
    const char = procBlock[endIdx];
    if (char === '{') depth++;
    if (char === '}') depth--;
    endIdx++;
  }

  if (depth !== 0) return null;

  const objectContent = procBlock.slice(startIdx + 1, endIdx - 1);
  const fields = parseObjectFields(objectContent);

  return {
    fields,
    ...(objectContent.length < 500 ? { raw: objectContent.trim() } : {}),
  };
}

/**
 * Parse fields from z.object content
 */
function parseObjectFields(content: string): InlineField[] {
  const fields: InlineField[] = [];

  // Split by field definitions (name: z.something())
  // Handle multiline by normalizing whitespace
  const normalized = content.replace(/\s+/g, ' ').trim();

  // Match field patterns: fieldName: z.type().modifiers()
  const fieldRegex = /(\w+)\s*:\s*(z\.[^,}]+(?:\([^)]*\))?(?:\.[^,}]+(?:\([^)]*\))?)*)/g;
  let match;

  while ((match = fieldRegex.exec(normalized)) !== null) {
    const fieldName = match[1];
    const zodChain = match[2];

    if (!fieldName || !zodChain) continue;

    const field = parseZodChain(fieldName, zodChain);
    if (field) {
      fields.push(field);
    }
  }

  return fields;
}

/**
 * Parse a Zod chain like z.string().min(1).optional()
 */
function parseZodChain(name: string, chain: string): InlineField | null {
  const baseType = extractBaseType(chain);
  if (!baseType) return null;

  let required = true;
  let defaultValue: string | undefined;

  // Check for optional
  if (chain.includes('.optional()')) {
    required = false;
  }

  // Check for default
  const defaultMatch = chain.match(/\.default\s*\(\s*(['"]?)([^'")\s]+)\1\s*\)/);
  if (defaultMatch) {
    defaultValue = defaultMatch[2];
    required = false;
  }

  const validations = extractValidations(chain);

  // Check for nullable
  if (chain.includes('.nullable()')) {
    validations.push('nullable');
  }

  // Handle external schema reference override
  if (chain.match(/^\w+Schema/)) {
    // This case seems odd given extractBaseType logic but preserving original intent
    // If it starts with Schema but extractBaseType didn't return null?
    // Actually extractBaseType returns null if not z.something or Schema
    // Let's refine extractBaseType to handle Schema logic too.
  }

  return {
    name,
    type: baseType,
    required,
    ...(validations.length > 0 ? { validation: validations.join(', ') } : {}),
    ...(defaultValue ? { defaultValue } : {}),
  };
}

function extractBaseType(chain: string): string | null {
  // Handle external schema reference
  if (chain.match(/^\w+Schema/)) {
    return chain.match(/^(\w+)Schema/)?.[1] || 'unknown';
  }

  const typeMatch = chain.match(/^z\.(\w+)/);
  if (!typeMatch?.[1]) return null;

  let baseType = typeMatch[1];

  // Handle enum with values
  if (baseType === 'enum') {
    const enumMatch = chain.match(/z\.enum\s*\(\s*\[([^\]]+)\]/);
    if (enumMatch?.[1]) {
      const values = enumMatch[1]
        .split(',')
        .map((v) => v.trim().replace(/['"]/g, ''))
        .slice(0, 5);
      baseType = `enum(${values.join('|')})`;
    }
  }

  // Handle nativeEnum
  if (baseType === 'nativeEnum') {
    baseType = 'enum';
  }

  // Handle array type
  if (baseType === 'array') {
    const innerMatch = chain.match(/z\.array\s*\(\s*z\.(\w+)/);
    if (innerMatch) {
      baseType = `${innerMatch[1]}[]`;
    } else {
      baseType = 'array';
    }
  }

  return baseType;
}

function extractValidations(chain: string): string[] {
  const validations: string[] = [];

  const minMatch = chain.match(/\.min\s*\(\s*(\d+)\s*\)/);
  if (minMatch) {
    validations.push(`min:${minMatch[1]}`);
  }

  const maxMatch = chain.match(/\.max\s*\(\s*(\d+)\s*\)/);
  if (maxMatch) {
    validations.push(`max:${maxMatch[1]}`);
  }

  if (chain.includes('.email()')) {
    validations.push('email');
  }

  if (chain.includes('.url()')) {
    validations.push('url');
  }

  if (chain.includes('.uuid()')) {
    validations.push('uuid');
  }

  const regexMatch = chain.match(/\.regex\s*\(\s*\/([^/]+)\/\s*\)/);
  if (regexMatch) {
    validations.push(`regex:/${regexMatch[1]}/`);
  }

  if (chain.includes('.positive()')) {
    validations.push('positive');
  }

  if (chain.includes('.int()')) {
    validations.push('int');
  }

  return validations;
}

/**
 * Format inline schema for AI-readable output
 */
export function formatInlineSchema(schema: InlineSchema): string {
  if (schema.fields.length === 0) return 'empty';

  return schema.fields
    .map((f) => {
      let str = `${f.name}: ${f.type}`;
      if (!f.required) str += '?';
      if (f.validation) str += ` (${f.validation})`;
      if (f.defaultValue) str += ` = ${f.defaultValue}`;
      return str;
    })
    .join(', ');
}
