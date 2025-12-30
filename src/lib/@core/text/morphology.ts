/**
 * @module lib/@core/text/morphology
 * @description English morphology analysis for code naming
 *
 * Provides linguistic analysis for detecting:
 * - Plural nouns (files, items, results)
 * - Past participles (sorted, filtered, matched)
 * - Syllable estimation
 * - Vowel ratio analysis
 * - Abbreviation detection
 *
 * Used by:
 * - @detectors for verb detection
 * - refactor/duplicates for name detection
 * - @i18n for text analysis
 *
 * @example
 * ```typescript
 * import { isPluralNoun, isPastParticiple, getVowelRatio } from '@/lib/@core/text';
 *
 * isPluralNoun('files');      // true
 * isPastParticiple('sorted'); // true
 * getVowelRatio('hello');     // 0.4
 * ```
 */

// ============================================================================
// VOWEL ANALYSIS
// ============================================================================

/**
 * Calculate vowel ratio in a string
 * Real words have ~40% vowels, abbreviations have fewer
 *
 * @example
 * getVowelRatio('hello') // 0.4
 * getVowelRatio('cfg')   // 0 (abbreviation)
 */
export function getVowelRatio(str: string): number {
  const vowels = str.match(/[aeiou]/gi);
  return vowels ? vowels.length / str.length : 0;
}

/**
 * Check if name is an abbreviation (all consonants or very low vowel ratio)
 *
 * @example
 * isAbbreviation('cfg') // true
 * isAbbreviation('msg') // true
 * isAbbreviation('hello') // false
 */
export function isAbbreviation(name: string): boolean {
  if (name.length > 5) return false;
  const vowelRatio = getVowelRatio(name);
  // Abbreviations typically have very few vowels: cfg, msg, cb, fn, ctx
  return vowelRatio < 0.2;
}

// ============================================================================
// SYLLABLE ANALYSIS
// ============================================================================

/**
 * Estimate syllable count using vowel cluster heuristic
 * Each vowel group typically represents one syllable
 *
 * @example
 * estimateSyllables('hello')    // 2
 * estimateSyllables('beautiful') // 4
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

// ============================================================================
// PLURAL NOUN DETECTION
// ============================================================================

/**
 * Check if a word is likely a plural noun (ends with 's' or 'es')
 *
 * Filters out:
 * - Words too short to be meaningful plurals
 * - Words ending in 'ss' (class, pass, etc.)
 * - Words ending in common non-plural suffixes (-ness, -less, -ous)
 * - Common verbs in 3rd person singular (gets, sets, has)
 *
 * @example
 * isPluralNoun('files')   // true
 * isPluralNoun('items')   // true
 * isPluralNoun('class')   // false (ends in 'ss')
 * isPluralNoun('process') // false (verb/noun, not plural)
 */
export function isPluralNoun(word: string): boolean {
  const lowerWord = word.toLowerCase();

  // Must be at least 4 chars (3 char root + 's')
  if (lowerWord.length < 4) return false;

  // Must end with 's'
  if (!lowerWord.endsWith('s')) return false;

  // Filter out words ending in 'ss' (class, pass, less, ness)
  if (lowerWord.endsWith('ss')) return false;

  // Filter out words ending in common non-plural suffixes
  const nonPluralSuffixes = [
    /ness$/, // readiness, darkness
    /less$/, // nameless, useless
    /ous$/, // dangerous, famous
    /ious$/, // previous, various
    /eous$/, // gorgeous
    /us$/, // status, focus (Latin singular)
    /is$/, // analysis, basis (Greek singular)
    /as$/, // alias, canvas
  ];

  for (const suffix of nonPluralSuffixes) {
    if (suffix.test(lowerWord)) return false;
  }

  // Filter out common verbs that end in 's' (3rd person singular)
  const commonVerbs = [
    /^(gets|sets|has|does|goes|runs|says|uses|makes|takes|gives|finds|keeps|calls|shows|moves)$/,
    /^(reads|loads|saves|sends|starts|stops|checks|works|helps|needs|wants|looks|seems|comes)$/,
  ];

  for (const verbPattern of commonVerbs) {
    if (verbPattern.test(lowerWord)) return false;
  }

  // Likely a plural noun
  return true;
}

// ============================================================================
// PAST PARTICIPLE DETECTION
// ============================================================================

/**
 * Check if a word is likely a past participle used as a variable name
 *
 * Past participles often used for transformation results:
 * - sorted, filtered, mapped, reduced
 * - processed, validated, normalized
 * - found, matched, selected
 *
 * @example
 * isPastParticiple('sorted')    // true
 * isPastParticiple('filtered')  // true
 * isPastParticiple('matched')   // true
 * isPastParticiple('selected')  // true
 * isPastParticiple('red')       // false
 */
export function isPastParticiple(word: string): boolean {
  const lowerWord = word.toLowerCase();

  // Must be at least 5 chars (3 char root + 'ed')
  if (lowerWord.length < 5) return false;

  // Check for regular past participle (-ed ending)
  if (lowerWord.endsWith('ed')) {
    // Filter out adjectives that naturally end in -ed
    const notParticiples = [
      /^(red|bed|led|wed|fed|shed)$/, // Short words
      /^(need|seed|deed|weed|breed|greed|speed)$/, // -eed words
      /^(sacred|wicked|naked|rugged|ragged)$/, // Adjectives
    ];

    for (const pattern of notParticiples) {
      if (pattern.test(lowerWord)) return false;
    }

    // Common transformation verbs that become variable names
    const transformationRoots = [
      /^(sort|filter|map|reduc|group|merg|join|split|pars|format)ed$/,
      /^(process|transform|convert|normal|valid|sanit|clean)ed$/,
      /^(match|found|select|pick|extract|collect|gather)ed$/,
      /^(updat|modif|chang|fix|patch|adjust)ed$/,
      /^(load|sav|fetch|retriev|cach)ed$/,
      /^(encod|decod|compress|encrypt|decrypt)ed$/,
    ];

    for (const pattern of transformationRoots) {
      if (pattern.test(lowerWord)) return true;
    }

    // Heuristic: if it's a reasonable length and ends in 'ed', likely a participle
    // Check that the root (without 'ed') looks like a verb
    const root = lowerWord.slice(0, -2);
    if (root.length >= 3 && root.length <= 10) {
      const vowelRatio = getVowelRatio(root);
      // Real verbs have reasonable vowel ratios
      if (vowelRatio >= 0.2 && vowelRatio <= 0.6) {
        return true;
      }
    }
  }

  // Check for irregular past participles commonly used as variable names
  const irregularParticiples = [
    /^(found|built|sent|made|taken|given|shown|known|seen|done|gone|run|set|put|cut|read|written|chosen|frozen|broken|spoken|hidden|driven|fallen|forgotten|gotten|risen|shaken|stolen|worn|torn|drawn|grown|thrown|blown|flown|sworn|borne)$/,
  ];

  for (const pattern of irregularParticiples) {
    if (pattern.test(lowerWord)) return true;
  }

  return false;
}

// ============================================================================
// NOUN SUFFIX DETECTION
// ============================================================================

/**
 * Check if a word ends with common noun suffixes
 * These patterns indicate the word is likely a noun/object
 *
 * @example
 * hasNounSuffix('handler')  // true (-er)
 * hasNounSuffix('iterator') // true (-or)
 * hasNounSuffix('function') // true (-tion)
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

// ============================================================================
// SEGMENT SPLITTING
// ============================================================================

/**
 * Split name into semantic segments (camelCase/snake_case)
 *
 * @example
 * splitIntoSegments('getUserName') // ['get', 'User', 'Name']
 * splitIntoSegments('user_name')   // ['user', 'name']
 */
export function splitIntoSegments(name: string): string[] {
  // Handle snake_case
  if (name.includes('_')) {
    return name.split('_').filter((s) => s.length > 0);
  }
  // Handle camelCase/PascalCase
  return name.split(/(?=[A-Z])/).filter((s) => s.length > 0);
}
