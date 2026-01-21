/**
 * @module commands/refactor/analyzers/metrics/recommendations
 * @description Recommendation generation for refactoring
 *
 * Generates prioritized, actionable recommendations based on analysis.
 */

import path from 'node:path';
import type { RefactorAnalysis } from '../../core/types';
import type { ArchHealth, DomainInfo, Recommendation } from '../../core/types-ai';

// ============================================================================
// NEW ISSUE TYPES
// ============================================================================

/**
 * Data validation issue types
 */
export interface DataIssue {
  file: string;
  line: number;
  type: 'duplicate-item' | 'inconsistent-data' | 'missing-field';
  message: string;
  severity: 'error' | 'warning';
}

/**
 * File system issue types
 */
export interface FileSystemIssue {
  type: 'backup-file' | 'temp-file';
  file: string;
  suggestion: string;
}

/**
 * Dead code issue types
 */
export interface DeadCodeIssue {
  file: string;
  line: number;
  type: 'unused-import' | 'unused-variable' | 'unreachable-code';
  identifier: string;
}

// ============================================================================
// RECOMMENDATION GENERATORS
// ============================================================================

/**
 * Generate recommendations for architecture violations
 */
function generateArchRecommendations(
  archHealth: ArchHealth,
  priority: { value: number },
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const violation of archHealth.violations.filter((v) => v.severity === 'error')) {
    recommendations.push({
      id: `arch-${priority.value}`,
      priority: priority.value++,
      category: 'architecture',
      title: violation.type === 'circular' ? 'Fix circular dependency' : 'Fix layer violation',
      description: violation.message,
      expectedImprovement: 15,
      effort: 'high',
      affectedFiles: [violation.from, violation.to],
      autoFixable: false,
    });
  }

  return recommendations;
}

/**
 * Generate recommendations for duplicate functions
 */
function generateDuplicateRecommendations(
  analysis: RefactorAnalysis,
  priority: { value: number },
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const dup of analysis.duplicates.filter((d) => d.recommendation === 'merge')) {
    recommendations.push({
      id: `dup-${priority.value}`,
      priority: priority.value++,
      category: 'duplication',
      title: `Merge duplicate function: ${dup.name}`,
      description: `${(dup.similarity * 100).toFixed(0)}% similar functions found in ${dup.locations.length} locations`,
      expectedImprovement: 5,
      effort: 'low',
      affectedFiles: dup.locations.map((l) => l.file),
      autoFixable: true,
    });
  }

  return recommendations;
}

/**
 * Generate recommendations for structure issues
 */
function generateStructureRecommendations(
  analysis: RefactorAnalysis,
  priority: { value: number },
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const issue of analysis.structure.issues.filter((i) => i.severity === 'error')) {
    recommendations.push({
      id: `struct-${priority.value}`,
      priority: priority.value++,
      category: 'structure',
      title: `Fix structure issue: ${issue.type}`,
      description: issue.message,
      expectedImprovement: 10,
      effort: 'medium',
      affectedFiles: issue.files,
      autoFixable: issue.type === 'missing-barrel',
    });
  }

  return recommendations;
}

/**
 * Generate recommendations for domain coherence
 */
function generateDomainRecommendations(
  domains: DomainInfo[],
  priority: { value: number },
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const domain of domains.filter((d) => d.coherence < 0.8)) {
    recommendations.push({
      id: `domain-${priority.value}`,
      priority: priority.value++,
      category: 'structure',
      title: `Improve domain coherence: ${domain.name}`,
      description: domain.suggestion || `Move ${domain.shouldMove.length} misplaced files`,
      expectedImprovement: 5,
      effort: 'medium',
      affectedFiles: domain.shouldMove.map((m) => m.file),
      autoFixable: true,
    });
  }

  return recommendations;
}

/**
 * Generate recommendations for data validation issues
 *
 * Groups data integrity issues by file and creates actionable recommendations
 * for fixing duplicate items, inconsistent data, and missing fields.
 *
 * @param issues - Array of data validation issues
 * @param priority - Priority counter (mutated)
 * @returns Array of data integrity recommendations
 */
function generateDataValidationRecommendations(
  issues: DataIssue[],
  priority: { value: number },
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const errors = issues.filter((i) => i.severity === 'error');

  if (errors.length === 0) {
    return recommendations;
  }

  // Group by file
  const byFile = new Map<string, DataIssue[]>();
  for (const issue of errors) {
    const existing = byFile.get(issue.file) || [];
    existing.push(issue);
    byFile.set(issue.file, existing);
  }

  for (const [file, fileIssues] of byFile) {
    const firstIssue = fileIssues[0];
    if (!firstIssue) continue;

    recommendations.push({
      id: `data-${priority.value}`,
      priority: priority.value++,
      category: 'data-integrity',
      title: `Fix data integrity issues in ${path.basename(file)}`,
      description: `${fileIssues.length} data integrity issue(s): ${firstIssue.message}`,
      expectedImprovement: 10,
      effort: 'low',
      affectedFiles: [file],
      autoFixable: false, // Manual review needed
    });
  }

  return recommendations;
}

/**
 * Generate recommendations for file system health
 *
 * Creates recommendations for removing backup files, temp files, and
 * updating .gitignore. Groups all backup files into a single recommendation.
 *
 * @param issues - Array of file system issues
 * @param priority - Priority counter (mutated)
 * @returns Array of cleanup recommendations
 */
function generateFileSystemRecommendations(
  issues: FileSystemIssue[],
  priority: { value: number },
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (issues.length === 0) {
    return recommendations;
  }

  // Single recommendation for all backup files
  const backupFiles = issues.filter((i) => i.type === 'backup-file');
  if (backupFiles.length > 0) {
    recommendations.push({
      id: `fs-${priority.value}`,
      priority: priority.value++,
      category: 'cleanup',
      title: 'Remove backup files from repository',
      description: `${backupFiles.length} backup file(s) found: ${backupFiles.map((f) => path.basename(f.file)).join(', ')}`,
      expectedImprovement: 3,
      effort: 'trivial',
      affectedFiles: backupFiles.map((i) => i.file),
      autoFixable: true, // Can auto-delete
    });
  }

  // Single recommendation for all temp files
  const tempFiles = issues.filter((i) => i.type === 'temp-file');
  if (tempFiles.length > 0) {
    recommendations.push({
      id: `fs-${priority.value}`,
      priority: priority.value++,
      category: 'cleanup',
      title: 'Remove temporary files from repository',
      description: `${tempFiles.length} temporary file(s) found`,
      expectedImprovement: 2,
      effort: 'trivial',
      affectedFiles: tempFiles.map((i) => i.file),
      autoFixable: true,
    });
  }

  return recommendations;
}

/**
 * Generate recommendations for dead code removal
 *
 * Groups dead code issues by file and creates recommendations for removing
 * unused imports, variables, and unreachable code.
 *
 * @param issues - Array of dead code issues
 * @param priority - Priority counter (mutated)
 * @returns Array of cleanup recommendations
 */
function generateDeadCodeRecommendations(
  issues: DeadCodeIssue[],
  priority: { value: number },
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (issues.length === 0) {
    return recommendations;
  }

  // Group by file
  const byFile = new Map<string, DeadCodeIssue[]>();
  for (const issue of issues) {
    const existing = byFile.get(issue.file) || [];
    existing.push(issue);
    byFile.set(issue.file, existing);
  }

  for (const [file, fileIssues] of byFile) {
    const unusedImports = fileIssues.filter((i) => i.type === 'unused-import');
    const unusedVariables = fileIssues.filter((i) => i.type === 'unused-variable');

    if (unusedImports.length > 0) {
      recommendations.push({
        id: `dead-${priority.value}`,
        priority: priority.value++,
        category: 'cleanup',
        title: `Remove unused imports in ${path.basename(file)}`,
        description: `${unusedImports.length} unused import(s): ${unusedImports.map((i) => i.identifier).join(', ')}`,
        expectedImprovement: 2,
        effort: 'trivial',
        affectedFiles: [file],
        autoFixable: true, // Can auto-remove
      });
    }

    if (unusedVariables.length > 0) {
      recommendations.push({
        id: `dead-${priority.value}`,
        priority: priority.value++,
        category: 'cleanup',
        title: `Remove unused variables in ${path.basename(file)}`,
        description: `${unusedVariables.length} unused variable(s): ${unusedVariables.map((i) => i.identifier).join(', ')}`,
        expectedImprovement: 2,
        effort: 'trivial',
        affectedFiles: [file],
        autoFixable: true,
      });
    }
  }

  return recommendations;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generate prioritized recommendations
 *
 * Creates a comprehensive list of actionable recommendations based on all
 * analysis results. Recommendations are ordered by priority:
 * 1. Architecture violations (blocking issues)
 * 2. Data validation (critical bugs)
 * 3. File system health (easy wins)
 * 4. Dead code (maintainability)
 * 5. Duplicate functions (code quality)
 * 6. Structure issues (organization)
 * 7. Domain coherence (long-term maintenance)
 *
 * @param analysis - Core refactor analysis results
 * @param archHealth - Architecture health analysis
 * @param domains - Domain classification info
 * @param dataIssues - Optional data validation issues
 * @param fileSystemIssues - Optional file system health issues
 * @param deadCodeIssues - Optional dead code issues
 * @returns Prioritized array of recommendations
 */
export function generateRecommendations(
  analysis: RefactorAnalysis,
  archHealth: ArchHealth,
  domains: DomainInfo[],
  dataIssues?: DataIssue[],
  fileSystemIssues?: FileSystemIssue[],
  deadCodeIssues?: DeadCodeIssue[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const priority = { value: 1 };

  // 1. Architecture violations (highest priority - blocking issues)
  recommendations.push(...generateArchRecommendations(archHealth, priority));

  // 2. Data validation (critical bugs - data integrity)
  if (dataIssues && dataIssues.length > 0) {
    recommendations.push(...generateDataValidationRecommendations(dataIssues, priority));
  }

  // 3. File system health (easy wins - cleanup)
  if (fileSystemIssues && fileSystemIssues.length > 0) {
    recommendations.push(...generateFileSystemRecommendations(fileSystemIssues, priority));
  }

  // 4. Dead code (maintainability - cleanup)
  if (deadCodeIssues && deadCodeIssues.length > 0) {
    recommendations.push(...generateDeadCodeRecommendations(deadCodeIssues, priority));
  }

  // 5. Duplicate functions (code quality)
  recommendations.push(...generateDuplicateRecommendations(analysis, priority));

  // 6. Structure issues (organization)
  recommendations.push(...generateStructureRecommendations(analysis, priority));

  // 7. Domain coherence (long-term maintenance)
  recommendations.push(...generateDomainRecommendations(domains, priority));

  return recommendations;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Filter recommendations by category
 */
export function filterByCategory(
  recommendations: Recommendation[],
  category: Recommendation['category'],
): Recommendation[] {
  return recommendations.filter((r) => r.category === category);
}

/**
 * Get only auto-fixable recommendations
 */
export function getAutoFixable(recommendations: Recommendation[]): Recommendation[] {
  return recommendations.filter((r) => r.autoFixable);
}

/**
 * Calculate total expected improvement
 */
export function calculateTotalImprovement(recommendations: Recommendation[]): number {
  return recommendations.reduce((sum, r) => sum + r.expectedImprovement, 0);
}

/**
 * Sort recommendations by priority
 */
export function sortByPriority(recommendations: Recommendation[]): Recommendation[] {
  return [...recommendations].sort((a, b) => a.priority - b.priority);
}

/**
 * Group recommendations by category
 */
export function groupByCategory(
  recommendations: Recommendation[],
): Map<Recommendation['category'], Recommendation[]> {
  const grouped = new Map<Recommendation['category'], Recommendation[]>();

  for (const rec of recommendations) {
    const existing = grouped.get(rec.category) || [];
    existing.push(rec);
    grouped.set(rec.category, existing);
  }

  return grouped;
}
