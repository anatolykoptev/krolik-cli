/**
 * @module commands/refactor/output
 * @description Output formatters for refactor command
 *
 * Provides formatters for different output formats:
 * - Text: Human-readable console output
 * - JSON: Machine-readable JSON
 * - XML: Basic XML output
 * - AI-Native: Enhanced XML optimized for AI agents
 */

import type { RefactorAnalysis, OutputFormat } from '../core';

// ============================================================================
// EXPORTS
// ============================================================================

// Text formatters
export {
  formatRefactorText,
  formatMigrationPreview,
  visualizeStructure,
} from './text';

// JSON formatters
export {
  formatRefactorJson,
  formatRefactorJsonCompact,
} from './json';

// XML formatters
export {
  formatRefactorXml,
} from './xml';

// AI-native formatters
export {
  formatAiNativeXml,
} from './ai-native';

// ============================================================================
// UNIFIED FORMATTER
// ============================================================================

/**
 * Format analysis based on output type
 */
export function formatRefactor(
  analysis: RefactorAnalysis,
  format: OutputFormat = 'text',
): string {
  // Lazy import to avoid circular deps
  switch (format) {
    case 'xml': {
      const { formatRefactorXml } = require('./xml');
      return formatRefactorXml(analysis);
    }
    case 'json': {
      const { formatRefactorJson } = require('./json');
      return formatRefactorJson(analysis);
    }
    case 'text':
    default: {
      const { formatRefactorText } = require('./text');
      return formatRefactorText(analysis);
    }
  }
}
