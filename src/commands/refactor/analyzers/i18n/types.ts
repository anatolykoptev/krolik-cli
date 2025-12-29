/**
 * @module commands/refactor/analyzers/i18n/types
 * @description Types for i18n hardcoded string detection and recommendations
 */

// ============================================================================
// STRING DETECTION TYPES
// ============================================================================

/**
 * Detected language of the hardcoded string
 */
export type DetectedLanguage = 'ru' | 'en' | 'mixed' | 'unknown';

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
 * Priority level for i18n extraction
 */
export type I18nPriority = 'critical' | 'high' | 'medium' | 'low';

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

/**
 * Location information for a detected string
 */
export interface StringLocation {
  /** File path (relative to project root) */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** Start offset in source file */
  start: number;
  /** End offset in source file */
  end: number;
}

/**
 * Information about a detected hardcoded string
 */
export interface HardcodedStringInfo {
  /** Unique identifier for this detection */
  id: string;

  /** The actual hardcoded string value */
  value: string;

  /** Detected language of the string */
  language: DetectedLanguage;

  /** Context where the string was found */
  context: StringContext;

  /** Category of user-facing text */
  category: TextCategory;

  /** Priority for extraction (1 = highest) */
  priority: number;

  /** Location information */
  location: StringLocation;

  /** Parent component/function name if available */
  parentContext?: string;

  /** JSX attribute name if context is 'jsx-attribute' */
  attributeName?: string;

  /** For template literals: interpolation variables found */
  interpolations?: string[];

  /** Whether this string contains only technical content (should skip) */
  isTechnical: boolean;

  /** Confidence score for detection (0-1) */
  confidence: number;

  /** Code snippet for context */
  snippet?: string;
}

// ============================================================================
// RECOMMENDATION TYPES
// ============================================================================

/**
 * Effort level for implementing the recommendation
 */
export type I18nEffort = 'trivial' | 'low' | 'medium' | 'high';

/**
 * Suggested i18n key based on context analysis
 */
export interface SuggestedI18nKey {
  /** Full key path (e.g., "common.buttons.submit") */
  key: string;

  /** Namespace/section (e.g., "common", "pages.home") */
  namespace: string;

  /** Final key segment (e.g., "submit") */
  name: string;

  /** How the key was generated */
  source: 'component' | 'attribute' | 'content' | 'inferred';

  /** Confidence in the key suggestion (0-1) */
  confidence: number;
}

/**
 * Code transformation for fixing hardcoded string
 */
export interface CodeFix {
  /** Original code snippet */
  original: string;

  /** Suggested replacement code */
  replacement: string;

  /** Required imports to add */
  imports: string[];
}

/**
 * Recommendation for extracting a hardcoded string to i18n
 */
export interface I18nRecommendation {
  /** Unique recommendation ID */
  id: string;

  /** Priority for this recommendation (1 = highest) */
  priority: number;

  /** Category for grouping (always 'i18n') */
  category: 'i18n';

  /** Human-readable title */
  title: string;

  /** Detailed description */
  description: string;

  /** Expected improvement score */
  expectedImprovement: number;

  /** Effort level */
  effort: I18nEffort;

  /** Affected files */
  affectedFiles: string[];

  /** Whether this can be auto-fixed */
  autoFixable: boolean;

  /** The detected hardcoded string */
  detection: HardcodedStringInfo;

  /** Suggested i18n key */
  suggestedKey: SuggestedI18nKey;

  /** Suggested translation values */
  translations: {
    ru: string;
    en?: string;
  };

  /** Code transformation suggestion */
  codeFix: CodeFix;
}

// ============================================================================
// ANALYSIS RESULT TYPES
// ============================================================================

/**
 * Analysis status for a file
 */
export type AnalysisStatus = 'analyzed' | 'skipped' | 'error';

/**
 * File-level i18n analysis result
 */
export interface FileI18nAnalysis {
  /** Relative file path */
  file: string;

  /** Detected hardcoded strings */
  strings: HardcodedStringInfo[];

  /** Analysis status */
  status: AnalysisStatus;

  /** Skip reason if status is 'skipped' */
  skipReason?: string;

  /** Error message if status is 'error' */
  error?: string;

  /** Analysis duration in ms */
  durationMs?: number;
}

/**
 * Component-level grouping of hardcoded strings
 */
export interface ComponentI18nGroup {
  /** Component name */
  componentName: string;

  /** File path */
  file: string;

  /** All detected strings in this component */
  strings: HardcodedStringInfo[];

  /** Recommended namespace for this component's translations */
  suggestedNamespace: string;
}

/**
 * Statistics about the i18n analysis
 */
export interface I18nAnalysisStats {
  /** Total files analyzed */
  filesAnalyzed: number;

  /** Total files skipped */
  filesSkipped: number;

  /** Total files with errors */
  filesWithErrors: number;

  /** Total hardcoded strings found */
  totalStrings: number;

  /** Breakdown by language */
  byLanguage: Record<DetectedLanguage, number>;

  /** Breakdown by context */
  byContext: Record<StringContext, number>;

  /** Breakdown by priority level */
  byPriority: Record<I18nPriority, number>;

  /** Breakdown by category */
  byCategory: Record<TextCategory, number>;

  /** Analysis duration in ms */
  durationMs: number;
}

/**
 * Complete i18n analysis result
 */
export interface I18nAnalysisResult {
  /** File-level analysis results */
  files: FileI18nAnalysis[];

  /** Component-level groupings */
  componentGroups: ComponentI18nGroup[];

  /** Generated recommendations */
  recommendations: I18nRecommendation[];

  /** Analysis statistics */
  stats: I18nAnalysisStats;

  /** Suggested new translation keys to add */
  suggestedTranslations: {
    /** Keys to add to ru.ts */
    ru: Record<string, string>;
    /** Keys to add to en.ts (auto-translated or empty) */
    en: Record<string, string>;
  };

  /** Analysis timestamp */
  timestamp: string;

  /** Project root path */
  projectRoot: string;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Options for i18n analysis
 */
export interface I18nAnalyzerOptions {
  /** Root path to analyze */
  rootPath: string;

  /** Specific files to analyze (if not provided, scans all) */
  files?: string[];

  /** Minimum string length to consider (default: 2) */
  minLength?: number;

  /** Maximum string length to consider (default: 500) */
  maxLength?: number;

  /** Languages to detect (default: ['ru', 'en']) */
  languages?: DetectedLanguage[];

  /** Whether to include JSX text content (default: true) */
  includeJsxText?: boolean;

  /** Whether to include JSX attributes (default: true) */
  includeJsxAttributes?: boolean;

  /** Whether to include string literals (default: true) */
  includeStringLiterals?: boolean;

  /** Whether to include template literals (default: true) */
  includeTemplateLiterals?: boolean;

  /** Custom skip file patterns */
  skipFilePatterns?: RegExp[];

  /** Custom skip string patterns */
  skipStringPatterns?: RegExp[];

  /** Existing translation keys (to avoid duplicates) */
  existingKeys?: Set<string>;

  /** Path to i18n config for namespace detection */
  i18nConfigPath?: string;

  /** Verbose output */
  verbose?: boolean;

  /** Maximum files to analyze (for testing) */
  limit?: number;
}

/**
 * Default options for i18n analyzer
 */
export const DEFAULT_I18N_OPTIONS: Required<
  Omit<I18nAnalyzerOptions, 'rootPath' | 'files' | 'existingKeys' | 'i18nConfigPath'>
> = {
  minLength: 2,
  maxLength: 500,
  languages: ['ru', 'en'],
  includeJsxText: true,
  includeJsxAttributes: true,
  includeStringLiterals: true,
  includeTemplateLiterals: true,
  skipFilePatterns: [],
  skipStringPatterns: [],
  verbose: false,
  limit: 0,
};
