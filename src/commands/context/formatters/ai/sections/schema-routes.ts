/**
 * @module commands/context/formatters/ai/sections/schema-routes
 * @description Schema and Routes section formatters
 *
 * Includes:
 * - Full formatters for detailed output
 * - Summary formatters for compact output (routes-summary, schema-highlights)
 *
 * Mode-based optimization:
 * | Mode  | Routes      | Schema      |
 * |-------|-------------|-------------|
 * | quick | summary     | highlights  |
 * | deep  | top 5 full  | top 4 full  |
 * | full  | both (10)   | both (8)    |
 */

import type { InlineField } from '../../../../routes/inline-schema';
import type { RoutesOutput } from '../../../../routes/output';
import type { AiContextData } from '../../../types';
import { filterEnumsByModels, filterModelsByKeywords, filterRoutersByKeywords } from '../filters';
import {
  DEFAULT_PAGE_SIZE,
  getModeLimits,
  MAX_ITEMS_LARGE,
  MAX_ITEMS_MEDIUM,
  MAX_LIMIT,
  MAX_SIZE,
} from '../helpers';

// ============================================================================
// SUMMARY SECTIONS (compact output for quick mode)
// ============================================================================

/**
 * Format routes summary - top routers by procedure count
 * Output: ~200 tokens vs ~800 tokens for full routes
 */
export function formatRoutesSummarySection(lines: string[], data: AiContextData, limit = 10): void {
  const { routes } = data;
  if (!routes || routes.routers.length === 0) return;

  // Sort routers by procedure count (most first)
  const sortedRouters = [...routes.routers].sort(
    (a, b) => b.procedures.length - a.procedures.length,
  );

  const totalProcedures = routes.routers.reduce((sum, r) => sum + r.procedures.length, 0);

  lines.push(
    `  <routes-summary routers="${routes.routers.length}" procedures="${totalProcedures}">`,
  );

  for (const router of sortedRouters.slice(0, limit)) {
    const routerName = router.file.replace(/\.ts$/, '');
    const queries = router.procedures.filter((p) => p.type === 'query').length;
    const mutations = router.procedures.filter((p) => p.type === 'mutation').length;

    lines.push(
      `    <router n="${routerName}" procs="${router.procedures.length}" q="${queries}" m="${mutations}"/>`,
    );
  }

  if (routes.routers.length > limit) {
    lines.push(`    <!-- +${routes.routers.length - limit} more routers -->`);
  }

  lines.push('  </routes-summary>');
}

/**
 * Format schema highlights - top models by reference count
 * Output: ~150 tokens vs ~600 tokens for full schema
 */
export function formatSchemaHighlightsSection(
  lines: string[],
  data: AiContextData,
  limit = 8,
): void {
  const { schema, dbRelations } = data;
  if (!schema || schema.models.length === 0) return;

  // Build reference count map from relations
  const refCounts = new Map<string, number>();
  if (dbRelations) {
    for (const rel of dbRelations.relations) {
      refCounts.set(rel.to, (refCounts.get(rel.to) || 0) + 1);
    }
  }

  // Sort models by reference count (most referenced first)
  const sortedModels = [...schema.models].sort((a, b) => {
    const aRefs = refCounts.get(a.name) || 0;
    const bRefs = refCounts.get(b.name) || 0;
    // If same refs, sort by field count (more complex models first)
    if (aRefs === bRefs) return b.fields.length - a.fields.length;
    return bRefs - aRefs;
  });

  const totalRelations = dbRelations?.relations.length || 0;

  lines.push(
    `  <schema-highlights models="${schema.models.length}" relations="${totalRelations}">`,
  );

  for (const model of sortedModels.slice(0, limit)) {
    const refs = refCounts.get(model.name) || 0;
    const relCount = model.relations?.length || 0;

    lines.push(
      `    <model n="${model.name}" fields="${model.fields.length}" refs="${refs}" rels="${relCount}"/>`,
    );
  }

  if (schema.models.length > limit) {
    lines.push(`    <!-- +${schema.models.length - limit} more models -->`);
  }

  lines.push('  </schema-highlights>');
}

// ============================================================================
// FULL SECTIONS (detailed output)
// ============================================================================

/**
 * Format schema section with mode-based limits
 *
 * Mode behavior:
 * - quick: Uses schema-highlights only (handled in formatAiPrompt)
 * - deep: Shows top 4 models with full details
 * - full: Shows top 8 models plus highlights for overview
 */
export function formatSchemaSection(
  lines: string[],
  data: AiContextData,
  keywords: { primary: string[]; secondary: string[] },
): void {
  const { schema, mode } = data;
  if (!schema || schema.models.length === 0) return;

  // Get mode-based limits
  const limits = getModeLimits(mode);
  const { highlightsOnly, fullLimit } = limits.schema;

  // In quick mode, use highlights only (called separately in formatAiPrompt)
  if (highlightsOnly) {
    return;
  }

  const relevantModels = filterModelsByKeywords(schema.models, keywords);
  if (relevantModels.length === 0) return;

  // Apply mode-based limit
  const modelsToShow = relevantModels.slice(0, fullLimit);

  lines.push('  <schema>');
  formatModels(lines, modelsToShow);

  if (relevantModels.length > fullLimit) {
    lines.push(`    <!-- ${relevantModels.length - fullLimit} more models in this domain -->`);
  }
  lines.push('  </schema>');

  // Enums section (only for shown models)
  const relevantEnums = filterEnumsByModels(schema.enums, modelsToShow);
  if (relevantEnums.length > 0) {
    formatEnums(lines, relevantEnums);
  }
}

/**
 * Format models list
 */
function formatModels(
  lines: string[],
  models: AiContextData['schema'] extends infer S
    ? S extends { models: infer M }
      ? M
      : never
    : never,
): void {
  for (const model of (
    models as Array<{
      name: string;
      file: string;
      fields: Array<{
        name: string;
        type: string;
        isArray?: boolean;
        isRequired?: boolean;
        isId?: boolean;
        isUnique?: boolean;
      }>;
      relations: string[];
    }>
  ).slice(0, 10)) {
    const totalFields = model.fields.length;
    const maxFields = totalFields <= DEFAULT_PAGE_SIZE ? totalFields : MAX_SIZE;
    const fieldsAttr = totalFields > maxFields ? ` totalFields="${totalFields}"` : '';

    lines.push(`    <model name="${model.name}" file="${model.file}"${fieldsAttr}>`);
    formatModelFields(lines, model.fields.slice(0, maxFields), model.relations);

    if (totalFields > maxFields) {
      const omittedCount = totalFields - maxFields;
      lines.push(
        `      <omitted count="${omittedCount}">timestamps, metadata, internal flags</omitted>`,
      );
    }
    lines.push('    </model>');
  }
}

/**
 * Format model fields
 */
function formatModelFields(
  lines: string[],
  fields: Array<{
    name: string;
    type: string;
    isArray?: boolean;
    isRequired?: boolean;
    isId?: boolean;
    isUnique?: boolean;
  }>,
  relations: string[],
): void {
  for (const field of fields) {
    const attrs: string[] = [];
    attrs.push(`type="${field.type}${field.isArray ? '[]' : ''}"`);
    if (!field.isRequired) attrs.push('optional="true"');
    if (field.isId) attrs.push('primary="true"');
    if (field.isUnique) attrs.push('unique="true"');
    if (relations.includes(field.type)) {
      attrs.push(`relation="${field.type}"`);
    }
    lines.push(`      <field name="${field.name}" ${attrs.join(' ')}/>`);
  }
}

/**
 * Format enums section
 */
function formatEnums(lines: string[], enums: Array<{ name: string; values: string[] }>): void {
  lines.push('  <enums>');
  for (const e of enums.slice(0, MAX_SIZE)) {
    const values = e.values.slice(0, 10).join(', ');
    const more = e.values.length > 10 ? `, +${e.values.length - 10} more` : '';
    lines.push(`    <enum name="${e.name}">${values}${more}</enum>`);
  }
  if (enums.length > MAX_SIZE) {
    lines.push(`    <!-- ${enums.length - MAX_SIZE} more enums -->`);
  }
  lines.push('  </enums>');
}

/**
 * Format routes section with mode-based limits
 *
 * Mode behavior:
 * - quick: Uses routes-summary only (handled in formatAiPrompt)
 * - deep: Shows top 5 routers with full details
 * - full: Shows top 10 routers plus summary for overview
 */
export function formatRoutesSection(
  lines: string[],
  data: AiContextData,
  keywords: { primary: string[]; secondary: string[] },
): void {
  const { routes, mode } = data;
  if (!routes || routes.routers.length === 0) return;

  // Get mode-based limits
  const limits = getModeLimits(mode);
  const { summaryOnly, fullLimit } = limits.routes;

  // In quick mode, use summary only (called separately in formatAiPrompt)
  if (summaryOnly) {
    return;
  }

  const relevantRouters = filterRoutersByKeywords(routes.routers, keywords);
  if (relevantRouters.length === 0) return;

  // Apply mode-based limit
  const routersToShow = relevantRouters.slice(0, fullLimit);

  lines.push('  <routes basePath="packages/api/src/routers">');

  for (const router of routersToShow) {
    formatRouter(lines, router);
  }

  if (relevantRouters.length > fullLimit) {
    lines.push(`    <!-- ${relevantRouters.length - fullLimit} more routers in this domain -->`);
  }
  lines.push('  </routes>');
}

/**
 * Format single router
 */
function formatRouter(lines: string[], router: RoutesOutput['routers'][0]): void {
  const routerName = router.file.replace(/\.ts$/, '');
  lines.push(`    <router name="${routerName}" file="${router.file}.ts">`);

  const queries = router.procedures.filter((p) => p.type === 'query');
  const mutations = router.procedures.filter((p) => p.type === 'mutation');

  // Queries
  formatProcedures(lines, queries, 'query', MAX_ITEMS_LARGE, MAX_ITEMS_MEDIUM);

  // Mutations
  formatProcedures(lines, mutations, 'mutation', MAX_ITEMS_LARGE, MAX_ITEMS_MEDIUM);

  lines.push('    </router>');
}

/**
 * Format procedures (queries or mutations)
 */
function formatProcedures(
  lines: string[],
  procedures: RoutesOutput['routers'][0]['procedures'],
  tag: string,
  threshold: number,
  maxItems: number,
): void {
  const limit = procedures.length <= threshold ? procedures.length : maxItems;

  for (const proc of procedures.slice(0, limit)) {
    formatProcedure(lines, proc, tag);
  }

  if (procedures.length > limit) {
    lines.push(`      <${tag}s-omitted count="${procedures.length - limit}"/>`);
  }
}

/**
 * Format a single procedure (query or mutation)
 */
function formatProcedure(
  lines: string[],
  proc: RoutesOutput['routers'][0]['procedures'][0],
  tag: string,
): void {
  const prot = proc.isProtected ? ' protected="true"' : '';
  const outputAttr = proc.outputSchema ? ` output="${proc.outputSchema}"` : '';

  if (proc.inputFields && proc.inputFields.length > 0) {
    const inputStr = formatInputFields(proc.inputFields);
    lines.push(`      <${tag}${prot}${outputAttr}>${proc.name}(${inputStr})</${tag}>`);
  } else {
    const inputAttr = proc.inputSchema
      ? ` input="${proc.inputSchema}"`
      : proc.hasInput
        ? ' input="true"'
        : '';
    lines.push(`      <${tag}${prot}${inputAttr}${outputAttr}>${proc.name}</${tag}>`);
  }
}

/**
 * Format input fields for compact display
 */
function formatInputFields(fields: InlineField[]): string {
  const formatted = fields.slice(0, MAX_LIMIT).map((f) => {
    let str = f.name;
    if (!f.required) str += '?';
    str += `: ${f.type}`;
    if (f.validation) str += ` (${f.validation})`;
    if (f.defaultValue) str += ` = ${f.defaultValue}`;
    return str;
  });

  const suffix = fields.length > MAX_LIMIT ? `, +${fields.length - MAX_LIMIT} more` : '';

  return formatted.join(', ') + suffix;
}
