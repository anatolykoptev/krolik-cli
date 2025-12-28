/**
 * @module commands/context/parsers/signatures
 * @description Context-specific signature formatting for Smart Context / RepoMap
 *
 * This module provides formatting utilities for displaying signatures in the
 * Aider-style repo map format. The core extraction logic has been moved to
 * `@/lib/parsing/signatures` for reusability.
 *
 * @example
 * import { extractSignatures, formatSignaturesForFile } from './signatures';
 *
 * const signatures = extractSignatures('src/utils.ts', sourceCode);
 * console.log(formatSignaturesForFile('src/utils.ts', signatures));
 * // src/utils.ts:
 * // ...
 * // |export function parseDate(str: string): Date
 * // ...
 * // |export function formatDate(date: Date, format: string): string
 */

// Re-export types
export type { Signature, SignatureOptions } from '@/lib/parsing/signatures';
// Re-export core extraction functionality from lib
export {
  extractSignatures,
  extractSignaturesFromFiles,
} from '@/lib/parsing/signatures';

// Import Signature type for formatting functions
import type { Signature } from '@/lib/parsing/signatures';

// ============================================================================
// AIDER-STYLE FORMATTING
// ============================================================================

/** Prefix for elided content indicator */
const ELISION_MARKER = '...';

/** Prefix for signature content line */
const CONTENT_MARKER = '|';

/**
 * Format signatures for a file in Aider-style repo map format
 *
 * Produces output like:
 * ```
 * src/utils.ts:
 * ...
 * |export function parseDate(str: string): Date
 * ...
 * |export function formatDate(date: Date, format: string): string
 * ```
 *
 * @param filePath - File path to display
 * @param signatures - Signatures to format
 * @returns Formatted string in repo map style
 *
 * @example
 * const output = formatSignaturesForFile('src/utils.ts', signatures);
 * // src/utils.ts:
 * // ...
 * // |export function parseDate(str: string): Date
 */
export function formatSignaturesForFile(filePath: string, signatures: Signature[]): string {
  if (signatures.length === 0) return '';

  const lines: string[] = [`${filePath}:`];

  for (const sig of signatures) {
    lines.push(ELISION_MARKER);
    lines.push(`${CONTENT_MARKER}${sig.text}`);
  }

  return lines.join('\n');
}

/**
 * Format signatures for multiple files
 *
 * Combines formatted output from multiple files with blank line separators.
 *
 * @param signaturesMap - Map of file path to signatures
 * @returns Formatted string with all files
 *
 * @example
 * const map = extractSignaturesFromFiles(['src/a.ts', 'src/b.ts']);
 * console.log(formatSignaturesMap(map));
 */
export function formatSignaturesMap(signaturesMap: Map<string, Signature[]>): string {
  const sections: string[] = [];

  for (const [filePath, signatures] of signaturesMap) {
    const formatted = formatSignaturesForFile(filePath, signatures);
    if (formatted) {
      sections.push(formatted);
    }
  }

  return sections.join('\n\n');
}

// ============================================================================
// XML FORMATTING (for context output)
// ============================================================================

/**
 * Format signatures as XML for context output
 *
 * Produces structured XML output for AI context consumption.
 *
 * @param signaturesMap - Map of file path to signatures
 * @returns XML-formatted string
 *
 * @example
 * const xml = formatSignaturesAsXml(signaturesMap);
 * // <signatures>
 * //   <file path="src/utils.ts">
 * //     <signature type="function" name="parseDate" line="15" exported="true">
 * //       export function parseDate(str: string): Date
 * //     </signature>
 * //   </file>
 * // </signatures>
 */
export function formatSignaturesAsXml(signaturesMap: Map<string, Signature[]>): string {
  if (signaturesMap.size === 0) {
    return '<signatures />';
  }

  const lines: string[] = ['<signatures>'];

  for (const [filePath, signatures] of signaturesMap) {
    lines.push(`  <file path="${escapeXml(filePath)}">`);

    for (const sig of signatures) {
      const attrs = [
        `type="${sig.type}"`,
        `name="${escapeXml(sig.name)}"`,
        `line="${sig.line}"`,
        `exported="${sig.isExported}"`,
      ].join(' ');

      lines.push(`    <signature ${attrs}>`);
      lines.push(`      ${escapeXml(sig.text)}`);
      lines.push('    </signature>');
    }

    lines.push('  </file>');
  }

  lines.push('</signatures>');
  return lines.join('\n');
}

/**
 * Format a single file's signatures as XML
 *
 * @param filePath - File path
 * @param signatures - Signatures for the file
 * @returns XML-formatted string for single file
 */
export function formatFileSignaturesAsXml(filePath: string, signatures: Signature[]): string {
  if (signatures.length === 0) {
    return '';
  }

  const lines: string[] = [`<file path="${escapeXml(filePath)}">`];

  for (const sig of signatures) {
    const attrs = [
      `type="${sig.type}"`,
      `name="${escapeXml(sig.name)}"`,
      `line="${sig.line}"`,
      `exported="${sig.isExported}"`,
    ].join(' ');

    lines.push(`  <signature ${attrs}>`);
    lines.push(`    ${escapeXml(sig.text)}`);
    lines.push('  </signature>');
  }

  lines.push('</file>');
  return lines.join('\n');
}

// ============================================================================
// MARKDOWN FORMATTING
// ============================================================================

/**
 * Format signatures as Markdown table
 *
 * @param signaturesMap - Map of file path to signatures
 * @returns Markdown-formatted table
 *
 * @example
 * const md = formatSignaturesAsMarkdown(signaturesMap);
 * // | File | Type | Name | Exported |
 * // |------|------|------|----------|
 * // | src/utils.ts | function | parseDate | Yes |
 */
export function formatSignaturesAsMarkdown(signaturesMap: Map<string, Signature[]>): string {
  const lines: string[] = [
    '| File | Type | Name | Exported |',
    '|------|------|------|----------|',
  ];

  for (const [filePath, signatures] of signaturesMap) {
    for (const sig of signatures) {
      const exported = sig.isExported ? 'Yes' : 'No';
      lines.push(`| ${filePath} | ${sig.type} | ${sig.name} | ${exported} |`);
    }
  }

  return lines.join('\n');
}

/**
 * Format signatures grouped by type
 *
 * @param signatures - Array of signatures
 * @returns Signatures grouped by type
 */
export function groupSignaturesByType(signatures: Signature[]): Map<string, Signature[]> {
  const grouped = new Map<string, Signature[]>();

  for (const sig of signatures) {
    const existing = grouped.get(sig.type) ?? [];
    existing.push(sig);
    grouped.set(sig.type, existing);
  }

  return grouped;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
