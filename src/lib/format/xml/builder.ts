/**
 * @module lib/format/xml/builder
 * @description XML element and document building utilities
 */

import { escapeXml } from './escape';
import { minifyXmlOutput } from './minify';

// ============================================================================
// TYPES
// ============================================================================

export interface XmlAttributes {
  [key: string]: string | number | boolean | undefined;
}

export interface XmlElement {
  tag: string;
  content?: string | XmlElement[];
  attrs?: XmlAttributes;
  cdata?: boolean;
}

// ============================================================================
// ATTRIBUTE FORMATTING
// ============================================================================

/**
 * Format attributes for XML tag
 */
function formatAttributes(attrs?: XmlAttributes): string {
  if (!attrs) return '';

  const parts: string[] = [];

  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;

    const strValue = typeof value === 'boolean' ? value.toString() : escapeXml(String(value));

    parts.push(`${key}="${strValue}"`);
  }

  return parts.join(' ');
}

// ============================================================================
// ELEMENT BUILDING
// ============================================================================

/**
 * Wrap content in an XML tag
 *
 * @example
 * wrapXml('name', 'John')
 * // Returns: '<name>John</name>'
 *
 * wrapXml('user', 'John', { id: '123', active: true })
 * // Returns: '<user id="123" active="true">John</user>'
 */
export function wrapXml(tag: string, content: string, attrs?: XmlAttributes): string {
  const attrStr = formatAttributes(attrs);
  const openTag = attrStr ? `<${tag} ${attrStr}>` : `<${tag}>`;

  return `${openTag}${content}</${tag}>`;
}

/**
 * Create a self-closing XML tag
 *
 * @example
 * selfClosingTag('br')
 * // Returns: '<br />'
 *
 * selfClosingTag('img', { src: 'photo.jpg' })
 * // Returns: '<img src="photo.jpg" />'
 */
export function selfClosingTag(tag: string, attrs?: XmlAttributes): string {
  const attrStr = formatAttributes(attrs);
  return attrStr ? `<${tag} ${attrStr} />` : `<${tag} />`;
}

/**
 * Build an XML element (recursive)
 *
 * @example
 * buildElement({
 *   tag: 'user',
 *   attrs: { id: '1' },
 *   content: [
 *     { tag: 'name', content: 'John' },
 *     { tag: 'email', content: 'john@example.com' }
 *   ]
 * })
 */
export function buildElement(element: XmlElement, indent: number = 0): string {
  const { tag, content, attrs, cdata } = element;
  const spaces = '  '.repeat(indent);

  // Self-closing if no content
  if (!content) {
    return `${spaces}${selfClosingTag(tag, attrs)}`;
  }

  // String content
  if (typeof content === 'string') {
    const escapedContent = cdata ? `<![CDATA[${content}]]>` : escapeXml(content);

    // Short content on one line
    if (content.length < 60 && !content.includes('\n')) {
      return `${spaces}${wrapXml(tag, escapedContent, attrs)}`;
    }

    // Long content on multiple lines
    const attrStr = formatAttributes(attrs);
    const openTag = attrStr ? `<${tag} ${attrStr}>` : `<${tag}>`;
    return `${spaces}${openTag}\n${spaces}  ${escapedContent}\n${spaces}</${tag}>`;
  }

  // Array of child elements
  const attrStr = formatAttributes(attrs);
  const openTag = attrStr ? `<${tag} ${attrStr}>` : `<${tag}>`;
  const children = content.map((child) => buildElement(child, indent + 1)).join('\n');

  return `${spaces}${openTag}\n${children}\n${spaces}</${tag}>`;
}

/**
 * Build a complete XML document
 *
 * @example
 * buildXmlDocument({
 *   tag: 'root',
 *   content: [
 *     { tag: 'item', content: 'Hello' }
 *   ]
 * })
 */
export function buildXmlDocument(
  root: XmlElement,
  options: { declaration?: boolean; minify?: boolean } = {},
): string {
  const { declaration = true, minify = true } = options;
  const xml = buildElement(root);

  let result: string;
  if (declaration) {
    result = `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
  } else {
    result = xml;
  }

  // Apply minification by default (no information loss for AI)
  return minify ? minifyXmlOutput(result) : result;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a simple element with text content
 */
export function textElement(tag: string, text: string, attrs?: XmlAttributes): string {
  return wrapXml(tag, escapeXml(text), attrs);
}

/**
 * Create a CDATA section
 */
export function cdata(content: string): string {
  return `<![CDATA[${content}]]>`;
}

/**
 * Create an XML comment
 */
export function xmlComment(text: string): string {
  // Escape double dashes in comments
  const safeText = text.replace(/--/g, '- -');
  return `<!-- ${safeText} -->`;
}
