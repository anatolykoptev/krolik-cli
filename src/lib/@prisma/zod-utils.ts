/**
 * @module lib/@prisma/zod-utils
 * @description Shared utilities for Prisma to Zod conversion
 */

import type { PrismaEnum, PrismaField } from '@/commands/schema/parser';

// ============================================================================
// TYPE MAPPINGS
// ============================================================================

/** Map Prisma scalar types to Zod methods */
export const PRISMA_TO_ZOD: Record<string, string> = {
  String: 'z.string()',
  Int: 'z.number().int()',
  Float: 'z.number()',
  Boolean: 'z.boolean()',
  DateTime: 'z.date()',
  Json: 'z.unknown()',
  BigInt: 'z.bigint()',
  Decimal: 'z.number()',
  Bytes: 'z.instanceof(Buffer)',
};

/** Common ID field patterns and their Zod representations */
export const ID_PATTERNS: Record<string, string> = {
  cuid: 'z.string().cuid()',
  uuid: 'z.string().uuid()',
  autoincrement: 'z.number().int().positive()',
  default: 'z.string()',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Detect ID type from Prisma default value
 */
export function detectIdType(defaultValue?: string): string {
  if (!defaultValue) return ID_PATTERNS.default as string;

  const lower = defaultValue.toLowerCase();
  if (lower.includes('cuid')) return ID_PATTERNS.cuid as string;
  if (lower.includes('uuid')) return ID_PATTERNS.uuid as string;
  if (lower.includes('autoincrement')) return ID_PATTERNS.autoincrement as string;

  return ID_PATTERNS.default as string;
}

/**
 * Convert a Prisma field to Zod type string
 */
export function fieldToZod(field: PrismaField, enums: Map<string, PrismaEnum>): string {
  let zodType: string;

  // Check if it's an enum
  if (enums.has(field.type)) {
    const enumDef = enums.get(field.type)!;
    const values = enumDef.values.map((v) => `'${v}'`).join(', ');
    zodType = `z.enum([${values}])`;
  }
  // Check if it's a known scalar type
  else if (PRISMA_TO_ZOD[field.type]) {
    zodType = PRISMA_TO_ZOD[field.type] as string;

    // Special handling for ID fields
    if (field.isId) {
      zodType = detectIdType(field.default);
    }
  }
  // Unknown type (likely a relation) - skip
  else {
    return '';
  }

  // Handle array
  if (field.isArray) {
    zodType = `z.array(${zodType})`;
  }

  // Handle optional
  if (!field.isRequired) {
    zodType = `${zodType}.optional()`;
  }

  return zodType;
}
