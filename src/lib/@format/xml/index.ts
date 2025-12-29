/**
 * @module lib/@format/xml
 * @description XML formatting utilities - Layer 1 (depends on core)
 *
 * Provides utilities for:
 * - XML character escaping
 * - XML element building
 * - XML document generation
 * - XML minification (via minify-xml)
 * - XML optimization for AI (3 levels: minify, semantic, simplify)
 */

// Building
export type { XmlAttributes, XmlElement } from './builder';
export {
  buildElement,
  buildXmlDocument,
  cdata,
  selfClosingTag,
  textElement,
  wrapXml,
  xmlComment,
} from './builder';
// Escaping
export { escapeXml, unescapeXml } from './escape';

// Minification
export { minifyXmlOutput } from './minify';

// Optimization (4 levels for AI context)
export type {
  AggressiveOptions,
  CompactOptions,
  OptimizationContext,
  OptimizationLevel,
  OptimizeOptions,
  OptimizeResult,
} from './optimizer';
export { optimizeXml, optimizeXmlAuto, XMLOptimizer } from './optimizer';
