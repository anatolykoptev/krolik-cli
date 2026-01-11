/**
 * @module cli/parsers/option-parser
 * @description Option parsing utilities for CLI commands
 */

/**
 * Parse integer option with fallback
 */
export function parseIntOption(value: unknown, defaultValue: number): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Parse comma-separated string to array
 */
export function parseStringArray(value: unknown, delimiter = ','): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(delimiter)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Parse mode from boolean flags
 */
export function parseMode<T extends string>(
  flags: Record<string, boolean | undefined>,
  modes: T[],
  defaultMode: T,
): T {
  for (const mode of modes) {
    if (flags[mode]) return mode;
  }
  return defaultMode;
}

/**
 * Parse output level from flags
 */
export function parseOutputLevel(flags: {
  summary?: boolean;
  full?: boolean;
  compact?: boolean;
}): 'summary' | 'compact' | 'default' | 'full' {
  if (flags.summary) return 'summary';
  if (flags.compact) return 'compact';
  if (flags.full) return 'full';
  return 'default';
}
