/**
 * @module commands/context/formatters/ai/sections/advanced-analysis
 * @description Formatters for advanced analysis sections: Import Graph, DB Relations, API Contracts, Env Vars
 */

import type { AiContextData } from '../../../types';
import { escapeXml, MAX_ITEMS_LARGE, MAX_ITEMS_MEDIUM, MAX_SIZE } from '../helpers';

/**
 * Determine risk level based on import count
 */
function getImportRisk(importCount: number): 'critical' | 'high' | 'medium' | 'low' {
  if (importCount >= 50) return 'critical';
  if (importCount >= 20) return 'high';
  if (importCount >= 10) return 'medium';
  return 'low';
}

/**
 * Format import graph with circular dependency detection
 */
export function formatImportGraphSection(lines: string[], data: AiContextData): void {
  const { importGraph } = data;
  if (!importGraph || importGraph.nodes.length === 0) return;

  lines.push('  <import-graph>');

  // Show circular dependencies first (critical - must fix)
  if (importGraph.circular.length > 0) {
    lines.push('    <circular-dependencies priority="critical" action="must-fix">');
    for (const cycle of importGraph.circular.slice(0, 10)) {
      const cyclePath = cycle.map((f) => escapeXml(f)).join(' → ');
      // Suggest fix: extract shared types to separate file
      lines.push(`      <cycle fix="extract-types">${cyclePath}</cycle>`);
    }
    if (importGraph.circular.length > 10) {
      lines.push(`      <!-- +${importGraph.circular.length - 10} more cycles -->`);
    }
    lines.push('    </circular-dependencies>');
  }

  // Show nodes summary with health indicator
  const healthStatus = importGraph.circular.length === 0 ? 'healthy' : 'issues';
  lines.push(
    `    <summary nodes="${importGraph.nodes.length}" circular="${importGraph.circular.length}" health="${healthStatus}"/>`,
  );

  // Show top-level dependencies (most imported files) with risk levels
  const sortedNodes = [...importGraph.nodes].sort(
    (a, b) => (b.importedBy?.length ?? 0) - (a.importedBy?.length ?? 0),
  );

  const hotNodes = sortedNodes.filter((n) => (n.importedBy?.length ?? 0) > 2).slice(0, 10);
  if (hotNodes.length > 0) {
    lines.push('    <hot-files note="changes here affect many files">');
    for (const node of hotNodes) {
      const count = node.importedBy?.length ?? 0;
      const risk = getImportRisk(count);
      lines.push(
        `      <file path="${escapeXml(node.file)}" imported-by="${count}" risk="${risk}"/>`,
      );
    }
    lines.push('    </hot-files>');
  }

  lines.push('  </import-graph>');
}

/**
 * Format models list for database section
 */
function formatModels(lines: string[], models: string[]): void {
  if (models.length === 0) return;
  lines.push(`    <models count="${models.length}">`);
  for (const model of models.slice(0, MAX_SIZE)) {
    lines.push(`      <model>${model}</model>`);
  }
  if (models.length > MAX_SIZE) {
    lines.push(`      <!-- +${models.length - MAX_SIZE} more models -->`);
  }
  lines.push('    </models>');
}

/**
 * Format a single relation XML element
 */
function formatRelationElement(
  rel: {
    from: string;
    to: string;
    type?: string;
    field: string;
    onDelete?: string;
    isOptional?: boolean;
  },
  includeMeta: boolean,
): string {
  const optional = rel.isOptional ? ' optional="true"' : '';
  if (includeMeta) {
    const onDelete = rel.onDelete ? ` on-delete="${rel.onDelete}"` : '';
    return `      <relation from="${rel.from}" to="${rel.to}" type="${rel.type}" field="${rel.field}"${onDelete}${optional}/>`;
  }
  return `      <relation from="${rel.from}" to="${rel.to}" field="${rel.field}"${optional}/>`;
}

/**
 * Format cascade relations (high risk)
 */
function formatCascadeRelations(
  lines: string[],
  cascadeRels: Array<{ from: string; to: string; field: string; isOptional?: boolean }>,
): void {
  if (cascadeRels.length === 0) return;
  lines.push(
    `    <cascade-relations count="${cascadeRels.length}" risk="high" note="deleting parent deletes children">`,
  );
  for (const rel of cascadeRels.slice(0, MAX_ITEMS_MEDIUM)) {
    lines.push(formatRelationElement(rel, false));
  }
  if (cascadeRels.length > MAX_ITEMS_MEDIUM) {
    lines.push(`      <!-- +${cascadeRels.length - MAX_ITEMS_MEDIUM} more cascade relations -->`);
  }
  lines.push('    </cascade-relations>');
}

/**
 * Format regular relations
 */
function formatRegularRelations(
  lines: string[],
  otherRels: Array<{
    from: string;
    to: string;
    type?: string;
    field: string;
    onDelete?: string;
    isOptional?: boolean;
  }>,
): void {
  if (otherRels.length === 0) return;
  lines.push(`    <relations count="${otherRels.length}">`);
  for (const rel of otherRels.slice(0, MAX_ITEMS_LARGE)) {
    lines.push(formatRelationElement(rel, true));
  }
  if (otherRels.length > MAX_ITEMS_LARGE) {
    lines.push(`      <!-- +${otherRels.length - MAX_ITEMS_LARGE} more relations -->`);
  }
  lines.push('    </relations>');
}

/**
 * Format database indexes
 */
function formatIndexes(
  lines: string[],
  indexes: Array<{ model: string; fields: string[]; unique?: boolean; name?: string }>,
): void {
  if (!indexes || indexes.length === 0) return;
  lines.push(`    <indexes count="${indexes.length}">`);
  for (const idx of indexes.slice(0, MAX_ITEMS_MEDIUM)) {
    const uniqueAttr = idx.unique ? ' unique="true"' : '';
    const nameAttr = idx.name ? ` name="${escapeXml(idx.name)}"` : '';
    lines.push(
      `      <index model="${idx.model}" fields="${idx.fields.join(', ')}"${uniqueAttr}${nameAttr}/>`,
    );
  }
  if (indexes.length > MAX_ITEMS_MEDIUM) {
    lines.push(`      <!-- +${indexes.length - MAX_ITEMS_MEDIUM} more indexes -->`);
  }
  lines.push('    </indexes>');
}

/**
 * Format database relations from Prisma schema
 */
export function formatDbRelationsSection(lines: string[], data: AiContextData): void {
  const { dbRelations } = data;
  if (!dbRelations || (dbRelations.models.length === 0 && dbRelations.relations.length === 0))
    return;

  const cascadeDeletes = dbRelations.relations.filter((r) => r.onDelete === 'Cascade').length;
  const cascadeWarning = cascadeDeletes > 10 ? ' cascade-warning="true"' : '';

  lines.push(`  <database-relations${cascadeWarning}>`);

  formatModels(lines, dbRelations.models);

  if (dbRelations.relations.length > 0) {
    const cascadeRels = dbRelations.relations.filter((r) => r.onDelete === 'Cascade');
    const otherRels = dbRelations.relations.filter((r) => r.onDelete !== 'Cascade');
    formatCascadeRelations(lines, cascadeRels);
    formatRegularRelations(lines, otherRels);
  }

  formatIndexes(lines, dbRelations.indexes);

  lines.push('  </database-relations>');
}

/** Max fields to show in API contract schemas */
const MAX_SCHEMA_FIELDS = 10;

/** Schema field type for input/output */
interface SchemaField {
  name: string;
  type: string;
  required?: boolean;
  validation?: string;
}

/** Schema info for procedure input/output */
interface SchemaInfo {
  schema: string;
  fields?: SchemaField[];
}

/**
 * Format schema fields (input or output)
 */
function formatSchemaFields(
  lines: string[],
  schema: SchemaInfo,
  tag: 'input' | 'output',
  includeValidation: boolean,
): void {
  const fields = schema.fields ?? [];
  if (fields.length === 0) {
    lines.push(`        <${tag} schema="${schema.schema}"/>`);
    return;
  }
  lines.push(`        <${tag} schema="${schema.schema}">`);
  for (const field of fields.slice(0, MAX_SCHEMA_FIELDS)) {
    const req = field.required ? '' : '?';
    const val =
      includeValidation && field.validation ? ` validation="${escapeXml(field.validation)}"` : '';
    lines.push(`          ${field.name}${req}: ${escapeXml(field.type)}${val}`);
  }
  if (fields.length > MAX_SCHEMA_FIELDS) {
    lines.push(`          <!-- +${fields.length - MAX_SCHEMA_FIELDS} more fields -->`);
  }
  lines.push(`        </${tag}>`);
}

/** Procedure type for API contracts */
interface ProcedureInfo {
  type: string;
  name: string;
  protection: string;
  input?: SchemaInfo;
  output?: SchemaInfo;
}

/**
 * Format a single procedure
 */
function formatProcedure(lines: string[], proc: ProcedureInfo): void {
  const protAttr = proc.protection !== 'public' ? ` protection="${proc.protection}"` : '';

  if (!proc.input && !proc.output) {
    lines.push(`      <${proc.type} name="${proc.name}"${protAttr}/>`);
    return;
  }

  lines.push(`      <${proc.type} name="${proc.name}"${protAttr}>`);
  if (proc.input) formatSchemaFields(lines, proc.input, 'input', true);
  if (proc.output) formatSchemaFields(lines, proc.output, 'output', false);
  lines.push(`      </${proc.type}>`);
}

/** Router type for API contracts */
interface RouterInfo {
  name: string;
  path: string;
  procedures: ProcedureInfo[];
  subRouters: string[];
}

/**
 * Format a single router
 */
function formatRouter(lines: string[], router: RouterInfo): void {
  lines.push(`    <router name="${router.name}" path="${escapeXml(router.path)}">`);

  for (const proc of router.procedures.slice(0, MAX_ITEMS_LARGE)) {
    formatProcedure(lines, proc);
  }

  if (router.procedures.length > MAX_ITEMS_LARGE) {
    lines.push(`      <!-- +${router.procedures.length - MAX_ITEMS_LARGE} more procedures -->`);
  }

  if (router.subRouters.length > 0) {
    lines.push(`      <sub-routers>${router.subRouters.join(', ')}</sub-routers>`);
  }

  lines.push('    </router>');
}

/**
 * Format API contracts from tRPC routers
 */
export function formatApiContractsSection(lines: string[], data: AiContextData): void {
  const { apiContracts } = data;
  if (!apiContracts || apiContracts.length === 0) return;

  lines.push('  <api-contracts>');

  for (const router of apiContracts.slice(0, MAX_ITEMS_MEDIUM)) {
    formatRouter(lines, router);
  }

  if (apiContracts.length > MAX_ITEMS_MEDIUM) {
    lines.push(`    <!-- +${apiContracts.length - MAX_ITEMS_MEDIUM} more routers -->`);
  }

  lines.push('  </api-contracts>');
}

/** Priority type for env vars */
type EnvVarPriority = 'critical' | 'high' | 'medium' | 'low';

/** Priority order for sorting */
const PRIORITY_ORDER: Record<EnvVarPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Categorize env var by importance based on name patterns
 */
function getEnvVarPriority(name: string): 'critical' | 'high' | 'medium' | 'low' {
  const criticalPatterns = ['DATABASE_URL', 'AUTH_SECRET', 'NEXTAUTH_', 'JWT_', 'ENCRYPTION_'];
  const highPatterns = ['API_KEY', 'SECRET', 'PASSWORD', 'TOKEN', 'REDIS_', 'STRIPE_'];
  const mediumPatterns = ['NEXT_PUBLIC_', 'APP_', 'BASE_URL', 'SITE_URL'];

  const upperName = name.toUpperCase();

  if (criticalPatterns.some((p) => upperName.includes(p))) return 'critical';
  if (highPatterns.some((p) => upperName.includes(p))) return 'high';
  if (mediumPatterns.some((p) => upperName.includes(p))) return 'medium';
  return 'low';
}

/**
 * Format missing env variables section
 */
function formatMissingVars(lines: string[], missing: string[]): void {
  if (missing.length === 0) return;

  const sorted = [...missing].sort(
    (a, b) => PRIORITY_ORDER[getEnvVarPriority(a)] - PRIORITY_ORDER[getEnvVarPriority(b)],
  );

  lines.push(`    <missing count="${missing.length}" action="add-to-env-file">`);
  for (const varName of sorted.slice(0, MAX_ITEMS_MEDIUM)) {
    lines.push(`      <var priority="${getEnvVarPriority(varName)}">${escapeXml(varName)}</var>`);
  }
  if (missing.length > MAX_ITEMS_MEDIUM) {
    lines.push(`      <!-- +${missing.length - MAX_ITEMS_MEDIUM} more missing -->`);
  }
  lines.push('    </missing>');
}

/**
 * Format unused env variables section
 */
function formatUnusedVars(lines: string[], unused: string[]): void {
  if (unused.length === 0) return;

  lines.push(`    <unused count="${unused.length}" action="remove-or-use">`);
  for (const varName of unused.slice(0, MAX_ITEMS_MEDIUM)) {
    lines.push(`      <var>${escapeXml(varName)}</var>`);
  }
  if (unused.length > MAX_ITEMS_MEDIUM) {
    lines.push(`      <!-- +${unused.length - MAX_ITEMS_MEDIUM} more unused -->`);
  }
  lines.push('    </unused>');
}

/**
 * Format env var usages section
 */
function formatEnvUsages(lines: string[], usages: Array<{ name: string }>): void {
  if (usages.length === 0) return;

  const byVar = new Map<string, number>();
  for (const usage of usages) {
    byVar.set(usage.name, (byVar.get(usage.name) ?? 0) + 1);
  }

  const sortedVars = Array.from(byVar.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ITEMS_MEDIUM);

  lines.push(`    <usages total="${usages.length}" unique="${byVar.size}">`);
  for (const [name, count] of sortedVars) {
    lines.push(`      <var name="${escapeXml(name)}" references="${count}"/>`);
  }
  if (byVar.size > MAX_ITEMS_MEDIUM) {
    lines.push(`      <!-- +${byVar.size - MAX_ITEMS_MEDIUM} more variables -->`);
  }
  lines.push('    </usages>');
}

/**
 * Format environment variables analysis
 */
export function formatEnvVarsSection(lines: string[], data: AiContextData): void {
  const { envVars } = data;
  if (!envVars) return;

  const hasMissing = envVars.missing.length > 0;
  const hasUnused = envVars.unused.length > 0;
  const hasUsages = envVars.usages.length > 0;

  if (!hasMissing && !hasUnused && !hasUsages) return;

  const criticalMissing = envVars.missing.filter((v) => getEnvVarPriority(v) === 'critical').length;
  const health = criticalMissing > 0 ? 'critical' : hasMissing ? 'warning' : 'healthy';

  lines.push(`  <env-vars health="${health}">`);

  formatMissingVars(lines, envVars.missing);
  formatUnusedVars(lines, envVars.unused);
  formatEnvUsages(lines, envVars.usages);

  const usedCount = new Set(envVars.usages.map((u) => u.name)).size;
  lines.push(
    `    <summary defined="${envVars.definitions.length}" used="${usedCount}" missing="${envVars.missing.length}" unused="${envVars.unused.length}"/>`,
  );

  lines.push('  </env-vars>');
}
