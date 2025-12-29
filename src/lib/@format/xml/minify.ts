/**
 * @module lib/@format/xml/minify
 * @description XML minification for AI-optimized output
 *
 * Uses minify-xml with aggressive options for maximum token savings.
 * Safe for AI consumption - no semantic information loss.
 */

import { defaultOptions, minify as minifyXml } from 'minify-xml';

/**
 * Aggressive minification options for maximum token savings
 * Adds text trimming/collapsing on top of default options
 */
const aggressiveOptions = {
  ...defaultOptions,
  trimWhitespaceFromTexts: true,
  collapseWhitespaceInTexts: true,
};

/**
 * Minify XML output (removes whitespace, comments)
 * Safe for AI consumption - no information loss
 *
 * @example
 * minifyXmlOutput('<root>  <child>text</child>  </root>')
 * // Returns: '<root><child>text</child></root>'
 */
export function minifyXmlOutput(xml: string): string {
  if (!xml || xml.trim().length === 0) return '';

  try {
    return minifyXml(xml, aggressiveOptions);
  } catch {
    return xml; // Return original if minification fails
  }
}
