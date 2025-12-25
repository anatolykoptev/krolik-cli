/**
 * @module commands/context/parsers/types
 * @description Type definitions for parsers
 */

/**
 * Zod schema field definition
 */
export interface ZodField {
  name: string;
  type: string;
  required: boolean;
  validation?: string; // e.g., "min: 1, max: 100"
}

/**
 * Zod schema definition
 */
export interface ZodSchemaInfo {
  name: string;
  type: 'input' | 'output' | 'filter';
  fields: ZodField[];
  file: string;
}

/**
 * Component analysis result
 */
export interface ComponentInfo {
  name: string;
  file: string;
  type: 'client' | 'server';
  purpose?: string;
  imports: string[];
  hooks: string[];
  state?: string;
  fields?: string[];
  errorHandling?: string;
  features?: string[];
}

/**
 * Test file analysis result
 */
export interface TestInfo {
  file: string;
  describes: {
    name: string;
    tests: string[];
  }[];
}

/**
 * Extracted TypeScript interface/type
 */
export interface ExtractedType {
  name: string;
  kind: 'interface' | 'type';
  file: string;
  properties?: TypeProperty[];
  extends?: string[];
  description?: string;
}

/**
 * Property of an interface/type
 */
export interface TypeProperty {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}

/**
 * Import relationship
 */
export interface ImportRelation {
  file: string;
  imports: ImportItem[];
}

/**
 * Import item from a TypeScript file
 */
export interface ImportItem {
  from: string;
  names: string[];
  isTypeOnly: boolean;
}
