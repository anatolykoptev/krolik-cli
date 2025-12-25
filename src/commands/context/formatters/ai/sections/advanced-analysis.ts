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
 * Format database relations from Prisma schema
 */
export function formatDbRelationsSection(lines: string[], data: AiContextData): void {
  const { dbRelations } = data;
  if (!dbRelations || (dbRelations.models.length === 0 && dbRelations.relations.length === 0))
    return;

  // Count cascade deletes for health assessment
  const cascadeDeletes = dbRelations.relations.filter((r) => r.onDelete === 'Cascade').length;
  const cascadeWarning = cascadeDeletes > 10 ? ' cascade-warning="true"' : '';

  lines.push(`  <database-relations${cascadeWarning}>`);

  // Models summary
  if (dbRelations.models.length > 0) {
    lines.push(`    <models count="${dbRelations.models.length}">`);
    for (const model of dbRelations.models.slice(0, MAX_SIZE)) {
      lines.push(`      <model>${model}</model>`);
    }
    if (dbRelations.models.length > MAX_SIZE) {
      lines.push(`      <!-- +${dbRelations.models.length - MAX_SIZE} more models -->`);
    }
    lines.push('    </models>');
  }

  // Separate cascade relations (high risk) from others
  if (dbRelations.relations.length > 0) {
    const cascadeRels = dbRelations.relations.filter((r) => r.onDelete === 'Cascade');
    const otherRels = dbRelations.relations.filter((r) => r.onDelete !== 'Cascade');

    // Show cascade relations first with warning
    if (cascadeRels.length > 0) {
      lines.push(
        `    <cascade-relations count="${cascadeRels.length}" risk="high" note="deleting parent deletes children">`,
      );
      for (const rel of cascadeRels.slice(0, MAX_ITEMS_MEDIUM)) {
        const optional = rel.isOptional ? ' optional="true"' : '';
        lines.push(
          `      <relation from="${rel.from}" to="${rel.to}" field="${rel.field}"${optional}/>`,
        );
      }
      if (cascadeRels.length > MAX_ITEMS_MEDIUM) {
        lines.push(
          `      <!-- +${cascadeRels.length - MAX_ITEMS_MEDIUM} more cascade relations -->`,
        );
      }
      lines.push('    </cascade-relations>');
    }

    // Other relations
    if (otherRels.length > 0) {
      lines.push(`    <relations count="${otherRels.length}">`);
      for (const rel of otherRels.slice(0, MAX_ITEMS_LARGE)) {
        const onDelete = rel.onDelete ? ` on-delete="${rel.onDelete}"` : '';
        const optional = rel.isOptional ? ' optional="true"' : '';
        lines.push(
          `      <relation from="${rel.from}" to="${rel.to}" type="${rel.type}" field="${rel.field}"${onDelete}${optional}/>`,
        );
      }
      if (otherRels.length > MAX_ITEMS_LARGE) {
        lines.push(`      <!-- +${otherRels.length - MAX_ITEMS_LARGE} more relations -->`);
      }
      lines.push('    </relations>');
    }
  }

  // Indexes
  if (dbRelations.indexes && dbRelations.indexes.length > 0) {
    lines.push(`    <indexes count="${dbRelations.indexes.length}">`);
    for (const idx of dbRelations.indexes.slice(0, MAX_ITEMS_MEDIUM)) {
      const uniqueAttr = idx.unique ? ' unique="true"' : '';
      const nameAttr = idx.name ? ` name="${escapeXml(idx.name)}"` : '';
      lines.push(
        `      <index model="${idx.model}" fields="${idx.fields.join(', ')}"${uniqueAttr}${nameAttr}/>`,
      );
    }
    if (dbRelations.indexes.length > MAX_ITEMS_MEDIUM) {
      lines.push(`      <!-- +${dbRelations.indexes.length - MAX_ITEMS_MEDIUM} more indexes -->`);
    }
    lines.push('    </indexes>');
  }

  lines.push('  </database-relations>');
}

/**
 * Format API contracts from tRPC routers
 */
export function formatApiContractsSection(lines: string[], data: AiContextData): void {
  const { apiContracts } = data;
  if (!apiContracts || apiContracts.length === 0) return;

  lines.push('  <api-contracts>');

  for (const router of apiContracts.slice(0, MAX_ITEMS_MEDIUM)) {
    lines.push(`    <router name="${router.name}" path="${escapeXml(router.path)}">`);

    // Procedures
    for (const proc of router.procedures.slice(0, MAX_ITEMS_LARGE)) {
      const protAttr = proc.protection !== 'public' ? ` protection="${proc.protection}"` : '';

      if (proc.input || proc.output) {
        lines.push(`      <${proc.type} name="${proc.name}"${protAttr}>`);

        // Input schema
        if (proc.input) {
          if (proc.input.fields.length > 0) {
            lines.push(`        <input schema="${proc.input.schema}">`);
            for (const field of proc.input.fields.slice(0, 10)) {
              const req = field.required ? '' : '?';
              const val = field.validation ? ` validation="${escapeXml(field.validation)}"` : '';
              lines.push(`          ${field.name}${req}: ${escapeXml(field.type)}${val}`);
            }
            if (proc.input.fields.length > 10) {
              lines.push(`          <!-- +${proc.input.fields.length - 10} more fields -->`);
            }
            lines.push('        </input>');
          } else {
            lines.push(`        <input schema="${proc.input.schema}"/>`);
          }
        }

        // Output schema
        if (proc.output) {
          if (proc.output.fields && proc.output.fields.length > 0) {
            lines.push(`        <output schema="${proc.output.schema}">`);
            for (const field of proc.output.fields.slice(0, 10)) {
              const req = field.required ? '' : '?';
              lines.push(`          ${field.name}${req}: ${escapeXml(field.type)}`);
            }
            if (proc.output.fields.length > 10) {
              lines.push(`          <!-- +${proc.output.fields.length - 10} more fields -->`);
            }
            lines.push('        </output>');
          } else {
            lines.push(`        <output schema="${proc.output.schema}"/>`);
          }
        }

        lines.push(`      </${proc.type}>`);
      } else {
        lines.push(`      <${proc.type} name="${proc.name}"${protAttr}/>`);
      }
    }

    if (router.procedures.length > MAX_ITEMS_LARGE) {
      lines.push(`      <!-- +${router.procedures.length - MAX_ITEMS_LARGE} more procedures -->`);
    }

    // Sub-routers
    if (router.subRouters.length > 0) {
      lines.push(`      <sub-routers>${router.subRouters.join(', ')}</sub-routers>`);
    }

    lines.push('    </router>');
  }

  if (apiContracts.length > MAX_ITEMS_MEDIUM) {
    lines.push(`    <!-- +${apiContracts.length - MAX_ITEMS_MEDIUM} more routers -->`);
  }

  lines.push('  </api-contracts>');
}

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
 * Format environment variables analysis
 */
export function formatEnvVarsSection(lines: string[], data: AiContextData): void {
  const { envVars } = data;
  if (!envVars) return;

  const hasMissing = envVars.missing.length > 0;
  const hasUnused = envVars.unused.length > 0;
  const hasUsages = envVars.usages.length > 0;

  if (!hasMissing && !hasUnused && !hasUsages) return;

  // Calculate overall health
  const criticalMissing = envVars.missing.filter((v) => getEnvVarPriority(v) === 'critical').length;
  const health = criticalMissing > 0 ? 'critical' : hasMissing ? 'warning' : 'healthy';

  lines.push(`  <env-vars health="${health}">`);

  // Missing variables with priority levels
  if (hasMissing) {
    const sortedMissing = [...envVars.missing].sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[getEnvVarPriority(a)] - priorityOrder[getEnvVarPriority(b)];
    });

    lines.push(`    <missing count="${envVars.missing.length}" action="add-to-env-file">`);
    for (const varName of sortedMissing.slice(0, MAX_ITEMS_MEDIUM)) {
      const priority = getEnvVarPriority(varName);
      lines.push(`      <var priority="${priority}">${escapeXml(varName)}</var>`);
    }
    if (envVars.missing.length > MAX_ITEMS_MEDIUM) {
      lines.push(`      <!-- +${envVars.missing.length - MAX_ITEMS_MEDIUM} more missing -->`);
    }
    lines.push('    </missing>');
  }

  // Unused variables (can be cleaned up)
  if (hasUnused) {
    lines.push(`    <unused count="${envVars.unused.length}" action="remove-or-use">`);
    for (const varName of envVars.unused.slice(0, MAX_ITEMS_MEDIUM)) {
      lines.push(`      <var>${escapeXml(varName)}</var>`);
    }
    if (envVars.unused.length > MAX_ITEMS_MEDIUM) {
      lines.push(`      <!-- +${envVars.unused.length - MAX_ITEMS_MEDIUM} more unused -->`);
    }
    lines.push('    </unused>');
  }

  // Usage summary with priority info
  if (hasUsages) {
    // Group by variable name
    const byVar = new Map<string, number>();
    for (const usage of envVars.usages) {
      byVar.set(usage.name, (byVar.get(usage.name) ?? 0) + 1);
    }

    const sortedVars = Array.from(byVar.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_ITEMS_MEDIUM);

    lines.push(`    <usages total="${envVars.usages.length}" unique="${byVar.size}">`);
    for (const [name, count] of sortedVars) {
      lines.push(`      <var name="${escapeXml(name)}" references="${count}"/>`);
    }
    if (byVar.size > MAX_ITEMS_MEDIUM) {
      lines.push(`      <!-- +${byVar.size - MAX_ITEMS_MEDIUM} more variables -->`);
    }
    lines.push('    </usages>');
  }

  // Summary with actionable info
  const usedCount = new Set(envVars.usages.map((u) => u.name)).size;
  lines.push(
    `    <summary defined="${envVars.definitions.length}" used="${usedCount}" missing="${envVars.missing.length}" unused="${envVars.unused.length}"/>`,
  );

  lines.push('  </env-vars>');
}
