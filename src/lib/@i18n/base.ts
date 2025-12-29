/**
 * @module lib/@i18n/base
 * @description Base language plugin class providing common functionality for all language plugins.
 *
 * Provides default implementations for:
 * - Unicode-based character detection
 * - Transliteration using character maps
 * - Stop word filtering
 *
 * Language plugins should extend this class and override the abstract properties.
 *
 * @example
 * ```typescript
 * import { BaseLanguagePlugin } from './base';
 *
 * class GermanLanguagePlugin extends BaseLanguagePlugin {
 *   readonly code = 'de';
 *   readonly name = 'German';
 *   readonly unicodeRanges: Array<[number, number]> = [
 *     [0x00C0, 0x00FF], // Latin Extended-A (umlauts, etc.)
 *   ];
 *   protected readonly translitMap = new Map([['ä', 'ae'], ['ö', 'oe'], ['ü', 'ue']]);
 *   protected readonly stopWords = new Set(['der', 'die', 'das', 'und']);
 * }
 * ```
 */

import type {
  LanguageDetectionResult,
  LanguagePlugin,
  StopWordFilterResult,
  TransliterationResult,
} from './types';

/**
 * Abstract base class for language plugins.
 *
 * Provides common implementations for character detection, transliteration,
 * and stop word filtering. Subclasses must provide:
 * - `code`: ISO 639-1 language code
 * - `name`: Human-readable language name
 * - `unicodeRanges`: Character detection ranges
 * - `translitMap`: Character-to-Latin mapping
 * - `stopWords`: Set of stop words
 */
export abstract class BaseLanguagePlugin implements LanguagePlugin {
  /** ISO 639-1 language code (e.g., 'ru', 'de', 'zh') */
  abstract readonly code: string;

  /** Human-readable language name (e.g., 'Russian', 'German', 'Chinese') */
  abstract readonly name: string;

  /**
   * Unicode code point ranges for this language's script.
   * Each tuple is [startCodePoint, endCodePoint] inclusive.
   */
  abstract readonly unicodeRanges: ReadonlyArray<readonly [number, number]>;

  /**
   * Character-to-Latin transliteration map.
   * Maps individual characters (including uppercase) to their Latin equivalents.
   */
  protected abstract readonly translitMap: ReadonlyMap<string, string>;

  /**
   * Set of stop words for this language.
   * Common words that should be filtered in key generation.
   */
  protected abstract readonly stopWords: ReadonlySet<string>;

  /**
   * Detects the presence and confidence of this language in the given text.
   *
   * Confidence is calculated as the ratio of matched characters to total
   * analyzable characters (excluding whitespace and punctuation).
   *
   * @param text - Text to analyze for language presence
   * @returns Detection result with confidence score and character counts
   *
   * @example
   * ```typescript
   * const result = plugin.detect('Привет мир');
   * // => { language: 'ru', confidence: 1.0, matchedChars: 9, totalChars: 9 }
   *
   * const mixed = plugin.detect('Hello Привет');
   * // => { language: 'ru', confidence: 0.5, matchedChars: 6, totalChars: 12 }
   * ```
   */
  detect(text: string): LanguageDetectionResult {
    if (!text) {
      return {
        language: this.code,
        confidence: 0,
        matchedChars: 0,
        totalChars: 0,
      };
    }

    let matchedChars = 0;
    let totalChars = 0;

    for (const char of text) {
      // Skip whitespace and common punctuation
      if (/\s/.test(char) || /[.,!?;:'"()\-[\]{}]/.test(char)) {
        continue;
      }

      totalChars++;

      if (this.isLanguageChar(char)) {
        matchedChars++;
      }
    }

    const confidence = totalChars > 0 ? matchedChars / totalChars : 0;

    return {
      language: this.code,
      confidence,
      matchedChars,
      totalChars,
    };
  }

  /**
   * Transliterates text from this language's script to Latin characters.
   *
   * Characters not found in the transliteration map are preserved as-is,
   * and tracked in the `unmappedChars` array.
   *
   * @param text - Text to transliterate
   * @returns Result with Latin text and any unmapped characters
   *
   * @example
   * ```typescript
   * const result = plugin.transliterate('Привет мир');
   * // => { text: 'Privet mir', sourceLanguage: 'ru', unmappedChars: [] }
   *
   * const mixed = plugin.transliterate('Hello Привет');
   * // => { text: 'Hello Privet', sourceLanguage: 'ru', unmappedChars: [] }
   * ```
   */
  transliterate(text: string): TransliterationResult {
    if (!text) {
      return {
        text: '',
        sourceLanguage: this.code,
        unmappedChars: [],
      };
    }

    const unmappedChars: string[] = [];
    let result = '';

    for (const char of text) {
      const mapped = this.translitMap.get(char);

      if (mapped !== undefined) {
        result += mapped;
      } else {
        result += char;
        // Track unmapped characters that belong to this language
        if (this.isLanguageChar(char)) {
          unmappedChars.push(char);
        }
      }
    }

    return {
      text: result,
      sourceLanguage: this.code,
      unmappedChars: [...new Set(unmappedChars)], // Deduplicate
    };
  }

  /**
   * Returns the set of stop words for this language.
   *
   * Stop words are common words (articles, prepositions, conjunctions)
   * that are typically filtered out in text processing and key generation.
   *
   * @returns Immutable set of stop words
   *
   * @example
   * ```typescript
   * const stops = plugin.getStopWords();
   * stops.has('и');  // => true (Russian "and")
   * stops.has('код'); // => false (not a stop word)
   * ```
   */
  getStopWords(): ReadonlySet<string> {
    return this.stopWords;
  }

  /**
   * Filters stop words from an array of words.
   *
   * @param words - Array of words to filter
   * @returns Result with filtered words and list of removed stop words
   *
   * @example
   * ```typescript
   * const result = plugin.filterStopWords(['это', 'быстрый', 'код']);
   * // => { words: ['быстрый', 'код'], removedWords: ['это'], language: 'ru' }
   * ```
   */
  filterStopWords(words: string[]): StopWordFilterResult {
    const filtered: string[] = [];
    const removed: string[] = [];

    for (const word of words) {
      const normalized = word.toLowerCase();
      if (this.stopWords.has(normalized)) {
        removed.push(word);
      } else {
        filtered.push(word);
      }
    }

    return {
      words: filtered,
      removedWords: removed,
      language: this.code,
    };
  }

  /**
   * Checks if a character belongs to this language's script.
   *
   * Uses Unicode code point ranges to determine membership.
   *
   * @param char - A single character to check
   * @returns True if the character is in this language's Unicode range
   *
   * @example
   * ```typescript
   * plugin.isLanguageChar('Б');  // => true (Cyrillic)
   * plugin.isLanguageChar('B');  // => false (Latin)
   * plugin.isLanguageChar(' ');  // => false (whitespace)
   * ```
   */
  isLanguageChar(char: string): boolean {
    if (!char || char.length === 0) {
      return false;
    }

    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) {
      return false;
    }

    for (const [start, end] of this.unicodeRanges) {
      if (codePoint >= start && codePoint <= end) {
        return true;
      }
    }

    return false;
  }
}
