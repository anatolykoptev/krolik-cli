/**
 * @module commands/context/collectors
 * @description Data collectors for context generation
 *
 * Collectors extract structured data from various sources:
 * - constraints: Critical rules from schema and hints
 * - entrypoints: Where to start reading code for a domain
 * - data-flow: How data moves through the system
 */

export type { Constraint, ConstraintSeverity, ConstraintType } from './constraints';
export {
  collectConstraints,
  extractHintConstraints,
  extractModelConstraints,
  extractSchemaConstraints,
} from './constraints';
export type { DataFlow, DataFlowStep } from './data-flow';
export { generateDataFlows } from './data-flow';
export type { EntryPoint, EntryPointLayer, EntryPointRole } from './entrypoints';
export { detectEntryPoints } from './entrypoints';
