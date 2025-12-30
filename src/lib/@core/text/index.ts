/**
 * @module lib/@core/text
 * @description Text and linguistic analysis utilities
 *
 * Provides morphology analysis for English words used in code naming:
 * - Plural/singular detection
 * - Past participle detection
 * - Syllable counting
 * - Vowel ratio analysis
 * - Segment splitting (camelCase/snake_case)
 *
 * @example
 * ```typescript
 * import { isPluralNoun, isPastParticiple, splitIntoSegments } from '@/lib/@core/text';
 *
 * // Detect plural nouns
 * isPluralNoun('files');   // true
 * isPluralNoun('class');   // false
 *
 * // Detect past participles
 * isPastParticiple('sorted');   // true
 * isPastParticiple('filter');   // false
 *
 * // Split naming conventions
 * splitIntoSegments('getUserName'); // ['get', 'User', 'Name']
 * ```
 */

export {
  estimateSyllables,
  getVowelRatio,
  hasNounSuffix,
  isAbbreviation,
  isPastParticiple,
  isPluralNoun,
  splitIntoSegments,
} from './morphology';
