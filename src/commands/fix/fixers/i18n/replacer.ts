/**
 * @module commands/fix/fixers/i18n/replacer
 * @description Line-by-line text replacement for i18n automation
 *
 * KEY INSIGHT: Process content LINE BY LINE, not byte offsets.
 * This avoids UTF-8/UTF-16 conversion issues and simplifies validation.
 */

import type {
  Detection,
  Replacement,
  ReplacementConfig,
  SkippedReplacement,
  TransformResult,
  TranslationCatalog,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const I18N_IMPORT_PATTERNS = [
  /import\s+\{[^}]*\bt\b[^}]*\}\s+from\s+['"]@piternow\/shared['"]/,
  /import\s+\{[^}]*\bt\b[^}]*\}\s+from\s+['"]react-i18next['"]/,
  /const\s+\{\s*t\s*\}\s*=\s*useTranslation\s*\(/,
];

const DIRECTIVE_PATTERN = /^['"]use (?:client|server)['"];?\s*$/;
const FIRST_IMPORT_PATTERN = /^import\s+/m;

// ============================================================================
// HELPERS
// ============================================================================

function hasI18nImport(content: string): boolean {
  return I18N_IMPORT_PATTERNS.some((p) => p.test(content));
}

function findImportInjectionLine(lines: readonly string[]): number {
  let start = 0;
  const firstLine = lines[0];
  if (lines.length > 0 && firstLine !== undefined && DIRECTIVE_PATTERN.test(firstLine.trim())) {
    const secondLine = lines[1];
    start = lines.length > 1 && secondLine !== undefined && secondLine.trim() === '' ? 2 : 1;
  }
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && FIRST_IMPORT_PATTERN.test(line)) return i;
  }
  return start;
}

function buildReplacement(key: string, d: Detection, fn: string): string {
  const vars = d.interpolations.length > 0 ? `, { ${d.interpolations.join(', ')} }` : '';
  const tCall = `${fn}('${key}'${vars})`;
  return d.context === 'jsx-text' || d.context === 'jsx-attribute' ? `{${tCall}}` : tCall;
}

function buildOriginalPattern(d: Detection): string {
  if (d.context === 'jsx-text') return d.value;
  if (d.context === 'template-literal') return `\`${d.value}\``;
  return `${d.quote}${d.value}${d.quote}`;
}

function findTextOnLine(
  line: string,
  text: string,
  expectedCol: number,
): { found: boolean; start: number; end: number } {
  // Try near expected column first
  for (let offset = 0; offset <= 5; offset++) {
    for (const col of [expectedCol - offset, expectedCol + offset]) {
      if (col >= 0 && col < line.length && line.substring(col, col + text.length) === text) {
        return { found: true, start: col, end: col + text.length };
      }
    }
  }
  // Fallback: search entire line
  const idx = line.indexOf(text);
  if (idx !== -1) return { found: true, start: idx, end: idx + text.length };
  return { found: false, start: -1, end: -1 };
}

function findTranslationKey(value: string, catalog: TranslationCatalog): string | undefined {
  for (const [key, entry] of catalog.entries) {
    if (entry.value === value || entry.icuValue === value) return key;
  }
  return undefined;
}

function groupByLine(detections: readonly Detection[]): Map<number, Detection[]> {
  const map = new Map<number, Detection[]>();
  for (const d of detections) {
    const arr = map.get(d.line) ?? [];
    arr.push(d);
    map.set(d.line, arr);
  }
  return map;
}

interface LineRep {
  start: number;
  end: number;
  original: string;
  replacement: string;
  key: string;
}

function applyLineReplacements(line: string, reps: readonly LineRep[]): string {
  const sorted = [...reps].sort((a, b) => b.start - a.start);
  let result = line;
  for (const r of sorted) {
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  }
  return result;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Replace hardcoded strings with t() calls using line-by-line processing.
 *
 * Strategy:
 * 1. Split content into lines
 * 2. Group detections by line number
 * 3. For each line, find and validate text position
 * 4. Build replacement, apply from right to left
 * 5. Add import if needed
 * 6. Rebuild content
 */
export function replaceInFile(
  content: string,
  detections: readonly Detection[],
  catalog: TranslationCatalog,
  config: ReplacementConfig,
): TransformResult {
  const lines = content.split('\n');
  const replacements: Replacement[] = [];
  const skipped: SkippedReplacement[] = [];
  const lineGroups = groupByLine(detections);

  for (const [lineNum, dets] of lineGroups) {
    const lineIdx = lineNum - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) {
      for (const d of dets) {
        skipped.push({ detection: d, reason: `Line ${lineNum} out of bounds` });
      }
      continue;
    }

    const currentLine = lines[lineIdx];
    if (currentLine === undefined) {
      for (const d of dets) {
        skipped.push({ detection: d, reason: `Line ${lineNum} is undefined` });
      }
      continue;
    }
    const lineReps: LineRep[] = [];

    for (const d of dets) {
      const key = findTranslationKey(d.value, catalog);
      if (key === undefined) {
        skipped.push({
          detection: d,
          reason: `No translation key for: "${d.value.slice(0, 30)}..."`,
        });
        continue;
      }

      const pattern = buildOriginalPattern(d);
      const pos = findTextOnLine(currentLine, pattern, d.column);
      if (!pos.found) {
        skipped.push({
          detection: d,
          reason: `Text not found on line: "${pattern.slice(0, 30)}..."`,
        });
        continue;
      }

      const rep = buildReplacement(key, d, config.functionName);
      lineReps.push({ start: pos.start, end: pos.end, original: pattern, replacement: rep, key });
      replacements.push({
        line: lineNum,
        startColumn: pos.start,
        endColumn: pos.end,
        original: pattern,
        replacement: rep,
        key,
        validated: true,
      });
    }

    if (!config.dryRun && lineReps.length > 0 && currentLine !== undefined) {
      lines[lineIdx] = applyLineReplacements(currentLine, lineReps);
    }
  }

  let importAdded = false;
  if (config.addImport && replacements.length > 0 && !hasI18nImport(content) && !config.dryRun) {
    const injLine = findImportInjectionLine(lines);
    lines.splice(injLine, 0, config.importStatement);
    importAdded = true;
  }

  return {
    filePath: '',
    content: config.dryRun ? content : lines.join('\n'),
    replacementCount: replacements.length,
    skipped,
    importAdded,
  };
}
