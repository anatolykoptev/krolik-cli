/**
 * @module lib/@i18n
 * @description Pluggable internationalization language system
 *
 * Provides language detection, transliteration, and stop word filtering
 * through a plugin architecture. Each language is a separate module
 * that can be enabled/disabled independently.
 *
 * @example
 * ```typescript
 * import { defaultRegistry, transliterate, detectLanguage } from '@/lib/@i18n';
 *
 * // Detect language
 * const result = detectLanguage('Привет мир');
 * // => { primary: { language: 'ru', confidence: 1.0, ... }, ... }
 *
 * // Transliterate
 * const latin = transliterate('Привет мир');
 * // => 'privet mir'
 * ```
 */

// Export base class
export { BaseLanguagePlugin } from './base';
export {
  EnglishLanguagePlugin,
  englishPlugin,
  hasEnglishText,
} from './languages/english';
// Export language plugins
export {
  hasRussianText,
  RussianLanguagePlugin,
  russianPlugin,
  transliterateRussian,
} from './languages/russian';
// Export namespace resolver
export type { NamespaceRule } from './namespace-resolver';
export {
  createNamespaceDetector,
  createNamespaceRule,
  detectNamespace,
  NAMESPACE_RULES,
  normalizeNamespacePart,
} from './namespace-resolver';
// Export registry
export { createLanguageRegistry, LanguageRegistry } from './registry';
// Export types
export type {
  LanguageDetectionResult,
  LanguagePlugin,
  LanguageRegistryConfig,
  MultiLanguageDetectionResult,
  StopWordFilterResult,
  TransliterationResult,
} from './types';

// ============================================================================
// DEFAULT REGISTRY
// ============================================================================

import { englishPlugin } from './languages/english';
import { russianPlugin } from './languages/russian';
import { createLanguageRegistry } from './registry';

/**
 * Default pre-configured language registry with Russian and English
 */
export const defaultRegistry = createLanguageRegistry({
  defaultLanguage: 'en',
  minConfidence: 0.3,
});

// Register default plugins
defaultRegistry.register(russianPlugin);
defaultRegistry.register(englishPlugin);

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Detect languages in text using default registry
 */
export function detectLanguage(text: string) {
  return defaultRegistry.detect(text);
}

/**
 * Transliterate text using default registry
 */
export function transliterate(text: string): string {
  return defaultRegistry.transliterate(text).text;
}

/**
 * Get all stop words from default registry
 */
export function getAllStopWords(): ReadonlySet<string> {
  return defaultRegistry.getAllStopWords();
}

/**
 * Filter stop words using default registry
 */
export function filterStopWords(words: string[]): string[] {
  const stopWords = getAllStopWords();
  return words.filter((word) => !stopWords.has(word.toLowerCase()));
}

/**
 * Check if text contains user-facing content (Russian or meaningful English)
 */
export function isUserFacingText(text: string): boolean {
  const detection = detectLanguage(text);

  // Russian text is always user-facing
  if (detection.primary.language === 'ru' && detection.primary.confidence > 0.3) {
    return true;
  }

  // English text with multiple words
  if (detection.primary.language === 'en') {
    const words = text.match(/[A-Za-z]{3,}/g) ?? [];
    return words.length >= 1;
  }

  return false;
}
