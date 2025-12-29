/**
 * @module lib/@i18n/languages/english
 * @description English language plugin for the i18n system.
 *
 * Provides:
 * - Latin alphabet character detection (A-Z, a-z)
 * - Identity transliteration (lowercase conversion only)
 * - Comprehensive English stop word filtering
 *
 * Since English uses the Latin alphabet, transliteration simply
 * converts text to lowercase. The primary value is in stop word
 * filtering for i18n key generation.
 *
 * @example
 * ```typescript
 * import { englishPlugin, hasEnglishText } from './english';
 *
 * // Detect English text
 * const result = englishPlugin.detect('Hello World');
 * // => { language: 'en', confidence: 1.0, matchedChars: 10, totalChars: 10 }
 *
 * // Check for English content
 * hasEnglishText('Hello World'); // => true
 *
 * // Filter stop words
 * const filtered = englishPlugin.filterStopWords(['the', 'quick', 'brown', 'fox']);
 * // => { words: ['quick', 'brown', 'fox'], removedWords: ['the'], language: 'en' }
 * ```
 */

import { BaseLanguagePlugin } from '../base';
import type { TransliterationResult } from '../types';

/**
 * Latin character case mapping for transliteration.
 *
 * English doesn't need transliteration since it uses Latin script,
 * but we provide uppercase-to-lowercase mapping for consistency
 * with other language plugins.
 */
const LATIN_MAP = new Map<string, string>([
  ['A', 'a'],
  ['B', 'b'],
  ['C', 'c'],
  ['D', 'd'],
  ['E', 'e'],
  ['F', 'f'],
  ['G', 'g'],
  ['H', 'h'],
  ['I', 'i'],
  ['J', 'j'],
  ['K', 'k'],
  ['L', 'l'],
  ['M', 'm'],
  ['N', 'n'],
  ['O', 'o'],
  ['P', 'p'],
  ['Q', 'q'],
  ['R', 'r'],
  ['S', 's'],
  ['T', 't'],
  ['U', 'u'],
  ['V', 'v'],
  ['W', 'w'],
  ['X', 'x'],
  ['Y', 'y'],
  ['Z', 'z'],
]);

/**
 * Comprehensive English stop words for i18n key generation.
 *
 * These common words add little semantic value and are filtered
 * out when generating i18n keys from English text content.
 *
 * Categories included:
 * - Articles (a, an, the)
 * - Pronouns (I, you, he, she, it, we, they, etc.)
 * - Prepositions (in, on, at, to, for, of, with, by, from, etc.)
 * - Conjunctions (and, or, but, if, because, etc.)
 * - Auxiliary verbs (is, are, was, were, be, have, has, had, etc.)
 * - Common short words (here, there, when, where, why, how, etc.)
 */
const ENGLISH_STOP_WORDS = new Set<string>([
  // Articles
  'a',
  'an',
  'the',

  // Pronouns - personal
  'i',
  'me',
  'my',
  'myself',
  'we',
  'our',
  'ours',
  'ourselves',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
  'he',
  'him',
  'his',
  'himself',
  'she',
  'her',
  'hers',
  'herself',
  'it',
  'its',
  'itself',
  'they',
  'them',
  'their',
  'theirs',
  'themselves',

  // Pronouns - demonstrative and relative
  'what',
  'which',
  'who',
  'whom',
  'this',
  'that',
  'these',
  'those',

  // Prepositions
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'up',
  'down',
  'out',
  'off',
  'over',
  'under',
  'again',
  'further',
  'then',
  'once',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',

  // Conjunctions
  'and',
  'or',
  'but',
  'if',
  'because',
  'as',
  'until',
  'while',
  'nor',
  'so',
  'yet',
  'both',
  'either',
  'neither',
  'not',
  'only',

  // Auxiliary verbs - be
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',

  // Auxiliary verbs - have
  'have',
  'has',
  'had',
  'having',

  // Auxiliary verbs - do
  'do',
  'does',
  'did',
  'doing',

  // Modal verbs
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'can',
  'need',
  'dare',
  'ought',
  'used',

  // Common short words - location/time
  'here',
  'there',
  'when',
  'where',
  'why',
  'how',

  // Common short words - quantifiers
  'all',
  'each',
  'every',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'any',

  // Common short words - comparisons and modifiers
  'same',
  'than',
  'too',
  'very',
  'just',
  'also',
]);

/**
 * English language plugin with Latin alphabet support.
 *
 * Extends BaseLanguagePlugin to provide English-specific behavior:
 * - Detects Latin A-Z characters
 * - Transliterates by lowercasing (no script change needed)
 * - Filters comprehensive English stop words
 *
 * @example
 * ```typescript
 * const plugin = new EnglishLanguagePlugin();
 *
 * // Character detection
 * plugin.isLanguageChar('A'); // => true
 * plugin.isLanguageChar('a'); // => true
 * plugin.isLanguageChar('1'); // => false
 *
 * // Language detection
 * const result = plugin.detect('Hello World');
 * console.log(result.confidence); // => 1.0
 *
 * // Stop word filtering
 * const filtered = plugin.filterStopWords(['the', 'cat', 'sat']);
 * // => { words: ['cat', 'sat'], removedWords: ['the'], language: 'en' }
 * ```
 */
export class EnglishLanguagePlugin extends BaseLanguagePlugin {
  /**
   * ISO 639-1 language code for English.
   */
  readonly code = 'en';

  /**
   * Human-readable language name.
   */
  readonly name = 'English';

  /**
   * Unicode code point ranges for Latin alphabet.
   *
   * Basic Latin:
   * - U+0041-U+005A: A-Z (uppercase)
   * - U+0061-U+007A: a-z (lowercase)
   */
  readonly unicodeRanges: ReadonlyArray<readonly [number, number]> = [
    [0x0041, 0x005a], // A-Z
    [0x0061, 0x007a], // a-z
  ];

  /**
   * @internal
   * Character mapping for transliteration.
   * Maps uppercase to lowercase for consistency.
   */
  protected readonly translitMap: ReadonlyMap<string, string> = LATIN_MAP;

  /**
   * @internal
   * English stop words set.
   */
  protected readonly stopWords: ReadonlySet<string> = ENGLISH_STOP_WORDS;

  /**
   * Transliterates English text by lowercasing.
   *
   * Since English already uses the Latin alphabet, transliteration
   * simply converts the entire text to lowercase. This maintains
   * consistency with other language plugins while providing
   * the expected normalization for key generation.
   *
   * @param text - The text to transliterate (lowercase)
   * @returns Transliteration result with lowercased text
   *
   * @example
   * ```typescript
   * plugin.transliterate('Hello World');
   * // => { text: 'hello world', sourceLanguage: 'en', unmappedChars: [] }
   *
   * plugin.transliterate('UPPERCASE');
   * // => { text: 'uppercase', sourceLanguage: 'en', unmappedChars: [] }
   * ```
   */
  override transliterate(text: string): TransliterationResult {
    return {
      text: text.toLowerCase(),
      sourceLanguage: this.code,
      unmappedChars: [],
    };
  }
}

/**
 * Pre-instantiated English language plugin for convenience.
 *
 * Use this singleton instance instead of creating new instances
 * to avoid unnecessary memory allocation.
 *
 * @example
 * ```typescript
 * import { englishPlugin } from './english';
 *
 * const result = englishPlugin.detect('Hello World');
 * const filtered = englishPlugin.filterStopWords(['the', 'quick', 'fox']);
 * ```
 */
export const englishPlugin = new EnglishLanguagePlugin();

/**
 * Checks if text contains significant English content.
 *
 * Returns true if the text has:
 * - At least 3 matching Latin characters
 * - Confidence score above 0.3 (30%)
 *
 * Useful for quick language detection without full analysis.
 *
 * @param text - The text to analyze
 * @returns True if the text contains significant English content
 *
 * @example
 * ```typescript
 * hasEnglishText('Hello World');  // => true
 * hasEnglishText('Hi');           // => false (too short)
 * hasEnglishText('Привет мир');   // => false (Cyrillic)
 * hasEnglishText('Hello Привет'); // => true (mixed, >30% Latin)
 * ```
 */
export function hasEnglishText(text: string): boolean {
  const result = englishPlugin.detect(text);
  return result.confidence > 0.3 && result.matchedChars >= 3;
}
