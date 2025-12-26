/**
 * @module mcp/tools/core/errors
 * @description Standardized AI-friendly error system for MCP tools
 *
 * Provides structured, actionable errors in XML format for AI consumption.
 *
 * Error code ranges:
 * - E1xx: Project/path errors
 * - E2xx: Git errors
 * - E3xx: Database errors
 * - E4xx: API errors
 * - E5xx: Parse errors
 * - E6xx: Validation errors
 */

import { escapeXml } from './formatting';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Error definition in the catalog
 */
export interface ErrorDefinition {
  code: string;
  message: string;
  hint: string;
  recoverable: boolean;
}

/**
 * MCP Error with structured details
 */
export class MCPError extends Error {
  readonly code: string;
  readonly hint: string;
  readonly recoverable: boolean;
  readonly details: Record<string, unknown>;

  constructor(definition: ErrorDefinition, details?: Record<string, unknown>) {
    super(definition.message);
    this.name = 'MCPError';
    this.code = definition.code;
    this.hint = definition.hint;
    this.recoverable = definition.recoverable;
    this.details = details ?? {};
  }
}

// ============================================================================
// ERROR CATALOG
// ============================================================================

/**
 * Centralized error catalog for all MCP tools
 *
 * Error code ranges:
 * - E1xx: Project/path errors
 * - E2xx: Git errors
 * - E3xx: Database errors
 * - E4xx: API errors
 * - E5xx: Parse errors
 * - E6xx: Validation errors
 */
export const ERROR_CATALOG: Record<string, ErrorDefinition> = {
  // E1xx: Project/path errors
  E101: {
    code: 'E101',
    message: 'Project not found',
    hint: 'Specify a valid project with --project or run from project directory',
    recoverable: true,
  },
  E102: {
    code: 'E102',
    message: 'Path not accessible',
    hint: 'Check if the path exists and you have read permissions',
    recoverable: true,
  },
  E103: {
    code: 'E103',
    message: 'Multiple projects detected',
    hint: 'Specify which project to use with the project parameter',
    recoverable: true,
  },
  E104: {
    code: 'E104',
    message: 'No package.json found',
    hint: 'Ensure you are in a Node.js project directory',
    recoverable: true,
  },
  E105: {
    code: 'E105',
    message: 'Invalid project structure',
    hint: 'Project must have package.json or .git directory',
    recoverable: true,
  },

  // E2xx: Git errors
  E201: {
    code: 'E201',
    message: 'Not a git repository',
    hint: 'Initialize a git repo with `git init` or navigate to a git project',
    recoverable: true,
  },
  E202: {
    code: 'E202',
    message: 'No remote configured',
    hint: 'Add a remote with `git remote add origin <url>`',
    recoverable: true,
  },
  E203: {
    code: 'E203',
    message: 'No commits found',
    hint: 'Create an initial commit with `git commit -m "Initial commit"`',
    recoverable: true,
  },
  E204: {
    code: 'E204',
    message: 'Uncommitted changes exist',
    hint: 'Commit or stash changes before proceeding',
    recoverable: true,
  },
  E205: {
    code: 'E205',
    message: 'Branch not found',
    hint: 'Check available branches with `git branch -a`',
    recoverable: true,
  },

  // E3xx: Database errors
  E301: {
    code: 'E301',
    message: 'SQLite database error',
    hint: 'Check database file permissions or run migrations',
    recoverable: true,
  },
  E302: {
    code: 'E302',
    message: 'Migration failed',
    hint: 'Check migration files and database state',
    recoverable: true,
  },
  E303: {
    code: 'E303',
    message: 'Database connection failed',
    hint: 'Verify database file exists and is not locked',
    recoverable: true,
  },
  E304: {
    code: 'E304',
    message: 'Query execution failed',
    hint: 'Check query syntax and table schema',
    recoverable: true,
  },

  // E4xx: API errors
  E401: {
    code: 'E401',
    message: 'Rate limit exceeded',
    hint: 'Wait before retrying or reduce request frequency',
    recoverable: true,
  },
  E402: {
    code: 'E402',
    message: 'Authentication failed',
    hint: 'Check API credentials or re-authenticate',
    recoverable: true,
  },
  E403: {
    code: 'E403',
    message: 'API request failed',
    hint: 'Check network connection and API availability',
    recoverable: true,
  },
  E404: {
    code: 'E404',
    message: 'Resource not found',
    hint: 'Verify the resource exists and the URL is correct',
    recoverable: true,
  },
  E405: {
    code: 'E405',
    message: 'API timeout',
    hint: 'Try again or increase timeout settings',
    recoverable: true,
  },

  // E5xx: Parse errors
  E501: {
    code: 'E501',
    message: 'Invalid JSON',
    hint: 'Check JSON syntax for missing commas, brackets, or quotes',
    recoverable: true,
  },
  E502: {
    code: 'E502',
    message: 'Malformed YAML',
    hint: 'Check YAML indentation and syntax',
    recoverable: true,
  },
  E503: {
    code: 'E503',
    message: 'TypeScript parse error',
    hint: 'Check TypeScript syntax and imports',
    recoverable: true,
  },
  E504: {
    code: 'E504',
    message: 'Invalid schema',
    hint: 'Verify Prisma schema syntax',
    recoverable: true,
  },
  E505: {
    code: 'E505',
    message: 'Config file parse error',
    hint: 'Check configuration file format and syntax',
    recoverable: true,
  },

  // E6xx: Validation errors
  E601: {
    code: 'E601',
    message: 'Missing required field',
    hint: 'Provide all required parameters for this operation',
    recoverable: true,
  },
  E602: {
    code: 'E602',
    message: 'Invalid field value',
    hint: 'Check parameter types and allowed values',
    recoverable: true,
  },
  E603: {
    code: 'E603',
    message: 'Invalid input format',
    hint: 'Check input format matches expected pattern',
    recoverable: true,
  },
  E604: {
    code: 'E604',
    message: 'Value out of range',
    hint: 'Check value is within acceptable bounds',
    recoverable: true,
  },
  E605: {
    code: 'E605',
    message: 'Duplicate entry',
    hint: 'A record with this identifier already exists',
    recoverable: true,
  },
};

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format details object as XML elements
 */
function formatDetails(details: Record<string, unknown>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(details)) {
    if (value === undefined || value === null) continue;

    const stringValue = Array.isArray(value)
      ? value.map((v) => String(v)).join(', ')
      : String(value);

    lines.push(`    <${escapeXml(key)}>${escapeXml(stringValue)}</${escapeXml(key)}>`);
  }

  return lines.join('\n');
}

/**
 * Format an MCP error as XML for AI consumption
 *
 * @param code - Error code (e.g., 'E101')
 * @param details - Optional additional context
 * @returns XML-formatted error string
 *
 * @example
 * formatMCPError('E101', { requested: 'foo-project', available: ['bar', 'baz'] })
 * // Returns:
 * // <error code="E101" recoverable="true">
 * //   <message>Project not found</message>
 * //   <hint>Specify a valid project with --project or run from project directory</hint>
 * //   <details>
 * //     <requested>foo-project</requested>
 * //     <available>bar, baz</available>
 * //   </details>
 * // </error>
 */
export function formatMCPError(code: string, details?: Record<string, unknown>): string {
  const definition = ERROR_CATALOG[code];

  if (!definition) {
    // Unknown error code - create generic error
    return [
      `<error code="${escapeXml(code)}" recoverable="false">`,
      `  <message>Unknown error code: ${escapeXml(code)}</message>`,
      '  <hint>This error code is not defined in the error catalog</hint>',
      '</error>',
    ].join('\n');
  }

  const lines: string[] = [
    `<error code="${escapeXml(definition.code)}" recoverable="${definition.recoverable}">`,
    `  <message>${escapeXml(definition.message)}</message>`,
    `  <hint>${escapeXml(definition.hint)}</hint>`,
  ];

  if (details && Object.keys(details).length > 0) {
    const formattedDetails = formatDetails(details);
    if (formattedDetails) {
      lines.push('  <details>');
      lines.push(formattedDetails);
      lines.push('  </details>');
    }
  }

  lines.push('</error>');
  return lines.join('\n');
}

/**
 * Create an MCPError from a catalog code
 *
 * @param code - Error code (e.g., 'E101')
 * @param details - Optional additional context
 * @returns MCPError instance
 * @throws Error if code is not in catalog
 *
 * @example
 * throw createError('E101', { requested: 'my-project' });
 */
export function createError(code: string, details?: Record<string, unknown>): MCPError {
  const definition = ERROR_CATALOG[code];

  if (!definition) {
    throw new Error(`Unknown error code: ${code}`);
  }

  return new MCPError(definition, details);
}

/**
 * Check if an error is an MCPError
 */
export function isMCPError(error: unknown): error is MCPError {
  return error instanceof MCPError;
}

/**
 * Format any error as XML, handling both MCPError and regular errors
 *
 * @param error - Error to format (MCPError or regular Error)
 * @returns XML-formatted error string
 */
export function formatError(error: unknown): string {
  if (isMCPError(error)) {
    return formatMCPError(error.code, error.details);
  }

  if (error instanceof Error) {
    // Wrap regular errors as generic error
    return [
      '<error code="E000" recoverable="false">',
      `  <message>${escapeXml(error.message)}</message>`,
      '  <hint>An unexpected error occurred</hint>',
      `  <details>`,
      `    <type>${escapeXml(error.name)}</type>`,
      `  </details>`,
      '</error>',
    ].join('\n');
  }

  // Unknown error type
  return [
    '<error code="E000" recoverable="false">',
    `  <message>${escapeXml(String(error))}</message>`,
    '  <hint>An unexpected error occurred</hint>',
    '</error>',
  ].join('\n');
}
