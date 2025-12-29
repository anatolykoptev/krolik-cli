/**
 * @module lib/@modules/classifier
 * @description Module category classification
 *
 * Classifies discovered modules into categories based on
 * combined signals from all analyzers.
 */

import type { ExportedMember } from '@/lib/@ast';
import { detectContentType } from './signals/content';
import { getDirectoryCategoryHint } from './signals/directory';
import { getExportCategoryHint } from './signals/exports';
import { inferCategoryFromNaming } from './signals/naming';
import type { ContentSignals, DetectionSignals, ModuleCategory } from './types';

// ============================================================================
// CLASSIFICATION RULES
// ============================================================================

/**
 * Classification decision tree
 *
 * Priority order (highest first):
 * 1. Content-based (most accurate)
 * 2. Naming-based (strong signal)
 * 3. Directory-based (good hint)
 * 4. Export-based (fallback)
 */
export function classifyModule(
  signals: DetectionSignals,
  exports: ExportedMember[],
): ModuleCategory {
  // 1. Content-based classification (most accurate)
  const contentCategory = classifyByContent(signals.content);
  if (contentCategory) {
    return contentCategory;
  }

  // 2. Naming-based classification
  const namingCategory = inferCategoryFromNaming(signals.naming);
  if (namingCategory) {
    return namingCategory;
  }

  // 3. Directory-based classification
  const dirHint = getDirectoryCategoryHint(signals.directory.matchedPattern ?? '');
  if (dirHint) {
    return mapDirHintToCategory(dirHint);
  }

  // 4. Export-based classification
  const exportHint = getExportCategoryHint(exports);
  if (exportHint) {
    return mapExportHintToCategory(exportHint);
  }

  // 5. Default to unknown
  return 'unknown';
}

/**
 * Classify based on content signals
 */
function classifyByContent(signals: ContentSignals): ModuleCategory | null {
  const contentType = detectContentType(signals);

  switch (contentType) {
    case 'component':
      return 'ui-component';
    case 'hook':
      return 'hook';
    case 'schema':
      return 'schema';
    case 'context':
      return 'context';
    case 'utility':
      return 'utility';
    case 'async-service':
      return 'service';
    default:
      return null;
  }
}

/**
 * Map directory hint to category
 */
function mapDirHintToCategory(
  hint: 'component' | 'hook' | 'utility' | 'type' | 'service' | 'context' | 'constant',
): ModuleCategory {
  switch (hint) {
    case 'component':
      return 'ui-component';
    case 'hook':
      return 'hook';
    case 'utility':
      return 'utility';
    case 'type':
      return 'type';
    case 'service':
      return 'service';
    case 'context':
      return 'context';
    case 'constant':
      return 'constant';
    default:
      return 'unknown';
  }
}

/**
 * Map export hint to category
 */
function mapExportHintToCategory(
  hint: 'type' | 'utility' | 'class' | 'constant' | 'mixed',
): ModuleCategory {
  switch (hint) {
    case 'type':
      return 'type';
    case 'utility':
      return 'utility';
    case 'class':
      return 'service'; // Classes often represent services
    case 'constant':
      return 'constant';
    case 'mixed':
      return 'utility'; // Mixed exports are often utility modules
    default:
      return 'unknown';
  }
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

/**
 * Classification confidence level
 */
export type ClassificationConfidence = 'high' | 'medium' | 'low';

/**
 * Calculate confidence in the classification
 *
 * Returns high confidence when multiple signals agree.
 */
export function calculateClassificationConfidence(
  signals: DetectionSignals,
  exports: ExportedMember[],
  category: ModuleCategory,
): ClassificationConfidence {
  let agreementCount = 0;

  // Check content agreement
  const contentCategory = classifyByContent(signals.content);
  if (contentCategory === category) {
    agreementCount += 2; // Content is most reliable
  }

  // Check naming agreement
  const namingCategory = inferCategoryFromNaming(signals.naming);
  if (namingCategory === category) {
    agreementCount += 1;
  }

  // Check directory agreement
  const dirHint = getDirectoryCategoryHint(signals.directory.matchedPattern ?? '');
  if (dirHint && mapDirHintToCategory(dirHint) === category) {
    agreementCount += 1;
  }

  // Check export agreement
  const exportHint = getExportCategoryHint(exports);
  if (exportHint && mapExportHintToCategory(exportHint) === category) {
    agreementCount += 1;
  }

  if (agreementCount >= 3) {
    return 'high';
  }
  if (agreementCount >= 2) {
    return 'medium';
  }
  return 'low';
}

// ============================================================================
// CATEGORY UTILITIES
// ============================================================================

/**
 * Get human-readable category name
 */
export function getCategoryDisplayName(category: ModuleCategory): string {
  const names: Record<ModuleCategory, string> = {
    'ui-component': 'UI Component',
    hook: 'React Hook',
    utility: 'Utility',
    type: 'Type Definitions',
    schema: 'Validation Schema',
    service: 'Service/API Client',
    constant: 'Constants',
    context: 'React Context',
    hoc: 'Higher-Order Component',
    model: 'Data Model',
    unknown: 'Unknown',
  };

  return names[category];
}

/**
 * Get category icon (for CLI output)
 */
export function getCategoryIcon(category: ModuleCategory): string {
  const icons: Record<ModuleCategory, string> = {
    'ui-component': '[C]',
    hook: '[H]',
    utility: '[U]',
    type: '[T]',
    schema: '[S]',
    service: '[A]',
    constant: '[K]',
    context: '[X]',
    hoc: '[O]',
    model: '[M]',
    unknown: '[?]',
  };

  return icons[category];
}

/**
 * Check if category is typically shared/reusable
 */
export function isTypicallyReusableCategory(category: ModuleCategory): boolean {
  const reusableCategories: ModuleCategory[] = [
    'utility',
    'hook',
    'type',
    'schema',
    'constant',
    'context',
    'service',
  ];

  return reusableCategories.includes(category);
}

/**
 * Get related categories
 *
 * Useful for suggesting similar modules.
 */
export function getRelatedCategories(category: ModuleCategory): ModuleCategory[] {
  const relations: Record<ModuleCategory, ModuleCategory[]> = {
    'ui-component': ['hook', 'context', 'hoc'],
    hook: ['ui-component', 'context', 'utility'],
    utility: ['hook', 'service', 'constant'],
    type: ['schema', 'model'],
    schema: ['type', 'utility'],
    service: ['utility', 'schema'],
    constant: ['utility', 'type'],
    context: ['hook', 'ui-component'],
    hoc: ['hook', 'ui-component'],
    model: ['type', 'schema'],
    unknown: [],
  };

  return relations[category] ?? [];
}
