/**
 * @module lib/@context
 * @description File and project context utilities
 *
 * This module provides:
 * - File type detection (CLI, test, config, component, etc.)
 * - File context building for quality/fix operations
 * - Skip logic for lint/console checks
 */

// Types
export type { FileType, FileContext, FileContextOptions } from './types';

// File type detectors
export {
  CLI_FILE_PATTERNS,
  TEST_FILE_PATTERNS,
  CONFIG_FILE_PATTERNS,
  OUTPUT_FILE_PATTERNS,
  COMPONENT_FILE_PATTERNS,
  HOOK_FILE_PATTERNS,
  UTIL_FILE_PATTERNS,
  API_FILE_PATTERNS,
  SCHEMA_FILE_PATTERNS,
  isCliFile,
  isTestFile,
  isConfigFile,
  isOutputFile,
  isComponentFile,
  isHookFile,
  isUtilFile,
  isApiFile,
  isSchemaFile,
  detectFileType,
  shouldSkipConsole,
  shouldSkipLint,
} from './detectors';

// File context builder
export {
  buildFileContext,
  buildFileContextFromRelative,
  contextAllowsConsole,
  contextRequiresStrictLint,
} from './file-context';
