/**
 * @module commands/refactor/analyzers/core/duplicates/patterns
 * @description Pattern detection for placeholder and suffix-only names
 */

import {
  estimateSyllables,
  getVowelRatio,
  hasNounSuffix,
  hasVerbPrefix,
  splitIntoSegments,
} from './linguistic';

/**
 * Dynamically detect if a name is a suffix-only (lacks subject/context)
 * Uses linguistic analysis instead of hardcoded word lists
 *
 * Examples:
 * - "handler" -> true (suffix-only, no subject)
 * - "clickHandler" -> false (has subject "click")
 * - "data" -> true (generic noun)
 * - "userData" -> false (has subject "user")
 */
export function isSuffixOnlyName(name: string): boolean {
  const lowerName = name.toLowerCase();

  // 1. Must be a single word (no compound segments)
  const segments = splitIntoSegments(name);
  if (segments.length > 1) {
    return false; // Compound names are meaningful
  }

  // 2. Very short words (<=3 chars) are handled elsewhere
  if (name.length <= 3) {
    return false;
  }

  // 3. Very long single words (>12 chars) are likely domain-specific
  if (name.length > 12) {
    return false;
  }

  // 4. Must look like a real word (reasonable vowel ratio)
  const vowelRatio = getVowelRatio(lowerName);
  if (vowelRatio < 0.2 || vowelRatio > 0.7) {
    return false; // Likely abbreviation or not a real word
  }

  // 5. Check for noun-like suffix patterns
  if (!hasNounSuffix(lowerName)) {
    return false; // Doesn't look like a noun suffix
  }

  // 6. Must NOT start with a verb prefix
  if (hasVerbPrefix(lowerName)) {
    return false;
  }

  // 7. Check syllable count - suffix-only words are typically 1-3 syllables
  const syllables = estimateSyllables(lowerName);
  if (syllables > 3) {
    return false; // Likely a domain-specific term
  }

  // 8. Common programming suffix patterns (structurally recognizable as generic)
  const genericNounPatterns = [
    /^(func|function)$/i,
    /^(handler|callback|listener)$/i,
    /^(params|props|args|options|config)$/i,
    /^(data|info|meta)$/i,
    /^(item|value|result|entry)$/i,
    /^(response|request)$/i,
    /^(context|state|store|cache)$/i,
    /^(type|node|element)$/i,
    /^(list|array|object|map|set|queue)$/i,
  ];

  for (const pattern of genericNounPatterns) {
    if (pattern.test(lowerName)) {
      return true;
    }
  }

  // 9. Heuristic: single nouns with common suffixes and no qualifier
  if (/^[a-z]+(er|or|ry|nt|ng)$/i.test(lowerName) && name.length <= 10) {
    return true;
  }

  return false;
}

/**
 * Detect common variable names that are used everywhere for intermediate results
 *
 * These are NOT real duplicates - they are common naming conventions for:
 * - Collection results (files, items, parts, entries)
 * - Filtered/sorted results (sorted, filtered, matched)
 * - Iteration variables (line, lines, path, paths)
 *
 * @example
 * const files = await findFiles(...);     // Common result name
 * const sorted = [...items].sort(...);    // Common transformation name
 * const parts = path.split('/');          // Common decomposition name
 */
export function isCommonVariableName(name: string): boolean {
  const lowerName = name.toLowerCase();

  // 1. Common collection/result variable names (plurals)
  const commonCollectionNames = [
    // File system
    /^(files|dirs|directories|folders|paths|sources)$/i,
    // Array operations
    /^(items|entries|elements|records|rows|lines|parts|chunks|segments|tokens)$/i,
    // Results
    /^(results|matches|hits|findings|issues|errors|warnings)$/i,
    // Data
    /^(keys|values|pairs|fields|props|attrs|args|params)$/i,
    // Strings
    /^(words|chars|names|labels|tags|ids)$/i,
  ];

  for (const pattern of commonCollectionNames) {
    if (pattern.test(lowerName)) {
      return true;
    }
  }

  // 2. Common transformation result names (past participles as variable names)
  const transformationPatterns = [
    /^(sorted|filtered|mapped|reduced|grouped|merged|joined|split|parsed|formatted)$/i,
    /^(processed|transformed|converted|normalized|validated|sanitized|cleaned)$/i,
    /^(matched|found|selected|picked|extracted|collected|gathered)$/i,
    /^(updated|modified|changed|fixed|patched|adjusted)$/i,
  ];

  for (const pattern of transformationPatterns) {
    if (pattern.test(lowerName)) {
      return true;
    }
  }

  // 3. Common iteration variable names
  const iterationPatterns = [
    /^(line|path|file|dir|item|entry|key|value|name|index|offset)$/i,
    /^(current|next|prev|first|last|head|tail)$/i,
    /^(left|right|start|end|begin|stop)$/i,
  ];

  for (const pattern of iterationPatterns) {
    if (pattern.test(lowerName)) {
      return true;
    }
  }

  // 4. Common temporary/intermediate result names
  const tempPatterns = [
    /^(temp|tmp|buf|buffer|acc|accumulator|memo|cache)$/i,
    /^(output|input|source|target|dest|destination)$/i,
    /^(raw|clean|final|base|root|parent|child)$/i,
  ];

  for (const pattern of tempPatterns) {
    if (pattern.test(lowerName)) {
      return true;
    }
  }

  return false;
}

/**
 * Dynamically detect placeholder/test names
 * Uses linguistic patterns to identify metasyntactic variables
 */
export function isPlaceholderName(name: string): boolean {
  const lowerName = name.toLowerCase();

  // 1. Well-known metasyntactic variables
  if (/^(foo|bar|baz|qux|quux|corge|grault|garply|waldo|fred|plugh|xyzzy|thud)$/i.test(lowerName)) {
    return true;
  }

  // 2. Very short words with unusual letter combinations (CVC with rare consonants)
  if (name.length === 3) {
    if (/^[bcdfghjklmnpqrstvwxz][aeiou][bcdfghjklmnpqrstvwxz]$/i.test(lowerName)) {
      if (/[qxz]/.test(lowerName)) {
        return true;
      }
    }
  }

  // 3. Test/temporary naming patterns
  if (/^(test|demo|example|sample|temp|tmp|mock|stub|fake|dummy)\d*$/i.test(lowerName)) {
    return true;
  }

  // 4. Placeholder with numbers (x1, foo2, test123)
  if (/^[a-z]{1,4}\d+$/i.test(lowerName)) {
    return true;
  }

  // 5. All same letter repeated (aaa, xxx)
  if (/^(.)\1+$/.test(lowerName)) {
    return true;
  }

  // 6. Short words with multiple unusual letters
  if (name.length <= 4) {
    const unusualCount = (lowerName.match(/[qxzj]/g) || []).length;
    if (unusualCount >= 1 && name.length <= 3) {
      return true;
    }
  }

  return false;
}

/**
 * Detect Next.js API route handlers and page component patterns
 * These repeat by convention and are NOT real duplicates
 */
export function isNextJsConventionPattern(name: string, filePath?: string): boolean {
  // 1. Next.js API route handlers (must be named POST, GET, etc.)
  if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(name)) {
    return true;
  }

  // 2. Next.js page components - *Page in page.tsx files
  if (filePath && /\/page\.tsx?$/.test(filePath)) {
    if (/Page$/.test(name)) {
      return true;
    }
  }

  // 3. Next.js layout/loading/error components
  if (/^(Layout|Loading|Error|NotFound|Template)$/.test(name)) {
    return true;
  }

  // 4. generateMetadata, generateStaticParams - Next.js conventions
  if (/^generate(Metadata|StaticParams|Viewport)$/.test(name)) {
    return true;
  }

  return false;
}

/**
 * Detect common callback/handler patterns that are expected to repeat
 * across different components (e.g., handleSubmit, onChange, onLoadingChange)
 *
 * These are NOT real duplicates - they are naming conventions for event handlers
 */
export function isCommonCallbackPattern(name: string): boolean {
  // 1. handle* patterns (handleSubmit, handleChange, handleClick, etc.)
  if (/^handle[A-Z][a-zA-Z]*$/.test(name)) {
    return true;
  }

  // 2. on*Change patterns (onLoadingChange, onValueChange, etc.)
  if (/^on[A-Z][a-zA-Z]*Change$/.test(name)) {
    return true;
  }

  // 3. on*Click patterns (onClick, onButtonClick, etc.)
  if (/^on[A-Z]?[a-zA-Z]*Click$/.test(name)) {
    return true;
  }

  // 4. on*Submit patterns
  if (/^on[A-Z]?[a-zA-Z]*Submit$/.test(name)) {
    return true;
  }

  // 5. Common React lifecycle/effect patterns
  if (/^use[A-Z][a-zA-Z]*Effect$/.test(name)) {
    return true;
  }

  // 6. Common form field handlers
  if (/^(onChange|onBlur|onFocus|onInput|onKeyDown|onKeyUp|onKeyPress)$/.test(name)) {
    return true;
  }

  // 7. Common event handlers that repeat everywhere
  if (
    /^(onClose|onOpen|onToggle|onSelect|onClear|onReset|onCancel|onConfirm|onSave|onDelete|onEdit|onAdd|onRemove)$/.test(
      name,
    )
  ) {
    return true;
  }

  // 8. Common UI action patterns (open/close/toggle dialogs, modals, etc.)
  if (
    /^(open|close|toggle|show|hide)(Dialog|Modal|Drawer|Sheet|Popover|Menu|Dropdown)$/.test(name)
  ) {
    return true;
  }

  return false;
}

/**
 * Dynamically detect short verb prefixes that need a subject
 */
export function isShortVerbPrefix(name: string): boolean {
  const lowerName = name.toLowerCase();

  // 1. Must be short (2-4 chars for standalone verbs)
  if (name.length > 4) {
    return false;
  }

  // 2. Check for verb-like structure
  const vowelRatio = getVowelRatio(lowerName);
  if (vowelRatio < 0.15 || vowelRatio > 0.6) {
    return false;
  }

  // 3. Common short verb patterns in programming
  const shortVerbPatterns = [
    /^(get|set|put|pop|add|run|do)$/i,
    /^(is|on|to|go|be)$/i,
    /^(has|can|use|try|let|new)$/i,
    /^(push|pull|call|send|read|load|save|emit|init|exec|make|find|show|hide|move|copy|sort|test|trim|join|bind|wrap|lock|tick|ping|fire)$/i,
  ];

  for (const pattern of shortVerbPatterns) {
    if (pattern.test(lowerName)) {
      return true;
    }
  }

  // 4. Heuristic: very short words ending in common verb endings
  if (name.length <= 3 && /^[a-z]+(t|d|k|p|n|s)$/i.test(lowerName)) {
    return true;
  }

  return false;
}
