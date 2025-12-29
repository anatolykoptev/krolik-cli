/**
 * @module commands/refactor/analyzers/i18n/recommendations
 * @description I18n recommendation generator for hardcoded string extraction
 *
 * This module provides comprehensive functionality for generating actionable
 * recommendations to extract hardcoded strings into i18n translation files.
 * It analyzes detected strings, generates appropriate i18n keys, calculates
 * effort levels, and produces code transformation suggestions.
 *
 * @example
 * ```typescript
 * import {
 *   generateI18nRecommendations,
 *   generateCodeFix,
 *   calculateEffort,
 *   groupByComponent,
 * } from './recommendations';
 *
 * // Generate recommendations from analysis
 * const recommendations = generateI18nRecommendations(analysisResult, existingKeys);
 *
 * // Get code fix for a specific detection
 * const fix = generateCodeFix(detection, suggestedKey);
 * console.log(`Replace: ${fix.original}`);
 * console.log(`With: ${fix.replacement}`);
 *
 * // Calculate effort for a detection
 * const effort = calculateEffort(detection);
 * console.log(`Effort level: ${effort}`);
 *
 * // Group strings by component for batch processing
 * const groups = groupByComponent(detections);
 * ```
 *
 * @see {@link generateI18nRecommendations} - Main recommendation generator
 * @see {@link generateCodeFix} - Code transformation generator
 * @see {@link calculateEffort} - Effort level calculator
 * @see {@link groupByComponent} - Component-based grouping utility
 */

import { transliterate } from '@/lib/@i18n';
import type {
  CodeFix,
  ComponentI18nGroup,
  HardcodedStringInfo,
  I18nAnalysisResult,
  I18nEffort,
  I18nRecommendation,
  StringContext,
  SuggestedI18nKey,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default import statement to add when using the t() function
 */
const DEFAULT_T_IMPORT = "import { t } from '@piternow/shared';";

/**
 * Priority weights for different string contexts
 * Lower values indicate higher priority
 */
const CONTEXT_PRIORITY_WEIGHTS: Record<StringContext, number> = {
  'jsx-text': 1,
  'jsx-attribute': 2,
  'template-literal': 3,
  'string-literal': 4,
  conditional: 5,
  'object-property': 6,
  'array-element': 7,
};

/**
 * Effort thresholds for different scenarios
 */
const EFFORT_THRESHOLDS = {
  /** Maximum interpolations for trivial effort */
  TRIVIAL_MAX_INTERPOLATIONS: 0,
  /** Maximum interpolations for low effort */
  LOW_MAX_INTERPOLATIONS: 1,
  /** Maximum interpolations for medium effort */
  MEDIUM_MAX_INTERPOLATIONS: 3,
} as const;

// ============================================================================
// CODE FIX GENERATION
// ============================================================================

/**
 * Generates a code transformation to replace a hardcoded string with i18n call.
 *
 * Handles different contexts:
 * - JSX text: `<h1>Текст</h1>` -> `<h1>{t('key')}</h1>`
 * - JSX attributes: `placeholder="Текст"` -> `placeholder={t('key')}`
 * - Template literals: `` `Привет ${name}` `` -> `t('key', { name })`
 * - String literals: `"Текст"` -> `t('key')`
 *
 * @param detection - The detected hardcoded string information
 * @param suggestedKey - The suggested i18n key for this string
 * @returns CodeFix object with original, replacement, and required imports
 *
 * @example
 * ```typescript
 * const detection: HardcodedStringInfo = {
 *   value: 'Введите имя',
 *   context: 'jsx-attribute',
 *   attributeName: 'placeholder',
 *   // ... other fields
 * };
 *
 * const key: SuggestedI18nKey = {
 *   key: 'common.form.enterName',
 *   namespace: 'common',
 *   name: 'enterName',
 *   source: 'attribute',
 *   confidence: 0.9,
 * };
 *
 * const fix = generateCodeFix(detection, key);
 * // fix.original = 'placeholder="Введите имя"'
 * // fix.replacement = 'placeholder={t(\'common.form.enterName\')}'
 * // fix.imports = ["import { t } from '@piternow/shared';"]
 * ```
 */
export function generateCodeFix(
  detection: HardcodedStringInfo,
  suggestedKey: SuggestedI18nKey,
): CodeFix {
  const keyPath = suggestedKey.key;
  const imports = [DEFAULT_T_IMPORT];

  switch (detection.context) {
    case 'jsx-text':
      return generateJsxTextFix(detection, keyPath, imports);

    case 'jsx-attribute':
      return generateJsxAttributeFix(detection, keyPath, imports);

    case 'template-literal':
      return generateTemplateLiteralFix(detection, keyPath, imports);

    case 'string-literal':
      return generateStringLiteralFix(detection, keyPath, imports);

    case 'conditional':
      return generateConditionalFix(detection, keyPath, imports);

    case 'object-property':
      return generateObjectPropertyFix(detection, keyPath, imports);

    case 'array-element':
      return generateArrayElementFix(detection, keyPath, imports);

    default:
      // Fallback for unknown contexts
      return {
        original: detection.snippet || `"${detection.value}"`,
        replacement: `t('${keyPath}')`,
        imports,
      };
  }
}

/**
 * Generate fix for JSX text content
 * `<h1>Текст</h1>` -> `<h1>{t('key')}</h1>`
 */
function generateJsxTextFix(
  detection: HardcodedStringInfo,
  keyPath: string,
  imports: string[],
): CodeFix {
  const original = detection.snippet || detection.value;

  // Handle interpolations in JSX text (rare but possible with expressions)
  if (detection.interpolations && detection.interpolations.length > 0) {
    const params = formatInterpolationParams(detection.interpolations);
    return {
      original,
      replacement: `{t('${keyPath}', ${params})}`,
      imports,
    };
  }

  return {
    original,
    replacement: `{t('${keyPath}')}`,
    imports,
  };
}

/**
 * Generate fix for JSX attributes
 * `placeholder="Текст"` -> `placeholder={t('key')}`
 */
function generateJsxAttributeFix(
  detection: HardcodedStringInfo,
  keyPath: string,
  imports: string[],
): CodeFix {
  const attrName = detection.attributeName || 'value';
  const original = detection.snippet || `${attrName}="${detection.value}"`;

  // Handle interpolations in attribute values
  if (detection.interpolations && detection.interpolations.length > 0) {
    const params = formatInterpolationParams(detection.interpolations);
    return {
      original,
      replacement: `${attrName}={t('${keyPath}', ${params})}`,
      imports,
    };
  }

  return {
    original,
    replacement: `${attrName}={t('${keyPath}')}`,
    imports,
  };
}

/**
 * Generate fix for template literals with interpolations
 * `` `Привет, ${name}!` `` -> `t('key', { name })`
 */
function generateTemplateLiteralFix(
  detection: HardcodedStringInfo,
  keyPath: string,
  imports: string[],
): CodeFix {
  const original = detection.snippet || `\`${detection.value}\``;

  if (detection.interpolations && detection.interpolations.length > 0) {
    const params = formatInterpolationParams(detection.interpolations);
    return {
      original,
      replacement: `t('${keyPath}', ${params})`,
      imports,
    };
  }

  // Template literal without interpolations - convert to simple call
  return {
    original,
    replacement: `t('${keyPath}')`,
    imports,
  };
}

/**
 * Generate fix for string literals
 * `const msg = "Сообщение"` -> `const msg = t('key')`
 */
function generateStringLiteralFix(
  detection: HardcodedStringInfo,
  keyPath: string,
  imports: string[],
): CodeFix {
  const quote = detection.snippet?.includes("'") ? "'" : '"';
  const original = detection.snippet || `${quote}${detection.value}${quote}`;

  return {
    original,
    replacement: `t('${keyPath}')`,
    imports,
  };
}

/**
 * Generate fix for conditional expressions
 * `condition ? "Да" : "Нет"` -> `condition ? t('key.yes') : t('key.no')`
 */
function generateConditionalFix(
  detection: HardcodedStringInfo,
  keyPath: string,
  imports: string[],
): CodeFix {
  const original = detection.snippet || `"${detection.value}"`;

  return {
    original,
    replacement: `t('${keyPath}')`,
    imports,
  };
}

/**
 * Generate fix for object properties
 * `{ label: "Кнопка" }` -> `{ label: t('key') }`
 */
function generateObjectPropertyFix(
  detection: HardcodedStringInfo,
  keyPath: string,
  imports: string[],
): CodeFix {
  const original = detection.snippet || `"${detection.value}"`;

  return {
    original,
    replacement: `t('${keyPath}')`,
    imports,
  };
}

/**
 * Generate fix for array elements
 * `["Опция 1", "Опция 2"]` -> `[t('key.option1'), t('key.option2')]`
 */
function generateArrayElementFix(
  detection: HardcodedStringInfo,
  keyPath: string,
  imports: string[],
): CodeFix {
  const original = detection.snippet || `"${detection.value}"`;

  return {
    original,
    replacement: `t('${keyPath}')`,
    imports,
  };
}

/**
 * Format interpolation variables into a params object string
 * `['name', 'count']` -> `{ name, count }`
 */
function formatInterpolationParams(interpolations: string[]): string {
  // Deduplicate and sort for consistency
  const uniqueParams = Array.from(new Set(interpolations)).sort();

  // Use shorthand property syntax when variable name matches
  return `{ ${uniqueParams.join(', ')} }`;
}

// ============================================================================
// EFFORT CALCULATION
// ============================================================================

/**
 * Calculates the effort level required to extract a hardcoded string to i18n.
 *
 * Effort levels are determined by:
 * - **trivial**: Simple string replacement, no interpolation
 * - **low**: Single file change, simple attribute, 0-1 interpolations
 * - **medium**: Template literal with 2-3 interpolations
 * - **high**: Complex context, 4+ interpolations, or special handling needed
 *
 * @param detection - The detected hardcoded string information
 * @returns The calculated effort level
 *
 * @example
 * ```typescript
 * // Simple JSX text -> trivial
 * const effort1 = calculateEffort({ context: 'jsx-text', value: 'Привет' });
 * // effort1 === 'trivial'
 *
 * // Template with many interpolations -> high
 * const effort2 = calculateEffort({
 *   context: 'template-literal',
 *   interpolations: ['a', 'b', 'c', 'd'],
 * });
 * // effort2 === 'high'
 * ```
 */
export function calculateEffort(detection: HardcodedStringInfo): I18nEffort {
  const interpolationCount = detection.interpolations?.length || 0;

  // High effort scenarios
  if (interpolationCount > EFFORT_THRESHOLDS.MEDIUM_MAX_INTERPOLATIONS) {
    return 'high';
  }

  // Context-based effort assessment
  switch (detection.context) {
    case 'jsx-text':
      // JSX text is straightforward unless it has interpolations
      if (interpolationCount === 0) {
        return 'trivial';
      }
      return interpolationCount <= EFFORT_THRESHOLDS.LOW_MAX_INTERPOLATIONS ? 'low' : 'medium';

    case 'jsx-attribute':
      // Attributes are usually simple
      if (interpolationCount === 0) {
        return 'trivial';
      }
      return 'low';

    case 'string-literal':
      // String literals are simple
      return 'trivial';

    case 'template-literal':
      // Template literals depend on interpolation count
      if (interpolationCount === 0) {
        return 'trivial';
      }
      if (interpolationCount <= EFFORT_THRESHOLDS.LOW_MAX_INTERPOLATIONS) {
        return 'low';
      }
      return 'medium';

    case 'conditional':
      // Conditionals need more care to handle both branches
      return 'medium';

    case 'object-property':
      // Object properties might affect multiple usages
      return 'low';

    case 'array-element':
      // Array elements often need index-based keys
      return 'medium';

    default:
      return 'medium';
  }
}

// ============================================================================
// COMPONENT GROUPING
// ============================================================================

/**
 * Groups detected hardcoded strings by their parent component.
 *
 * This enables batch processing of i18n extraction on a per-component basis,
 * which is more efficient than processing strings individually. It also
 * suggests appropriate namespaces for each component's translations.
 *
 * @param strings - Array of detected hardcoded string information
 * @returns Array of component groups with suggested namespaces
 *
 * @example
 * ```typescript
 * const strings: HardcodedStringInfo[] = [
 *   { parentContext: 'LoginForm', file: 'src/auth/LoginForm.tsx', ... },
 *   { parentContext: 'LoginForm', file: 'src/auth/LoginForm.tsx', ... },
 *   { parentContext: 'Header', file: 'src/layout/Header.tsx', ... },
 * ];
 *
 * const groups = groupByComponent(strings);
 * // groups = [
 * //   { componentName: 'LoginForm', strings: [...], suggestedNamespace: 'auth.loginForm' },
 * //   { componentName: 'Header', strings: [...], suggestedNamespace: 'layout.header' },
 * // ]
 * ```
 */
export function groupByComponent(strings: HardcodedStringInfo[]): ComponentI18nGroup[] {
  const componentMap = new Map<string, ComponentI18nGroup>();

  for (const str of strings) {
    const componentName = str.parentContext || extractComponentFromPath(str.location.file);
    const key = `${str.location.file}:${componentName}`;

    if (!componentMap.has(key)) {
      componentMap.set(key, {
        componentName,
        file: str.location.file,
        strings: [],
        suggestedNamespace: generateNamespaceFromPath(str.location.file, componentName),
      });
    }

    componentMap.get(key)!.strings.push(str);
  }

  // Sort groups by file path for consistent output
  return Array.from(componentMap.values()).sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * Extract component name from file path when parentContext is not available
 */
function extractComponentFromPath(filePath: string): string {
  // Remove extension and get the filename
  const filename =
    filePath
      .split('/')
      .pop()
      ?.replace(/\.(tsx?|jsx?)$/, '') || 'Unknown';

  // Handle common patterns like index.tsx
  if (filename === 'index') {
    const parts = filePath.split('/');
    return parts[parts.length - 2] || 'Unknown';
  }

  return filename;
}

/**
 * Generate suggested namespace from file path and component name
 */
function generateNamespaceFromPath(filePath: string, componentName: string): string {
  // Extract meaningful path segments
  const segments = filePath
    .replace(/\.(tsx?|jsx?)$/, '')
    .split('/')
    .filter((seg) => !['src', 'components', 'pages', 'app', 'index'].includes(seg.toLowerCase()));

  // Take last 1-2 meaningful segments
  const relevantSegments = segments.slice(-2);

  if (relevantSegments.length === 0) {
    return camelCase(componentName);
  }

  // Build namespace
  const namespace = relevantSegments.map((seg) => camelCase(seg)).join('.');

  return namespace;
}

/**
 * Convert string to camelCase
 */
function camelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^./, (c) => c.toLowerCase());
}

// ============================================================================
// RECOMMENDATION GENERATION
// ============================================================================

/**
 * Generates actionable i18n recommendations from analysis results.
 *
 * This function processes the analysis results and creates prioritized,
 * deduplicated recommendations for extracting hardcoded strings to i18n.
 * Each recommendation includes the suggested key, translation values,
 * and code transformation needed.
 *
 * @param analysis - The complete i18n analysis result
 * @param existingKeys - Optional set of keys already in translation files
 * @returns Array of prioritized i18n recommendations
 *
 * @example
 * ```typescript
 * const analysis = await analyzeI18n({ rootPath: './src' });
 * const existingKeys = new Set(['common.buttons.submit', 'common.buttons.cancel']);
 *
 * const recommendations = generateI18nRecommendations(analysis, existingKeys);
 *
 * // Process recommendations in order of priority
 * for (const rec of recommendations.slice(0, 10)) {
 *   console.log(`[${rec.priority}] ${rec.title}`);
 *   console.log(`  Key: ${rec.suggestedKey.key}`);
 *   console.log(`  Fix: ${rec.codeFix.original} -> ${rec.codeFix.replacement}`);
 * }
 * ```
 */
export function generateI18nRecommendations(
  analysis: I18nAnalysisResult,
  existingKeys?: Set<string>,
): I18nRecommendation[] {
  const recommendations: I18nRecommendation[] = [];
  const seenHashes = new Set<string>();
  let priorityCounter = 1;

  // Collect all strings from all files
  const allStrings = analysis.files
    .filter((f) => f.status === 'analyzed')
    .flatMap((f) => f.strings);

  // Sort by context priority and then by file for consistent ordering
  const sortedStrings = [...allStrings].sort((a, b) => {
    const priorityDiff =
      (CONTEXT_PRIORITY_WEIGHTS[a.context] || 99) - (CONTEXT_PRIORITY_WEIGHTS[b.context] || 99);

    if (priorityDiff !== 0) return priorityDiff;

    return a.location.file.localeCompare(b.location.file);
  });

  for (const detection of sortedStrings) {
    // Skip technical strings
    if (detection.isTechnical) {
      continue;
    }

    // Skip if confidence is too low
    if (detection.confidence < 0.5) {
      continue;
    }

    // Create unique hash to detect duplicates
    const hash = createDeduplicationHash(detection);
    if (seenHashes.has(hash)) {
      continue;
    }
    seenHashes.add(hash);

    // Generate suggested key
    const suggestedKey = generateSuggestedKey(detection);

    // Skip if key already exists
    if (existingKeys?.has(suggestedKey.key)) {
      continue;
    }

    // Calculate effort
    const effort = calculateEffort(detection);

    // Generate code fix
    const codeFix = generateCodeFix(detection, suggestedKey);

    // Create recommendation
    const recommendation = createRecommendation(
      detection,
      suggestedKey,
      codeFix,
      effort,
      priorityCounter++,
    );

    recommendations.push(recommendation);
  }

  return recommendations;
}

/**
 * Create a deduplication hash for a detection
 * Strings with same value in same context type are considered duplicates
 */
function createDeduplicationHash(detection: HardcodedStringInfo): string {
  // Combine value, context, and optionally attribute name for uniqueness
  const parts = [detection.value, detection.context];

  if (detection.attributeName) {
    parts.push(detection.attributeName);
  }

  return parts.join('|');
}

/**
 * Generate a suggested i18n key for a detection
 */
function generateSuggestedKey(detection: HardcodedStringInfo): SuggestedI18nKey {
  const componentName =
    detection.parentContext || extractComponentFromPath(detection.location.file);
  const namespace = generateNamespaceFromPath(detection.location.file, componentName);

  // Determine key source and generate name
  let name: string;
  let source: SuggestedI18nKey['source'];
  let confidence: number;

  if (detection.attributeName) {
    // Attribute-based key (e.g., placeholder -> placeholderText)
    name = generateKeyFromAttribute(detection.attributeName, detection.value);
    source = 'attribute';
    confidence = 0.85;
  } else if (detection.parentContext) {
    // Component context available
    name = generateKeyFromContent(detection.value, detection.category);
    source = 'component';
    confidence = 0.8;
  } else {
    // Infer from content
    name = generateKeyFromContent(detection.value, detection.category);
    source = 'inferred';
    confidence = 0.7;
  }

  const key = `${namespace}.${name}`;

  return {
    key,
    namespace,
    name,
    source,
    confidence,
  };
}

/**
 * Generate key name from attribute name and value
 */
function generateKeyFromAttribute(attrName: string, value: string): string {
  // Common attribute mappings
  const attrKeyMappings: Record<string, string> = {
    placeholder: 'placeholder',
    title: 'title',
    alt: 'alt',
    'aria-label': 'ariaLabel',
    'aria-description': 'ariaDescription',
    label: 'label',
  };

  const baseKey = attrKeyMappings[attrName.toLowerCase()] || camelCase(attrName);

  // Add content hint for disambiguation
  const contentHint = generateContentHint(value);

  return contentHint ? `${baseKey}${capitalize(contentHint)}` : baseKey;
}

/**
 * Generate key name from content and category
 */
function generateKeyFromContent(value: string, category: string): string {
  // Generate a meaningful key from the content
  const words = value
    .toLowerCase()
    // Remove punctuation
    .replace(/[^\w\sа-яё]/gi, '')
    // Split by whitespace
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 4); // Take first 4 words max

  if (words.length === 0) {
    // Fallback to category-based key
    return `${category}Text`;
  }

  // Transliterate if Russian (transliterate handles full text)
  const transliterated = transliterate(words.join(' '));

  return camelCase(transliterated);
}

/**
 * Generate a short content hint for key disambiguation
 */
function generateContentHint(value: string): string {
  const words = value
    .toLowerCase()
    .replace(/[^\w\sа-яё]/gi, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2);

  if (words.length === 0) return '';

  // Transliterate the joined words
  return transliterate(words.join('')).replace(/\s+/g, '');
}

/**
 * Capitalize first letter of string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Create a complete i18n recommendation
 */
function createRecommendation(
  detection: HardcodedStringInfo,
  suggestedKey: SuggestedI18nKey,
  codeFix: CodeFix,
  effort: I18nEffort,
  priority: number,
): I18nRecommendation {
  const id = `i18n-${priority}-${hashString(detection.id)}`;

  const title = generateRecommendationTitle(detection);
  const description = generateRecommendationDescription(detection, suggestedKey);

  // Calculate expected improvement based on priority and context
  const expectedImprovement = calculateExpectedImprovement(detection, effort);

  // Determine if this can be auto-fixed
  const autoFixable = isAutoFixable(detection, effort);

  return {
    id,
    priority,
    category: 'i18n',
    title,
    description,
    expectedImprovement,
    effort,
    affectedFiles: [detection.location.file],
    autoFixable,
    detection,
    suggestedKey,
    translations: {
      ru: detection.value,
      ...(detection.language === 'en' ? { en: detection.value } : {}),
    },
    codeFix,
  };
}

/**
 * Generate human-readable recommendation title
 */
function generateRecommendationTitle(detection: HardcodedStringInfo): string {
  const truncatedValue =
    detection.value.length > 30 ? `${detection.value.slice(0, 30)}...` : detection.value;

  const contextLabel = getContextLabel(detection.context);

  return `Extract ${contextLabel}: "${truncatedValue}"`;
}

/**
 * Get human-readable label for string context
 */
function getContextLabel(context: StringContext): string {
  const labels: Record<StringContext, string> = {
    'jsx-text': 'JSX text',
    'jsx-attribute': 'attribute',
    'string-literal': 'string',
    'template-literal': 'template',
    conditional: 'conditional',
    'object-property': 'property',
    'array-element': 'array item',
  };

  return labels[context] || 'text';
}

/**
 * Generate detailed recommendation description
 */
function generateRecommendationDescription(
  detection: HardcodedStringInfo,
  suggestedKey: SuggestedI18nKey,
): string {
  const parts: string[] = [];

  // Location info
  parts.push(
    `Found in ${detection.location.file}:${detection.location.line}:${detection.location.column}`,
  );

  // Context info
  if (detection.parentContext) {
    parts.push(`inside ${detection.parentContext}`);
  }

  // Language info
  if (detection.language !== 'unknown') {
    parts.push(`(${detection.language.toUpperCase()} text)`);
  }

  // Interpolations
  if (detection.interpolations && detection.interpolations.length > 0) {
    parts.push(`with interpolations: ${detection.interpolations.join(', ')}`);
  }

  // Suggested key
  parts.push(`Suggested key: ${suggestedKey.key}`);

  return parts.join('. ');
}

/**
 * Calculate expected improvement score
 */
function calculateExpectedImprovement(detection: HardcodedStringInfo, effort: I18nEffort): number {
  // Base improvement depends on context importance
  const contextWeights: Record<StringContext, number> = {
    'jsx-text': 10,
    'jsx-attribute': 8,
    'template-literal': 7,
    'string-literal': 5,
    conditional: 6,
    'object-property': 5,
    'array-element': 4,
  };

  const baseImprovement = contextWeights[detection.context] || 5;

  // Adjust by effort (easier = more valuable to fix)
  const effortMultiplier: Record<I18nEffort, number> = {
    trivial: 1.5,
    low: 1.2,
    medium: 1.0,
    high: 0.8,
  };

  // Adjust by confidence
  const confidenceMultiplier = 0.5 + detection.confidence * 0.5;

  return Math.round(baseImprovement * effortMultiplier[effort] * confidenceMultiplier);
}

/**
 * Determine if detection can be auto-fixed
 */
function isAutoFixable(detection: HardcodedStringInfo, effort: I18nEffort): boolean {
  // High effort items need manual review
  if (effort === 'high') {
    return false;
  }

  // Low confidence items need manual review
  if (detection.confidence < 0.7) {
    return false;
  }

  // Conditionals need careful handling
  if (detection.context === 'conditional') {
    return false;
  }

  // Complex interpolations need review
  if (detection.interpolations && detection.interpolations.length > 2) {
    return false;
  }

  return true;
}

/**
 * Simple hash function for generating unique IDs
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Filter recommendations to only include auto-fixable ones
 *
 * @param recommendations - Array of i18n recommendations
 * @returns Filtered array containing only auto-fixable recommendations
 */
export function getAutoFixableRecommendations(
  recommendations: I18nRecommendation[],
): I18nRecommendation[] {
  return recommendations.filter((r) => r.autoFixable);
}

/**
 * Group recommendations by file for efficient batch processing
 *
 * @param recommendations - Array of i18n recommendations
 * @returns Map of file path to recommendations affecting that file
 */
export function groupRecommendationsByFile(
  recommendations: I18nRecommendation[],
): Map<string, I18nRecommendation[]> {
  const grouped = new Map<string, I18nRecommendation[]>();

  for (const rec of recommendations) {
    for (const file of rec.affectedFiles) {
      const existing = grouped.get(file) || [];
      existing.push(rec);
      grouped.set(file, existing);
    }
  }

  return grouped;
}

/**
 * Calculate total expected improvement from recommendations
 *
 * @param recommendations - Array of i18n recommendations
 * @returns Total expected improvement score
 */
export function calculateTotalI18nImprovement(recommendations: I18nRecommendation[]): number {
  return recommendations.reduce((sum, r) => sum + r.expectedImprovement, 0);
}

/**
 * Get recommendations statistics
 *
 * @param recommendations - Array of i18n recommendations
 * @returns Statistics object with counts by effort level
 */
export function getRecommendationStats(recommendations: I18nRecommendation[]): {
  total: number;
  autoFixable: number;
  byEffort: Record<I18nEffort, number>;
} {
  const stats = {
    total: recommendations.length,
    autoFixable: recommendations.filter((r) => r.autoFixable).length,
    byEffort: {
      trivial: 0,
      low: 0,
      medium: 0,
      high: 0,
    } as Record<I18nEffort, number>,
  };

  for (const rec of recommendations) {
    stats.byEffort[rec.effort]++;
  }

  return stats;
}
