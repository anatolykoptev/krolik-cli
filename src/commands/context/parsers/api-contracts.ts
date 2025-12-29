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
import { scanDirectory } from '@/lib/@core/fs';

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

  scanDirectory(
    routersDir,
    (fullPath) => {
      const relativePath = path.relative(routersDir, fullPath);

      // Skip index and _app files
      const fileName = path.basename(fullPath);
      if (fileName === 'index.ts' || fileName === '_app.ts') return;

      const contract = parseRouterFile(fullPath, relativePath);
      if (contract) {
        // Always include routers, even if they have no procedures yet (might be parsing issue)
        contracts.push(contract);
      }
    },
    {
      patterns,
      extensions: ['.ts'],
      includeTests: false,
    },
  );

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

  const matchIndex = routerCallMatch.index;
  if (matchIndex === undefined) {
    return {
      name: routerName,
      path: relativePath,
      procedures,
      subRouters,
    };
  }
  const startIdx = matchIndex + routerCallMatch[0].length - 1;

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
  let match: RegExpExecArray | null;

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
 * State for tracking string parsing
 */
interface StringState {
  inString: boolean;
  stringChar: string;
}

/**
 * Update string tracking state based on current character
 */
function updateStringState(char: string, prevChar: string, state: StringState): StringState {
  if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
    if (!state.inString) {
      return { inString: true, stringChar: char };
    } else if (char === state.stringChar) {
      return { inString: false, stringChar: '' };
    }
  }
  return state;
}

/**
 * Depth tracking state for parsing
 */
interface DepthState {
  paren: number;
  brace: number;
}

/**
 * Update depth tracking based on character
 */
function updateDepthState(char: string, state: DepthState): DepthState {
  const parenDelta = char === '(' ? 1 : char === ')' ? -1 : 0;
  const braceDelta = char === '{' ? 1 : char === '}' ? -1 : 0;
  return {
    paren: state.paren + parenDelta,
    brace: state.brace + braceDelta,
  };
}

/**
 * Check if we've reached the end of a procedure value
 */
function isEndOfProcedureValue(char: string, depth: DepthState): boolean {
  return depth.paren === 0 && depth.brace === 0 && (char === ',' || char === '}');
}

/**
 * Extract procedure value from router body starting at given index
 * Handles nested parens, braces, and strings
 */
function extractProcedureValue(text: string, startIdx: number): string | null {
  let endIdx = startIdx;
  let depthState: DepthState = { paren: 0, brace: 0 };
  let stringState: StringState = { inString: false, stringChar: '' };

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i] ?? '';
    const prevChar = i > 0 ? (text[i - 1] ?? '') : '';

    stringState = updateStringState(char, prevChar, stringState);
    if (stringState.inString) continue;

    depthState = updateDepthState(char, depthState);

    if (isEndOfProcedureValue(char, depthState)) {
      endIdx = i;
      break;
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
  let match: RegExpExecArray | null;

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
 * Resolve Zod type from type name and modifiers
 */
function resolveZodType(zodType: string, modifiers: string, validations: string[]): string {
  let type = zodType;

  if (type === 'enum') {
    const enumMatch = modifiers.match(/\(\s*\[([^\]]+)\]/);
    if (enumMatch?.[1]) {
      const values = enumMatch[1]
        .split(',')
        .map((v) => v.trim().replace(/['"]/g, ''))
        .slice(0, 3);
      type = `enum(${values.join('|')})`;
    }
  } else if (type === 'nativeEnum') {
    type = 'enum';
  } else if (type === 'array') {
    const arrayMatch = modifiers.match(/\(\s*z\.(\w+)/);
    if (arrayMatch?.[1]) {
      type = `${arrayMatch[1]}[]`;
    }
  } else if (type === 'coerce') {
    const coerceMatch = modifiers.match(/\.(\w+)/);
    if (coerceMatch?.[1]) {
      type = coerceMatch[1];
      validations.push('coerce');
    }
  }

  return type;
}

/**
 * Extract validations from Zod modifiers
 */
function extractZodValidations(modifiers: string): string[] {
  const validations: string[] = [];

  if (modifiers.includes('.nullable()')) {
    validations.push('nullable');
  }

  const minMatch = modifiers.match(/\.min\(\s*(\d+)\s*\)/);
  if (minMatch?.[1]) {
    validations.push(`min:${minMatch[1]}`);
  }

  const maxMatch = modifiers.match(/\.max\(\s*(\d+)\s*\)/);
  if (maxMatch?.[1]) {
    validations.push(`max:${maxMatch[1]}`);
  }

  const simpleValidators = ['email', 'url', 'uuid', 'int', 'positive'];
  for (const validator of simpleValidators) {
    if (modifiers.includes(`.${validator}()`)) {
      validations.push(validator);
    }
  }

  return validations;
}

/**
 * Parse Zod field chain (type + modifiers)
 */
function parseZodFieldChain(name: string, zodType: string, modifiers: string): SchemaField | null {
  const validations = extractZodValidations(modifiers);
  const type = resolveZodType(zodType, modifiers, validations);

  let required = true;
  let defaultValue: string | undefined;

  if (modifiers.includes('.optional()')) {
    required = false;
  }

  const defaultMatch = modifiers.match(/\.default\(\s*(['"]?)([^'")\s]+)\1\s*\)/);
  if (defaultMatch?.[2]) {
    defaultValue = defaultMatch[2];
    required = false;
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
 * Format input contract as XML lines
 */
function formatInputXml(input: InputContract): string[] {
  const lines: string[] = [];
  lines.push(`        <input schema="${input.schema}">`);
  for (const field of input.fields) {
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
  lines.push('        </input>');
  return lines;
}

/**
 * Format output contract as XML lines
 */
function formatOutputXml(output: OutputContract): string[] {
  const lines: string[] = [];
  const outputAttrs = [`schema="${output.schema}"`];
  if (output.fields && output.fields.length > 0) {
    lines.push(`        <output ${outputAttrs.join(' ')}>`);
    for (const field of output.fields) {
      const fieldAttrs = [`name="${field.name}"`, `type="${field.type}"`];
      lines.push(`          <field ${fieldAttrs.join(' ')} />`);
    }
    lines.push('        </output>');
  } else {
    lines.push(`        <output ${outputAttrs.join(' ')} />`);
  }
  return lines;
}

/**
 * Format procedure as XML lines
 */
function formatProcedureXml(proc: ProcedureContract): string[] {
  const lines: string[] = [];
  const attrs = [`name="${proc.name}"`, `type="${proc.type}"`, `protection="${proc.protection}"`];

  if (proc.rateLimit) {
    attrs.push(`rate-limit="${proc.rateLimit.bucket}"`);
  }

  lines.push(`      <procedure ${attrs.join(' ')}>`);

  if (proc.input) {
    lines.push(...formatInputXml(proc.input));
  }

  if (proc.output) {
    lines.push(...formatOutputXml(proc.output));
  }

  lines.push('      </procedure>');
  return lines;
}

/**
 * Format API contracts as XML for AI context
 */
export function formatApiContractsXml(contracts: RouterContract[]): string {
  const totalProcedures = contracts.reduce((sum, c) => sum + c.procedures.length, 0);
  const lines: string[] = [
    '<api-contracts>',
    `  <summary>Found ${contracts.length} routers with ${totalProcedures} procedures</summary>`,
  ];

  for (const contract of contracts) {
    lines.push('');
    lines.push(`  <router name="${contract.name}" path="${contract.path}">`);

    if (contract.subRouters.length > 0) {
      lines.push(`    <sub-routers>${contract.subRouters.join(', ')}</sub-routers>`);
    }

    lines.push(`    <procedures count="${contract.procedures.length}">`);

    for (const proc of contract.procedures) {
      lines.push(...formatProcedureXml(proc));
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
