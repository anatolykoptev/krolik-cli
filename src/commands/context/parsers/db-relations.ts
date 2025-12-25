/**
 * @module commands/context/parsers/db-relations
 * @description Prisma schema relations analyzer
 *
 * Parses Prisma schema files to extract:
 * - Model relationships (one-to-one, one-to-many, many-to-many)
 * - Foreign keys with cascade rules
 * - Indexes and unique constraints
 * - ASCII diagram visualization
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Relation type classification
 */
export type RelationType = 'one-to-one' | 'one-to-many' | 'many-to-many';

/**
 * Cascade behavior for onDelete/onUpdate
 */
export type CascadeBehavior = 'Cascade' | 'Restrict' | 'NoAction' | 'SetNull' | 'SetDefault';

/**
 * Model relation definition
 */
export interface ModelRelation {
  from: string; // source model
  to: string; // target model
  field: string; // field name in source model
  type: RelationType;
  onDelete?: CascadeBehavior;
  onUpdate?: CascadeBehavior;
  isOptional: boolean; // whether field is optional (?)
  backRelationField?: string; // field name in target model (reverse relation)
  backRelationArray?: boolean; // whether back relation is array
  relationName?: string; // @relation("Name") if specified
}

/**
 * Index definition
 */
export interface ModelIndex {
  model: string;
  fields: string[];
  unique: boolean;
  name?: string; // @@index([...], name: "idx_name")
}

/**
 * Complete database relations analysis
 */
export interface DbRelations {
  models: string[];
  relations: ModelRelation[];
  indexes: ModelIndex[];
}

/**
 * Parse a single Prisma file for relations
 */
function parsePrismaFileRelations(filePath: string): DbRelations {
  const content = fs.readFileSync(filePath, 'utf-8');
  const models: string[] = [];
  const relations: ModelRelation[] = [];
  const indexes: ModelIndex[] = [];

  // Extract all models
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let modelMatch;

  while ((modelMatch = modelRegex.exec(content)) !== null) {
    const [, modelName, modelBody] = modelMatch;
    if (!modelName || !modelBody) continue;

    models.push(modelName);

    // Parse relations within the model
    const lines = modelBody.trim().split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Parse relation field: fieldName ModelType? @relation(...)
      const relationMatch = trimmed.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s+@relation\(([^)]+)\)/);

      if (relationMatch) {
        const [, fieldName, targetModel, isArray, isOptional, relationArgs] = relationMatch;

        if (!fieldName || !targetModel || !relationArgs) continue;

        // Parse @relation arguments
        const relationName = relationArgs.match(/"([^"]+)"/)?.[1];
        const onDeleteMatch = relationArgs.match(/onDelete:\s*(\w+)/);
        const onUpdateMatch = relationArgs.match(/onUpdate:\s*(\w+)/);

        // Determine relation type
        let relationType: RelationType;
        if (isArray) {
          // Array field: one-to-many or many-to-many
          // We'll check for back-relation to determine
          relationType = 'one-to-many';
        } else {
          // Scalar field: one-to-one or many-to-one
          relationType = 'one-to-one';
        }

        const relation: ModelRelation = {
          from: modelName,
          to: targetModel,
          field: fieldName,
          type: relationType,
          isOptional: !!isOptional,
        };

        if (onDeleteMatch?.[1]) {
          relation.onDelete = onDeleteMatch[1] as CascadeBehavior;
        }
        if (onUpdateMatch?.[1]) {
          relation.onUpdate = onUpdateMatch[1] as CascadeBehavior;
        }
        if (relationName) {
          relation.relationName = relationName;
        }

        relations.push(relation);
      }

      // Parse @@index
      const indexMatch = trimmed.match(/@@index\(\[([^\]]+)\](?:,\s*name:\s*"([^"]+)")?\)/);
      if (indexMatch) {
        const [, fieldsStr, indexName] = indexMatch;
        if (!fieldsStr) continue;

        const fields = fieldsStr.split(',').map((f) => f.trim());
        const idx: ModelIndex = {
          model: modelName,
          fields,
          unique: false,
        };
        if (indexName) {
          idx.name = indexName;
        }
        indexes.push(idx);
      }

      // Parse @@unique
      const uniqueMatch = trimmed.match(/@@unique\(\[([^\]]+)\](?:,\s*name:\s*"([^"]+)")?\)/);
      if (uniqueMatch) {
        const [, fieldsStr, indexName] = uniqueMatch;
        if (!fieldsStr) continue;

        const fields = fieldsStr.split(',').map((f) => f.trim());
        const idx: ModelIndex = {
          model: modelName,
          fields,
          unique: true,
        };
        if (indexName) {
          idx.name = indexName;
        }
        indexes.push(idx);
      }

      // Parse inline @unique
      const fieldUniqueMatch = trimmed.match(/^(\w+)\s+\w+.*@unique/);
      if (fieldUniqueMatch) {
        const fieldName = fieldUniqueMatch[1];
        if (fieldName) {
          indexes.push({
            model: modelName,
            fields: [fieldName],
            unique: true,
          });
        }
      }
    }
  }

  return { models, relations, indexes };
}

/**
 * Enhance relations with back-relation information
 */
function enhanceRelations(relations: ModelRelation[]): ModelRelation[] {
  const enhanced = [...relations];

  // Build a map for quick lookup
  const relationMap = new Map<string, ModelRelation[]>();
  for (const rel of enhanced) {
    const key = `${rel.to}-${rel.from}`;
    if (!relationMap.has(key)) {
      relationMap.set(key, []);
    }
    relationMap.get(key)?.push(rel);
  }

  // Find back-relations and determine relation types
  for (const rel of enhanced) {
    const backKey = `${rel.from}-${rel.to}`;
    const backRelations = relationMap.get(backKey) || [];

    // Find matching back-relation (by relationName or model pairing)
    const backRel = backRelations.find(
      (r) => !r.backRelationField && (!rel.relationName || r.relationName === rel.relationName),
    );

    if (backRel) {
      rel.backRelationField = backRel.field;
      rel.backRelationArray = backRel.type !== 'one-to-one';

      // Refine relation type based on back-relation
      if (rel.type === 'one-to-many' && backRel.type === 'one-to-many') {
        // Both sides are arrays = many-to-many
        rel.type = 'many-to-many';
        backRel.type = 'many-to-many';
      } else if (rel.type === 'one-to-one' && backRel.type === 'one-to-many') {
        // Scalar -> Array = many-to-one (from rel perspective)
        rel.type = 'one-to-many';
      }

      // Mark back-relation as processed
      backRel.backRelationField = rel.field;
      backRel.backRelationArray = rel.type !== 'one-to-one';
    }
  }

  return enhanced;
}

/**
 * Parse all Prisma files in a directory
 */
export function parseDbRelations(schemaDir: string): DbRelations {
  const allModels: string[] = [];
  const allRelations: ModelRelation[] = [];
  const allIndexes: ModelIndex[] = [];

  // Parse schema.prisma
  const schemaFile = path.join(schemaDir, 'schema.prisma');
  if (fs.existsSync(schemaFile)) {
    const { models, relations, indexes } = parsePrismaFileRelations(schemaFile);
    allModels.push(...models);
    allRelations.push(...relations);
    allIndexes.push(...indexes);
  }

  // Parse models directory
  const modelsDir = path.join(schemaDir, 'models');
  if (fs.existsSync(modelsDir)) {
    const modelFiles = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.prisma'));
    for (const file of modelFiles) {
      const { models, relations, indexes } = parsePrismaFileRelations(path.join(modelsDir, file));
      allModels.push(...models);
      allRelations.push(...relations);
      allIndexes.push(...indexes);
    }
  }

  // Enhance relations with back-relation info
  const enhancedRelations = enhanceRelations(allRelations);

  return {
    models: [...new Set(allModels)],
    relations: enhancedRelations,
    indexes: allIndexes,
  };
}

/**
 * Format relation as ASCII diagram line
 */
function formatRelationLine(rel: ModelRelation): string {
  const optional = rel.isOptional ? '?' : '';
  const cascade = rel.onDelete ? ` [${rel.onDelete}]` : '';

  let arrow: string;
  switch (rel.type) {
    case 'one-to-one':
      arrow = '1 ──── 1';
      break;
    case 'one-to-many':
      arrow = '1 ──── *';
      break;
    case 'many-to-many':
      arrow = '* ──── *';
      break;
  }

  const backInfo = rel.backRelationField ? ` (← ${rel.backRelationField})` : '';

  return `  ${rel.from}.${rel.field}${optional} ${arrow} ${rel.to}${cascade}${backInfo}`;
}

/**
 * Filter relations by model names
 */
function filterRelationsByModels(
  relations: ModelRelation[],
  filterModels: string[],
): ModelRelation[] {
  const modelSet = new Set(filterModels.map((m) => m.toLowerCase()));

  return relations.filter(
    (rel) => modelSet.has(rel.from.toLowerCase()) || modelSet.has(rel.to.toLowerCase()),
  );
}

/**
 * Format DB relations as ASCII diagram
 */
export function formatDbRelationsAscii(relations: DbRelations, filterModels?: string[]): string {
  const lines: string[] = [];

  lines.push('DATABASE RELATIONS');
  lines.push('='.repeat(60));
  lines.push('');

  // Apply filter if provided
  const displayRelations = filterModels
    ? filterRelationsByModels(relations.relations, filterModels)
    : relations.relations;

  // Get all models involved in filtered relations
  const involvedModels = new Set<string>();
  for (const rel of displayRelations) {
    involvedModels.add(rel.from);
    involvedModels.add(rel.to);
  }

  lines.push(`Models: ${[...involvedModels].sort().join(', ')}`);
  lines.push(`Relations: ${displayRelations.length}`);
  lines.push('');

  // Group relations by source model
  const byModel = new Map<string, ModelRelation[]>();
  for (const rel of displayRelations) {
    if (!byModel.has(rel.from)) {
      byModel.set(rel.from, []);
    }
    byModel.get(rel.from)?.push(rel);
  }

  // Sort models alphabetically
  const sortedModels = [...byModel.keys()].sort();

  for (const model of sortedModels) {
    const rels = byModel.get(model) || [];
    lines.push(`${model}:`);
    for (const rel of rels) {
      lines.push(formatRelationLine(rel));
    }
    lines.push('');
  }

  // Add indexes section for filtered models
  if (filterModels) {
    const modelSet = new Set(filterModels.map((m) => m.toLowerCase()));
    const filteredIndexes = relations.indexes.filter((idx) =>
      modelSet.has(idx.model.toLowerCase()),
    );

    if (filteredIndexes.length > 0) {
      lines.push('INDEXES');
      lines.push('-'.repeat(60));
      lines.push('');

      const indexesByModel = new Map<string, ModelIndex[]>();
      for (const idx of filteredIndexes) {
        if (!indexesByModel.has(idx.model)) {
          indexesByModel.set(idx.model, []);
        }
        indexesByModel.get(idx.model)?.push(idx);
      }

      for (const model of [...indexesByModel.keys()].sort()) {
        const indexes = indexesByModel.get(model) || [];
        lines.push(`${model}:`);
        for (const idx of indexes) {
          const unique = idx.unique ? ' [UNIQUE]' : '';
          const name = idx.name ? ` (${idx.name})` : '';
          lines.push(`  ${idx.fields.join(', ')}${unique}${name}`);
        }
        lines.push('');
      }
    }
  }

  // Legend
  lines.push('LEGEND');
  lines.push('-'.repeat(60));
  lines.push('  1 ──── 1   One-to-one');
  lines.push('  1 ──── *   One-to-many');
  lines.push('  * ──── *   Many-to-many');
  lines.push('  ?          Optional relation');
  lines.push('  [Cascade]  onDelete behavior');
  lines.push('  (← field)  Back-relation field name');
  lines.push('');

  return lines.join('\n');
}

/**
 * Get critical relations for a feature/domain
 *
 * Returns relations that are critical based on:
 * - Cascade deletes
 * - Required relations (non-optional)
 * - Relations to core models
 */
export function getCriticalRelations(
  relations: DbRelations,
  coreModels: string[],
): ModelRelation[] {
  const modelSet = new Set(coreModels.map((m) => m.toLowerCase()));

  return relations.relations.filter((rel) => {
    // Cascade deletes are critical
    if (rel.onDelete === 'Cascade') return true;

    // Required relations are critical
    if (!rel.isOptional) return true;

    // Relations to core models are critical
    if (modelSet.has(rel.from.toLowerCase()) || modelSet.has(rel.to.toLowerCase())) {
      return true;
    }

    return false;
  });
}

/**
 * Format critical relations as ASCII diagram
 */
export function formatCriticalRelationsAscii(relations: DbRelations, coreModels: string[]): string {
  const critical = getCriticalRelations(relations, coreModels);
  const lines: string[] = [];

  lines.push('CRITICAL RELATIONS');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Focus models: ${coreModels.join(', ')}`);
  lines.push(`Critical relations: ${critical.length}`);
  lines.push('');

  // Group by source model
  const byModel = new Map<string, ModelRelation[]>();
  for (const rel of critical) {
    if (!byModel.has(rel.from)) {
      byModel.set(rel.from, []);
    }
    byModel.get(rel.from)?.push(rel);
  }

  for (const model of [...byModel.keys()].sort()) {
    const rels = byModel.get(model) || [];
    lines.push(`${model}:`);
    for (const rel of rels) {
      lines.push(formatRelationLine(rel));

      // Add criticality reason
      const reasons: string[] = [];
      if (rel.onDelete === 'Cascade') reasons.push('cascade delete');
      if (!rel.isOptional) reasons.push('required');
      if (reasons.length > 0) {
        lines.push(`    ⚠️  ${reasons.join(', ')}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
