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

import type { OutputFormat } from '../core/options';
import type { RefactorAnalysis } from '../core/types';

// ============================================================================
// EXPORTS
// ============================================================================

// AI-native formatters
export { type AiNativeXmlOptions, type AnalysisMode, formatAiNativeXml } from './ai-native';

// JSON formatters
export {
  formatRefactorJson,
  formatRefactorJsonCompact,
} from './json';
// Text formatters
export {
  formatMigrationPreview,
  formatRefactorText,
  visualizeStructure,
} from './text';
// XML formatters
export { formatRefactorXml } from './xml';

// ============================================================================
// UNIFIED FORMATTER
// ============================================================================

/**
 * Format analysis based on output type
 */
export function formatRefactor(analysis: RefactorAnalysis, format: OutputFormat = 'text'): string {
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
    default: {
      const { formatRefactorText } = require('./text');
      return formatRefactorText(analysis);
    }
  }
}
