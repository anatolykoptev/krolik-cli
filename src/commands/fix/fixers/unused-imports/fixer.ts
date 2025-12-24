/**
 * @module commands/fix/fixers/unused-imports/fixer
 * @description Fix unused imports by removing them
 */

import type { FixOperation, QualityIssue } from '../../core/types';

/**
 * Fix an unused import issue
 */
export function fixUnusedImportIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line) return null;

  const lines = content.split('\n');
  const lineIndex = issue.line - 1;

  if (lineIndex < 0 || lineIndex >= lines.length) return null;

  const line = lines[lineIndex];
  if (line === undefined) return null;

  // Check if entire import is unused
  if (issue.message.includes('entire import')) {
    // Delete the entire line
    return {
      action: 'delete-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
    };
  }

  // Extract the unused identifier from message
  const match = issue.message.match(/Unused import: '(\w+)'/);
  if (!match) return null;

  const unusedId = match[1];
  if (!unusedId) return null;

  // Try to remove just this identifier from the import
  const newLine = removeIdentifierFromImport(line, unusedId);

  if (newLine === null) {
    // If we couldn't modify the line, delete it entirely
    return {
      action: 'delete-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
    };
  }

  if (newLine === '') {
    // Import is now empty, delete the line
    return {
      action: 'delete-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
    };
  }

  return {
    action: 'replace-line',
    file: issue.file,
    line: issue.line,
    oldCode: line,
    newCode: newLine,
  };
}

/**
 * Remove a single identifier from an import statement
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Import parsing requires handling multiple patterns
function removeIdentifierFromImport(line: string, identifier: string): string | null {
  // Handle named imports: import { a, b, c } from 'module'
  const namedMatch = line.match(
    /^(\s*import\s+(?:type\s+)?)(\{[^}]+\})(\s+from\s+['"][^'"]+['"];?\s*)$/,
  );
  if (namedMatch) {
    const prefix = namedMatch[1] ?? '';
    const names = namedMatch[2] ?? '';
    const suffix = namedMatch[3] ?? '';

    // Parse the names inside braces
    const inner = names.slice(1, -1); // Remove { }
    const parts = inner
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    // Filter out the unused identifier
    const filtered = parts.filter((part) => {
      // Handle "X as Y" - check both X and Y
      const asMatch = part.match(/^(\w+)\s+as\s+(\w+)$/);
      if (asMatch) {
        return asMatch[1] !== identifier && asMatch[2] !== identifier;
      }
      // Handle "type X"
      const typeMatch = part.match(/^type\s+(\w+)$/);
      if (typeMatch) {
        return typeMatch[1] !== identifier;
      }
      // Simple identifier
      return part !== identifier;
    });

    if (filtered.length === 0) {
      return ''; // Empty import
    }

    return `${prefix}{ ${filtered.join(', ')} }${suffix}`;
  }

  // Handle default + named: import A, { b, c } from 'module'
  const defaultNamedMatch = line.match(
    /^(\s*import\s+)(\w+)(\s*,\s*)(\{[^}]+\})(\s+from\s+['"][^'"]+['"];?\s*)$/,
  );
  if (defaultNamedMatch) {
    const prefix = defaultNamedMatch[1] ?? '';
    const defaultImport = defaultNamedMatch[2] ?? '';
    const comma = defaultNamedMatch[3] ?? '';
    const names = defaultNamedMatch[4] ?? '';
    const suffix = defaultNamedMatch[5] ?? '';

    // Check if removing default import
    if (defaultImport === identifier) {
      // Keep only named imports
      return `${prefix}${names}${suffix}`;
    }

    // Remove from named imports
    const inner = names.slice(1, -1);
    const parts = inner
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const filtered = parts.filter((part) => {
      const asMatch = part.match(/^(\w+)\s+as\s+(\w+)$/);
      if (asMatch) return asMatch[1] !== identifier && asMatch[2] !== identifier;
      const typeMatch = part.match(/^type\s+(\w+)$/);
      if (typeMatch) return typeMatch[1] !== identifier;
      return part !== identifier;
    });

    if (filtered.length === 0) {
      // Only default import left
      return `${prefix}${defaultImport}${suffix}`;
    }

    return `${prefix}${defaultImport}${comma}{ ${filtered.join(', ')} }${suffix}`;
  }

  // Handle default import: import A from 'module'
  const defaultMatch = line.match(
    /^(\s*import\s+(?:type\s+)?)(\w+)(\s+from\s+['"][^'"]+['"];?\s*)$/,
  );
  if (defaultMatch) {
    if (defaultMatch[2] === identifier) {
      return ''; // Remove entire import
    }
  }

  // Handle namespace import: import * as A from 'module'
  const namespaceMatch = line.match(
    /^(\s*import\s+\*\s+as\s+)(\w+)(\s+from\s+['"][^'"]+['"];?\s*)$/,
  );
  if (namespaceMatch) {
    if (namespaceMatch[2] === identifier) {
      return ''; // Remove entire import
    }
  }

  return null; // Couldn't parse the line
}
