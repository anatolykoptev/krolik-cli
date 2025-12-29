/**
 * @module lib/@i18n/types
 * @description Core types for pluggable i18n language system.
 *
 * This module provides type definitions for:
 * - Language detection (single and multi-language)
 * - Text transliteration to Latin characters
 * - Stop word filtering
 * - Language plugin interface for extensibility
 * - Registry configuration
 */

/**
 * Result of detecting a single language in text.
 *
 * @example
 * ```typescript
 * const result: LanguageDetectionResult = {
 *   language: 'ru',
 *   confidence: 0.95,
 *   matchedChars: 47,
 *   totalChars: 50
 * };
 * ```
 */
export interface LanguageDetectionResult {
  /** ISO 639-1 language code (e.g., 'ru', 'en', 'de') */
  language: string;

  /** Confidence score from 0 to 1, where 1 is highest confidence */
  confidence: number;

  /** Number of characters that matched this language's character set */
  matchedChars: number;

  /** Total number of characters analyzed in the input text */
  totalChars: number;
}

/**
 * Result of transliterating text from one script to Latin characters.
 *
 * @example
 * ```typescript
 * const result: TransliterationResult = {
 *   text: 'privet mir',
 *   sourceLanguage: 'ru',
 *   unmappedChars: []
 * };
 * ```
 */
export interface TransliterationResult {
  /** The transliterated text in Latin characters */
  text: string;

  /** ISO 639-1 code of the source language that was transliterated */
  sourceLanguage: string;

  /** Array of characters that could not be transliterated */
  unmappedChars: string[];
}

/**
 * Result of filtering stop words from a list of words.
 *
 * @example
 * ```typescript
 * const result: StopWordFilterResult = {
 *   words: ['быстрый', 'код'],
 *   removedWords: ['и', 'в', 'на'],
 *   language: 'ru'
 * };
 * ```
 */
export interface StopWordFilterResult {
  /** Words remaining after stop word filtering */
  words: string[];

  /** Words that were identified and removed as stop words */
  removedWords: string[];

  /** ISO 639-1 code of the language used for filtering */
  language: string;
}

/**
 * Interface for language plugins.
 *
 * Each supported language implements this interface to provide:
 * - Character detection via Unicode ranges
 * - Transliteration to Latin characters
 * - Stop word filtering
 *
 * @example
 * ```typescript
 * class RussianPlugin implements LanguagePlugin {
 *   readonly code = 'ru';
 *   readonly name = 'Russian';
 *   readonly unicodeRanges: Array<[number, number]> = [
 *     [0x0400, 0x04FF], // Cyrillic
 *   ];
 *   // ... implement methods
 * }
 * ```
 */
export interface LanguagePlugin {
  /** Unique ISO 639-1 language code (e.g., 'ru', 'en', 'de') */
  readonly code: string;

  /** Human-readable display name for the language */
  readonly name: string;

  /**
   * Unicode code point ranges for character detection.
   * Each tuple represents [start, end] inclusive range.
   */
  readonly unicodeRanges: ReadonlyArray<readonly [number, number]>;

  /**
   * Detects if and how much of the text contains this language.
   *
   * @param text - The text to analyze
   * @returns Detection result with confidence score
   */
  detect(text: string): LanguageDetectionResult;

  /**
   * Transliterates text from this language's script to Latin characters.
   *
   * @param text - The text to transliterate
   * @returns Transliteration result with the Latin text
   */
  transliterate(text: string): TransliterationResult;

  /**
   * Returns the set of stop words for this language.
   * Stop words are common words that are often filtered out in text processing.
   *
   * @returns Immutable set of stop words
   */
  getStopWords(): ReadonlySet<string>;

  /**
   * Filters stop words from the given list of words.
   *
   * @param words - Array of words to filter
   * @returns Filter result with remaining and removed words
   */
  filterStopWords(words: string[]): StopWordFilterResult;

  /**
   * Checks if a single character belongs to this language's character set.
   *
   * @param char - A single character to check
   * @returns True if the character is part of this language's script
   */
  isLanguageChar(char: string): boolean;
}

/**
 * Configuration options for the language registry.
 *
 * @example
 * ```typescript
 * const config: LanguageRegistryConfig = {
 *   defaultLanguage: 'en',
 *   enabledLanguages: ['en', 'ru', 'de'],
 *   minConfidence: 0.3
 * };
 * ```
 */
export interface LanguageRegistryConfig {
  /** ISO 639-1 code of the default/fallback language */
  defaultLanguage: string;

  /**
   * List of language codes to enable.
   * If empty or undefined, all registered languages are enabled.
   */
  enabledLanguages?: string[];

  /**
   * Minimum confidence threshold for language detection.
   * Languages detected below this threshold are ignored.
   * @default 0.1
   */
  minConfidence?: number;
}

/**
 * Result of detecting multiple languages in text.
 *
 * Used when text may contain mixed languages (e.g., English with Russian words).
 *
 * @example
 * ```typescript
 * const result: MultiLanguageDetectionResult = {
 *   primary: { language: 'en', confidence: 0.7, matchedChars: 70, totalChars: 100 },
 *   all: [
 *     { language: 'en', confidence: 0.7, matchedChars: 70, totalChars: 100 },
 *     { language: 'ru', confidence: 0.3, matchedChars: 30, totalChars: 100 }
 *   ],
 *   isMixed: true
 * };
 * ```
 */
export interface MultiLanguageDetectionResult {
  /** The language with the highest confidence score */
  primary: LanguageDetectionResult;

  /** All detected languages, sorted by confidence (highest first) */
  all: LanguageDetectionResult[];

  /** True if multiple languages were detected with significant presence */
  isMixed: boolean;
}
