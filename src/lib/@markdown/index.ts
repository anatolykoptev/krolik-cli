/**
 * @module lib/@markdown
 * @description Markdown utilities (frontmatter parsing, etc.)
 */

export type { CommonFrontmatter, FrontmatterResult } from './frontmatter';
export {
  createFrontmatter,
  getFrontmatterValue,
  hasFrontmatter,
  parseCommonFrontmatter,
  parseFrontmatter,
  stripFrontmatter,
} from './frontmatter';
