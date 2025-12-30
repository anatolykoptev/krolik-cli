/**
 * @module types/commands
 * @description Command-related type definitions
 *
 * PREFER DIRECT IMPORTS from specific files:
 * - @/types/commands/base - Base command types
 * - @/types/commands/context - Context command types
 * - @/types/commands/review - Review command types
 * - @/types/commands/routes - Routes command types
 * - @/types/commands/schema - Schema command types
 * - @/types/commands/security - Security command types
 * - @/types/commands/status - Status command types
 */

// Re-exports for backwards compatibility - prefer direct imports
export type {
  BaseCommandOptions,
  CommandContext,
  CommandResult,
  Logger,
  LogLevel,
  OutputFormat,
} from './base';

export type { ChecklistItem, ContextResult, IssueResult } from './context';

export type {
  DocReference,
  FileChange,
  ReviewCategory,
  ReviewIssue,
  ReviewResult,
  ReviewSeverity,
} from './review';

export type { RouteProcedure, RouterDefinition, RoutesResult } from './routes';

export type { SchemaField, SchemaModel, SchemaRelation, SchemaResult } from './schema';

export type { SecurityCodeIssue, SecurityResult, SecurityVulnerability } from './security';

export type { StatusResult } from './status';
