/**
 * @module commands/refactor/analyzers/core/duplicates/linguistic
 * @description Linguistic analysis utilities for name detection
 */

import { extractVerbPrefix } from '../../../../../lib/@patterns';

/**
 * Split name into semantic segments (camelCase/snake_case)
 */
export function splitIntoSegments(name: string): string[] {
  // Handle snake_case
  if (name.includes('_')) {
    return name.split('_').filter((s) => s.length > 0);
  }
  // Handle camelCase/PascalCase
  return name.split(/(?=[A-Z])/).filter((s) => s.length > 0);
}

/**
 * Calculate vowel ratio in a string
 * Real words have ~40% vowels, abbreviations have fewer
 */
export function getVowelRatio(str: string): number {
  const vowels = str.match(/[aeiou]/gi);
  return vowels ? vowels.length / str.length : 0;
}

/**
 * Check if name is an abbreviation (all consonants or very low vowel ratio)
 */
export function isAbbreviation(name: string): boolean {
  if (name.length > 5) return false;
  const vowelRatio = getVowelRatio(name);
  // Abbreviations typically have very few vowels: cfg, msg, cb, fn, ctx
  return vowelRatio < 0.2;
}

/**
 * Estimate syllable count using vowel cluster heuristic
 * Each vowel group typically represents one syllable
 */
export function estimateSyllables(word: string): number {
  const lowerWord = word.toLowerCase();
  // Count vowel clusters (consecutive vowels count as one)
  const vowelClusters = lowerWord.match(/[aeiouy]+/g);
  if (!vowelClusters) return 1;

  let count = vowelClusters.length;

  // Adjust for silent 'e' at end
  if (lowerWord.endsWith('e') && count > 1) {
    count--;
  }

  // Adjust for common suffixes that don't add syllables
  if (/le$/.test(lowerWord) && count > 1) {
    // 'le' ending usually doesn't add a syllable if preceded by consonant
    const beforeLe = lowerWord.slice(-3, -2);
    if (!/[aeiouy]/.test(beforeLe)) {
      count++;
    }
  }

  return Math.max(1, count);
}

/**
 * Check if a word ends with common noun suffixes
 * These patterns indicate the word is likely a noun/object
 */
export function hasNounSuffix(word: string): boolean {
  const lowerWord = word.toLowerCase();

  // Common noun-forming suffixes in programming
  const nounPatterns = [
    /er$/, // handler, listener, helper, manager
    /or$/, // iterator, selector, constructor
    /tion$/, // function, action, collection
    /sion$/, // session, version
    /ment$/, // element, argument
    /ness$/, // readiness
    /ity$/, // utility, entity
    /ure$/, // structure, closure
    /ance$/, // instance
    /ence$/, // reference, sequence
    /ing$/, // string, thing (as nouns)
    /ist$/, // list (and -ist words)
    /ata$/, // data, metadata
    /xt$/, // context, text
    /que$/, // queue
    /ay$/, // array, display
    /ch$/, // cache, batch
    /ck$/, // callback, stack
    /se$/, // response, case
    /te$/, // state, template
    /de$/, // node, code
    /ue$/, // value, queue
    /pe$/, // type, pipe
    /me$/, // name, frame
    /ms$/, // params, items
    /gs$/, // args, flags
    /ps$/, // props
    /ns$/, // options, actions
    /ts$/, // results, events
    /rd$/, // record
    /ry$/, // factory, entry
    /ol$/, // control, protocol
    /et$/, // object, set
    /ap$/, // map
    /lt$/, // result
    /ig$/, // config
    /fo$/, // info
  ];

  return nounPatterns.some((pattern) => pattern.test(lowerWord));
}

/**
 * Check if a word starts with a verb prefix
 * Words starting with action verbs are usually meaningful when combined
 *
 * Uses the shared linguistic verb detection from @patterns/verb-detection
 */
export function hasVerbPrefix(word: string): boolean {
  // Use the shared verb detection module for consistent behavior
  return extractVerbPrefix(word) !== null;
}
