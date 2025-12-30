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
// Export catalog
export type { FindByValueOptions, LoadOptions, LocaleCatalog } from './catalog';
export { createLocaleCatalog, defaultCatalog } from './catalog';
// Export key resolver
export type {
  BatchResolveResult,
  KeyResolverOptions,
  ResolvedKey,
  SimpleKeyResolverOptions,
  SimpleLocaleCatalog,
} from './key-resolver';
export {
  resolveKey,
  resolveKeySync,
  resolveKeys,
  resolveKeysSync,
} from './key-resolver';
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
// Export setup
export type { I18nSetupConfig, LocalesDirResult } from './setup';
export {
  DEFAULT_I18N_CONFIG,
  detectLocalesDir,
  ensureLocalesDir,
  getOrCreateLocalesDir,
  initDefaultLocales,
  initLanguageLocales,
} from './setup';
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

// ============================================================================
// I18NEXT-CLI INTEGRATION
// ============================================================================

export {
  createDefaultConfig,
  detectHardcodedStrings,
  extractKeys,
  generateKeyFromText,
  generateTypes,
  type HardcodedStringIssue,
  type I18nDetectionResult,
  type I18nExtractionResult,
  type I18nextToolkitConfig,
  loadI18nextConfig,
  syncLocales,
} from './i18next-integration';

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
