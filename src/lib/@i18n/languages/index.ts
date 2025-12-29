/**
 * @module lib/@i18n/languages
 * @description Language plugin exports for the i18n system.
 *
 * This module provides a centralized export point for all language plugins.
 * Each plugin provides character detection, transliteration, and stop word filtering.
 *
 * @example
 * ```typescript
 * import {
 *   russianPlugin,
 *   hasRussianText,
 *   transliterateRussian,
 *   englishPlugin,
 *   hasEnglishText,
 * } from './languages';
 *
 * // Or import classes for custom instantiation
 * import { RussianLanguagePlugin, EnglishLanguagePlugin } from './languages';
 * ```
 */

// English language support
export { EnglishLanguagePlugin, englishPlugin, hasEnglishText } from './english';
// Russian language support
export {
  filterRussianStopWords,
  hasRussianText,
  isRussianStopWord,
  RussianLanguagePlugin,
  russianPlugin,
  transliterateRussian,
} from './russian';
