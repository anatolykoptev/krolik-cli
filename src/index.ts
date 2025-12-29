/**
 * @module krolik-cli
 * @description KROLIK — fast AI-assisted development toolkit
 *
 * @example
 * ```typescript
 * import { defineConfig } from 'krolik-cli';
 *
 * export default defineConfig({
 *   name: 'my-project',
 *   paths: {
 *     web: 'apps/web',
 *     api: 'packages/api',
 *   },
 * });
 * ```
 */

// Configuration
export { defineConfig, getConfig, loadConfig } from './config';
export { findFiles, readFile, writeFile } from './lib/@core/fs';
// Library utilities (for advanced usage)
export { createLogger } from './lib/@core/logger';
export { exec, execLines, tryExec } from './lib/@core/shell';
export { getCurrentBranch, getStatus, isGitRepo } from './lib/@git';
// Types
// Command types
export type {
  CommandContext,
  CommandResult,
  FeatureConfig,
  KrolikConfig,
  Logger,
  PathConfig,
  PrismaConfig,
  RabbitConfig,
  ResolvedConfig,
  ReviewResult,
  RoutesResult,
  SchemaResult,
  StatusResult,
  TemplateConfig,
  TrpcConfig,
} from './types';
