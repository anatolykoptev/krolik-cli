/**
 * @module commands/quality/analyzers/hardcoded
 * @description Detection of hardcoded values (magic numbers, URLs, colors, text)
 */

import type { HardcodedValue } from "../types";

const HTTP_PORT = 80;

// ============================================================================
// PATTERNS
// ============================================================================

const PATTERNS = {
  magicNumber: /(?<![.\w])(\d{2,}|[2-9]\d*)(?![.\w\]])/g,
  url: /(["'`])(https?:\/\/[^"'`\s]+)\1/g,
  hexColor: /#([0-9A-Fa-f]{3}){1,2}\b/g,
  hardcodedText: /["'`][А-Яа-яЁё][А-Яа-яЁё\s]{10,}["'`]/g,
};

const ACCEPTABLE_NUMBERS = new Set([10, 100, 1000, 24, 60, 1024, 2048]);

const SKIP_FILE_PATTERNS = [
  ".config.",
  "schema",
  ".test.",
  ".spec.",
  "__tests__",
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if file should be skipped
 */
function shouldSkipFile(filepath: string): boolean {
  return SKIP_FILE_PATTERNS.some((pattern) => filepath.includes(pattern));
}

/** Pattern for SCREAMING_SNAKE_CASE constant declarations */
const CONST_DECL_PATTERN = /^\s*(?:export\s+)?const\s+[A-Z][A-Z0-9_]*\s*=/;

/**
 * Check if line should be skipped
 */
function shouldSkipLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    line.includes("import ") ||
    line.includes("from ") ||
    line.includes(": number") ||
    line.includes(": string") ||
    // Skip constant declarations (SCREAMING_SNAKE_CASE = value)
    CONST_DECL_PATTERN.test(line)
  );
}

/**
 * Check if number should be skipped
 */
function shouldSkipNumber(line: string, num: number): boolean {
  return (
    ACCEPTABLE_NUMBERS.has(num) ||
    line.includes(`[${num}]`) ||
    line.includes("timeout") ||
    line.includes("delay")
  );
}

/**
 * Check if URL should be skipped
 */
function shouldSkipUrl(url: string): boolean {
  return (
    url.includes("schema.org") ||
    url.includes("json-schema") ||
    url.includes("github.com") ||
    url.includes("docs.")
  );
}

// ============================================================================
// INDIVIDUAL DETECTORS
// ============================================================================

/**
 * Detect magic numbers in a line
 */
function detectNumbers(line: string, lineNum: number): HardcodedValue[] {
  const values: HardcodedValue[] = [];
  // Strip trailing comments before matching
  const codeOnly = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
  const matches = codeOnly.matchAll(PATTERNS.magicNumber);

  for (const match of matches) {
    const num = parseInt(match[1] ?? "0", 10);
    if (shouldSkipNumber(line, num)) continue;

    values.push({
      value: num,
      type: "number",
      line: lineNum,
      context: line.trim().slice(0, HTTP_PORT),
    });
  }

  return values;
}

/**
 * Detect hardcoded URLs in a line
 */
function detectUrls(line: string, lineNum: number): HardcodedValue[] {
  const values: HardcodedValue[] = [];
  const matches = line.matchAll(PATTERNS.url);

  for (const match of matches) {
    const url = match[2] ?? "";
    if (shouldSkipUrl(url)) continue;

    values.push({
      value: url,
      type: "url",
      line: lineNum,
      context: line.trim().slice(0, HTTP_PORT),
    });
  }

  return values;
}

/**
 * Detect hardcoded hex colors in a line
 */
function detectColors(
  line: string,
  lineNum: number,
  filepath: string,
): HardcodedValue[] {
  // Skip tailwind config or CSS files
  if (filepath.includes("tailwind") || filepath.endsWith(".css")) {
    return [];
  }

  const values: HardcodedValue[] = [];
  const matches = line.matchAll(PATTERNS.hexColor);

  for (const match of matches) {
    values.push({
      value: match[0],
      type: "color",
      line: lineNum,
      context: line.trim().slice(0, HTTP_PORT),
    });
  }

  return values;
}

/**
 * Detect hardcoded Russian text (i18n issues)
 */
function detectText(
  line: string,
  lineNum: number,
  filepath: string,
): HardcodedValue[] {
  // Skip test or story files
  if (filepath.includes(".test.") || filepath.includes(".stories.")) {
    return [];
  }

  const values: HardcodedValue[] = [];
  const matches = line.matchAll(PATTERNS.hardcodedText);

  for (const match of matches) {
    values.push({
      value: match[0].slice(1, -1), // Remove quotes
      type: "string",
      line: lineNum,
      context: line.trim().slice(0, HTTP_PORT),
    });
  }

  return values;
}

/**
 * Process a single line for all hardcoded values
 */
function processLine(
  line: string,
  lineNum: number,
  filepath: string,
): HardcodedValue[] {
  if (shouldSkipLine(line)) {
    return [];
  }

  return [
    ...detectNumbers(line, lineNum),
    ...detectUrls(line, lineNum),
    ...detectColors(line, lineNum, filepath),
    ...detectText(line, lineNum, filepath),
  ];
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Detect hardcoded values in content
 */
export function detectHardcodedValues(
  content: string,
  filepath: string,
): HardcodedValue[] {
  if (shouldSkipFile(filepath)) {
    return [];
  }

  const lines = content.split("\n");
  const values: HardcodedValue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    values.push(...processLine(line, i + 1, filepath));
  }

  return values;
}
