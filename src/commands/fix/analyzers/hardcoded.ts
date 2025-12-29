import {
  DETECTION_PATTERNS,
  isAcceptableNumber,
  shouldSkipFile,
  shouldSkipLine,
  shouldSkipUrl,
} from '../../../lib/@detectors/hardcoded/index';
import type { HardcodedValue } from '../types';

const MAX_CONTEXT_LENGTH = 80;

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
  const matches = codeOnly.matchAll(DETECTION_PATTERNS.magicNumber);

  for (const match of matches) {
    const num = parseInt(match[1] ?? '0', 10);

    // Skip acceptable numbers and array indices
    if (isAcceptableNumber(num)) continue;
    if (line.includes(`[${num}]`)) continue;
    if (line.includes('timeout') || line.includes('delay')) continue;

    values.push({
      value: num,
      type: 'number',
      line: lineNum,
      context: line.trim().slice(0, MAX_CONTEXT_LENGTH),
    });
  }

  return values;
}

/**
 * Detect hardcoded URLs in a line
 */
function detectUrls(line: string, lineNum: number): HardcodedValue[] {
  const values: HardcodedValue[] = [];
  const matches = line.matchAll(DETECTION_PATTERNS.url);

  for (const match of matches) {
    const url = match[2] ?? '';
    if (shouldSkipUrl(url)) continue;

    values.push({
      value: url,
      type: 'url',
      line: lineNum,
      context: line.trim().slice(0, MAX_CONTEXT_LENGTH),
    });
  }

  return values;
}

/**
 * Detect hardcoded hex colors in a line
 */
function detectColors(line: string, lineNum: number, filepath: string): HardcodedValue[] {
  // Skip tailwind config or CSS files
  if (filepath.includes('tailwind') || filepath.endsWith('.css')) {
    return [];
  }

  const values: HardcodedValue[] = [];
  const matches = line.matchAll(DETECTION_PATTERNS.hexColor);

  for (const match of matches) {
    values.push({
      value: match[0],
      type: 'color',
      line: lineNum,
      context: line.trim().slice(0, MAX_CONTEXT_LENGTH),
    });
  }

  return values;
}

/**
 * Detect hardcoded Russian text (i18n issues)
 */
function detectText(line: string, lineNum: number, filepath: string): HardcodedValue[] {
  // Skip test or story files
  if (filepath.includes('.test.') || filepath.includes('.stories.')) {
    return [];
  }

  const values: HardcodedValue[] = [];
  const matches = line.matchAll(DETECTION_PATTERNS.hardcodedText);

  for (const match of matches) {
    values.push({
      value: match[0].slice(1, -1), // Remove quotes
      type: 'string',
      line: lineNum,
      context: line.trim().slice(0, MAX_CONTEXT_LENGTH),
    });
  }

  return values;
}

/**
 * Process a single line for all hardcoded values
 */
function processLine(line: string, lineNum: number, filepath: string): HardcodedValue[] {
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
export function detectHardcodedValues(content: string, filepath: string): HardcodedValue[] {
  if (shouldSkipFile(filepath)) {
    return [];
  }

  const lines = content.split('\n');
  const values: HardcodedValue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    values.push(...processLine(line, i + 1, filepath));
  }

  return values;
}
