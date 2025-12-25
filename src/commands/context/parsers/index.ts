/**
 * @module commands/context/parsers
 * @description Parsers for code analysis (Zod schemas, components, tests)
 *
 * All parsers now use SWC AST for accurate parsing:
 * - types-parser-swc: TypeScript interfaces/types with generics support
 * - zod-swc: Nested z.object() calls, method chains
 * - components-swc: JSX/hooks from AST (no false positives)
 * - tests-swc: describe/it blocks from AST
 *
 * Benefits over regex:
 * - No false positives from strings/comments
 * - Proper handling of nested structures
 * - Type-safe AST traversal
 * - 10-20x faster with SWC's Rust parser
 */

export type {
  InputContract,
  OutputContract,
  ProcedureContract,
  RouterContract,
  SchemaField,
} from './api-contracts';
export { formatApiContractsXml, parseApiContracts } from './api-contracts';
// Legacy regex-based parsers (kept for backward compatibility)
export { parseComponents as parseComponentsRegex } from './components';
// SWC-based parsers (recommended)
export { parseComponents } from './components-swc';
export type {
  CascadeBehavior,
  DbRelations,
  ModelIndex,
  ModelRelation,
  RelationType,
} from './db-relations';
// Database relations
export {
  formatCriticalRelationsAscii,
  formatDbRelationsAscii,
  getCriticalRelations,
  parseDbRelations,
} from './db-relations';
export type {
  EnvVarDefinition,
  EnvVarsReport,
  EnvVarUsage,
} from './env-vars';
export { formatEnvVarsXml, parseEnvVars } from './env-vars';
// Context hints
export { generateContextHints } from './hints';
export type { ImportGraph, ImportNode } from './import-graph-swc';
export {
  buildImportGraphSwc,
  filterGraphByPatterns,
  formatImportGraphAscii,
  getGraphStats,
} from './import-graph-swc';
export { parseTestFiles as parseTestFilesRegex } from './tests';
export { parseTestFiles } from './tests-swc';
// Re-export types
export type {
  ComponentInfo,
  TestInfo,
  ZodField,
  ZodSchemaInfo,
} from './types';
export {
  buildImportGraph as buildImportGraphRegex,
  parseTypesInDir as parseTypesInDirRegex,
} from './types-parser';
export type {
  ExtractedType,
  ImportItem,
  ImportRelation,
  TypeProperty,
} from './types-parser-swc';
export { buildImportGraph, parseTypesInDir } from './types-parser-swc';
export { parseZodSchemas as parseZodSchemasRegex } from './zod';
export { parseZodSchemas } from './zod-swc';
