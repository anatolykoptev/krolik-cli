/**
 * @module lib/@markdown
 * @deprecated Use '@/lib/format' instead. This module will be removed in a future version.
 * @description Markdown utilities (deprecated re-export)
 *
 * This module is kept for backward compatibility.
 * Frontmatter utilities are now re-exported from '@/lib/format'.
 *
 * @example
 * // Old (deprecated):
 * import { parseFrontmatter, hasFrontmatter } from '@/lib/@markdown';
 *
 * // New (recommended):
 * import { parseFrontmatter, hasFrontmatter } from '@/lib/format';
 */

// Re-export frontmatter utilities from the new format module
export type { CommonFrontmatter, FrontmatterResult } from '../format';
export {
  createFrontmatter,
  getFrontmatterValue,
  hasFrontmatter,
  parseCommonFrontmatter,
  parseFrontmatter,
  stripFrontmatter,
} from '../format';
