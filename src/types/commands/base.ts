/**
 * @module types/commands/base
 * @description Base command types and interfaces
 */

import type { ResolvedConfig } from '../config';

/**
 * Output format for command results
 * Default is 'ai' (AI-friendly XML format)
 */
export type OutputFormat = 'ai' | 'json' | 'text' | 'markdown';

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
  section(title: string): void;
  box(lines: string[], type?: 'info' | 'success' | 'warning' | 'error'): void;
}

/**
 * Base options for all commands
 */
export interface BaseCommandOptions {
  /** Output format (default: 'ai' for AI-friendly XML) */
  format?: OutputFormat;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Dry run mode (no changes) */
  dryRun?: boolean;
  /** Custom config path */
  config?: string;
  /** Project root override */
  projectRoot?: string;
  /** Human-readable text output */
  text?: boolean;
  /** JSON output */
  json?: boolean;
}

/**
 * Command context passed to all commands
 */
export interface CommandContext {
  /** Resolved configuration */
  config: ResolvedConfig;
  /** Logger instance */
  logger: Logger;
  /** Command options */
  options: BaseCommandOptions;
}

/**
 * Generic command result
 */
export interface CommandResult<T = unknown> {
  /** Whether command succeeded */
  success: boolean;
  /** Result data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Duration in milliseconds */
  durationMs?: number;
}
