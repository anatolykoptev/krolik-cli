/**
 * @module commands/context/parsers/api-contracts
 * @description tRPC API contracts analyzer using SWC AST
 *
 * Extracts complete procedure contracts from tRPC routers:
 * - Procedure type (query/mutation/subscription)
 * - Input/output Zod schemas with field details
 * - Protection level (public/protected/admin)
 * - Rate limiting configuration
 *
 * Uses SWC for accurate AST parsing and field extraction.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Field definition in Zod schema
 */
export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  validation?: string;
  defaultValue?: string;
}

/**
 * Input schema with fields
 */
export interface InputContract {
  schema: string; // Schema name or 'inline'
  fields: SchemaField[];
}

/**
 * Output schema with fields
 */
export interface OutputContract {
  schema: string; // Schema name or 'inline' or 'inferred'
  fields?: SchemaField[]; // Only for inline schemas
}

/**
 * Single tRPC procedure contract
 */
export interface ProcedureContract {
  name: string;
  type: 'query' | 'mutation' | 'subscription' | 'unknown';
  protection: 'public' | 'protected' | 'admin' | 'rate-limited';
  rateLimit?: {
    bucket: string;
    max?: number;
    windowMs?: number;
  };
  input?: InputContract;
  output?: OutputContract;
}

/**
 * Router contract with all procedures
 */
export interface RouterContract {
  name: string;
  path: string;
  procedures: ProcedureContract[];
  subRouters: string[];
}

/**
 * Parse all tRPC router files in directory
 */
export function parseApiContracts(routersDir: string, patterns: string[]): RouterContract[] {
  const contracts: RouterContract[] = [];

  if (!fs.existsSync(routersDir)) {
    return contracts;
  }

  function scanDir(dir: string, relativePath = ''): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const currentRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        scanDir(fullPath, currentRelPath);
        continue;
      }

      // Only process .ts files, skip tests and index files
      if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) continue;
      if (entry.name === 'index.ts' || entry.name === '_app.ts') continue;

      // Filter by patterns if provided
      if (patterns.length > 0 && !matchesPatterns(entry.name, patterns)) continue;

      const contract = parseRouterFile(fullPath, currentRelPath);
      if (contract) {
        // Always include routers, even if they have no procedures yet (might be parsing issue)
        contracts.push(contract);
      }
    }
  }

  scanDir(routersDir);

  // Sort by procedure count (most important routers first)
  contracts.sort((a, b) => b.procedures.length - a.procedures.length);

  return contracts;
}

/**
 * Parse single router file
 */
function parseRouterFile(filePath: string, relativePath: string): RouterContract | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath, '.ts');

  // Find router definition name from content (more reliable than AST for this)
  let routerName = `${fileName}Router`;
  const routerMatch = content.match(
    /(?:export\s+const\s+)?(\w+Router)\s*=\s*(?:router|createTRPCRouter)/,
  );
  if (routerMatch?.[1]) {
    routerName = routerMatch[1];
  }

  // Parse procedures and sub-routers using regex (more reliable for this specific pattern)
  const procedures: ProcedureContract[] = [];
  const subRouters: string[] = [];

  // Find the router({ ... }) block
  const routerCallMatch = content.match(/(?:router|createTRPCRouter)\s*\(\s*\{/);
  if (!routerCallMatch) {
    return {
      name: routerName,
      path: relativePath,
      procedures,
      subRouters,
    };
  }

  const startIdx = routerCallMatch.index! + routerCallMatch[0].length - 1;

  // Find matching closing brace
  let depth = 1;
  let endIdx = startIdx + 1;
  while (depth > 0 && endIdx < content.length) {
    const char = content[endIdx];
    if (char === '{') depth++;
    if (char === '}') depth--;
    endIdx++;
  }

  if (depth !== 0) {
    return {
      name: routerName,
      path: relativePath,
      procedures,
      subRouters,
    };
  }

  const routerBody = content.slice(startIdx + 1, endIdx - 1);

  // Parse procedures from router body
  parseProceduresFromBody(routerBody, content, procedures, subRouters);

  return {
    name: routerName,
    path: relativePath,
    procedures,
    subRouters,
  };
}

/**
 * Parse procedures from router body text
 */
function parseProceduresFromBody(
  routerBody: string,
  _fullContent: string,
  procedures: ProcedureContract[],
  subRouters: string[],
): void {
  // Parse each procedure property by finding name: Procedure pattern
  // This avoids matching schema object properties
  const procNameRegex = /^\s*(\w+)\s*:\s*(\w+Procedure|\w+Router)/gm;
  let match;

  while ((match = procNameRegex.exec(routerBody)) !== null) {
    const procedureName = match[1];
    const valuePrefix = match[2];
    if (!procedureName || !valuePrefix) continue;

    const startIdx = match.index + match[0].length;

    // Extract the full procedure value (handle nested parens, strings, etc.)
    // Include the Procedure/Router prefix we already matched
    const procedureValue = valuePrefix + extractProcedureValue(routerBody, startIdx);
    if (!procedureValue) continue;

    // Check if this is a sub-router (contains 'Router' but not 'Procedure')
    if (procedureValue.includes('Router') && !procedureValue.includes('Procedure')) {
      subRouters.push(procedureName);
      continue;
    }

    // Only process if it's a real procedure (has query/mutation/subscription)
    if (!procedureValue.match(/\.(query|mutation|subscription)\s*\(/)) {
      continue;
    }

    // Parse procedure
    const procedure = parseProcedureFromChain(procedureName, procedureValue);
    if (procedure) {
      procedures.push(procedure);
    }
  }
}

/**
 * Extract procedure value from router body starting at given index
 * Handles nested parens, braces, and strings
 */
function extractProcedureValue(text: string, startIdx: number): string | null {
  let endIdx = startIdx;
  let depth = 0;
  let braceDepth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';

    // Track string state
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
    }

    if (inString) continue;

    // Track parenthesis and brace depth
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === '{') braceDepth++;
    if (char === '}') braceDepth--;

    // End when we hit a comma or closing brace at depth 0
    if (depth === 0 && braceDepth === 0) {
      if (char === ',' || char === '}') {
        endIdx = i;
        break;
      }
    }

    endIdx = i + 1;
  }

  if (endIdx <= startIdx) return null;

  return text.slice(startIdx, endIdx).trim();
}

/**
 * Parse procedure from chain text
 */
function parseProcedureFromChain(name: string, valueText: string): ProcedureContract | null {
  // Detect protection level
  let protection: ProcedureContract['protection'] = 'public';
  let rateLimit: ProcedureContract['rateLimit'] | undefined;

  if (valueText.includes('protectedProcedure')) {
    protection = 'protected';
  } else if (valueText.includes('adminProcedure')) {
    protection = 'admin';
  } else if (valueText.includes('rateLimitedProcedure')) {
    protection = 'rate-limited';
    // Extract rate limit bucket (e.g., rateLimitedProcedure.auth)
    const bucketMatch = valueText.match(/rateLimitedProcedure\.(\w+)/);
    if (bucketMatch?.[1]) {
      rateLimit = { bucket: bucketMatch[1] };
    }
  }

  // Detect procedure type
  let type: ProcedureContract['type'] = 'unknown';
  if (valueText.includes('.query(')) {
    type = 'query';
  } else if (valueText.includes('.mutation(')) {
    type = 'mutation';
  } else if (valueText.includes('.subscription(')) {
    type = 'subscription';
  }

  if (type === 'unknown') return null;

  // Extract input schema
  const input = extractInputSchema(valueText);

  // Extract output schema
  const output = extractOutputSchema(valueText);

  const procedure: ProcedureContract = {
    name,
    type,
    protection,
  };

  if (rateLimit) {
    procedure.rateLimit = rateLimit;
  }
  if (input) {
    procedure.input = input;
  }
  if (output) {
    procedure.output = output;
  }

  return procedure;
}

/**
 * Extract input schema from procedure chain
 */
function extractInputSchema(procedureText: string): InputContract | null {
  if (!procedureText.includes('.input(')) return null;

  // Try to find schema reference
  const schemaRefMatch = procedureText.match(/\.input\(\s*(\w+Schema|\w+Input)/);
  if (schemaRefMatch?.[1]) {
    return {
      schema: schemaRefMatch[1],
      fields: [],
    };
  }

  // Try to extract inline z.object() schema
  const inlineMatch = procedureText.match(/\.input\(\s*z\.object\(\s*\{/);
  if (inlineMatch) {
    const fields = extractInlineZodFields(procedureText);
    return {
      schema: 'inline',
      fields,
    };
  }

  return {
    schema: 'unknown',
    fields: [],
  };
}

/**
 * Extract output schema from procedure chain
 */
function extractOutputSchema(procedureText: string): OutputContract | null {
  if (!procedureText.includes('.output(')) return null;

  // Try to find schema reference
  const schemaRefMatch = procedureText.match(/\.output\(\s*(\w+Schema|\w+Output)/);
  if (schemaRefMatch?.[1]) {
    return {
      schema: schemaRefMatch[1],
    };
  }

  // Check for z.array()
  const arrayMatch = procedureText.match(/\.output\(\s*z\.array\(\s*(\w+)/);
  if (arrayMatch?.[1]) {
    return {
      schema: `${arrayMatch[1]}[]`,
    };
  }

  // Inline schema
  if (procedureText.match(/\.output\(\s*z\.object/)) {
    return {
      schema: 'inline',
      fields: extractInlineZodFields(procedureText),
    };
  }

  return {
    schema: 'inferred',
  };
}

/**
 * Extract fields from inline z.object() definition
 */
function extractInlineZodFields(zodText: string): SchemaField[] {
  const fields: SchemaField[] = [];

  // Find z.object({ ... })
  const objectMatch = zodText.match(/z\.object\(\s*\{([^}]+)\}/);
  if (!objectMatch?.[1]) return fields;

  const objectContent = objectMatch[1];

  // Parse each field: fieldName: z.type().modifiers()
  const fieldRegex = /(\w+)\s*:\s*z\.(\w+)([^,}]*)/g;
  let match;

  while ((match = fieldRegex.exec(objectContent)) !== null) {
    const [, fieldName, zodType, modifiers] = match;
    if (!fieldName || !zodType) continue;

    const field = parseZodFieldChain(fieldName, zodType, modifiers || '');
    if (field) {
      fields.push(field);
    }
  }

  return fields;
}

/**
 * Parse Zod field chain (type + modifiers)
 */
function parseZodFieldChain(name: string, zodType: string, modifiers: string): SchemaField | null {
  let type = zodType;
  let required = true;
  const validations: string[] = [];
  let defaultValue: string | undefined;

  // Handle enum
  if (type === 'enum') {
    const enumMatch = modifiers.match(/\(\s*\[([^\]]+)\]/);
    if (enumMatch?.[1]) {
      const values = enumMatch[1]
        .split(',')
        .map((v) => v.trim().replace(/['"]/g, ''))
        .slice(0, 3);
      type = `enum(${values.join('|')})`;
    }
  }

  // Handle nativeEnum
  if (type === 'nativeEnum') {
    type = 'enum';
  }

  // Handle array
  if (type === 'array') {
    const arrayMatch = modifiers.match(/\(\s*z\.(\w+)/);
    if (arrayMatch?.[1]) {
      type = `${arrayMatch[1]}[]`;
    }
  }

  // Handle coerce
  if (type === 'coerce') {
    const coerceMatch = modifiers.match(/\.(\w+)/);
    if (coerceMatch?.[1]) {
      type = coerceMatch[1];
      validations.push('coerce');
    }
  }

  // Check for optional
  if (modifiers.includes('.optional()')) {
    required = false;
  }

  // Check for nullable
  if (modifiers.includes('.nullable()')) {
    validations.push('nullable');
  }

  // Extract default value
  const defaultMatch = modifiers.match(/\.default\(\s*(['"]?)([^'")\s]+)\1\s*\)/);
  if (defaultMatch?.[2]) {
    defaultValue = defaultMatch[2];
    required = false;
  }

  // Extract validations
  const minMatch = modifiers.match(/\.min\(\s*(\d+)\s*\)/);
  if (minMatch?.[1]) {
    validations.push(`min:${minMatch[1]}`);
  }

  const maxMatch = modifiers.match(/\.max\(\s*(\d+)\s*\)/);
  if (maxMatch?.[1]) {
    validations.push(`max:${maxMatch[1]}`);
  }

  if (modifiers.includes('.email()')) {
    validations.push('email');
  }

  if (modifiers.includes('.url()')) {
    validations.push('url');
  }

  if (modifiers.includes('.uuid()')) {
    validations.push('uuid');
  }

  if (modifiers.includes('.int()')) {
    validations.push('int');
  }

  if (modifiers.includes('.positive()')) {
    validations.push('positive');
  }

  const field: SchemaField = {
    name,
    type,
    required,
  };

  if (validations.length > 0) {
    field.validation = validations.join(', ');
  }

  if (defaultValue) {
    field.defaultValue = defaultValue;
  }

  return field;
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
 * Format API contracts as XML for AI context
 */
export function formatApiContractsXml(contracts: RouterContract[]): string {
  const lines: string[] = [
    '<api-contracts>',
    `  <summary>Found ${contracts.length} routers with ${contracts.reduce((sum, c) => sum + c.procedures.length, 0)} procedures</summary>`,
  ];

  for (const contract of contracts) {
    lines.push('');
    lines.push(`  <router name="${contract.name}" path="${contract.path}">`);

    if (contract.subRouters.length > 0) {
      lines.push(`    <sub-routers>${contract.subRouters.join(', ')}</sub-routers>`);
    }

    lines.push(`    <procedures count="${contract.procedures.length}">`);

    for (const proc of contract.procedures) {
      const attrs = [
        `name="${proc.name}"`,
        `type="${proc.type}"`,
        `protection="${proc.protection}"`,
      ];

      if (proc.rateLimit) {
        attrs.push(`rate-limit="${proc.rateLimit.bucket}"`);
      }

      lines.push(`      <procedure ${attrs.join(' ')}>`);

      // Input
      if (proc.input) {
        lines.push(`        <input schema="${proc.input.schema}">`);
        if (proc.input.fields.length > 0) {
          for (const field of proc.input.fields) {
            const fieldAttrs = [
              `name="${field.name}"`,
              `type="${field.type}"`,
              `required="${field.required}"`,
            ];
            if (field.validation) {
              fieldAttrs.push(`validation="${escapeXml(field.validation)}"`);
            }
            if (field.defaultValue) {
              fieldAttrs.push(`default="${escapeXml(field.defaultValue)}"`);
            }
            lines.push(`          <field ${fieldAttrs.join(' ')} />`);
          }
        }
        lines.push('        </input>');
      }

      // Output
      if (proc.output) {
        const outputAttrs = [`schema="${proc.output.schema}"`];
        if (proc.output.fields && proc.output.fields.length > 0) {
          lines.push(`        <output ${outputAttrs.join(' ')}>`);
          for (const field of proc.output.fields) {
            const fieldAttrs = [`name="${field.name}"`, `type="${field.type}"`];
            lines.push(`          <field ${fieldAttrs.join(' ')} />`);
          }
          lines.push('        </output>');
        } else {
          lines.push(`        <output ${outputAttrs.join(' ')} />`);
        }
      }

      lines.push('      </procedure>');
    }

    lines.push('    </procedures>');
    lines.push('  </router>');
  }

  lines.push('</api-contracts>');
  return lines.join('\n');
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
