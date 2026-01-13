/**
 * @module commands/context/parsers
 * @description Parsers for code analysis (Zod schemas, components, tests)
 *
 * All parsers use SWC AST for accurate parsing:
 * - types-parser-swc: TypeScript interfaces/types with generics support
 * - zod-swc: Nested z.object() calls, method chains
 * - components-swc: JSX/hooks from AST (no false positives)
 * - tests-swc: describe/it blocks from AST
 *
 * Benefits:
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
// Components parser (SWC-based)
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
// Signature extraction for Smart Context / RepoMap
export type { SignatureOptions } from './signatures';
export {
  extractSignatures,
  extractSignaturesFromFiles,
  formatSignaturesForFile,
  formatSignaturesMap,
} from './signatures';
// Test files parser (SWC-based)
export { parseTestFiles } from './tests-swc';
// Re-export types
export type {
  ComponentInfo,
  ExtractedType,
  ImportItem,
  ImportRelation,
  TestInfo,
  TypeProperty,
  ZodField,
  ZodSchemaInfo,
} from './types';
// Types and imports parser (SWC-based)
export { buildImportGraph, parseTypesInDir } from './types-parser-swc';
// Zod schemas parser (SWC-based)
export { parseZodSchemas } from './zod-swc';
