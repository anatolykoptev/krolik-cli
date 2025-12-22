/**
 * @module commands/fix/strategies/hardcoded
 * @description Fix strategies for hardcoded values
 *
 * Extracts hardcoded values into named constants:
 * - Magic numbers → CONST_NAME
 * - URLs → const CONFIG_URL
 * - Colors → CSS variables or theme constants
 */

import type { QualityIssue } from '../../quality/types';
import type { FixOperation, FixStrategy } from '../types';

// ============================================================================
// PATTERNS
// ============================================================================

const FIXABLE_PATTERNS = {
  // "Hardcoded number: 120"
  NUMBER: /hardcoded\s+number:\s*(\d+)/i,
  // "Hardcoded url: https://..."
  URL: /hardcoded\s+url:\s*(https?:\/\/[^\s]+)/i,
  // "Hardcoded color: #fff" - skip, needs theme system
  COLOR: /hardcoded\s+color/i,
  // "Hardcoded string: текст" - skip, needs i18n
  TEXT: /hardcoded\s+string/i,
};

/**
 * Generate a constant name from a number's context
 */
function generateNumberConstName(value: number, context: string): string {
  const lower = context.toLowerCase();

  // Time-related
  if (lower.includes('timeout') || lower.includes('delay')) {
    return `TIMEOUT_MS`;
  }
  if (lower.includes('interval')) {
    return `INTERVAL_MS`;
  }
  if (lower.includes('duration')) {
    return `DURATION_MS`;
  }

  // Size-related
  if (lower.includes('width')) {
    return `DEFAULT_WIDTH`;
  }
  if (lower.includes('height')) {
    return `DEFAULT_HEIGHT`;
  }
  if (lower.includes('size') || lower.includes('length')) {
    return `MAX_SIZE`;
  }
  if (lower.includes('limit')) {
    return `MAX_LIMIT`;
  }
  if (lower.includes('max')) {
    return `MAX_VALUE`;
  }
  if (lower.includes('min')) {
    return `MIN_VALUE`;
  }

  // Count-related
  if (lower.includes('count') || lower.includes('total')) {
    return `DEFAULT_COUNT`;
  }
  if (lower.includes('page')) {
    return `PAGE_SIZE`;
  }
  if (lower.includes('retry') || lower.includes('attempt')) {
    return `MAX_RETRIES`;
  }

  // Index/position
  if (lower.includes('index') || lower.includes('offset')) {
    return `DEFAULT_OFFSET`;
  }

  // Default: use value hint
  if (value >= 1000) {
    return `LARGE_NUMBER_${value}`;
  }
  return `MAGIC_NUMBER_${value}`;
}

/**
 * Generate a constant name for URL
 */
function generateUrlConstName(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/\./g, '_').toUpperCase();
    if (parsed.pathname && parsed.pathname !== '/') {
      const pathPart = parsed.pathname.split('/')[1]?.toUpperCase() || '';
      return `${host}_${pathPart}_URL`;
    }
    return `${host}_URL`;
  } catch {
    return 'API_URL';
  }
}

/**
 * Hardcoded values fix strategy
 */
export const hardcodedStrategy: FixStrategy = {
  categories: ['hardcoded'],

  canFix(issue: QualityIssue, _content: string): boolean {
    const { message } = issue;

    // We can extract numbers into constants
    if (FIXABLE_PATTERNS.NUMBER.test(message)) {
      return true;
    }

    // We can extract URLs into config
    if (FIXABLE_PATTERNS.URL.test(message)) {
      return true;
    }

    // Colors and text are more complex (need i18n or theme system)
    // Skip for now - these need manual attention
    return false;
  },

  generateFix(issue: QualityIssue, content: string): FixOperation | null {
    const { message, line, file, snippet } = issue;

    // Extract number into constant
    if (FIXABLE_PATTERNS.NUMBER.test(message)) {
      return generateNumberFix(content, file, line, message, snippet);
    }

    // Extract URL into constant
    if (FIXABLE_PATTERNS.URL.test(message)) {
      return generateUrlFix(content, file, line, snippet);
    }

    return null;
  },
};

// ============================================================================
// FIX GENERATORS
// ============================================================================

/**
 * Extract magic number into a named constant
 */
function generateNumberFix(
  content: string,
  file: string,
  targetLine: number | undefined,
  message: string,
  snippet: string | undefined,
): FixOperation | null {
  if (!targetLine) return null;

  // Extract the number from message
  const match = message.match(/(\d+)/);
  if (!match) return null;

  const value = parseInt(match[1] || '0', 10);
  const context = snippet || message;
  const constName = generateNumberConstName(value, context);

  const lines = content.split('\n');
  const targetLineContent = lines[targetLine - 1];
  if (!targetLineContent) return null;

  // Check if const already exists
  const constPattern = new RegExp(`const\\s+${constName}\\s*=`, 'i');
  if (constPattern.test(content)) {
    // Constant exists, just replace the value
    const newLine = targetLineContent.replace(
      new RegExp(`\\b${value}\\b`),
      constName,
    );

    if (newLine === targetLineContent) return null;

    return {
      action: 'replace-range',
      file,
      line: targetLine,
      endLine: targetLine,
      oldCode: targetLineContent,
      newCode: newLine,
    };
  }

  // Find where to insert the constant (after imports, before first function/class)
  let insertLine = 1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    if (line.startsWith('import ') || line.startsWith('from ')) {
      insertLine = i + 2; // After last import
    }
    if (line.includes('function ') || line.includes('class ') || line.includes('const ') && !line.includes('import')) {
      if (i > insertLine) {
        insertLine = i;
      }
      break;
    }
  }

  // Create the constant declaration
  const constDeclaration = `const ${constName} = ${value};\n`;

  // Replace the number with constant name in the target line
  const newTargetLine = targetLineContent.replace(
    new RegExp(`\\b${value}\\b`),
    constName,
  );

  if (newTargetLine === targetLineContent) return null;

  // Build the new content
  const newLines = [...lines];
  newLines[targetLine - 1] = newTargetLine;
  newLines.splice(insertLine, 0, constDeclaration);

  return {
    action: 'replace-range',
    file,
    line: 1,
    endLine: lines.length,
    oldCode: content,
    newCode: newLines.join('\n'),
  };
}

/**
 * Extract URL into a named constant
 */
function generateUrlFix(
  content: string,
  file: string,
  targetLine: number | undefined,
  snippet: string | undefined,
): FixOperation | null {
  if (!targetLine || !snippet) return null;

  // Extract URL from snippet
  const urlMatch = snippet.match(/(["'`])(https?:\/\/[^"'`\s]+)\1/);
  if (!urlMatch) return null;

  const url = urlMatch[2] || '';
  const quote = urlMatch[1] || '"';
  const constName = generateUrlConstName(url);

  const lines = content.split('\n');
  const targetLineContent = lines[targetLine - 1];
  if (!targetLineContent) return null;

  // Check if const already exists
  const constPattern = new RegExp(`const\\s+${constName}\\s*=`, 'i');
  if (constPattern.test(content)) {
    // Just replace the URL
    const newLine = targetLineContent.replace(
      new RegExp(`${quote}${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${quote}`),
      constName,
    );

    if (newLine === targetLineContent) return null;

    return {
      action: 'replace-range',
      file,
      line: targetLine,
      endLine: targetLine,
      oldCode: targetLineContent,
      newCode: newLine,
    };
  }

  // Find insertion point
  let insertLine = 1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    if (line.startsWith('import ')) {
      insertLine = i + 2;
    }
    if ((line.includes('function ') || line.includes('class ')) && i > insertLine) {
      insertLine = i;
      break;
    }
  }

  const constDeclaration = `const ${constName} = ${quote}${url}${quote};\n`;

  const newTargetLine = targetLineContent.replace(
    new RegExp(`${quote}${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${quote}`),
    constName,
  );

  if (newTargetLine === targetLineContent) return null;

  const newLines = [...lines];
  newLines[targetLine - 1] = newTargetLine;
  newLines.splice(insertLine, 0, constDeclaration);

  return {
    action: 'replace-range',
    file,
    line: 1,
    endLine: lines.length,
    oldCode: content,
    newCode: newLines.join('\n'),
  };
}
