/**
 * @module lib/@format/frontmatter
 * @description Frontmatter parsing utilities for markdown files
 */

/**
 * Result of parsing frontmatter
 */
export interface FrontmatterResult {
  /** Parsed frontmatter data */
  data: Record<string, unknown>;
  /** Content after frontmatter */
  body: string;
  /** Raw frontmatter string */
  raw: string;
}

/**
 * Common frontmatter fields
 */
export interface CommonFrontmatter {
  name?: string;
  description?: string;
  model?: string;
  [key: string]: unknown;
}

/**
 * Parse YAML-like frontmatter from markdown content
 */
export function parseFrontmatter(content: string): FrontmatterResult {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    return {
      data: {},
      body: content,
      raw: '',
    };
  }

  const raw = match[1] ?? '';
  const body = match[2] ?? '';
  const data: Record<string, unknown> = {};

  for (const line of raw.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value: unknown = line.slice(colonIndex + 1).trim();

      // Parse simple types
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10);

      data[key] = value;
    }
  }

  return { data, body, raw };
}

/**
 * Parse frontmatter with common fields
 */
export function parseCommonFrontmatter(content: string): {
  frontmatter: CommonFrontmatter;
  body: string;
} {
  const result = parseFrontmatter(content);
  return {
    frontmatter: result.data as CommonFrontmatter,
    body: result.body,
  };
}

/**
 * Get a specific frontmatter value
 */
export function getFrontmatterValue<T>(content: string, key: string): T | undefined {
  const { data } = parseFrontmatter(content);
  return data[key] as T | undefined;
}

/**
 * Check if content has frontmatter
 */
export function hasFrontmatter(content: string): boolean {
  return /^---\n[\s\S]*?\n---\n/.test(content);
}

/**
 * Strip frontmatter and return only body
 */
export function stripFrontmatter(content: string): string {
  return parseFrontmatter(content).body;
}

/**
 * Create frontmatter string from data
 */
export function createFrontmatter(data: Record<string, unknown>): string {
  const lines = ['---'];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      lines.push(`${key}: ${String(value)}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}
