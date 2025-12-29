/**
 * @module lib/@i18n/languages/russian
 * @description Russian language plugin with GOST 7.79-2000 transliteration.
 *
 * Provides comprehensive support for Russian (Cyrillic) text:
 * - Detection of Cyrillic characters in mixed-language text
 * - GOST 7.79-2000 System B compliant transliteration to Latin
 * - Extensive Russian stop word filtering for i18n key generation
 *
 * @see https://en.wikipedia.org/wiki/Romanization_of_Russian
 * @see https://en.wikipedia.org/wiki/GOST_7.79-2000
 *
 * @example
 * ```typescript
 * import { russianPlugin, hasRussianText, transliterateRussian } from './russian';
 *
 * // Check for Russian text
 * hasRussianText('Привет мир');  // => true
 * hasRussianText('Hello world'); // => false
 *
 * // Transliterate to Latin
 * transliterateRussian('Привет мир'); // => 'privet mir'
 *
 * // Use plugin methods directly
 * const result = russianPlugin.detect('Hello Привет');
 * // => { language: 'ru', confidence: 0.5, matchedChars: 6, totalChars: 12 }
 *
 * const filtered = russianPlugin.filterStopWords(['это', 'быстрый', 'код']);
 * // => { words: ['быстрый', 'код'], removedWords: ['это'], language: 'ru' }
 * ```
 */

import { BaseLanguagePlugin } from '../base';

// ============================================================================
// GOST 7.79-2000 TRANSLITERATION MAP
// ============================================================================

/**
 * GOST 7.79-2000 System B transliteration map for Russian Cyrillic.
 *
 * This is the official Russian standard for transliteration of Cyrillic
 * characters to Latin script, commonly used in international documentation,
 * passports, and library systems.
 *
 * Key characteristics of System B:
 * - Single characters map to 1-3 Latin characters
 * - Hard and soft signs (ъ, ь) are typically omitted
 * - Produces phonetically readable results for English speakers
 *
 * @see https://en.wikipedia.org/wiki/Romanization_of_Russian
 * @see GOST 7.79-2000 "Rules of transliteration of Cyrillic script"
 */
const CYRILLIC_TO_LATIN = new Map<string, string>([
  // -------------------------------------------------------------------------
  // Lowercase letters (а-я)
  // -------------------------------------------------------------------------
  ['а', 'a'], // A
  ['б', 'b'], // Be
  ['в', 'v'], // Ve
  ['г', 'g'], // Ge
  ['д', 'd'], // De
  ['е', 'e'], // Ye (beginning/after vowel) or E (after consonant)
  ['ё', 'yo'], // Yo - always stressed
  ['ж', 'zh'], // Zhe - voiced postalveolar fricative
  ['з', 'z'], // Ze
  ['и', 'i'], // I
  ['й', 'y'], // Short I / Y
  ['к', 'k'], // Ka
  ['л', 'l'], // El
  ['м', 'm'], // Em
  ['н', 'n'], // En
  ['о', 'o'], // O
  ['п', 'p'], // Pe
  ['р', 'r'], // Er
  ['с', 's'], // Es
  ['т', 't'], // Te
  ['у', 'u'], // U
  ['ф', 'f'], // Ef
  ['х', 'h'], // Ha (alternative: kh)
  ['ц', 'ts'], // Tse
  ['ч', 'ch'], // Che
  ['ш', 'sh'], // Sha
  ['щ', 'sch'], // Shcha (alternative: shch)
  ['ъ', ''], // Hard sign - omitted in transliteration
  ['ы', 'y'], // Y (hard I)
  ['ь', ''], // Soft sign - omitted in transliteration
  ['э', 'e'], // E (reverse E)
  ['ю', 'yu'], // Yu
  ['я', 'ya'], // Ya

  // -------------------------------------------------------------------------
  // Uppercase letters (А-Я) - map to lowercase output for key generation
  // -------------------------------------------------------------------------
  ['А', 'a'],
  ['Б', 'b'],
  ['В', 'v'],
  ['Г', 'g'],
  ['Д', 'd'],
  ['Е', 'e'],
  ['Ё', 'yo'],
  ['Ж', 'zh'],
  ['З', 'z'],
  ['И', 'i'],
  ['Й', 'y'],
  ['К', 'k'],
  ['Л', 'l'],
  ['М', 'm'],
  ['Н', 'n'],
  ['О', 'o'],
  ['П', 'p'],
  ['Р', 'r'],
  ['С', 's'],
  ['Т', 't'],
  ['У', 'u'],
  ['Ф', 'f'],
  ['Х', 'h'],
  ['Ц', 'ts'],
  ['Ч', 'ch'],
  ['Ш', 'sh'],
  ['Щ', 'sch'],
  ['Ъ', ''],
  ['Ы', 'y'],
  ['Ь', ''],
  ['Э', 'e'],
  ['Ю', 'yu'],
  ['Я', 'ya'],
]);

// ============================================================================
// RUSSIAN STOP WORDS
// ============================================================================

/**
 * Comprehensive Russian stop words set.
 *
 * These are common Russian words that should be filtered out during i18n
 * key generation as they add little semantic value:
 *
 * Categories included:
 * - Conjunctions (и, или, но, а)
 * - Prepositions (в, на, с, к, у, за, из, о, об, по, для, при)
 * - Particles (не, бы, же, ли, ведь)
 * - Pronouns (я, ты, он, она, оно, мы, вы, они, это, тот, весь)
 * - Relative pronouns (который, какой, чей, что, кто)
 * - Auxiliary verbs (быть, есть, был, была, было, были, будет)
 * - Modal words (можно, нельзя, надо, нужно, должен)
 * - Common adverbs (уже, ещё, очень, там, тут, вот)
 *
 * This list is optimized for i18n key generation in UI/UX contexts.
 */
const RUSSIAN_STOP_WORDS = new Set<string>([
  // -------------------------------------------------------------------------
  // Conjunctions - linking words
  // -------------------------------------------------------------------------
  'и', // and
  'а', // and/but (contrastive)
  'но', // but
  'или', // or
  'да', // and/yes (archaic conjunction)
  'либо', // or (alternative)
  'зато', // but instead
  'однако', // however
  'хотя', // although
  'чтобы', // in order to
  'если', // if
  'когда', // when
  'пока', // while/until
  'потому', // because (part of "потому что")
  'поэтому', // therefore

  // -------------------------------------------------------------------------
  // Prepositions - relationship words
  // -------------------------------------------------------------------------
  'в', // in/into
  'во', // in/into (variant before consonant clusters)
  'на', // on/at
  'с', // with/from
  'со', // with/from (variant)
  'к', // to/towards
  'ко', // to/towards (variant)
  'у', // at/by (possession, location)
  'за', // behind/for
  'из', // from/out of
  'о', // about
  'об', // about (variant)
  'обо', // about (variant before some pronouns)
  'по', // by/along/according to
  'для', // for
  'при', // at/during/in the presence of
  'до', // until/before
  'от', // from
  'без', // without
  'под', // under
  'над', // over/above
  'между', // between
  'через', // through/across
  'перед', // before/in front of
  'после', // after
  'около', // near/about
  'среди', // among
  'вместо', // instead of
  'кроме', // except
  'ради', // for the sake of
  'вокруг', // around
  'возле', // near

  // -------------------------------------------------------------------------
  // Particles - functional words
  // -------------------------------------------------------------------------
  'не', // not
  'ни', // neither/nor
  'бы', // would (conditional)
  'же', // emphasis particle
  'ли', // question particle
  'ведь', // after all
  'вот', // here is
  'только', // only
  'даже', // even
  'именно', // exactly
  'просто', // simply
  'всё', // all (neuter)
  'уж', // already (emphatic)
  'разве', // really?
  'неужели', // is it possible?
  'лишь', // only/just
  'хоть', // at least/even if
  'уже', // already
  'ещё', // still/yet
  'еще', // still/yet (alternative spelling)
  'так', // so/thus

  // -------------------------------------------------------------------------
  // Personal pronouns
  // -------------------------------------------------------------------------
  'я', // I
  'ты', // you (informal)
  'он', // he
  'она', // she
  'оно', // it
  'мы', // we
  'вы', // you (formal/plural)
  'они', // they

  // Personal pronoun case forms
  'меня', // me (genitive/accusative)
  'мне', // to me (dative)
  'мной', // by me (instrumental)
  'мною', // by me (instrumental, variant)
  'тебя', // you (genitive/accusative)
  'тебе', // to you (dative)
  'тобой', // by you (instrumental)
  'тобою', // by you (instrumental, variant)
  'его', // him/his (genitive/accusative)
  'ему', // to him (dative)
  'него', // him (genitive/accusative after preposition)
  'нему', // to him (dative after preposition)
  'ним', // by him (instrumental)
  'нём', // about him (prepositional)
  'ее', // her (genitive/accusative)
  'её', // her (genitive/accusative, with ё)
  'ей', // to her (dative)
  'нее', // her (genitive/accusative after preposition)
  'неё', // her (genitive/accusative after preposition, with ё)
  'ней', // about her (prepositional)
  'нас', // us (genitive/accusative)
  'нам', // to us (dative)
  'нами', // by us (instrumental)
  'вас', // you (genitive/accusative)
  'вам', // to you (dative)
  'вами', // by you (instrumental)
  'их', // them/their (genitive/accusative)
  'им', // to them (dative)
  'ими', // by them (instrumental)
  'них', // them (genitive/accusative after preposition)

  // Reflexive pronoun
  'себя', // oneself (genitive/accusative)
  'себе', // to oneself (dative)
  'собой', // by oneself (instrumental)
  'собою', // by oneself (instrumental, variant)

  // -------------------------------------------------------------------------
  // Demonstrative pronouns
  // -------------------------------------------------------------------------
  'это', // this (neuter/predicate)
  'этот', // this (masculine)
  'эта', // this (feminine)
  'эти', // these
  'этого', // of this (masculine/neuter genitive)
  'этой', // of this (feminine genitive)
  'этому', // to this (masculine/neuter dative)
  'этим', // by this (instrumental)
  'этих', // of these (genitive)
  'эту', // this (feminine accusative)

  'тот', // that (masculine)
  'та', // that (feminine)
  'то', // that (neuter)
  'те', // those
  'того', // of that (masculine/neuter genitive)
  'той', // of that (feminine genitive)
  'тому', // to that (dative)
  'тем', // by that (instrumental)
  'тех', // of those (genitive)
  'ту', // that (feminine accusative)

  // -------------------------------------------------------------------------
  // Relative/Interrogative pronouns
  // -------------------------------------------------------------------------
  'что', // what/that
  'чего', // of what (genitive)
  'чему', // to what (dative)
  'чем', // by what (instrumental)

  'кто', // who
  'кого', // of whom (genitive)
  'кому', // to whom (dative)
  'ком', // about whom (prepositional)
  'кем', // by whom (instrumental)

  'который', // which (masculine)
  'которая', // which (feminine)
  'которое', // which (neuter)
  'которые', // which (plural)
  'которого', // of which (masculine/neuter genitive)
  'которой', // of which (feminine genitive)
  'которому', // to which (dative)
  'которым', // by which (instrumental)
  'которых', // of which (genitive plural)

  'какой', // what kind of (masculine)
  'какая', // what kind of (feminine)
  'какое', // what kind of (neuter)
  'какие', // what kind of (plural)
  'как', // how

  // -------------------------------------------------------------------------
  // Possessive pronouns
  // -------------------------------------------------------------------------
  'свой', // one's own (masculine)
  'своя', // one's own (feminine)
  'свое', // one's own (neuter)
  'своё', // one's own (neuter, with ё)
  'свои', // one's own (plural)
  'своего', // of one's own (masculine/neuter genitive)
  'своей', // of one's own (feminine genitive)
  'своему', // to one's own (dative)
  'своим', // by one's own (instrumental)
  'своих', // of one's own (genitive plural)
  'свою', // one's own (feminine accusative)

  'мой', // my (masculine)
  'моя', // my (feminine)
  'мое', // my (neuter)
  'моё', // my (neuter, with ё)
  'мои', // my (plural)

  'твой', // your (informal, masculine)
  'твоя', // your (informal, feminine)
  'твое', // your (informal, neuter)
  'твоё', // your (informal, neuter, with ё)
  'твои', // your (informal, plural)

  'наш', // our (masculine)
  'наша', // our (feminine)
  'наше', // our (neuter)
  'наши', // our (plural)

  'ваш', // your (formal/plural, masculine)
  'ваша', // your (formal/plural, feminine)
  'ваше', // your (formal/plural, neuter)
  'ваши', // your (formal/plural, plural)

  // -------------------------------------------------------------------------
  // Indefinite/Quantifier pronouns
  // -------------------------------------------------------------------------
  'весь', // all (masculine)
  'вся', // all (feminine)
  'все', // all (neuter/plural)
  'всех', // of all (genitive)
  'всем', // to all (dative)
  'всего', // of all (neuter genitive) / in total
  'всей', // of all (feminine genitive)

  'сам', // oneself (masculine)
  'сама', // oneself (feminine)
  'само', // itself (neuter)
  'сами', // themselves

  'один', // one (masculine)
  'одна', // one (feminine)
  'одно', // one (neuter)
  'одни', // ones (plural)
  'одного', // of one (genitive)
  'одной', // of one (feminine genitive)
  'одному', // to one (dative)

  'другой', // other/another (masculine)
  'другая', // other/another (feminine)
  'другое', // other/another (neuter)
  'другие', // others

  'каждый', // each/every (masculine)
  'каждая', // each/every (feminine)
  'каждое', // each/every (neuter)

  'некоторый', // some (masculine)
  'некоторые', // some (plural)

  'любой', // any (masculine)
  'любая', // any (feminine)
  'любое', // any (neuter)
  'любые', // any (plural)

  // -------------------------------------------------------------------------
  // Auxiliary/Modal verbs (быть and modal constructions)
  // -------------------------------------------------------------------------
  'быть', // to be (infinitive)
  'есть', // is/are (present)
  'был', // was (masculine)
  'была', // was (feminine)
  'было', // was (neuter)
  'были', // were (plural)
  'будет', // will be
  'будут', // will be (plural)
  'буду', // will be (1st person)
  'будем', // will be (1st person plural)
  'будете', // will be (2nd person plural)
  'будешь', // will be (2nd person singular)

  'можно', // it is possible/allowed
  'нельзя', // it is impossible/forbidden
  'надо', // it is necessary
  'нужно', // it is needed
  'нужен', // is needed (masculine)
  'нужна', // is needed (feminine)
  'нужны', // are needed (plural)
  'должен', // must (masculine)
  'должна', // must (feminine)
  'должно', // must (neuter)
  'должны', // must (plural)

  // -------------------------------------------------------------------------
  // Common adverbs and discourse markers
  // -------------------------------------------------------------------------
  'очень', // very
  'там', // there
  'тут', // here
  'здесь', // here
  'где', // where
  'куда', // where to
  'откуда', // where from
  'почему', // why
  'зачем', // what for
  'сейчас', // now
  'теперь', // now
  'тогда', // then
  'всегда', // always
  'никогда', // never
  'иногда', // sometimes
  'часто', // often
  'редко', // rarely
  'потом', // then/later
  'опять', // again
  'снова', // again
  'вместе', // together
  'отдельно', // separately
  'сюда', // here (direction)
  'туда', // there (direction)
]);

// ============================================================================
// RUSSIAN LANGUAGE PLUGIN CLASS
// ============================================================================

/**
 * Russian language plugin with comprehensive Cyrillic support.
 *
 * Provides:
 * - Detection of Cyrillic characters (U+0400 to U+04FF)
 * - GOST 7.79-2000 System B compliant transliteration
 * - Extensive stop word filtering (~200 words)
 *
 * The Unicode range covers:
 * - Basic Cyrillic (U+0400-U+04FF) - Russian, Ukrainian, Serbian, etc.
 *
 * @example
 * ```typescript
 * const plugin = new RussianLanguagePlugin();
 *
 * // Detect Russian text
 * const detection = plugin.detect('Привет мир');
 * console.log(detection.confidence); // 1.0
 *
 * // Transliterate to Latin
 * const translit = plugin.transliterate('Москва');
 * console.log(translit.text); // 'moskva'
 *
 * // Filter stop words
 * const words = plugin.filterStopWords(['это', 'пример', 'кода']);
 * console.log(words.words); // ['пример', 'кода']
 * ```
 */
export class RussianLanguagePlugin extends BaseLanguagePlugin {
  /** ISO 639-1 language code for Russian */
  readonly code = 'ru';

  /** Human-readable language name */
  readonly name = 'Russian';

  /**
   * Unicode code point range for Cyrillic script.
   *
   * U+0400 to U+04FF covers:
   * - Cyrillic capital letters (U+0400-U+042F)
   * - Cyrillic small letters (U+0430-U+044F)
   * - Extended Cyrillic characters for other Slavic languages
   * - Historical and phonetic characters
   */
  readonly unicodeRanges: ReadonlyArray<readonly [number, number]> = [
    [0x0400, 0x04ff], // Cyrillic
  ];

  /** GOST 7.79-2000 transliteration map */
  protected readonly translitMap = CYRILLIC_TO_LATIN;

  /** Comprehensive Russian stop words set */
  protected readonly stopWords = RUSSIAN_STOP_WORDS;
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Pre-instantiated Russian plugin for convenience.
 *
 * Use this singleton instance instead of creating new instances
 * to save memory and ensure consistent behavior.
 *
 * @example
 * ```typescript
 * import { russianPlugin } from './russian';
 *
 * const result = russianPlugin.detect('Привет');
 * if (result.confidence > 0.5) {
 *   console.log('Text is primarily Russian');
 * }
 * ```
 */
export const russianPlugin = new RussianLanguagePlugin();

/**
 * Checks if text contains significant Russian (Cyrillic) content.
 *
 * Returns true if the text has:
 * - At least 2 matched Cyrillic characters
 * - Confidence score above 0.3 (30% of analyzable characters)
 *
 * @param text - Text to check for Russian content
 * @returns True if the text contains significant Russian content
 *
 * @example
 * ```typescript
 * hasRussianText('Привет мир');     // => true
 * hasRussianText('Hello world');    // => false
 * hasRussianText('Hello Привет');   // => true (mixed)
 * hasRussianText('да');             // => true (short)
 * hasRussianText('a');              // => false (Latin)
 * ```
 */
export function hasRussianText(text: string): boolean {
  const result = russianPlugin.detect(text);
  return result.confidence > 0.3 && result.matchedChars >= 2;
}

/**
 * Transliterates Russian Cyrillic text to Latin characters.
 *
 * Uses GOST 7.79-2000 System B standard for transliteration.
 * Non-Cyrillic characters are preserved as-is.
 *
 * @param text - Russian text to transliterate
 * @returns Transliterated text in Latin characters
 *
 * @example
 * ```typescript
 * transliterateRussian('Привет мир');      // => 'privet mir'
 * transliterateRussian('Москва');          // => 'moskva'
 * transliterateRussian('Hello мир');       // => 'Hello mir'
 * transliterateRussian('Ёжик в тумане');   // => 'yozhik v tumane'
 * transliterateRussian('Щедрый');          // => 'schedryy'
 * ```
 */
export function transliterateRussian(text: string): string {
  return russianPlugin.transliterate(text).text;
}

/**
 * Filters Russian stop words from a list of words.
 *
 * @param words - Array of words to filter
 * @returns Array of words with stop words removed
 *
 * @example
 * ```typescript
 * filterRussianStopWords(['это', 'быстрый', 'код']);
 * // => ['быстрый', 'код']
 *
 * filterRussianStopWords(['я', 'люблю', 'программирование']);
 * // => ['люблю', 'программирование']
 * ```
 */
export function filterRussianStopWords(words: string[]): string[] {
  return russianPlugin.filterStopWords(words).words;
}

/**
 * Checks if a word is a Russian stop word.
 *
 * @param word - Word to check
 * @returns True if the word is a Russian stop word
 *
 * @example
 * ```typescript
 * isRussianStopWord('и');     // => true
 * isRussianStopWord('код');   // => false
 * isRussianStopWord('ЭТО');   // => true (case-insensitive)
 * ```
 */
export function isRussianStopWord(word: string): boolean {
  return russianPlugin.getStopWords().has(word.toLowerCase());
}
