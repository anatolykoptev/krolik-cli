/**
 * @module commands/fix/strategies/hardcoded
 * @description AST-based fix strategies for hardcoded values
 *
 * Uses ts-morph for safe code transformations:
 * - Magic numbers → Named constants
 * - URLs → Config constants
 *
 * Smart features:
 * - Extracts context from AST (property names, variable names)
 * - Skips numbers in const object literals (intentional mappings)
 * - Generates meaningful constant names from context
 */

import { Project, SyntaxKind, SourceFile, NumericLiteral } from 'ts-morph';
import * as prettier from 'prettier';
import type { QualityIssue } from '../../quality/types';
import type { FixOperation, FixStrategy } from '../types';

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format code with Prettier using project config or sensible defaults
 */
async function formatWithPrettier(code: string, filepath: string): Promise<string> {
  try {
    // Try to resolve config from project
    const config = await prettier.resolveConfig(filepath);

    return await prettier.format(code, {
      ...config,
      filepath, // Let prettier infer parser from extension
    });
  } catch {
    // If formatting fails, return original code
    return code;
  }
}

// ============================================================================
// PATTERNS
// ============================================================================

const FIXABLE_PATTERNS = {
  NUMBER: /hardcoded\s+number:\s*(\d+)/i,
  URL: /hardcoded\s+url:\s*(https?:\/\/[^\s]+)/i,
  COLOR: /hardcoded\s+color/i,
  TEXT: /hardcoded\s+string/i,
};

// Numbers that are typically intentional, not magic
const ALLOWED_NUMBERS = new Set([
  0, 1, 2, -1,  // Common indices/increments
  10, 100, 1000, // Common bases
  24, 60, 365,   // Time units
  1024, 2048,    // Binary sizes
]);

// ============================================================================
// KNOWN CONSTANTS MAPPING
// ============================================================================

/**
 * Well-known values that have standard names
 * Priority 0 - highest priority in generateConstName
 */
const KNOWN_CONSTANTS: Record<number, string> = {
  // HTTP Status Codes - 2xx Success
  200: 'HTTP_OK',
  201: 'HTTP_CREATED',
  204: 'HTTP_NO_CONTENT',

  // HTTP Status Codes - 3xx Redirection
  301: 'HTTP_MOVED_PERMANENTLY',
  302: 'HTTP_FOUND',
  304: 'HTTP_NOT_MODIFIED',

  // HTTP Status Codes - 4xx Client Errors
  400: 'HTTP_BAD_REQUEST',
  401: 'HTTP_UNAUTHORIZED',
  403: 'HTTP_FORBIDDEN',
  404: 'HTTP_NOT_FOUND',
  405: 'HTTP_METHOD_NOT_ALLOWED',
  409: 'HTTP_CONFLICT',
  422: 'HTTP_UNPROCESSABLE_ENTITY',
  429: 'HTTP_TOO_MANY_REQUESTS',

  // HTTP Status Codes - 5xx Server Errors
  500: 'HTTP_INTERNAL_SERVER_ERROR',
  502: 'HTTP_BAD_GATEWAY',
  503: 'HTTP_SERVICE_UNAVAILABLE',
  504: 'HTTP_GATEWAY_TIMEOUT',

  // Note: Log levels (0-5) intentionally omitted - too ambiguous
  // (could be array indices, enum values, etc.)

  // Common Ports
  80: 'HTTP_PORT',
  443: 'HTTPS_PORT',
  3000: 'DEV_PORT',
  3001: 'DEV_PORT_ALT',
  5432: 'POSTGRES_PORT',
  6379: 'REDIS_PORT',
  8080: 'PROXY_PORT',
  8443: 'HTTPS_ALT_PORT',
  27017: 'MONGODB_PORT',

  // Common Timeouts (ms)
  5000: 'TIMEOUT_5S',
  10000: 'TIMEOUT_10S',
  30000: 'TIMEOUT_30S',
  60000: 'TIMEOUT_60S',

  // File sizes (bytes)
  1048576: 'ONE_MEGABYTE',
  5242880: 'FIVE_MEGABYTES',
  10485760: 'TEN_MEGABYTES',

  // Pagination
  20: 'DEFAULT_PAGE_SIZE',
  50: 'MAX_PAGE_SIZE',
};

// ============================================================================
// CONSTANT NAME GENERATION
// ============================================================================

/**
 * Keywords that suggest specific constant names
 */
const KEYWORD_TO_NAME: Record<string, string> = {
  // Time-related
  timeout: 'TIMEOUT_MS',
  delay: 'DELAY_MS',
  interval: 'INTERVAL_MS',
  duration: 'DURATION_MS',
  debounce: 'DEBOUNCE_MS',
  throttle: 'THROTTLE_MS',
  // Size-related
  width: 'DEFAULT_WIDTH',
  height: 'DEFAULT_HEIGHT',
  size: 'MAX_SIZE',
  length: 'MAX_LENGTH',
  limit: 'MAX_LIMIT',
  max: 'MAX_VALUE',
  min: 'MIN_VALUE',
  // Count-related
  count: 'DEFAULT_COUNT',
  total: 'TOTAL_COUNT',
  page: 'PAGE_SIZE',
  retry: 'MAX_RETRIES',
  attempt: 'MAX_ATTEMPTS',
  // Position
  index: 'DEFAULT_INDEX',
  offset: 'DEFAULT_OFFSET',
  // Network
  port: 'DEFAULT_PORT',
  threshold: 'THRESHOLD',
  // Status codes
  status: 'STATUS_CODE',
  code: 'ERROR_CODE',
};

/**
 * Convert camelCase or snake_case to SCREAMING_SNAKE_CASE
 */
function toScreamingSnake(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]/g, '_')
    .toUpperCase();
}

/**
 * Extract context from AST node for better constant naming
 */
function extractASTContext(node: NumericLiteral): string | null {
  const parent = node.getParent();
  if (!parent) return null;

  // Case 1: Property assignment - `{ foo: 42 }` → extract "foo"
  if (parent.getKind() === SyntaxKind.PropertyAssignment) {
    const propAssign = parent.asKind(SyntaxKind.PropertyAssignment);
    if (propAssign) {
      return propAssign.getName();
    }
  }

  // Case 2: Variable declaration - `const foo = 42` → extract "foo"
  if (parent.getKind() === SyntaxKind.VariableDeclaration) {
    const varDecl = parent.asKind(SyntaxKind.VariableDeclaration);
    if (varDecl) {
      return varDecl.getName();
    }
  }

  // Case 3: Function argument - look for parameter name
  if (parent.getKind() === SyntaxKind.CallExpression) {
    const call = parent.asKind(SyntaxKind.CallExpression);
    if (call) {
      const args = call.getArguments();
      const argIndex = args.findIndex(arg => arg === node);
      // Try to get function signature for param names (complex, skip for now)
      const funcName = call.getExpression().getText();
      if (funcName && argIndex >= 0) {
        return `${funcName}_arg${argIndex}`;
      }
    }
  }

  // Case 4: Binary expression - `x > 42` → extract "x" comparison
  if (parent.getKind() === SyntaxKind.BinaryExpression) {
    const binary = parent.asKind(SyntaxKind.BinaryExpression);
    if (binary) {
      const left = binary.getLeft();
      if (left.getKind() === SyntaxKind.Identifier) {
        return left.getText();
      }
    }
  }

  // Case 5: Array element - skip, no good context
  if (parent.getKind() === SyntaxKind.ArrayLiteralExpression) {
    return null;
  }

  return null;
}

/**
 * Generate a meaningful constant name from context
 *
 * Priority order:
 * 0. Known constants (HTTP codes, log levels, ports)
 * 1. Keyword matching from snippet/message
 * 2. AST context (property/variable names)
 * 3. Heuristic based on value
 */
function generateConstName(value: number, context: string, astContext: string | null): string {
  // Priority 0: Known constants (HTTP codes, log levels, ports, etc.)
  const knownName = KNOWN_CONSTANTS[value];
  if (knownName) {
    return knownName;
  }

  const lower = context.toLowerCase();

  // Priority 1: Keyword matching from snippet/message (most semantic)
  for (const [keyword, name] of Object.entries(KEYWORD_TO_NAME)) {
    if (lower.includes(keyword)) {
      return name;
    }
  }

  // Priority 2: AST context (if no keyword match)
  if (astContext) {
    // Skip generic names like "runKrolik_arg2"
    if (!/^.+_arg\d+$/.test(astContext)) {
      const upper = toScreamingSnake(astContext);
      // Avoid duplicating "VALUE" suffix
      if (upper.endsWith('_VALUE') || upper.endsWith('_COUNT') || upper.endsWith('_SIZE')) {
        return upper;
      }
      return `${upper}_VALUE`;
    }
  }

  // Priority 3: Heuristic based on value
  // Large values (>=1000) in function args are often timeouts
  if (value >= 1000 && value <= 300000) {
    return `TIMEOUT_MS_${value}`;
  }
  if (value >= 1000) {
    return `LARGE_VALUE_${value}`;
  }

  return `MAGIC_${value}`;
}

// ============================================================================
// AST UTILITIES
// ============================================================================

/**
 * Create a ts-morph project for code manipulation
 */
function createProject(): Project {
  return new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
    },
  });
}

/**
 * Find the optimal insertion point for constants
 * After imports, before first executable code or hooks
 */
function findInsertionPoint(sourceFile: SourceFile): number {
  const statements = sourceFile.getStatements();
  let insertPos = 0;

  for (const stmt of statements) {
    // Skip imports
    if (stmt.getKind() === SyntaxKind.ImportDeclaration) {
      insertPos = stmt.getEnd() + 1;
      continue;
    }

    // Skip type declarations (interface, type, enum)
    const kind = stmt.getKind();
    if (
      kind === SyntaxKind.InterfaceDeclaration ||
      kind === SyntaxKind.TypeAliasDeclaration ||
      kind === SyntaxKind.EnumDeclaration
    ) {
      insertPos = stmt.getEnd() + 1;
      continue;
    }

    // Found first executable code - insert before it
    break;
  }

  return insertPos;
}

/**
 * Check if a numeric literal is inside a type definition
 */
function isInsideTypeDefinition(node: NumericLiteral): boolean {
  let parent = node.getParent();
  while (parent) {
    const kind = parent.getKind();
    if (
      kind === SyntaxKind.InterfaceDeclaration ||
      kind === SyntaxKind.TypeAliasDeclaration ||
      kind === SyntaxKind.EnumDeclaration ||
      kind === SyntaxKind.PropertySignature
    ) {
      return true;
    }
    parent = parent.getParent();
  }
  return false;
}

/**
 * Check if a numeric literal is inside a string template
 */
function isInsideString(node: NumericLiteral): boolean {
  let parent = node.getParent();
  while (parent) {
    const kind = parent.getKind();
    if (
      kind === SyntaxKind.TemplateExpression ||
      kind === SyntaxKind.StringLiteral
    ) {
      return true;
    }
    parent = parent.getParent();
  }
  return false;
}

/**
 * Check if a numeric literal is inside a const object literal (mapping/lookup)
 * Examples: `const LOG_LEVELS = { error: 3 }` - these are intentional
 */
function isInsideConstObjectLiteral(node: NumericLiteral): boolean {
  let parent = node.getParent();
  let foundObjectLiteral = false;

  while (parent) {
    const kind = parent.getKind();

    // Track if we're inside an object literal
    if (kind === SyntaxKind.ObjectLiteralExpression) {
      foundObjectLiteral = true;
    }

    // If we find a const variable declaration containing an object literal
    if (kind === SyntaxKind.VariableDeclaration && foundObjectLiteral) {
      const varDecl = parent.asKind(SyntaxKind.VariableDeclaration);
      if (varDecl) {
        // Check if it's a SCREAMING_SNAKE_CASE or PascalCase const (likely a mapping)
        const name = varDecl.getName();
        if (name === name.toUpperCase() || /^[A-Z][a-zA-Z]*$/.test(name)) {
          return true;
        }
      }
    }

    // If we hit a VariableStatement with const keyword and object literal
    if (kind === SyntaxKind.VariableStatement && foundObjectLiteral) {
      const varStmt = parent.asKind(SyntaxKind.VariableStatement);
      if (varStmt) {
        const declList = varStmt.getDeclarationList();
        if (declList.getFlags() & 2 /* ConstKeyword */) {
          return true;
        }
      }
    }

    parent = parent.getParent();
  }
  return false;
}

/**
 * Check if a numeric literal is inside a const declaration with given name
 * (to avoid replacing the value in `const FOO = 42;` with `const FOO = FOO;`)
 */
function isInsideConstDeclaration(node: NumericLiteral, constName: string): boolean {
  let parent = node.getParent();
  while (parent) {
    if (parent.getKind() === SyntaxKind.VariableDeclaration) {
      const varDecl = parent.asKind(SyntaxKind.VariableDeclaration);
      if (varDecl && varDecl.getName() === constName) {
        return true;
      }
    }
    parent = parent.getParent();
  }
  return false;
}

/**
 * Check if number looks like a timestamp or date component
 */
function looksLikeTimestamp(value: number): boolean {
  // Unix timestamp range (roughly 2000-2050)
  if (value > 946684800000 && value < 2524608000000) return true;
  // Year values
  if (value >= 1970 && value <= 2100) return true;
  // Month/day values in date context handled by ALLOWED_NUMBERS
  return false;
}

// ============================================================================
// STRATEGY
// ============================================================================

export const hardcodedStrategy: FixStrategy = {
  categories: ['hardcoded'],

  canFix(issue: QualityIssue, _content: string): boolean {
    const { message } = issue;

    if (FIXABLE_PATTERNS.NUMBER.test(message)) {
      const match = message.match(/(\d+)/);
      const value = match ? parseInt(match[1] || '0', 10) : 0;

      // Skip commonly acceptable numbers
      if (ALLOWED_NUMBERS.has(value)) return false;

      // Skip timestamps
      if (looksLikeTimestamp(value)) return false;

      // We CAN fix status codes - they should be constants
      // We CAN fix port numbers - they should be config

      return true;
    }

    if (FIXABLE_PATTERNS.URL.test(message)) {
      return true;
    }

    // Colors and text need theme/i18n systems
    return false;
  },

  async generateFix(issue: QualityIssue, content: string): Promise<FixOperation | null> {
    const { message, file, snippet } = issue;

    if (FIXABLE_PATTERNS.NUMBER.test(message)) {
      return generateNumberFixAST(content, file, message, snippet);
    }

    if (FIXABLE_PATTERNS.URL.test(message)) {
      return generateUrlFix(content, file, snippet);
    }

    return null;
  },
};

// ============================================================================
// AST-BASED FIX GENERATORS
// ============================================================================

/**
 * Extract magic number into a named constant using AST
 *
 * Improvements:
 * - Uses AST context for better constant names
 * - Skips numbers in const object literals (intentional mappings)
 * - Smart filtering of false positives
 */
async function generateNumberFixAST(
  content: string,
  file: string,
  message: string,
  snippet: string | undefined,
): Promise<FixOperation | null> {
  // Extract the target value
  const match = message.match(/(\d+)/);
  if (!match) return null;
  const targetValue = parseInt(match[1] || '0', 10);

  // Skip allowed numbers
  if (ALLOWED_NUMBERS.has(targetValue)) return null;

  try {
    const project = createProject();
    const sourceFile = project.createSourceFile('temp.ts', content);

    // Find ALL numeric literals with this value that are safe to replace
    const candidates = sourceFile
      .getDescendantsOfKind(SyntaxKind.NumericLiteral)
      .filter(n => {
        const value = n.getLiteralValue();
        return (
          value === targetValue &&
          !isInsideTypeDefinition(n) &&
          !isInsideString(n) &&
          !isInsideConstObjectLiteral(n) // NEW: Skip const object mappings
        );
      });

    if (candidates.length === 0) return null;

    // Extract AST context from first candidate for better naming
    const astContext = extractASTContext(candidates[0]!);

    // Generate constant name from context
    const context = snippet || message;
    const constName = generateConstName(targetValue, context, astContext);

    // Check if constant already exists
    const existingConst = sourceFile
      .getVariableDeclarations()
      .find(v => v.getName() === constName);

    if (!existingConst) {
      // Find insertion point and add constant
      const insertPos = findInsertionPoint(sourceFile);
      const constDecl = `\nconst ${constName} = ${targetValue};\n`;
      sourceFile.insertText(insertPos, constDecl);
    }

    // After insertion, re-find candidates (positions have changed)
    // Replace FIRST matching literal only (safe approach)
    // IMPORTANT: Skip the literal inside the const declaration we just created!
    const updatedCandidates = sourceFile
      .getDescendantsOfKind(SyntaxKind.NumericLiteral)
      .filter(n => {
        const value = n.getLiteralValue();
        return (
          value === targetValue &&
          !isInsideTypeDefinition(n) &&
          !isInsideString(n) &&
          !isInsideConstObjectLiteral(n) &&
          !isInsideConstDeclaration(n, constName)
        );
      });

    // Replace first candidate (safe, single replacement per issue)
    if (updatedCandidates.length > 0) {
      updatedCandidates[0]?.replaceWithText(constName);
    }

    const newContent = sourceFile.getFullText();

    // Format with Prettier for clean output
    const formattedContent = await formatWithPrettier(newContent, file);

    return {
      action: 'replace-range',
      file,
      line: 1,
      endLine: content.split('\n').length,
      oldCode: content,
      newCode: formattedContent,
    };
  } catch {
    // AST parsing failed - skip this fix
    return null;
  }
}

/**
 * Extract URL into a named constant
 */
async function generateUrlFix(
  content: string,
  file: string,
  snippet: string | undefined,
): Promise<FixOperation | null> {
  if (!snippet) return null;

  const urlMatch = snippet.match(/(["'`])(https?:\/\/[^"'`\s]+)\1/);
  if (!urlMatch) return null;

  const url = urlMatch[2] || '';
  const quote = urlMatch[1] || '"';

  // Generate constant name from URL
  let constName = 'API_URL';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname
      .replace(/^www\./, '')
      .replace(/\./g, '_')
      .toUpperCase();

    // Add path hint if meaningful
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0 && pathParts[0] !== 'api') {
      constName = `${host}_${pathParts[0]!.toUpperCase()}_URL`;
    } else {
      constName = `${host}_URL`;
    }
  } catch {
    // Keep default
  }

  try {
    const project = createProject();
    const sourceFile = project.createSourceFile('temp.ts', content);

    // Check if constant exists
    const existingConst = sourceFile
      .getVariableDeclarations()
      .find(v => v.getName() === constName);

    if (!existingConst) {
      const insertPos = findInsertionPoint(sourceFile);
      const constDecl = `\nconst ${constName} = ${quote}${url}${quote};\n`;
      sourceFile.insertText(insertPos, constDecl);
    }

    // Find and replace the URL string
    const stringLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral);
    for (const literal of stringLiterals) {
      if (literal.getLiteralValue() === url) {
        literal.replaceWithText(constName);
        break;
      }
    }

    // Format with Prettier for clean output
    const formattedContent = await formatWithPrettier(sourceFile.getFullText(), file);

    return {
      action: 'replace-range',
      file,
      line: 1,
      endLine: content.split('\n').length,
      oldCode: content,
      newCode: formattedContent,
    };
  } catch {
    return null;
  }
}
