/**
 * @module types
 * @description Public type exports - lean barrel for essential types only
 *
 * For specific domain types, import directly from:
 * - @/types/config - Configuration types
 * - @/types/severity - Severity/priority types
 * - @/types/commands/base - Command base types
 * - @/types/commands/context - Context command types
 * - @/types/commands/review - Review command types
 * - @/types/commands/routes - Routes command types
 * - @/types/commands/schema - Schema command types
 * - @/types/commands/security - Security command types
 * - @/types/commands/status - Status command types
 */

// ============================================================================
// Base command types - used by all commands
// ============================================================================
export type {
  BaseCommandOptions,
  CommandContext,
  CommandResult,
  Logger,
  LogLevel,
  OutputFormat,
} from './commands/base';
// ============================================================================
// Command result types - used for command outputs
// ============================================================================
export type { ContextResult } from './commands/context';
export type {
  DocReference,
  FileChange,
  ReviewCategory,
  ReviewIssue,
  ReviewResult,
  ReviewSeverity,
} from './commands/review';
export type { RouteProcedure, RouterDefinition, RoutesResult } from './commands/routes';
export type { SchemaField, SchemaModel, SchemaRelation, SchemaResult } from './commands/schema';
export type { StatusResult } from './commands/status';
// ============================================================================
// Config types - commonly used across the codebase
// ============================================================================
export type {
  DomainConfig,
  FeatureConfig,
  KrolikConfig,
  PathConfig,
  PrismaConfig,
  RabbitConfig,
  ResolvedConfig,
  TemplateConfig,
  TrpcConfig,
} from './config';
// ============================================================================
// Shared severity types
// ============================================================================
export type { Priority, Severity } from './severity';
