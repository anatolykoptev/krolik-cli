/**
 * @module mcp/tools/flag-builder
 * @description Type-safe flag building for CLI commands
 */

import { escapeShellArg } from '@/lib/@security';
import { sanitizeFeatureName, sanitizeIssueNumber } from './utils';

// ============================================================================
// TYPES
// ============================================================================

export type SanitizeType = 'feature' | 'issue' | 'none';

export interface FlagDef {
  flag: string;
  sanitize?: SanitizeType;
  required?: boolean;
  transform?: (val: unknown) => string | null;
  validate?: (val: unknown) => boolean;
}

export type FlagSchema = Record<string, FlagDef>;

export type BuildResult = { ok: true; flags: string } | { ok: false; error: string };

// ============================================================================
// BUILDER
// ============================================================================

/**
 * Build CLI flags from arguments using a schema
 *
 * @param args - Arguments to build flags from
 * @param schema - Flag schema definition
 * @returns Result with flags string or error
 *
 * @example
 * ```ts
 * const schema = {
 *   dryRun: { flag: '--dry-run' },
 *   path: { flag: '--path', sanitize: 'feature' },
 *   category: {
 *     flag: '--category',
 *     validate: (val) => ['lint', 'type-safety'].includes(String(val))
 *   }
 * };
 *
 * const result = buildFlags(args, schema);
 * if (!result.ok) return result.error;
 * return runKrolik(`fix ${result.flags}`, projectPath);
 * ```
 */
export function buildFlags(args: Record<string, unknown>, schema: FlagSchema): BuildResult {
  const parts: string[] = [];

  for (const [key, def] of Object.entries(schema)) {
    const val = args[key];

    // Skip undefined/null/false
    if (val === undefined || val === null || val === false) {
      if (def.required) {
        return { ok: false, error: `Missing required argument: ${key}` };
      }
      continue;
    }

    // Boolean flags (true -> --flag)
    if (val === true) {
      parts.push(def.flag);
      continue;
    }

    // String/number values
    let strVal = String(val);

    // Sanitization
    if (def.sanitize === 'feature') {
      const sanitized = sanitizeFeatureName(val);
      if (!sanitized) {
        return {
          ok: false,
          error: `Invalid ${key}: Only alphanumeric, hyphens, underscores, dots allowed.`,
        };
      }
      strVal = sanitized;
    } else if (def.sanitize === 'issue') {
      const sanitized = sanitizeIssueNumber(val);
      if (!sanitized) {
        return { ok: false, error: `Invalid ${key}: Must be a positive number.` };
      }
      strVal = String(sanitized);
    }

    // Custom transform
    if (def.transform) {
      const transformed = def.transform(val);
      if (transformed === null) {
        return { ok: false, error: `Invalid ${key}` };
      }
      strVal = transformed;
    }

    // Custom validation
    if (def.validate && !def.validate(val)) {
      return { ok: false, error: `Invalid ${key}` };
    }

    // Handle positional arguments (empty flag name)
    if (def.flag === '') {
      parts.push(escapeShellArg(strVal));
    } else {
      parts.push(`${def.flag}=${escapeShellArg(strVal)}`);
    }
  }

  return { ok: true, flags: parts.join(' ') };
}
