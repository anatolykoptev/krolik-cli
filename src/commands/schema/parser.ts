/**
 * @module commands/schema/parser
 * @description Prisma schema file parser
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Prisma field definition
 */
export interface PrismaField {
  name: string;
  type: string;
  isRequired: boolean;
  isArray: boolean;
  isUnique: boolean;
  isId: boolean;
  default?: string;
}

/**
 * Prisma model definition
 */
export interface PrismaModel {
  name: string;
  file: string;
  fields: PrismaField[];
  relations: string[];
  description?: string;
}

/**
 * Prisma enum definition
 */
export interface PrismaEnum {
  name: string;
  file: string;
  values: string[];
}

/**
 * Parse result from a single file
 */
export interface ParseResult {
  models: PrismaModel[];
  enums: PrismaEnum[];
}

/**
 * Parse a Prisma schema file
 */
export function parsePrismaFile(filePath: string): ParseResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  return {
    models: parseModels(content, fileName),
    enums: parseEnums(content, fileName),
  };
}

/**
 * Parse models from content
 */
function parseModels(content: string, fileName: string): PrismaModel[] {
  const models: PrismaModel[] = [];
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let match;

  while ((match = modelRegex.exec(content)) !== null) {
    const [, name, body] = match;
    if (!name || !body) continue;

    const fields: PrismaField[] = [];
    const relations: string[] = [];

    const lines = body.trim().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

      const field = parseField(trimmed);
      if (field) {
        if (field.isRelation) {
          relations.push(field.type);
        } else {
          fields.push({
            name: field.name,
            type: field.type,
            isRequired: field.isRequired,
            isArray: field.isArray,
            isUnique: field.isUnique,
            isId: field.isId,
            default: field.default,
          });
        }
      }
    }

    models.push({
      name,
      file: fileName,
      fields,
      relations: [...new Set(relations)],
    });
  }

  return models;
}

/**
 * Parse a single field line
 */
function parseField(line: string): {
  name: string;
  type: string;
  isRequired: boolean;
  isArray: boolean;
  isUnique: boolean;
  isId: boolean;
  isRelation: boolean;
  default?: string;
} | null {
  const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)/);
  if (!fieldMatch) return null;

  const [, name, type, isArray, isOptional, rest] = fieldMatch;
  if (!name || !type) return null;

  return {
    name,
    type,
    isRequired: !isOptional,
    isArray: !!isArray,
    isUnique: rest?.includes('@unique') || false,
    isId: rest?.includes('@id') || false,
    isRelation: rest?.includes('@relation') || false,
    default: rest?.match(/@default\(([^)]+)\)/)?.[1],
  };
}

/**
 * Parse enums from content
 */
function parseEnums(content: string, fileName: string): PrismaEnum[] {
  const enums: PrismaEnum[] = [];
  const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
  let match;

  while ((match = enumRegex.exec(content)) !== null) {
    const [, name, body] = match;
    if (!name || !body) continue;

    const values = body
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//'));

    enums.push({ name, file: fileName, values });
  }

  return enums;
}

/**
 * Find and parse all Prisma files in a directory
 */
export function parseSchemaDirectory(schemaDir: string): ParseResult {
  const allModels: PrismaModel[] = [];
  const allEnums: PrismaEnum[] = [];

  // Parse main schema.prisma
  const schemaFile = path.join(schemaDir, 'schema.prisma');
  if (fs.existsSync(schemaFile)) {
    const { models, enums } = parsePrismaFile(schemaFile);
    allModels.push(...models);
    allEnums.push(...enums);
  }

  // Parse models directory
  const modelsDir = path.join(schemaDir, 'models');
  if (fs.existsSync(modelsDir)) {
    const modelFiles = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.prisma'));
    for (const file of modelFiles) {
      const { models, enums } = parsePrismaFile(path.join(modelsDir, file));
      allModels.push(...models);
      allEnums.push(...enums);
    }
  }

  return { models: allModels, enums: allEnums };
}
