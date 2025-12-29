/**
 * @module commands/refactor/analyzers/i18n/analyzer
 * @description High-performance i18n hardcoded string analyzer using SWC AST
 *
 * This module provides Google-level quality implementation for detecting
 * hardcoded user-facing text in React/TypeScript codebases. Uses single-pass
 * AST traversal for optimal performance and supports analysis of 1000+ files.
 *
 * Key features:
 * - Single-pass AST traversal with SWC (10-50x faster than ts-morph)
 * - Detects JSX text, JSX attributes, string literals, template literals
 * - Language detection for Russian/English text
 * - Context-aware categorization based on parent components
 * - Comprehensive error handling (never crashes on bad input)
 * - Immutable result structures
 *
 * @example
 * ```typescript
 * import { analyzeI18n } from './analyzer';
 *
 * const result = await analyzeI18n({
 *   rootPath: '/path/to/project',
 *   includeJsxText: true,
 *   includeJsxAttributes: true,
 * });
 *
 * console.log(`Found ${result.stats.totalStrings} hardcoded strings`);
 * ```
 */

import * as crypto from 'node:crypto';
import * as path from 'node:path';

import type { Node } from '@swc/core';
import {
  getNodeType,
  getSnippet,
  offsetToPosition,
  parseFile,
  visitNode,
} from '../../../../lib/@ast/swc';
import { findFiles, readFile, relativePath } from '../../../../lib/@core';
import {
  CATEGORY_BY_ATTRIBUTE,
  CATEGORY_BY_COMPONENT,
  CONTEXT_PRIORITY,
  hasCyrillicText,
  I18N_RELEVANT_ATTRIBUTES,
  I18N_SKIP_FILE_PATTERNS,
  isTechnicalString,
  SKIP_ATTRIBUTES,
} from '../../../../lib/@detectors/i18n';
import {
  detectLanguage as detectLanguageFromI18n,
  isUserFacingText as isUserFacingTextFromI18n,
} from '../../../../lib/@i18n';

import type {
  ComponentI18nGroup,
  DetectedLanguage,
  FileI18nAnalysis,
  HardcodedStringInfo,
  I18nAnalysisResult,
  I18nAnalysisStats,
  I18nAnalyzerOptions,
  I18nPriority,
  StringContext,
  StringLocation,
  TextCategory,
} from './types';

import { DEFAULT_I18N_OPTIONS } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Batch size for parallel file processing */
const BATCH_SIZE = 50;

/** Default file extensions to analyze */
const DEFAULT_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js'];

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

/**
 * Detect the language of a text string
 *
 * Uses lib/@i18n for language detection and maps the result to DetectedLanguage type.
 *
 * @param text - The text to analyze
 * @returns Detected language code
 *
 * @example
 * ```typescript
 * detectLanguage('Привет мир'); // 'ru'
 * detectLanguage('Hello world'); // 'en'
 * detectLanguage('Hello мир'); // 'mixed'
 * detectLanguage('123'); // 'unknown'
 * ```
 */
export function detectLanguage(text: string): DetectedLanguage {
  if (!text || text.length === 0) {
    return 'unknown';
  }

  const result = detectLanguageFromI18n(text);

  // Map lib/@i18n result to local DetectedLanguage type
  if (result.isMixed) {
    return 'mixed';
  }

  const lang = result.primary.language;

  // Map language codes to DetectedLanguage
  if (lang === 'ru') {
    return 'ru';
  }
  if (lang === 'en') {
    return 'en';
  }

  // If confidence is too low, treat as unknown
  if (result.primary.confidence < 0.3) {
    return 'unknown';
  }

  return 'unknown';
}

// ============================================================================
// STRING CONTEXT DETECTION
// ============================================================================

/**
 * Internal state for AST traversal
 */
interface TraversalState {
  /** Current component name stack */
  componentStack: string[];
  /** Current function/component name */
  currentFunction: string | null;
  /** Detected strings in this file */
  strings: HardcodedStringInfo[];
  /** File path for location tracking */
  filePath: string;
  /** Source content for snippet extraction */
  content: string;
  /** Pre-calculated line offsets */
  lineOffsets: number[];
  /** Base offset for SWC span normalization */
  baseOffset: number;
  /** Analyzer options */
  options: Required<I18nAnalyzerOptions>;
}

/**
 * Determine the text category based on context
 *
 * @param context - String context type
 * @param attributeName - JSX attribute name if applicable
 * @param componentName - Parent component name if available
 * @returns Text category
 */
function determineCategory(
  context: StringContext,
  attributeName?: string,
  componentName?: string,
): TextCategory {
  // First, check attribute-based category
  if (attributeName && CATEGORY_BY_ATTRIBUTE[attributeName]) {
    return CATEGORY_BY_ATTRIBUTE[attributeName] as TextCategory;
  }

  // Then check component-based category
  if (componentName && CATEGORY_BY_COMPONENT[componentName]) {
    return CATEGORY_BY_COMPONENT[componentName] as TextCategory;
  }

  // Default categories based on context
  switch (context) {
    case 'jsx-text':
      return 'ui-label';
    case 'jsx-attribute':
      return 'ui-label';
    case 'template-literal':
      return 'message';
    case 'conditional':
      return 'ui-label';
    case 'object-property':
      return 'other';
    case 'array-element':
      return 'other';
    default:
      return 'other';
  }
}

/**
 * Calculate priority for a detected string
 *
 * @param context - String context type
 * @param language - Detected language
 * @param attributeName - JSX attribute name if applicable
 * @returns Priority number (lower = higher priority)
 */
function calculatePriority(
  context: StringContext,
  language: DetectedLanguage,
  attributeName?: string,
): number {
  let basePriority: number;

  // Check specific context with attribute
  const contextKey = attributeName ? `jsx-attribute:${attributeName}` : context;
  basePriority = CONTEXT_PRIORITY[contextKey] ?? CONTEXT_PRIORITY[context] ?? 5;

  // Boost priority for Russian text (more urgent to extract)
  if (language === 'ru') {
    basePriority = Math.max(1, basePriority - 1);
  }

  return basePriority;
}

/**
 * Convert priority number to priority level
 *
 * @param priority - Numeric priority
 * @returns Priority level string
 */
function priorityToLevel(priority: number): I18nPriority {
  if (priority <= 1) return 'critical';
  if (priority <= 2) return 'high';
  if (priority <= 3) return 'medium';
  return 'low';
}

/**
 * Calculate confidence score for a detection
 *
 * @param text - Detected text
 * @param context - String context
 * @param language - Detected language
 * @returns Confidence score (0-1)
 */
function calculateConfidence(
  text: string,
  context: StringContext,
  language: DetectedLanguage,
): number {
  let confidence = 0.5;

  // Higher confidence for Cyrillic text (clearly user-facing)
  if (language === 'ru') {
    confidence += 0.3;
  }

  // Higher confidence for JSX text (clearly visible)
  if (context === 'jsx-text') {
    confidence += 0.2;
  }

  // Higher confidence for i18n-relevant attributes
  if (context === 'jsx-attribute') {
    confidence += 0.1;
  }

  // Lower confidence for very short strings
  if (text.length < 5) {
    confidence -= 0.1;
  }

  // Higher confidence for longer meaningful text
  if (text.length > 20) {
    confidence += 0.1;
  }

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Create a location object from SWC span
 *
 * @param span - SWC span with start/end
 * @param state - Traversal state
 * @returns Location object
 */
function createLocation(
  span: { start: number; end: number },
  state: TraversalState,
): StringLocation {
  // Normalize span offsets (SWC accumulates offsets globally)
  const normalizedStart = span.start - state.baseOffset;
  const normalizedEnd = span.end - state.baseOffset;

  const position = offsetToPosition(normalizedStart, state.lineOffsets);

  return {
    file: relativePath(state.filePath, state.options.rootPath),
    line: position.line,
    column: position.column,
    start: normalizedStart,
    end: normalizedEnd,
  };
}

/**
 * Check if a string should be skipped based on options and patterns
 *
 * @param text - The text to check
 * @param options - Analyzer options
 * @returns true if should skip
 */
function shouldSkipString(text: string, options: Required<I18nAnalyzerOptions>): boolean {
  // Length checks
  if (text.length < options.minLength || text.length > options.maxLength) {
    return true;
  }

  // Check technical patterns
  if (isTechnicalString(text)) {
    return true;
  }

  // Check custom skip patterns
  if (options.skipStringPatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  return false;
}

/**
 * Check if a string is user-facing (needs i18n)
 *
 * Uses lib/@i18n for user-facing text detection, with additional
 * filtering based on analyzer options.
 *
 * @param text - The text to check
 * @param options - Analyzer options
 * @returns true if user-facing
 */
function isUserFacingText(text: string, options: Required<I18nAnalyzerOptions>): boolean {
  // Use lib/@i18n for base detection
  if (!isUserFacingTextFromI18n(text)) {
    return false;
  }

  // Additional check: if only specific languages are targeted,
  // verify the detected language matches
  const detected = detectLanguage(text);
  if (detected !== 'unknown' && detected !== 'mixed') {
    return options.languages.includes(detected);
  }

  return true;
}

/**
 * Extract interpolation variables from template literal
 *
 * @param expressions - Template literal expressions
 * @returns Array of variable names
 */
function extractInterpolations(expressions: Node[]): string[] {
  const variables: string[] = [];

  for (const expr of expressions) {
    const type = getNodeType(expr);
    if (type === 'Identifier') {
      const id = expr as unknown as { value: string };
      if (id.value) {
        variables.push(id.value);
      }
    }
  }

  return variables;
}

/**
 * Get the current context name (function or component)
 *
 * @param state - Traversal state
 * @returns Context name or undefined
 */
function getCurrentContextName(state: TraversalState): string | undefined {
  const fromFunction = state.currentFunction;
  const fromComponent = state.componentStack[state.componentStack.length - 1];
  return fromFunction ?? fromComponent ?? undefined;
}

/**
 * Build a HardcodedStringInfo object with proper optional property handling
 *
 * This function handles the exactOptionalPropertyTypes requirement by
 * only including optional properties when they have defined values.
 */
function buildStringInfo(params: {
  value: string;
  language: DetectedLanguage;
  context: StringContext;
  category: TextCategory;
  priority: number;
  location: StringLocation;
  confidence: number;
  snippet: string;
  parentContext: string | undefined;
  attributeName?: string;
  interpolations?: string[];
}): HardcodedStringInfo {
  const result: HardcodedStringInfo = {
    id: crypto.randomUUID(),
    value: params.value,
    language: params.language,
    context: params.context,
    category: params.category,
    priority: params.priority,
    location: params.location,
    isTechnical: false,
    confidence: params.confidence,
    snippet: params.snippet,
  };

  // Only add optional properties if they have values
  if (params.parentContext !== undefined) {
    result.parentContext = params.parentContext;
  }
  if (params.attributeName !== undefined) {
    result.attributeName = params.attributeName;
  }
  if (params.interpolations !== undefined && params.interpolations.length > 0) {
    result.interpolations = params.interpolations;
  }

  return result;
}

// ============================================================================
// AST VISITOR HANDLERS
// ============================================================================

/**
 * Handle JSXText nodes
 *
 * JSX text is the text content between JSX tags:
 * <div>This is JSX text</div>
 */
function handleJSXText(node: Node, state: TraversalState): void {
  if (!state.options.includeJsxText) return;

  const jsxText = node as unknown as {
    value: string;
    raw: string;
    span: { start: number; end: number };
  };
  const text = jsxText.value?.trim();

  if (!text || shouldSkipString(text, state.options)) {
    return;
  }

  const language = detectLanguage(text);
  if (!isUserFacingText(text, state.options)) {
    return;
  }

  const context: StringContext = 'jsx-text';
  const parentContext = getCurrentContextName(state);
  const category = determineCategory(context, undefined, parentContext);
  const priority = calculatePriority(context, language);
  const confidence = calculateConfidence(text, context, language);
  const location = createLocation(jsxText.span, state);
  const snippet = getSnippet(
    state.content,
    jsxText.span.start - state.baseOffset,
    state.lineOffsets,
  );

  state.strings.push(
    buildStringInfo({
      value: text,
      language,
      context,
      category,
      priority,
      location,
      confidence,
      snippet,
      parentContext,
    }),
  );
}

/**
 * Handle JSXAttribute nodes
 *
 * JSX attributes like placeholder="Enter name" or title="Title text"
 */
function handleJSXAttribute(node: Node, state: TraversalState): void {
  if (!state.options.includeJsxAttributes) return;

  const attr = node as unknown as {
    name: { type: string; value?: string };
    value?: { type: string; value?: string; span?: { start: number; end: number } };
    span: { start: number; end: number };
  };

  // Get attribute name
  let attrName: string | undefined;
  if (attr.name?.type === 'Identifier') {
    attrName = attr.name.value;
  } else if (attr.name?.type === 'JSXNamespacedName') {
    // Handle namespaced names like aria-label
    const nsName = attr.name as unknown as {
      namespace: { value: string };
      name: { value: string };
    };
    attrName = `${nsName.namespace?.value ?? ''}-${nsName.name?.value ?? ''}`;
  }

  if (!attrName) return;

  // Skip non-relevant attributes
  if (SKIP_ATTRIBUTES.has(attrName)) return;
  if (!I18N_RELEVANT_ATTRIBUTES.has(attrName)) {
    // Still check if it has Cyrillic content
    const value = attr.value;
    if (!value || value.type !== 'StringLiteral') return;
    const text = value.value?.trim();
    if (!text || !hasCyrillicText(text)) return;
  }

  // Get string value
  const value = attr.value;
  if (!value) return;

  let text: string | undefined;
  let valueSpan: { start: number; end: number } | undefined;

  if (value.type === 'StringLiteral') {
    text = (value as unknown as { value: string }).value?.trim();
    valueSpan = value.span;
  } else if (value.type === 'JSXExpressionContainer') {
    // Handle expressions like placeholder={"text"}
    const expr = (
      value as unknown as {
        expression: { type: string; value?: string; span?: { start: number; end: number } };
      }
    ).expression;
    if (expr?.type === 'StringLiteral') {
      text = expr.value?.trim();
      valueSpan = expr.span;
    }
  }

  if (!text || !valueSpan || shouldSkipString(text, state.options)) {
    return;
  }

  const language = detectLanguage(text);
  if (!isUserFacingText(text, state.options)) {
    return;
  }

  const context: StringContext = 'jsx-attribute';
  const parentContext = getCurrentContextName(state);
  const category = determineCategory(context, attrName, parentContext);
  const priority = calculatePriority(context, language, attrName);
  const confidence = calculateConfidence(text, context, language);
  const location = createLocation(valueSpan, state);
  const snippet = getSnippet(state.content, valueSpan.start - state.baseOffset, state.lineOffsets);

  state.strings.push(
    buildStringInfo({
      value: text,
      language,
      context,
      category,
      priority,
      location,
      confidence,
      snippet,
      parentContext,
      attributeName: attrName,
    }),
  );
}

/**
 * Handle StringLiteral nodes
 *
 * Regular string literals like const message = "Hello"
 */
function handleStringLiteral(node: Node, state: TraversalState, parentPath: string[]): void {
  if (!state.options.includeStringLiterals) return;

  // Skip if inside JSX attribute (handled separately)
  if (parentPath.includes('JSXAttribute') || parentPath.includes('JSXOpeningElement')) {
    return;
  }

  const strLit = node as unknown as { value: string; span: { start: number; end: number } };
  const text = strLit.value?.trim();

  if (!text || shouldSkipString(text, state.options)) {
    return;
  }

  const language = detectLanguage(text);
  if (!isUserFacingText(text, state.options)) {
    return;
  }

  // Determine context based on parent
  let context: StringContext = 'string-literal';
  if (parentPath.includes('ConditionalExpression')) {
    context = 'conditional';
  } else if (parentPath.includes('KeyValueProperty')) {
    context = 'object-property';
  } else if (parentPath.includes('ArrayExpression')) {
    context = 'array-element';
  }

  const parentContext = getCurrentContextName(state);
  const category = determineCategory(context, undefined, parentContext);
  const priority = calculatePriority(context, language);
  const confidence = calculateConfidence(text, context, language);
  const location = createLocation(strLit.span, state);
  const snippet = getSnippet(
    state.content,
    strLit.span.start - state.baseOffset,
    state.lineOffsets,
  );

  state.strings.push(
    buildStringInfo({
      value: text,
      language,
      context,
      category,
      priority,
      location,
      confidence,
      snippet,
      parentContext,
    }),
  );
}

/**
 * Handle TemplateLiteral nodes
 *
 * Template literals like `Hello ${name}`
 */
function handleTemplateLiteral(node: Node, state: TraversalState): void {
  if (!state.options.includeTemplateLiterals) return;

  const template = node as unknown as {
    quasis: Array<{ cooked?: string; raw?: string }>;
    expressions: Node[];
    span: { start: number; end: number };
  };

  // Combine quasis to get full text (with ${...} placeholders)
  const parts: string[] = [];
  for (let i = 0; i < template.quasis.length; i++) {
    const quasi = template.quasis[i];
    if (quasi?.cooked) {
      parts.push(quasi.cooked);
    }
    if (i < template.expressions.length) {
      parts.push('${...}');
    }
  }

  const text = parts.join('').trim();

  if (!text || shouldSkipString(text, state.options)) {
    return;
  }

  const language = detectLanguage(text);
  if (!isUserFacingText(text, state.options)) {
    return;
  }

  const context: StringContext = 'template-literal';
  const parentContext = getCurrentContextName(state);
  const category = determineCategory(context, undefined, parentContext);
  const priority = calculatePriority(context, language);
  const confidence = calculateConfidence(text, context, language);
  const location = createLocation(template.span, state);
  const interpolations = extractInterpolations(template.expressions);
  const snippet = getSnippet(
    state.content,
    template.span.start - state.baseOffset,
    state.lineOffsets,
  );

  state.strings.push(
    buildStringInfo({
      value: text,
      language,
      context,
      category,
      priority,
      location,
      confidence,
      snippet,
      parentContext,
      interpolations,
    }),
  );
}

// ============================================================================
// FILE ANALYSIS
// ============================================================================

/**
 * Analyze a single file for hardcoded i18n strings
 *
 * Performs single-pass AST traversal using SWC for optimal performance.
 * Tracks component context for better key generation and categorization.
 *
 * @param filePath - Absolute path to the file
 * @param content - File content
 * @param options - Analyzer options
 * @returns File analysis result
 *
 * @example
 * ```typescript
 * const content = fs.readFileSync('Component.tsx', 'utf-8');
 * const result = analyzeFileI18n('Component.tsx', content, options);
 *
 * console.log(`Found ${result.strings.length} strings`);
 * ```
 */
export function analyzeFileI18n(
  filePath: string,
  content: string,
  options: Required<I18nAnalyzerOptions>,
): FileI18nAnalysis {
  const startTime = performance.now();
  const relPath = relativePath(filePath, options.rootPath);

  try {
    // Parse with SWC
    const { ast, lineOffsets, baseOffset } = parseFile(filePath, content);

    // Initialize traversal state
    const state: TraversalState = {
      componentStack: [],
      currentFunction: null,
      strings: [],
      filePath,
      content,
      lineOffsets,
      baseOffset,
      options,
    };

    // Single-pass traversal
    visitNode(ast, (node, context) => {
      const nodeType = getNodeType(node);
      const parentPath = context?.path ?? [];

      // Track component context
      if (nodeType === 'JSXOpeningElement') {
        const elem = node as unknown as { name: { type: string; value?: string } };
        if (elem.name?.type === 'Identifier' && elem.name.value) {
          // Only track PascalCase components
          if (/^[A-Z]/.test(elem.name.value)) {
            state.componentStack.push(elem.name.value);
          }
        }
      }

      // Track function context
      if (nodeType === 'FunctionDeclaration' || nodeType === 'FunctionExpression') {
        const fn = node as unknown as { identifier?: { value: string } };
        if (fn.identifier?.value) {
          state.currentFunction = fn.identifier.value;
        }
      }

      if (nodeType === 'ArrowFunctionExpression') {
        // Arrow functions inherit parent function context
      }

      if (nodeType === 'VariableDeclarator') {
        const decl = node as unknown as {
          id?: { type: string; value?: string };
          init?: { type: string };
        };
        if (decl.id?.type === 'Identifier' && decl.init?.type === 'ArrowFunctionExpression') {
          state.currentFunction = decl.id.value ?? null;
        }
      }

      // Handle specific node types
      switch (nodeType) {
        case 'JSXText':
          handleJSXText(node, state);
          break;
        case 'JSXAttribute':
          handleJSXAttribute(node, state);
          break;
        case 'StringLiteral':
          handleStringLiteral(node, state, parentPath);
          break;
        case 'TemplateLiteral':
          handleTemplateLiteral(node, state);
          break;
      }

      // Pop component stack on closing
      if (nodeType === 'JSXClosingElement') {
        state.componentStack.pop();
      }
    });

    return {
      file: relPath,
      strings: state.strings,
      status: 'analyzed',
      durationMs: performance.now() - startTime,
    };
  } catch (error) {
    return {
      file: relPath,
      strings: [],
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      durationMs: performance.now() - startTime,
    };
  }
}

/**
 * Extract hardcoded strings from content (convenience wrapper)
 *
 * @param filePath - File path
 * @param content - File content
 * @param options - Analyzer options
 * @returns Array of detected strings
 */
export function extractHardcodedStrings(
  filePath: string,
  content: string,
  options: I18nAnalyzerOptions,
): HardcodedStringInfo[] {
  const mergedOptions = mergeOptions(options);
  const result = analyzeFileI18n(filePath, content, mergedOptions);
  return result.strings;
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Merge user options with defaults
 */
function mergeOptions(options: I18nAnalyzerOptions): Required<I18nAnalyzerOptions> {
  return {
    rootPath: options.rootPath,
    files: options.files ?? [],
    minLength: options.minLength ?? DEFAULT_I18N_OPTIONS.minLength,
    maxLength: options.maxLength ?? DEFAULT_I18N_OPTIONS.maxLength,
    languages: options.languages ?? DEFAULT_I18N_OPTIONS.languages,
    includeJsxText: options.includeJsxText ?? DEFAULT_I18N_OPTIONS.includeJsxText,
    includeJsxAttributes: options.includeJsxAttributes ?? DEFAULT_I18N_OPTIONS.includeJsxAttributes,
    includeStringLiterals:
      options.includeStringLiterals ?? DEFAULT_I18N_OPTIONS.includeStringLiterals,
    includeTemplateLiterals:
      options.includeTemplateLiterals ?? DEFAULT_I18N_OPTIONS.includeTemplateLiterals,
    skipFilePatterns: [
      ...DEFAULT_I18N_OPTIONS.skipFilePatterns,
      ...(options.skipFilePatterns ?? []),
    ],
    skipStringPatterns: [
      ...DEFAULT_I18N_OPTIONS.skipStringPatterns,
      ...(options.skipStringPatterns ?? []),
    ],
    existingKeys: options.existingKeys ?? new Set(),
    i18nConfigPath: options.i18nConfigPath ?? '',
    verbose: options.verbose ?? DEFAULT_I18N_OPTIONS.verbose,
    limit: options.limit ?? DEFAULT_I18N_OPTIONS.limit,
  };
}

/**
 * Check if a file should be skipped
 */
function shouldSkipFile(
  filePath: string,
  options: Required<I18nAnalyzerOptions>,
): { skip: boolean; reason?: string } {
  // Check built-in skip patterns
  for (const pattern of I18N_SKIP_FILE_PATTERNS) {
    if (pattern.test(filePath)) {
      return { skip: true, reason: `Matches skip pattern: ${pattern.source}` };
    }
  }

  // Check custom skip patterns
  for (const pattern of options.skipFilePatterns) {
    if (pattern.test(filePath)) {
      return { skip: true, reason: `Matches custom pattern: ${pattern.source}` };
    }
  }

  return { skip: false };
}

/**
 * Build a FileI18nAnalysis object with proper optional property handling
 */
function buildFileAnalysis(params: {
  file: string;
  strings: HardcodedStringInfo[];
  status: 'analyzed' | 'skipped' | 'error';
  skipReason?: string;
  error?: string;
  durationMs?: number;
}): FileI18nAnalysis {
  const result: FileI18nAnalysis = {
    file: params.file,
    strings: params.strings,
    status: params.status,
  };

  if (params.skipReason !== undefined) {
    result.skipReason = params.skipReason;
  }
  if (params.error !== undefined) {
    result.error = params.error;
  }
  if (params.durationMs !== undefined) {
    result.durationMs = params.durationMs;
  }

  return result;
}

/**
 * Process files in batches for performance
 */
async function processFilesInBatches(
  files: string[],
  options: Required<I18nAnalyzerOptions>,
): Promise<FileI18nAnalysis[]> {
  const results: FileI18nAnalysis[] = [];

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (filePath): Promise<FileI18nAnalysis> => {
        const skipCheck = shouldSkipFile(filePath, options);
        if (skipCheck.skip) {
          return buildFileAnalysis({
            file: relativePath(filePath, options.rootPath),
            strings: [],
            status: 'skipped',
            ...(skipCheck.reason ? { skipReason: skipCheck.reason } : {}),
          });
        }

        const content = readFile(filePath);
        if (!content) {
          return buildFileAnalysis({
            file: relativePath(filePath, options.rootPath),
            strings: [],
            status: 'error',
            error: 'Failed to read file',
          });
        }

        return analyzeFileI18n(filePath, content, options);
      }),
    );

    results.push(...batchResults);
  }

  return results;
}

/**
 * Group strings by component
 */
function groupStringsByComponent(files: FileI18nAnalysis[]): ComponentI18nGroup[] {
  const groups = new Map<string, ComponentI18nGroup>();

  for (const file of files) {
    for (const str of file.strings) {
      const componentName = str.parentContext ?? 'Unknown';
      const key = `${file.file}:${componentName}`;

      if (!groups.has(key)) {
        groups.set(key, {
          componentName,
          file: file.file,
          strings: [],
          suggestedNamespace: deriveNamespace(file.file, componentName),
        });
      }

      groups.get(key)!.strings.push(str);
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.strings.length - a.strings.length);
}

/**
 * Derive namespace from file path and component name
 */
function deriveNamespace(filePath: string, componentName: string): string {
  const parts = filePath.split('/');

  // Try to find meaningful path segments
  const meaningfulParts: string[] = [];

  for (const part of parts) {
    // Skip common non-meaningful parts
    if (['src', 'app', 'components', 'lib', 'pages', 'features'].includes(part)) {
      continue;
    }
    // Skip file extensions
    if (part.includes('.')) {
      continue;
    }
    if (part && part.length > 1) {
      meaningfulParts.push(part.toLowerCase());
    }
  }

  // Add component name if meaningful
  if (
    componentName &&
    componentName !== 'Unknown' &&
    !meaningfulParts.includes(componentName.toLowerCase())
  ) {
    meaningfulParts.push(componentName.toLowerCase());
  }

  return meaningfulParts.slice(0, 3).join('.') || 'common';
}

/**
 * Calculate analysis statistics
 */
function calculateStats(files: FileI18nAnalysis[], durationMs: number): I18nAnalysisStats {
  const stats: I18nAnalysisStats = {
    filesAnalyzed: 0,
    filesSkipped: 0,
    filesWithErrors: 0,
    totalStrings: 0,
    byLanguage: { ru: 0, en: 0, mixed: 0, unknown: 0 },
    byContext: {
      'jsx-text': 0,
      'jsx-attribute': 0,
      'string-literal': 0,
      'template-literal': 0,
      conditional: 0,
      'object-property': 0,
      'array-element': 0,
    },
    byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
    byCategory: {
      'ui-label': 0,
      message: 0,
      placeholder: 0,
      title: 0,
      description: 0,
      navigation: 0,
      action: 0,
      validation: 0,
      toast: 0,
      modal: 0,
      tooltip: 0,
      other: 0,
    },
    durationMs,
  };

  for (const file of files) {
    switch (file.status) {
      case 'analyzed':
        stats.filesAnalyzed++;
        break;
      case 'skipped':
        stats.filesSkipped++;
        break;
      case 'error':
        stats.filesWithErrors++;
        break;
    }

    for (const str of file.strings) {
      stats.totalStrings++;
      stats.byLanguage[str.language]++;
      stats.byContext[str.context]++;
      stats.byPriority[priorityToLevel(str.priority)]++;
      stats.byCategory[str.category]++;
    }
  }

  return stats;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze a codebase for hardcoded i18n strings
 *
 * This is the main entry point for i18n analysis. It scans all TypeScript/React
 * files in the specified directory and detects hardcoded user-facing text that
 * should be extracted for internationalization.
 *
 * Features:
 * - High-performance single-pass AST traversal with SWC
 * - Parallel file processing in batches
 * - Language detection (Russian, English, mixed)
 * - Context-aware categorization
 * - Component grouping for efficient extraction
 *
 * @param options - Analysis options
 * @returns Complete analysis result with files, groups, stats, and recommendations
 *
 * @example
 * ```typescript
 * const result = await analyzeI18n({
 *   rootPath: '/path/to/project',
 *   includeJsxText: true,
 *   includeJsxAttributes: true,
 *   languages: ['ru', 'en'],
 * });
 *
 * // Access results
 * console.log(`Files analyzed: ${result.stats.filesAnalyzed}`);
 * console.log(`Hardcoded strings: ${result.stats.totalStrings}`);
 * console.log(`Russian strings: ${result.stats.byLanguage.ru}`);
 *
 * // Iterate over recommendations
 * for (const rec of result.recommendations) {
 *   console.log(`${rec.priority}: ${rec.detection.value}`);
 * }
 * ```
 */
export async function analyzeI18n(options: I18nAnalyzerOptions): Promise<I18nAnalysisResult> {
  const startTime = performance.now();
  const mergedOptions = mergeOptions(options);

  // Find files to analyze
  let files: string[];
  if (mergedOptions.files && mergedOptions.files.length > 0) {
    files = mergedOptions.files.map((f) =>
      path.isAbsolute(f) ? f : path.join(mergedOptions.rootPath, f),
    );
  } else {
    files = findFiles(mergedOptions.rootPath, {
      extensions: DEFAULT_EXTENSIONS,
      skipDirs: ['node_modules', 'dist', '.next', 'build', 'coverage'],
    });
  }

  // Apply limit if specified
  if (mergedOptions.limit > 0) {
    files = files.slice(0, mergedOptions.limit);
  }

  // Process files
  const fileResults = await processFilesInBatches(files, mergedOptions);

  // Group by component
  const componentGroups = groupStringsByComponent(fileResults);

  // Calculate statistics
  const durationMs = performance.now() - startTime;
  const stats = calculateStats(fileResults, durationMs);

  // Build suggested translations
  const suggestedTranslations: { ru: Record<string, string>; en: Record<string, string> } = {
    ru: {},
    en: {},
  };

  for (const file of fileResults) {
    for (const str of file.strings) {
      if (str.language === 'ru') {
        // Use a simple key based on position
        const key = `${str.parentContext ?? 'unknown'}.${str.id.slice(0, 8)}`;
        suggestedTranslations.ru[key] = str.value;
        suggestedTranslations.en[key] = ''; // Needs translation
      } else if (str.language === 'en') {
        const key = `${str.parentContext ?? 'unknown'}.${str.id.slice(0, 8)}`;
        suggestedTranslations.en[key] = str.value;
        suggestedTranslations.ru[key] = ''; // Needs translation
      }
    }
  }

  return {
    files: fileResults,
    componentGroups,
    recommendations: [], // Generated by recommendations module
    stats,
    suggestedTranslations,
    timestamp: new Date().toISOString(),
    projectRoot: mergedOptions.rootPath,
  };
}
