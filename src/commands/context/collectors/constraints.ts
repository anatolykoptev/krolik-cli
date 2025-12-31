/**
 * @module commands/context/collectors/constraints
 * @description Extract critical constraints from schema and CLAUDE.md hints
 *
 * Constraints are hard requirements that agents must follow:
 * - Concurrency: $transaction for atomic operations
 * - Cascade: onDelete behavior affecting data integrity
 * - Validation: required fields, unique constraints
 * - Timezone: UTC storage rules
 * - Security: access control patterns
 */

import type { SchemaOutput } from '../../schema/output';
import type { DbRelations, ModelRelation } from '../parsers/db-relations';

export type ConstraintSeverity = 'critical' | 'high' | 'medium';
export type ConstraintType =
  | 'concurrency'
  | 'cascade'
  | 'validation'
  | 'timezone'
  | 'security'
  | 'pattern';

export interface Constraint {
  type: ConstraintType;
  severity: ConstraintSeverity;
  message: string;
  source: string;
  /** Optional: model or domain this constraint applies to */
  scope?: string;
}

/**
 * Extract constraints from Prisma schema relations
 *
 * @param dbRelations - Parsed database relations
 * @param domains - Active domains to filter by
 */
export function extractSchemaConstraints(
  dbRelations: DbRelations,
  domains: string[],
): Constraint[] {
  const constraints: Constraint[] = [];
  const domainSet = new Set(domains.map((d) => d.toLowerCase()));

  for (const rel of dbRelations.relations) {
    // Filter by domain if provided
    if (domains.length > 0 && !isRelatedToDomain(rel, domainSet)) {
      continue;
    }

    // Cascade delete = critical (data loss risk)
    if (rel.onDelete === 'Cascade') {
      constraints.push({
        type: 'cascade',
        severity: 'critical',
        message: `${rel.from}.${rel.field} -> ${rel.to}: cascade delete (data loss risk)`,
        source: 'prisma-schema',
        scope: rel.from,
      });
    }

    // Required relations = high (validation errors)
    if (!rel.isOptional && rel.onDelete !== 'Cascade') {
      constraints.push({
        type: 'validation',
        severity: 'high',
        message: `${rel.from}.${rel.field} is required (FK constraint)`,
        source: 'prisma-schema',
        scope: rel.from,
      });
    }
  }

  // Unique constraints from indexes
  const uniqueIndexes = dbRelations.indexes.filter((idx) => idx.unique);
  for (const idx of uniqueIndexes) {
    if (domains.length > 0 && !domainSet.has(idx.model.toLowerCase())) {
      continue;
    }

    if (idx.fields.length > 1) {
      constraints.push({
        type: 'validation',
        severity: 'medium',
        message: `${idx.model}: unique constraint on [${idx.fields.join(', ')}]`,
        source: 'prisma-schema',
        scope: idx.model,
      });
    }
  }

  return constraints;
}

/**
 * Extract constraints from schema output (models, fields)
 */
export function extractModelConstraints(schema: SchemaOutput, domains: string[]): Constraint[] {
  const constraints: Constraint[] = [];
  const domainSet = new Set(domains.map((d) => d.toLowerCase()));

  for (const model of schema.models) {
    // Filter by domain (model name contains domain keyword)
    if (domains.length > 0 && !matchesDomain(model.name, domainSet)) {
      continue;
    }

    // Check for required unique fields (business logic)
    const uniqueFields = model.fields.filter((f) => f.isUnique && f.isRequired);
    for (const field of uniqueFields) {
      constraints.push({
        type: 'validation',
        severity: 'medium',
        message: `${model.name}.${field.name} must be unique`,
        source: 'prisma-schema',
        scope: model.name,
      });
    }
  }

  return constraints;
}

/**
 * Extract constraints from CLAUDE.md domain hints
 *
 * Parses hint values for constraint keywords:
 * - "$transaction" -> concurrency
 * - "UTC" / "timezone" -> timezone
 * - "ctx.session" / "access control" -> security
 */
export function extractHintConstraints(
  hints: Record<string, string>,
  domains: string[],
): Constraint[] {
  const constraints: Constraint[] = [];

  for (const [key, value] of Object.entries(hints)) {
    // Concurrency constraints (transaction required)
    if (value.includes('$transaction') || value.includes('transaction')) {
      constraints.push({
        type: 'concurrency',
        severity: 'critical',
        message: value,
        source: 'claude.md',
        scope: key,
      });
    }

    // Timezone constraints
    if (value.toLowerCase().includes('utc') || value.toLowerCase().includes('timezone')) {
      constraints.push({
        type: 'timezone',
        severity: 'medium',
        message: value,
        source: 'claude.md',
        scope: key,
      });
    }

    // Security constraints
    if (
      value.includes('ctx.session') ||
      value.toLowerCase().includes('access control') ||
      value.toLowerCase().includes('sensitive')
    ) {
      constraints.push({
        type: 'security',
        severity: 'high',
        message: value,
        source: 'claude.md',
        scope: key,
      });
    }

    // Pattern constraints (cascade, relations in hints)
    if (key === 'relations' || value.includes('cascade')) {
      constraints.push({
        type: 'cascade',
        severity: 'high',
        message: value,
        source: 'claude.md',
        scope: domains[0] || 'general',
      });
    }
  }

  return constraints;
}

/**
 * Collect all constraints for given domains
 *
 * Merges constraints from:
 * 1. Schema relations (cascade, required)
 * 2. Schema models (unique constraints)
 * 3. CLAUDE.md hints (concurrency, timezone, security)
 *
 * @returns Sorted by severity (critical first)
 */
export function collectConstraints(
  schema: SchemaOutput | undefined,
  dbRelations: DbRelations | undefined,
  hints: Record<string, string>,
  domains: string[],
): Constraint[] {
  const constraints: Constraint[] = [];

  // Extract from db relations
  if (dbRelations) {
    constraints.push(...extractSchemaConstraints(dbRelations, domains));
  }

  // Extract from schema models
  if (schema) {
    constraints.push(...extractModelConstraints(schema, domains));
  }

  // Extract from hints
  constraints.push(...extractHintConstraints(hints, domains));

  // Sort by severity: critical > high > medium
  const severityOrder: Record<ConstraintSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
  };

  return constraints.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * Check if a relation is related to any of the active domains
 */
function isRelatedToDomain(rel: ModelRelation, domainSet: Set<string>): boolean {
  const fromLower = rel.from.toLowerCase();
  const toLower = rel.to.toLowerCase();

  for (const domain of domainSet) {
    if (fromLower.includes(domain) || toLower.includes(domain)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if model name matches any domain
 */
function matchesDomain(modelName: string, domainSet: Set<string>): boolean {
  const nameLower = modelName.toLowerCase();
  for (const domain of domainSet) {
    if (nameLower.includes(domain)) {
      return true;
    }
  }
  return false;
}
