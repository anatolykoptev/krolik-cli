/**
 * @module types/commands/schema
 * @description Schema analysis result types
 */

/**
 * Schema field definition
 */
export interface SchemaField {
  name: string;
  type: string;
  isOptional: boolean;
  isArray: boolean;
  attributes: string[];
}

/**
 * Schema relation definition
 */
export interface SchemaRelation {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  target: string;
}

/**
 * Schema model definition
 */
export interface SchemaModel {
  name: string;
  fields: SchemaField[];
  relations: SchemaRelation[];
}

/**
 * Schema analysis result
 */
export interface SchemaResult {
  models: SchemaModel[];
  enums: Array<{ name: string; values: string[] }>;
  modelCount: number;
  enumCount: number;
}
