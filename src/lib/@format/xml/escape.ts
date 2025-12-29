/**
 * @module lib/@format/xml/escape
 * @description XML escaping and unescaping utilities
 */

/**
 * Escape special XML characters
 *
 * @example
 * escapeXml('<div>Hello & World</div>')
 * // Returns: '&lt;div&gt;Hello &amp; World&lt;/div&gt;'
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Unescape XML entities back to characters
 */
export function unescapeXml(text: string): string {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}
