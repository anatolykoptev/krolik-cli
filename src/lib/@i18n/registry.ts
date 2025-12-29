/**
 * @module lib/@i18n/registry
 * @description Language plugin registry for centralized language management.
 *
 * Provides unified access to language detection, transliteration, and stop word
 * filtering across multiple languages. Supports:
 * - Plugin registration and configuration
 * - Multi-language detection
 * - Automatic language selection for transliteration
 * - Combined stop word aggregation
 *
 * @example
 * ```typescript
 * import { createLanguageRegistry } from '@/lib/@i18n/registry';
 * import { RussianPlugin } from '@/lib/@i18n/plugins/russian';
 * import { EnglishPlugin } from '@/lib/@i18n/plugins/english';
 *
 * const registry = createLanguageRegistry({
 *   defaultLanguage: 'en',
 *   enabledLanguages: ['en', 'ru'],
 *   minConfidence: 0.3,
 * });
 *
 * registry.register(new RussianPlugin());
 * registry.register(new EnglishPlugin());
 *
 * const detection = registry.detect('Hello Привет');
 * // detection.isMixed = true
 * ```
 */

import type {
  LanguagePlugin,
  LanguageRegistryConfig,
  MultiLanguageDetectionResult,
  TransliterationResult,
} from './types';

/** Default minimum confidence threshold for language detection */
const DEFAULT_MIN_CONFIDENCE = 0.3;

/** Threshold for considering a secondary language as significant */
const MIXED_LANGUAGE_THRESHOLD = 0.2;

/**
 * Registry for managing language plugins.
 *
 * Centralizes plugin registration and provides unified APIs for
 * language detection, transliteration, and stop word operations.
 */
export class LanguageRegistry {
  private readonly plugins = new Map<string, LanguagePlugin>();
  private readonly config: Required<LanguageRegistryConfig>;

  /**
   * Creates a new language registry with the specified configuration.
   *
   * @param config - Registry configuration options
   */
  constructor(config: LanguageRegistryConfig) {
    this.config = {
      defaultLanguage: config.defaultLanguage,
      enabledLanguages: config.enabledLanguages ?? [],
      minConfidence: config.minConfidence ?? DEFAULT_MIN_CONFIDENCE,
    };
  }

  /**
   * Registers a language plugin with the registry.
   *
   * If `enabledLanguages` is configured, only plugins for those languages
   * will be registered. Others are silently ignored.
   *
   * @param plugin - The language plugin to register
   *
   * @example
   * ```typescript
   * registry.register(new RussianPlugin());
   * registry.register(new GermanPlugin()); // Ignored if 'de' not in enabledLanguages
   * ```
   */
  register(plugin: LanguagePlugin): void {
    const { enabledLanguages } = this.config;

    // Check if language is enabled (empty array means all enabled)
    if (enabledLanguages.length > 0 && !enabledLanguages.includes(plugin.code)) {
      return;
    }

    this.plugins.set(plugin.code, plugin);
  }

  /**
   * Retrieves a registered plugin by language code.
   *
   * @param code - ISO 639-1 language code
   * @returns The plugin if registered, undefined otherwise
   */
  get(code: string): LanguagePlugin | undefined {
    return this.plugins.get(code);
  }

  /**
   * Returns all registered plugins.
   *
   * @returns Array of all registered language plugins
   */
  getAll(): LanguagePlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Returns the list of registered language codes.
   *
   * @returns Array of ISO 639-1 language codes
   */
  getRegisteredLanguages(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Detects all languages present in the text.
   *
   * Runs detection on all registered plugins and returns results
   * sorted by confidence. Languages below `minConfidence` threshold
   * are filtered out.
   *
   * @param text - The text to analyze
   * @returns Multi-language detection result with primary and all detected languages
   *
   * @example
   * ```typescript
   * const result = registry.detect('Hello Привет Welt');
   * // result.primary.language might be 'en', 'ru', or 'de'
   * // result.all contains all detected languages sorted by confidence
   * // result.isMixed = true
   * ```
   */
  detect(text: string): MultiLanguageDetectionResult {
    const results = this.getAll()
      .map((plugin) => plugin.detect(text))
      .filter((result) => result.confidence >= this.config.minConfidence)
      .sort((a, b) => b.confidence - a.confidence);

    // Handle case where no language is detected
    if (results.length === 0) {
      return {
        primary: {
          language: 'unknown',
          confidence: 0,
          matchedChars: 0,
          totalChars: text.length,
        },
        all: [],
        isMixed: false,
      };
    }

    // Safe to access since we checked results.length > 0 above
    const primaryResult = results[0] as (typeof results)[number];
    const secondaryResult = results[1];

    // Determine if text contains mixed languages
    const isMixed =
      results.length > 1 &&
      secondaryResult !== undefined &&
      secondaryResult.confidence > MIXED_LANGUAGE_THRESHOLD;

    return {
      primary: primaryResult,
      all: results,
      isMixed,
    };
  }

  /**
   * Transliterates text using the appropriate language plugin.
   *
   * Automatically detects the primary language and uses its transliteration.
   * Falls back to returning unchanged text if no suitable plugin is found.
   *
   * @param text - The text to transliterate
   * @returns Transliteration result with Latin text
   *
   * @example
   * ```typescript
   * const result = registry.transliterate('Привет мир');
   * // result.text = 'Privet mir'
   * // result.sourceLanguage = 'ru'
   * ```
   */
  transliterate(text: string): TransliterationResult {
    const detection = this.detect(text);
    const plugin = this.get(detection.primary.language);

    if (!plugin) {
      return {
        text,
        sourceLanguage: 'unknown',
        unmappedChars: [],
      };
    }

    return plugin.transliterate(text);
  }

  /**
   * Transliterates text using a specific language plugin.
   *
   * @param text - The text to transliterate
   * @param languageCode - ISO 639-1 language code to use
   * @returns Transliteration result, or null if language not registered
   *
   * @example
   * ```typescript
   * const result = registry.transliterateWith('Привет', 'ru');
   * ```
   */
  transliterateWith(text: string, languageCode: string): TransliterationResult | null {
    const plugin = this.get(languageCode);
    if (!plugin) {
      return null;
    }
    return plugin.transliterate(text);
  }

  /**
   * Returns combined stop words from all registered plugins.
   *
   * Useful for creating a universal stop word filter that works
   * across all supported languages.
   *
   * @returns Immutable set containing stop words from all languages
   */
  getAllStopWords(): ReadonlySet<string> {
    const combined = new Set<string>();

    for (const plugin of this.plugins.values()) {
      for (const word of plugin.getStopWords()) {
        combined.add(word);
      }
    }

    return combined;
  }

  /**
   * Filters stop words using the appropriate language plugin.
   *
   * Automatically detects the primary language and uses its stop words.
   *
   * @param words - Array of words to filter
   * @returns Filter result, or null if no suitable plugin found
   */
  filterStopWords(
    words: string[],
  ): { words: string[]; removedWords: string[]; language: string } | null {
    if (words.length === 0) {
      return { words: [], removedWords: [], language: 'unknown' };
    }

    // Detect language from the first few words
    const sampleText = words.slice(0, 10).join(' ');
    const detection = this.detect(sampleText);
    const plugin = this.get(detection.primary.language);

    if (!plugin) {
      return null;
    }

    return plugin.filterStopWords(words);
  }

  /**
   * Returns the registry configuration.
   *
   * @returns Current configuration with all options resolved
   */
  getConfig(): Required<LanguageRegistryConfig> {
    return { ...this.config };
  }

  /**
   * Checks if a specific language is registered.
   *
   * @param code - ISO 639-1 language code
   * @returns True if the language is registered
   */
  hasLanguage(code: string): boolean {
    return this.plugins.has(code);
  }

  /**
   * Returns the number of registered plugins.
   *
   * @returns Count of registered language plugins
   */
  get size(): number {
    return this.plugins.size;
  }
}

/**
 * Factory function to create a pre-configured language registry.
 *
 * @param config - Optional registry configuration (defaults to English as default language)
 * @returns New LanguageRegistry instance
 *
 * @example
 * ```typescript
 * // Simple usage with defaults
 * const registry = createLanguageRegistry();
 *
 * // With custom configuration
 * const registry = createLanguageRegistry({
 *   defaultLanguage: 'ru',
 *   enabledLanguages: ['ru', 'en'],
 *   minConfidence: 0.5,
 * });
 * ```
 */
export function createLanguageRegistry(
  config: LanguageRegistryConfig = { defaultLanguage: 'en' },
): LanguageRegistry {
  return new LanguageRegistry(config);
}
