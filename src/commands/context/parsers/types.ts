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
