/**
 * @module commands/context/formatters/ai/filters
 * @description Filter functions for AI context data
 */

import type { SchemaOutput } from "../../../schema/output";
import type { RoutesOutput } from "../../../routes/output";
import { DEFAULT_PAGE_SIZE, MAX_SIZE } from "./helpers";

// Priority scores for keyword matching
const PRIORITY_PRIMARY = 2;
const PRIORITY_SECONDARY = 1;

/**
 * Filter models by resolved keywords
 */
export function filterModelsByKeywords(
  models: SchemaOutput["models"],
  keywords: { primary: string[]; secondary: string[] },
): SchemaOutput["models"] {
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
  routers: RoutesOutput["routers"],
  keywords: { primary: string[]; secondary: string[] },
): RoutesOutput["routers"] {
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
  enums: SchemaOutput["enums"],
  models: SchemaOutput["models"],
): SchemaOutput["enums"] {
  const usedTypes = new Set<string>();
  for (const model of models) {
    for (const field of model.fields) {
      usedTypes.add(field.type);
    }
  }
  return enums.filter((e) => usedTypes.has(e.name));
}
