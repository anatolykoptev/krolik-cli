/**
 * @module lib/@i18n/key-builder
 * @description i18n key generation utilities
 *
 * Provides intelligent key generation for internationalization based on:
 * - Component context and file structure
 * - Content analysis and transliteration
 * - Namespace detection from project conventions
 *
 * @example
 * ```typescript
 * import { textToKey, generateI18nKey } from '@/lib/@i18n/key-builder';
 *
 * textToKey('Привет мир');
 * // => 'privet_mir'
 *
 * generateI18nKey(stringInfo, 'PlaceCard');
 * // => { key: 'components.place.card.save', namespace: 'components', ... }
 * ```
 */

import { filterStopWords, transliterate } from './index';
import { detectNamespace } from './namespace-resolver';

// Re-export for convenience
export { detectNamespace } from './namespace-resolver';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_KEY_LENGTH = 50;
const MAX_KEY_WORDS = 5;
const MIN_CONFIDENCE = 0.3;
const HIGH_CONFIDENCE = 0.9;
const MEDIUM_CONFIDENCE = 0.7;

/**
 * Common UI action words that make good key prefixes
 */
const ACTION_KEYWORDS = new Set<string>([
  'submit',
  'cancel',
  'save',
  'delete',
  'edit',
  'add',
  'remove',
  'create',
  'update',
  'confirm',
  'close',
  'open',
  'show',
  'hide',
  'load',
  'loading',
  'search',
  'filter',
  'sort',
  'reset',
  'clear',
  'apply',
  'continue',
  'back',
  'next',
  'previous',
  'finish',
  'start',
  'stop',
  'pause',
  'resume',
  'retry',
  'refresh',
  'upload',
  'download',
  'import',
  'export',
  'copy',
  'paste',
  'share',
  'print',
  'send',
  'receive',
  'login',
  'logout',
  'register',
  'signup',
  'signin',
  'signout',
]);

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Truncates a key to the maximum allowed length
 */
function truncateKey(key: string): string {
  if (key.length <= MAX_KEY_LENGTH) {
    return key;
  }
  return key.slice(0, MAX_KEY_LENGTH).replace(/_+$/, '');
}

/**
 * Converts a PascalCase component name to namespace-friendly format
 */
export function componentToNamespacePart(componentName: string): string {
  if (!componentName) return '';

  // Handle all-caps abbreviations
  if (/^[A-Z]{2,}$/.test(componentName)) {
    return componentName.toLowerCase();
  }

  // Split on capital letters
  const parts = componentName.split(/(?=[A-Z])/).filter((p) => p.length > 0);
  return parts.map((p) => p.toLowerCase()).join('.');
}

/**
 * Extracts a key suffix from JSX attribute context
 */
export function attributeToKeySuffix(attributeName: string): string {
  if (!attributeName) return '';

  // Handle data-* attributes
  if (attributeName.startsWith('data-')) {
    return attributeName.slice(5).replace(/-/g, '_');
  }

  // Handle aria-* attributes
  if (attributeName.startsWith('aria-')) {
    return attributeName.replace(/-/g, '_');
  }

  return attributeName.replace(/-/g, '_').toLowerCase();
}

// ============================================================================
// TEXT TO KEY
// ============================================================================

/**
 * Converts human-readable text to a valid i18n key name.
 * Applies transliteration, normalization, and snake_case formatting.
 */
export function textToKey(text: string): string {
  if (!text?.trim()) {
    return 'text';
  }

  // Step 1: Transliterate Cyrillic to Latin
  let normalized = transliterate(text);

  // Step 2: Convert to lowercase
  normalized = normalized.toLowerCase();

  // Step 3: Replace non-alphanumeric characters with spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');

  // Step 4: Split into words and filter stop words
  const words = filterStopWords(normalized.split(/\s+/).filter((word) => word.length > 0)).slice(
    0,
    MAX_KEY_WORDS,
  );

  // Step 5: Handle edge case where all words were filtered
  if (words.length === 0) {
    const fallbackWords = normalized.split(/\s+/).filter((w) => w.length > 0);
    const firstFallback = fallbackWords[0];
    if (firstFallback) {
      return truncateKey(firstFallback);
    }
    return 'text';
  }

  return truncateKey(words.join('_'));
}

/**
 * Generates a meaningful key name from text content.
 * Identifies action words and key semantic components.
 */
export function generateKeyFromContent(text: string): string {
  if (!text?.trim()) {
    return 'text';
  }

  const transliterated = transliterate(text).toLowerCase();
  const words = transliterated.split(/\s+/).filter((w) => w.length > 0);
  const firstWord = words[0]?.replace(/[^a-z]/g, '');

  if (firstWord && ACTION_KEYWORDS.has(firstWord)) {
    if (words.length === 1) {
      return firstWord;
    }
    const contextWords = words.slice(1, 3).map((w) => w.replace(/[^a-z0-9]/g, ''));
    return truncateKey([firstWord, ...contextWords.filter((w) => w.length > 0)].join('_'));
  }

  return textToKey(text);
}

// ============================================================================
// I18N KEY GENERATION
// ============================================================================

/**
 * Suggested i18n key with metadata
 */
export interface SuggestedI18nKey {
  key: string;
  namespace: string;
  name: string;
  source: 'component' | 'attribute' | 'content' | 'inferred';
  confidence: number;
}

/**
 * Minimal string info needed for key generation
 */
export interface KeyGenerationContext {
  value: string;
  context: string;
  category: string;
  location: { file: string };
  attributeName?: string;
}

/**
 * Calculate confidence score for content-based key generation
 */
function calculateContentConfidence(originalText: string, generatedKey: string): number {
  let confidence = 0.5;

  const transliterated = transliterate(originalText).toLowerCase();
  const firstWord = transliterated.split(/\s+/)[0]?.replace(/[^a-z]/g, '');

  if (firstWord && ACTION_KEYWORDS.has(firstWord)) {
    confidence += 0.2;
  }
  if (originalText.length <= 30) confidence += 0.1;
  if (originalText.length > 100) confidence -= 0.2;
  if (generatedKey !== 'text' && generatedKey.length > 3) confidence += 0.1;

  return Math.max(MIN_CONFIDENCE, Math.min(HIGH_CONFIDENCE, confidence));
}

/**
 * Gets a suffix based on text category
 */
function getCategorySuffix(category: string): string {
  const categoryMap: Record<string, string> = {
    placeholder: 'placeholder',
    title: 'title',
    description: 'description',
    tooltip: 'tooltip',
    validation: 'error',
    toast: 'message',
    modal: 'modal',
  };
  return categoryMap[category] ?? '';
}

/**
 * Builds the complete key path from namespace and name
 */
function buildKeyPath(namespace: string, name: string): string {
  const namespaceParts = namespace.split('.');
  const nameParts = name.split('.');

  let dedupedName = name;
  for (const nsPart of namespaceParts) {
    if (nameParts[0] === nsPart) {
      nameParts.shift();
      dedupedName = nameParts.join('.') || name;
    } else {
      break;
    }
  }

  return truncateKey(`${namespace}.${dedupedName}`);
}

/**
 * Generates a complete i18n key suggestion based on string context.
 */
export function generateI18nKey(
  info: KeyGenerationContext,
  componentName?: string,
): SuggestedI18nKey {
  const namespace = detectNamespace(info.location.file);

  const parts: string[] = [];
  let source: SuggestedI18nKey['source'] = 'inferred';
  let confidence = MIN_CONFIDENCE;

  // Add component context
  if (componentName) {
    const componentPart = componentToNamespacePart(componentName);
    if (componentPart) {
      parts.push(componentPart);
      source = 'component';
      confidence = MEDIUM_CONFIDENCE;
    }
  }

  // Add attribute suffix for jsx-attribute context
  if (info.context === 'jsx-attribute' && info.attributeName) {
    const attrSuffix = attributeToKeySuffix(info.attributeName);
    if (attrSuffix) {
      parts.push(attrSuffix);
      source = 'attribute';
      confidence = HIGH_CONFIDENCE;
    }
  }

  const contentKey = generateKeyFromContent(info.value);

  if (parts.length === 0) {
    source = 'content';
    confidence = calculateContentConfidence(info.value, contentKey);
    return {
      key: buildKeyPath(namespace, contentKey),
      namespace,
      name: contentKey,
      source,
      confidence,
    };
  }

  const categorySuffix = getCategorySuffix(info.category);
  if (categorySuffix && !parts.includes(categorySuffix)) {
    parts.push(categorySuffix);
  }

  if (contentKey.length <= 20) {
    parts.push(contentKey);
    confidence = Math.max(confidence, MEDIUM_CONFIDENCE);
  }

  const name = truncateKey(parts.join('.'));

  return {
    key: buildKeyPath(namespace, name),
    namespace,
    name,
    source,
    confidence,
  };
}
