/**
 * @module lib/@markdown
 * @description Markdown utilities (frontmatter parsing, etc.)
 */

export type { FrontmatterResult, CommonFrontmatter } from './frontmatter';
export {
  parseFrontmatter,
  parseCommonFrontmatter,
  getFrontmatterValue,
  hasFrontmatter,
  stripFrontmatter,
  createFrontmatter,
} from './frontmatter';
