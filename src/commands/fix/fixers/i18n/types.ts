/**
 * @module commands/fix/fixers/i18n/types
 * @description Types for i18n fixer (line-by-line replacement and catalog management)
 */

// ============================================================================
// STRING CONTEXT TYPES (formerly from refactor/analyzers/i18n)
// ============================================================================

/**
 * Context where the hardcoded string was found
 */
export type StringContext =
  | 'jsx-text' // <h1>Привет мир</h1>
  | 'jsx-attribute' // placeholder="Введите имя"
  | 'string-literal' // const msg = "Сообщение"
  | 'template-literal' // const msg = `Привет, ${name}`
  | 'conditional' // condition ? "Да" : "Нет"
  | 'object-property' // { label: "Кнопка" }
  | 'array-element'; // ["Опция 1", "Опция 2"]

/**
 * User-facing text category for grouping
 */
export type TextCategory =
  | 'ui-label' // Button labels, form labels
  | 'message' // Error messages, notifications
  | 'placeholder' // Input placeholders
  | 'title' // Page titles, headers
  | 'description' // Descriptions, help text
  | 'navigation' // Menu items, breadcrumbs
  | 'action' // Action buttons, links
  | 'validation' // Validation messages
  | 'toast' // Toast notifications
  | 'modal' // Modal titles/content
  | 'tooltip' // Tooltip text
  | 'other';

// Aliases for backward compatibility
export type StringCategory = TextCategory;
export type DetectionContext = StringContext;

// ============================================================================
// DETECTION TYPES (Simplified for line replacement)
// ============================================================================

/**
 * Simplified detection for line-by-line replacement.
 * This is a subset of HardcodedStringInfo optimized for text replacement.
 */
export interface Detection {
  /** The raw text value */
  readonly value: string;
  /** Context where text was found */
  readonly context: StringContext;
  /** Category for key naming */
  readonly category: TextCategory;
  /** Line number (1-based) */
  readonly line: number;
  /** Column where text starts (0-based) */
  readonly column: number;
  /** Original quote character (', ", `) */
  readonly quote: string;
  /** JSX attribute name if applicable */
  readonly attributeName?: string;
  /** Whether text contains interpolations */
  readonly hasInterpolation: boolean;
  /** Extracted interpolation variables */
  readonly interpolations: readonly string[];
  /** Confidence score (0-1) */
  readonly confidence: number;
}

// ============================================================================
// TRANSLATION CATALOG TYPES
// ============================================================================

/**
 * Single translation entry in catalog
 */
export interface TranslationEntry {
  readonly key: string;
  readonly value: string;
  readonly icuValue: string;
  readonly namespace: string;
  readonly sourceFile: string;
  readonly sourceLine: number;
}

/**
 * Translation catalog with entries and stats
 */
export interface TranslationCatalog {
  readonly projectId: string;
  readonly locale: string;
  readonly entries: Map<string, TranslationEntry>;
  readonly generatedAt: Date;
  readonly stats: CatalogStats;
}

/**
 * Catalog statistics
 */
export interface CatalogStats {
  readonly totalEntries: number;
  readonly byNamespace: Map<string, number>;
  readonly byCategory: Map<TextCategory, number>;
  readonly withInterpolations: number;
}

// ============================================================================
// REPLACEMENT TYPES
// ============================================================================

/**
 * Planned replacement operation
 */
export interface Replacement {
  readonly line: number;
  readonly startColumn: number;
  readonly endColumn: number;
  readonly original: string;
  readonly replacement: string;
  readonly key: string;
  readonly validated: boolean;
}

/**
 * File transformation result
 */
export interface TransformResult {
  readonly filePath: string;
  readonly content: string;
  readonly replacementCount: number;
  readonly skipped: readonly SkippedReplacement[];
  readonly importAdded: boolean;
}

/**
 * Skipped replacement with reason
 */
export interface SkippedReplacement {
  readonly detection: Detection;
  readonly reason: string;
}

// ============================================================================
// CONFIG TYPES
// ============================================================================

/**
 * Key collision handling strategy
 */
export type CollisionStrategy = 'skip' | 'suffix' | 'overwrite' | 'error';

/**
 * Replacement configuration
 */
export interface ReplacementConfig {
  readonly functionName: string;
  readonly importStatement: string;
  readonly addImport: boolean;
  readonly dryRun: boolean;
}

// ============================================================================
// CONFIG TYPES (Additional)
// ============================================================================

/**
 * Detection configuration
 */
export interface DetectionConfig {
  readonly minLength: number;
  readonly maxLength: number;
  readonly minConfidence: number;
  readonly includeJsxText: boolean;
  readonly includeJsxAttributes: boolean;
  readonly includeStringLiterals: boolean;
  readonly includeTemplateLiterals: boolean;
  readonly skipPatterns: readonly string[];
}

/**
 * Extraction configuration
 */
export interface ExtractionConfig {
  readonly projectId: string;
  readonly locale: string;
  readonly collisionStrategy: CollisionStrategy;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Full i18n fix result
 */
export interface FixResult {
  readonly filesProcessed: number;
  readonly stringsDetected: number;
  readonly stringsReplaced: number;
  readonly stringsSkipped: number;
  readonly catalogEntries: number;
  readonly errors: readonly string[];
}
