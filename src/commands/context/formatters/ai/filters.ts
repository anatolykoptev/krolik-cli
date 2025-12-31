/**
 * @module commands/context/formatters/ai/filters
 * @description Filter functions for AI context data
 *
 * Provides two levels of filtering:
 * 1. Keyword-based filtering (filterModelsByKeywords, filterRoutersByKeywords)
 *    - Uses resolved domain keywords (primary/secondary)
 *    - Applied during schema/routes section formatting
 *
 * 2. Domain-scoped filtering (matchesDomain, modelMatchesDomain, routerMatchesDomain)
 *    - Direct path/name matching against detected domains
 *    - Applied before section formatting for aggressive filtering
 *    - When --feature booking: ~40% token reduction
 */

import type { RoutesOutput } from '../../../routes/output';
import type { SchemaOutput } from '../../../schema/output';
import { DEFAULT_PAGE_SIZE, MAX_SIZE } from './helpers';

// Priority scores for keyword matching
const PRIORITY_PRIMARY = 2;
const PRIORITY_SECONDARY = 1;

// ============================================================================
// DOMAIN-SCOPED FILTERS (Phase 5)
// These filter ALL context sections by detected domains
// ============================================================================

/**
 * Check if a file path matches any of the given domains
 *
 * Used for filtering:
 * - Repo map files
 * - Import graph nodes
 * - Related files
 *
 * @param filePath - File path to check
 * @param domains - Domain names to match (e.g., ['booking', 'crm'])
 * @returns true if path matches any domain or if domains is empty
 */
export function matchesDomain(filePath: string, domains: string[]): boolean {
  if (domains.length === 0) return true;
  const lowerPath = filePath.toLowerCase();
  return domains.some((d) => lowerPath.includes(d.toLowerCase()));
}

/**
 * Check if a model name or its relations match any of the given domains
 *
 * Used for filtering:
 * - Schema models
 * - DB relations
 *
 * Matches:
 * - Direct name match (e.g., "Booking" matches domain "booking")
 * - FK relation match (e.g., "TimeSlot" has FK to "Booking" -> matches "booking")
 *
 * @param model - Model with name and optional relations
 * @param domains - Domain names to match
 * @returns true if model matches any domain or if domains is empty
 */
export function modelMatchesDomain(
  model: { name: string; relations?: string[] },
  domains: string[],
): boolean {
  if (domains.length === 0) return true;
  const lowerName = model.name.toLowerCase();

  // Check direct name match
  if (domains.some((d) => lowerName.includes(d.toLowerCase()))) {
    return true;
  }

  // Check if model has FK to a domain model
  if (model.relations) {
    return model.relations.some((rel) =>
      domains.some((d) => rel.toLowerCase().includes(d.toLowerCase())),
    );
  }

  return false;
}

/**
 * Check if a router matches any of the given domains
 *
 * Used for filtering:
 * - Routes section
 * - API contracts
 *
 * @param router - Router with file path and optional procedures
 * @param domains - Domain names to match
 * @returns true if router matches any domain or if domains is empty
 */
export function routerMatchesDomain(
  router: { file: string; procedures?: { name: string }[] },
  domains: string[],
): boolean {
  if (domains.length === 0) return true;
  const lowerFile = router.file.toLowerCase();
  return domains.some((d) => lowerFile.includes(d.toLowerCase()));
}

// ============================================================================
// KEYWORD-BASED FILTERS (existing)
// These use resolved domain keywords for nuanced filtering
// ============================================================================

/**
 * Filter models by resolved keywords
 */
export function filterModelsByKeywords(
  models: SchemaOutput['models'],
  keywords: { primary: string[]; secondary: string[] },
): SchemaOutput['models'] {
  const allKeywords = [...keywords.primary, ...keywords.secondary];
  if (allKeywords.length === 0) return models.slice(0, DEFAULT_PAGE_SIZE);

  return models.filter((m) => {
    const name = m.name.toLowerCase();
    return allKeywords.some((k) => name.includes(k));
  });
}

/**
 * Filter routers by resolved keywords with priority sorting
 */
export function filterRoutersByKeywords(
  routers: RoutesOutput['routers'],
  keywords: { primary: string[]; secondary: string[] },
): RoutesOutput['routers'] {
  if (keywords.primary.length === 0 && keywords.secondary.length === 0) {
    return routers.slice(0, MAX_SIZE);
  }

  const scored = routers
    .map((r) => {
      const name = r.file.toLowerCase();
      let score = 0;
      if (keywords.primary.some((k) => name.includes(k))) score = PRIORITY_PRIMARY;
      else if (keywords.secondary.some((k) => name.includes(k))) score = PRIORITY_SECONDARY;
      return { router: r, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.router);
}

/**
 * Filter enums by types used in models
 */
export function filterEnumsByModels(
  enums: SchemaOutput['enums'],
  models: SchemaOutput['models'],
): SchemaOutput['enums'] {
  const usedTypes = new Set<string>();
  for (const model of models) {
    for (const field of model.fields) {
      usedTypes.add(field.type);
    }
  }
  return enums.filter((e) => usedTypes.has(e.name));
}
