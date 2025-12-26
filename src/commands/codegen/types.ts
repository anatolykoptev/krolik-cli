/**
 * @module commands/codegen/types
 * @description Type definitions for code generation
 */

import type { DocHints } from './services/types';

/**
 * Supported generator targets
 */
export type GeneratorTarget =
  | 'trpc-route'
  | 'zod-schema'
  | 'test'
  | 'hooks'
  | 'schemas'
  | 'tests'
  | 'barrels'
  | 'docs';

/**
 * Options passed to generators
 */
export interface GeneratorOptions {
  /** Name for the generated code (e.g., "booking", "user") */
  name: string;
  /** Output path for generated files */
  path?: string;
  /** Project root directory */
  projectRoot: string;
  /** Source file for test generator */
  file?: string;
  /** Dry run mode - preview without writing */
  dryRun?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
  /** Disable docs enhancement (docs enhancement is enabled by default) */
  noDocs?: boolean;
}

/**
 * Action to perform on the file
 */
export type FileAction = 'create' | 'append' | 'update';

/**
 * Metadata about docs enhancement applied to a generated file
 */
export interface DocsEnhancementMeta {
  /** Library name that provided the docs */
  library: string;
  /** Topics covered */
  topics: string[];
  /** Number of code snippets used */
  snippetsCount: number;
}

/**
 * A file to be generated
 */
export interface GeneratedFile {
  /** Path to the file (relative to project root) */
  path: string;
  /** Content to write */
  content: string;
  /** Action to perform */
  action: FileAction;
  /** Docs enhancement metadata if file was enhanced with cached docs */
  docsEnhanced?: DocsEnhancementMeta;
}

/**
 * Metadata for a generator
 */
export interface GeneratorMetadata {
  /** Generator identifier */
  id: GeneratorTarget;
  /** Human-readable name */
  name: string;
  /** Description of what this generator creates */
  description: string;
  /** Example usage */
  example: string;
}

/**
 * Generator interface
 */
export interface Generator {
  /** Generator metadata */
  metadata: GeneratorMetadata;
  /** Generate files based on options */
  generate(options: GeneratorOptions): GeneratedFile[];
}

/**
 * Result of code generation
 */
export interface CodegenResult {
  /** Whether generation succeeded */
  success: boolean;
  /** Generated files */
  files: GeneratedFile[];
  /** Error message if failed */
  error?: string;
}

/**
 * Codegen command options
 */
export interface CodegenOptions {
  /** Generator target */
  target?: GeneratorTarget | string;
  /** Name for generated code */
  name?: string;
  /** Output path */
  path?: string;
  /** Output file */
  output?: string;
  /** Source file (for test generator) */
  file?: string;
  /** Dry run mode */
  dryRun?: boolean;
  /** Force overwrite */
  force?: boolean;
  /** List available generators */
  list?: boolean;
  /** Disable docs enhancement (docs enhancement is enabled by default) */
  noDocs?: boolean;
}

/**
 * Generator context passed to enhanced templates
 */
export interface GeneratorContext {
  name: string;
  options: GeneratorOptions;
  hints: DocHints;
}
