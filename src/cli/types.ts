/**
 * @module cli/types
 * @description Unified CLI type definitions
 */

import type { Logger } from '../types/commands/base';
import type { ResolvedConfig } from '../types/config';

// ============================================================================
// Base Options
// ============================================================================

/** Base command options that all commands can receive */
export interface CommandOptions {
  [key: string]: unknown;
}

/** Global program options (from program.opts()) */
export interface GlobalProgramOptions {
  projectRoot?: string;
  cwd?: string;
  json?: boolean;
  text?: boolean;
  verbose?: boolean;
  noColor?: boolean;
  noSync?: boolean;
}

/** Common options available to most commands */
export interface CommonCommandOptions {
  project?: string;
  path?: string;
}

// ============================================================================
// Output Types
// ============================================================================

/** Output format for command results */
export type OutputFormat = 'json' | 'text' | 'ai';

/** Output verbosity level */
export type OutputLevel = 'summary' | 'compact' | 'default' | 'full';

// ============================================================================
// Mode Types
// ============================================================================

/** Quick/Deep mode for analysis commands */
export type AnalysisMode = 'quick' | 'default' | 'deep';

/** Fix command mode */
export type FixMode = 'quick' | 'default' | 'all';

/** Refactor command mode */
export type RefactorMode = 'quick' | 'default' | 'deep';

// ============================================================================
// Context Types
// ============================================================================

/** Context passed to all command runners */
export interface CommandContext {
  config: ResolvedConfig;
  logger: Logger;
  options: CommandOptions & GlobalProgramOptions;
}

// ============================================================================
// Factory Types
// ============================================================================

/** Option definition for command factories */
export interface CommandOptionDef {
  flags: string;
  description: string;
  defaultValue?: string | boolean | number;
}

/** Configuration for simple command factory */
export interface SimpleCommandConfig {
  name: string;
  description: string;
  options?: CommandOptionDef[];
  importPath: string;
  runnerName: string;
}

/** Configuration for subcommand factory */
export interface SubcommandConfig {
  name: string;
  description: string;
  argument?: {
    name: string;
    description: string;
    required?: boolean;
  };
  options?: CommandOptionDef[];
  importPath: string;
  runnerName: string;
}
