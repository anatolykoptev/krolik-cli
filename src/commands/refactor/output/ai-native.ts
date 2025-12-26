/**
 * @module commands/refactor/output/ai-native
 * @description AI-native XML formatter for refactor analysis
 *
 * Produces structured XML output optimized for AI agents:
 * - Dependency graphs for impact analysis
 * - Domain classification with coherence scores
 * - Migration ordering with prerequisites
 * - Prioritized recommendations
 * - Navigation hints for code placement
 */

import { escapeXml } from '../../../lib/@formatters';
import type {
  ArchViolation,
  DomainInfo,
  EnhancedMigrationAction,
  EnhancedRefactorAnalysis,
  Recommendation,
  ReusableModuleSummary,
  ReusableModulesInfo,
} from '../core';

// ============================================================================
// MAIN FORMATTER
// ============================================================================

/**
 * Format enhanced analysis as AI-native XML
 */
export function formatAiNativeXml(analysis: EnhancedRefactorAnalysis): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<!--');
  lines.push('  AI-NATIVE REFACTOR ANALYSIS');
  lines.push('  This output is optimized for AI agents like Claude Code.');
  lines.push(
    '  Structure: stats → context → architecture → domains → duplicates → migration → recommendations → navigation',
  );
  lines.push('-->');
  lines.push('');

  lines.push(`<refactor-analysis timestamp="${analysis.timestamp}" path="${analysis.path}">`);

  // Stats summary
  formatStats(lines, analysis);

  // Project context
  formatProjectContext(lines, analysis);

  // Architecture health
  formatArchitectureHealth(lines, analysis);

  // Domain classification
  formatDomains(lines, analysis);

  // Duplicates
  formatDuplicates(lines, analysis);

  // Enhanced migration plan
  formatMigration(lines, analysis);

  // Recommendations
  formatRecommendations(lines, analysis);

  // Reusable modules
  formatReusableModules(lines, analysis);

  // AI navigation hints
  formatAiNavigation(lines, analysis);

  lines.push('</refactor-analysis>');

  return lines.join('\n');
}

// ============================================================================
// SECTIONS
// ============================================================================

function formatStats(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { structure, duplicates, archHealth, recommendations } = analysis;

  lines.push('  <stats');
  lines.push(`    structure_score="${structure.score}"`);
  lines.push(`    architecture_score="${archHealth.score}"`);
  lines.push(`    duplicates_count="${duplicates.length}"`);
  lines.push(`    issues_count="${structure.issues.length}"`);
  lines.push(`    violations_count="${archHealth.violations.length}"`);
  lines.push(`    recommendations_count="${recommendations.length}"`);
  lines.push(`    migration_actions="${analysis.enhancedMigration.actions.length}"`);
  lines.push('  />');
  lines.push('');
}

function formatProjectContext(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { projectContext } = analysis;

  lines.push('  <project-context>');
  lines.push(`    <type>${projectContext.type}</type>`);
  lines.push(`    <name>${escapeXml(projectContext.name)}</name>`);

  lines.push('    <tech-stack>');
  lines.push(`      <framework>${projectContext.techStack.framework || 'none'}</framework>`);
  lines.push(`      <runtime>${projectContext.techStack.runtime}</runtime>`);
  lines.push(`      <language>${projectContext.techStack.language}</language>`);
  lines.push(`      <ui>${projectContext.techStack.ui || 'none'}</ui>`);
  if (projectContext.techStack.database.length > 0) {
    lines.push(`      <database>${projectContext.techStack.database.join(', ')}</database>`);
  }
  if (projectContext.techStack.stateManagement.length > 0) {
    lines.push(
      `      <state-management>${projectContext.techStack.stateManagement.join(', ')}</state-management>`,
    );
  }
  lines.push('    </tech-stack>');

  lines.push('    <entry-points>');
  if (projectContext.entryPoints.main) {
    lines.push(`      <main>${projectContext.entryPoints.main}</main>`);
  }
  if (projectContext.entryPoints.apiRoutes) {
    lines.push(`      <api-routes>${projectContext.entryPoints.apiRoutes}</api-routes>`);
  }
  if (projectContext.entryPoints.pages) {
    lines.push(`      <pages>${projectContext.entryPoints.pages}</pages>`);
  }
  if (projectContext.entryPoints.components) {
    lines.push(`      <components>${projectContext.entryPoints.components}</components>`);
  }
  lines.push('    </entry-points>');

  if (projectContext.importAlias) {
    lines.push(`    <import-alias>${projectContext.importAlias}</import-alias>`);
  }

  lines.push('  </project-context>');
  lines.push('');
}

function formatArchitectureHealth(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { archHealth } = analysis;

  lines.push(`  <architecture-health score="${archHealth.score}">`);

  // Dependency graph
  lines.push('    <dependency-graph>');
  for (const [node, deps] of Object.entries(archHealth.dependencyGraph)) {
    if (deps.length > 0) {
      lines.push(`      <node name="${node}" depends-on="${deps.join(', ')}" />`);
    } else {
      lines.push(`      <node name="${node}" depends-on="none" />`);
    }
  }
  lines.push('    </dependency-graph>');

  // Layer compliance
  lines.push('    <layer-compliance>');
  for (const [name, compliance] of Object.entries(archHealth.layerCompliance)) {
    lines.push(
      `      <layer name="${name}" expected="${compliance.expected}" compliant="${compliance.compliant}" />`,
    );
  }
  lines.push('    </layer-compliance>');

  // Violations
  if (archHealth.violations.length > 0) {
    lines.push('    <violations>');
    for (const v of archHealth.violations) {
      formatViolation(lines, v);
    }
    lines.push('    </violations>');
  }

  lines.push('  </architecture-health>');
  lines.push('');
}

function formatViolation(lines: string[], v: ArchViolation): void {
  lines.push(`      <violation type="${v.type}" severity="${v.severity}">`);
  lines.push(`        <from>${v.from}</from>`);
  lines.push(`        <to>${v.to}</to>`);
  lines.push(`        <message>${escapeXml(v.message)}</message>`);
  lines.push(`        <fix>${escapeXml(v.fix)}</fix>`);
  lines.push('      </violation>');
}

function formatDomains(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { domains } = analysis;

  lines.push(`  <domains count="${domains.length}">`);
  for (const domain of domains) {
    formatDomain(lines, domain);
  }
  lines.push('  </domains>');
  lines.push('');
}

function formatDomain(lines: string[], domain: DomainInfo): void {
  lines.push(
    `    <domain name="${domain.name}" category="${domain.category}" files="${domain.files}" coherence="${domain.coherence.toFixed(2)}">`,
  );
  lines.push(`      <description>${escapeXml(domain.description)}</description>`);

  if (domain.suggestion) {
    lines.push(`      <suggestion>${escapeXml(domain.suggestion)}</suggestion>`);
  }

  if (domain.shouldMove.length > 0) {
    lines.push('      <misplaced-files>');
    for (const m of domain.shouldMove.slice(0, 5)) {
      lines.push(`        <file name="${m.file}" suggested-domain="${m.suggestedDomain}" />`);
    }
    if (domain.shouldMove.length > 5) {
      lines.push(`        <!-- +${domain.shouldMove.length - 5} more files -->`);
    }
    lines.push('      </misplaced-files>');
  }

  lines.push('    </domain>');
}

function formatDuplicates(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { duplicates, typeDuplicates } = analysis;
  const totalCount = duplicates.length + (typeDuplicates?.length ?? 0);

  if (totalCount === 0) {
    lines.push('  <duplicates count="0" />');
    lines.push('');
    return;
  }

  lines.push(`  <duplicates count="${totalCount}">`);

  // Function duplicates
  if (duplicates.length > 0) {
    lines.push(`    <function-duplicates count="${duplicates.length}">`);
    const sorted = [...duplicates].sort((a, b) => b.similarity - a.similarity);

    for (const dup of sorted.slice(0, 10)) {
      const similarity = Math.round(dup.similarity * 100);
      lines.push(
        `      <duplicate name="${escapeXml(dup.name)}" similarity="${similarity}%" recommendation="${dup.recommendation}">`,
      );

      const canonical = dup.locations.find((l) => l.exported) || dup.locations[0];
      if (canonical) {
        lines.push(
          `        <canonical file="${canonical.file}" line="${canonical.line}" exported="${canonical.exported}" />`,
        );
      }

      lines.push('        <locations>');
      for (const loc of dup.locations) {
        if (loc !== canonical) {
          lines.push(
            `          <location file="${loc.file}" line="${loc.line}" exported="${loc.exported}" />`,
          );
        }
      }
      lines.push('        </locations>');
      lines.push('      </duplicate>');
    }

    if (duplicates.length > 10) {
      lines.push(`      <!-- +${duplicates.length - 10} more function duplicates -->`);
    }
    lines.push('    </function-duplicates>');
  }

  // Type duplicates
  if (typeDuplicates && typeDuplicates.length > 0) {
    lines.push(`    <type-duplicates count="${typeDuplicates.length}">`);
    const sorted = [...typeDuplicates].sort((a, b) => b.similarity - a.similarity);

    for (const dup of sorted.slice(0, 10)) {
      const similarity = Math.round(dup.similarity * 100);
      lines.push(
        `      <duplicate name="${escapeXml(dup.name)}" kind="${dup.kind}" similarity="${similarity}%" recommendation="${dup.recommendation}">`,
      );

      if (dup.commonFields && dup.commonFields.length > 0) {
        lines.push(`        <common-fields>${dup.commonFields.join(', ')}</common-fields>`);
      }
      if (dup.difference) {
        lines.push(`        <difference>${escapeXml(dup.difference)}</difference>`);
      }

      lines.push('        <locations>');
      for (const loc of dup.locations) {
        lines.push(
          `          <location file="${loc.file}" line="${loc.line}" name="${escapeXml(loc.name)}" exported="${loc.exported}" />`,
        );
      }
      lines.push('        </locations>');
      lines.push('      </duplicate>');
    }

    if (typeDuplicates.length > 10) {
      lines.push(`      <!-- +${typeDuplicates.length - 10} more type duplicates -->`);
    }
    lines.push('    </type-duplicates>');
  }

  lines.push('  </duplicates>');
  lines.push('');
}

function formatMigration(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { enhancedMigration } = analysis;

  lines.push(
    `  <migration files-affected="${enhancedMigration.filesAffected}" imports-to-update="${enhancedMigration.importsToUpdate}">`,
  );

  // Risk summary
  lines.push('    <risk-summary>');
  lines.push(`      <safe count="${enhancedMigration.riskSummary.safe}" />`);
  lines.push(`      <medium count="${enhancedMigration.riskSummary.medium}" />`);
  lines.push(`      <risky count="${enhancedMigration.riskSummary.risky}" />`);
  lines.push('    </risk-summary>');

  // Execution order
  lines.push('    <execution-order>');
  for (const step of enhancedMigration.executionOrder) {
    lines.push(
      `      <step number="${step.step}" action-id="${step.actionId}" can-parallelize="${step.canParallelize}" />`,
    );
  }
  lines.push('    </execution-order>');

  // Rollback points
  if (enhancedMigration.rollbackPoints.length > 0) {
    lines.push(
      `    <rollback-points>${enhancedMigration.rollbackPoints.join(', ')}</rollback-points>`,
    );
  }

  // Actions
  lines.push('    <actions>');
  for (const action of enhancedMigration.actions) {
    formatMigrationAction(lines, action);
  }
  lines.push('    </actions>');

  lines.push('  </migration>');
  lines.push('');
}

function formatMigrationAction(lines: string[], action: EnhancedMigrationAction): void {
  lines.push(
    `      <action id="${action.id}" type="${action.type}" risk="${action.risk}" order="${action.order}">`,
  );
  lines.push(`        <source>${action.source}</source>`);
  if (action.target) {
    lines.push(`        <target>${action.target}</target>`);
  }
  lines.push(`        <reason>${escapeXml(action.reason)}</reason>`);

  if (action.prerequisite.length > 0) {
    lines.push(`        <prerequisite>${action.prerequisite.join(', ')}</prerequisite>`);
  }

  if (action.affectedDetails.length > 0) {
    lines.push(`        <affected-files count="${action.affectedDetails.length}">`);
    for (const detail of action.affectedDetails.slice(0, 5)) {
      lines.push(`          <file path="${detail.file}" import-count="${detail.importCount}" />`);
    }
    if (action.affectedDetails.length > 5) {
      lines.push(`          <!-- +${action.affectedDetails.length - 5} more files -->`);
    }
    lines.push('        </affected-files>');
  }

  lines.push('      </action>');
}

function formatRecommendations(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { recommendations } = analysis;

  if (recommendations.length === 0) {
    lines.push('  <recommendations count="0" />');
    lines.push('');
    return;
  }

  lines.push(`  <recommendations count="${recommendations.length}">`);

  for (const rec of recommendations.slice(0, 10)) {
    formatRecommendation(lines, rec);
  }

  if (recommendations.length > 10) {
    lines.push(`    <!-- +${recommendations.length - 10} more recommendations -->`);
  }

  lines.push('  </recommendations>');
  lines.push('');
}

function formatRecommendation(lines: string[], rec: Recommendation): void {
  lines.push(
    `    <recommendation id="${rec.id}" priority="${rec.priority}" category="${rec.category}">`,
  );
  lines.push(`      <title>${escapeXml(rec.title)}</title>`);
  lines.push(`      <description>${escapeXml(rec.description)}</description>`);
  lines.push(`      <effort level="${rec.effort}" />`);
  lines.push(`      <expected-improvement score-delta="+${rec.expectedImprovement}" />`);
  lines.push(`      <auto-fixable>${rec.autoFixable}</auto-fixable>`);

  if (rec.affectedFiles.length > 0) {
    lines.push(`      <affected-files count="${rec.affectedFiles.length}">`);
    for (const file of rec.affectedFiles.slice(0, 3)) {
      lines.push(`        <file>${file}</file>`);
    }
    if (rec.affectedFiles.length > 3) {
      lines.push(`        <!-- +${rec.affectedFiles.length - 3} more files -->`);
    }
    lines.push('      </affected-files>');
  }

  lines.push('    </recommendation>');
}

function formatReusableModules(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { reusableModules } = analysis;

  if (!reusableModules) {
    lines.push('  <reusable-modules />');
    lines.push('');
    return;
  }

  lines.push(
    `  <reusable-modules total="${reusableModules.totalModules}" exports="${reusableModules.totalExports}" scan-ms="${reusableModules.scanDurationMs}">`,
  );

  // Top modules
  if (reusableModules.topModules.length > 0) {
    lines.push('    <!-- TOP REUSABLE MODULES (core + high) -->');
    lines.push(`    <top-modules count="${reusableModules.topModules.length}">`);
    for (const module of reusableModules.topModules.slice(0, 15)) {
      formatReusableModule(lines, module, '      ');
    }
    if (reusableModules.topModules.length > 15) {
      lines.push(`      <!-- +${reusableModules.topModules.length - 15} more top modules -->`);
    }
    lines.push('    </top-modules>');
  }

  // By category summary
  lines.push('    <!-- MODULES BY CATEGORY -->');
  lines.push('    <by-category>');
  formatCategorySummary(lines, reusableModules, 'hook', 'React Hooks');
  formatCategorySummary(lines, reusableModules, 'utility', 'Utility Functions');
  formatCategorySummary(lines, reusableModules, 'ui-component', 'UI Components');
  formatCategorySummary(lines, reusableModules, 'type', 'Type Definitions');
  formatCategorySummary(lines, reusableModules, 'schema', 'Validation Schemas');
  formatCategorySummary(lines, reusableModules, 'service', 'Services/API Clients');
  formatCategorySummary(lines, reusableModules, 'constant', 'Constants');
  formatCategorySummary(lines, reusableModules, 'context', 'React Contexts');
  formatCategorySummary(lines, reusableModules, 'hoc', 'Higher-Order Components');
  formatCategorySummary(lines, reusableModules, 'model', 'Data Models');
  lines.push('    </by-category>');

  lines.push('  </reusable-modules>');
  lines.push('');
}

function formatReusableModule(
  lines: string[],
  module: ReusableModuleSummary,
  indent: string,
): void {
  lines.push(
    `${indent}<module name="${escapeXml(module.name)}" category="${module.category}" level="${module.level}" score="${module.score}">`,
  );
  lines.push(`${indent}  <path>${module.path}</path>`);
  lines.push(`${indent}  <exports count="${module.exportCount}" />`);
  lines.push(`${indent}  <imported-by count="${module.importedByCount}" />`);
  if (module.description) {
    lines.push(`${indent}  <description>${escapeXml(module.description)}</description>`);
  }
  lines.push(`${indent}</module>`);
}

function formatCategorySummary(
  lines: string[],
  info: ReusableModulesInfo,
  category: keyof ReusableModulesInfo['byCategory'],
  displayName: string,
): void {
  const modules = info.byCategory[category];
  if (modules.length === 0) return;

  lines.push(
    `      <category name="${category}" display-name="${displayName}" count="${modules.length}">`,
  );

  // Show top 5 by score
  const sorted = [...modules].sort((a, b) => b.score - a.score);
  for (const module of sorted.slice(0, 5)) {
    lines.push(
      `        <module name="${escapeXml(module.name)}" score="${module.score}" path="${module.path}" />`,
    );
  }

  if (modules.length > 5) {
    lines.push(`        <!-- +${modules.length - 5} more ${category} modules -->`);
  }

  lines.push('      </category>');
}

function formatAiNavigation(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { aiNavigation } = analysis;

  lines.push('  <ai-navigation>');
  lines.push('    <!-- WHERE TO ADD NEW CODE -->');
  lines.push('    <add-new-code>');
  lines.push(`      <server-logic>${aiNavigation.addNewCode.serverLogic}</server-logic>`);
  lines.push(`      <client-hook>${aiNavigation.addNewCode.clientHook}</client-hook>`);
  lines.push(`      <utility>${aiNavigation.addNewCode.utility}</utility>`);
  lines.push(`      <constant>${aiNavigation.addNewCode.constant}</constant>`);
  lines.push(`      <integration>${aiNavigation.addNewCode.integration}</integration>`);
  lines.push(`      <component>${aiNavigation.addNewCode.component}</component>`);
  lines.push(`      <api-route>${aiNavigation.addNewCode.apiRoute}</api-route>`);
  lines.push(`      <test>${aiNavigation.addNewCode.test}</test>`);
  lines.push('    </add-new-code>');

  lines.push('    <!-- FILE PATTERNS -->');
  lines.push('    <file-patterns>');
  for (const fp of aiNavigation.filePatterns) {
    lines.push(
      `      <pattern type="${fp.pattern}" meaning="${fp.meaning}" example="${fp.example}" />`,
    );
  }
  lines.push('    </file-patterns>');

  lines.push('    <!-- IMPORT CONVENTIONS -->');
  lines.push('    <import-conventions>');
  lines.push(
    `      <absolute-imports>${aiNavigation.importConventions.absoluteImports}</absolute-imports>`,
  );
  if (aiNavigation.importConventions.alias) {
    lines.push(`      <alias>${aiNavigation.importConventions.alias}</alias>`);
  }
  lines.push(
    `      <barrel-exports>${aiNavigation.importConventions.barrelExports}</barrel-exports>`,
  );
  lines.push('      <preferred-order>');
  for (const order of aiNavigation.importConventions.preferredOrder) {
    lines.push(`        <item>${order}</item>`);
  }
  lines.push('      </preferred-order>');
  lines.push('    </import-conventions>');

  lines.push('    <!-- NAMING CONVENTIONS -->');
  lines.push('    <naming-conventions>');
  lines.push(`      <files>${aiNavigation.namingConventions.files}</files>`);
  lines.push(`      <components>${aiNavigation.namingConventions.components}</components>`);
  lines.push(`      <hooks>${aiNavigation.namingConventions.hooks}</hooks>`);
  lines.push(`      <utilities>${aiNavigation.namingConventions.utilities}</utilities>`);
  lines.push(`      <constants>${aiNavigation.namingConventions.constants}</constants>`);
  lines.push(`      <types>${aiNavigation.namingConventions.types}</types>`);
  lines.push('    </naming-conventions>');

  lines.push('  </ai-navigation>');
}
