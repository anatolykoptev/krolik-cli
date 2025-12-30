/**
 * @module lib/@detectors/file-context
 * @description File and project context utilities
 *
 * Migrated from lib/@context
 *
 * This module provides:
 * - File type detection (CLI, test, config, component, etc.)
 * - File context building for quality/fix operations
 * - Skip logic for lint/console checks
 */

// File type detectors
export {
  API_FILE_PATTERNS,
  CLI_FILE_PATTERNS,
  COMPONENT_FILE_PATTERNS,
  CONFIG_FILE_PATTERNS,
  detectFileType,
  HOOK_FILE_PATTERNS,
  isApiFile,
  isCliFile,
  isComponentFile,
  isConfigFile,
  isHookFile,
  isOutputFile,
  isSchemaFile,
  isTestFile,
  isUtilFile,
  OUTPUT_FILE_PATTERNS,
  SCHEMA_FILE_PATTERNS,
  shouldSkipConsole,
  shouldSkipLint,
  TEST_FILE_PATTERNS,
  UTIL_FILE_PATTERNS,
} from './detectors';
// File context builder
export {
  buildFileContext,
  buildFileContextFromRelative,
  contextAllowsConsole,
  contextRequiresStrictLint,
} from './file-context';
// Types
export type { FileContext, FileContextOptions, FileType } from './types';
