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
export { defineConfig, loadConfig, getConfig } from './config';

// Types
export type {
  KrolikConfig,
  RabbitConfig,
  ResolvedConfig,
  PathConfig,
  FeatureConfig,
  PrismaConfig,
  TrpcConfig,
  TemplateConfig,
} from './types';

// Command types
export type {
  CommandContext,
  CommandResult,
  StatusResult,
  ReviewResult,
  SchemaResult,
  RoutesResult,
  Logger,
} from './types';

// Library utilities (for advanced usage)
export { createLogger } from './lib/logger';
export { exec, tryExec, execLines } from './lib/shell';
export { findFiles, readFile, writeFile } from './lib/fs';
export { isGitRepo, getCurrentBranch, getStatus } from './lib/git';
