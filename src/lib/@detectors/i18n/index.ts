/**
 * @module lib/@detectors/i18n
 * @description Detection patterns for i18n hardcoded strings
 *
 * Detects:
 * - Russian (Cyrillic) text in JSX and string literals
 * - User-facing text in specific JSX attributes
 * - Skips technical strings, paths, and configuration
 */

// ============================================================================
// LANGUAGE DETECTION PATTERNS
// ============================================================================

/**
 * Pattern for detecting any Cyrillic character
 */
export const CYRILLIC_PATTERN = /[\u0400-\u04FF]/;

/**
 * Pattern for detecting significant Russian text (2+ Cyrillic chars)
 */
export const RUSSIAN_TEXT_PATTERN = /[А-Яа-яЁё]{2,}/;

/**
 * Pattern for detecting English text with words (3+ letters)
 */
export const ENGLISH_TEXT_PATTERN = /[A-Za-z]{3,}/;

/**
 * Minimum length for a string to be considered user-facing
 */
export const MIN_USER_FACING_LENGTH = 2;

/**
 * Maximum length for analysis (very long strings are likely data)
 */
export const MAX_STRING_LENGTH = 500;

// ============================================================================
// JSX ATTRIBUTE PATTERNS
// ============================================================================

/**
 * JSX attribute names that typically contain user-facing text
 */
export const I18N_RELEVANT_ATTRIBUTES = new Set([
  // Common UI attributes
  'placeholder',
  'title',
  'alt',
  'label',
  'description',
  'helperText',
  'errorMessage',
  'successMessage',
  'tooltip',
  'hint',
  'caption',
  'header',
  'footer',

  // Accessibility
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-valuetext',

  // Action text
  'buttonText',
  'linkText',
  'submitText',
  'cancelText',
  'confirmText',
  'closeText',
  'loadingText',

  // Content
  'message',
  'text',
  'content',
  'emptyText',
  'noDataText',
]);

/**
 * JSX attribute names to always skip (technical, not user-facing)
 */
export const SKIP_ATTRIBUTES = new Set([
  // Styling
  'className',
  'class',
  'style',

  // Technical identifiers
  'id',
  'key',
  'ref',
  'name', // Form field name, not user-facing

  // URLs and paths
  'href',
  'src',
  'action',
  'to',
  'path',

  // Input types
  'type',
  'inputMode',
  'autoComplete',
  'pattern',

  // Testing
  'data-testid',
  'data-cy',
  'data-test',

  // Layout
  'role',
  'tabIndex',
  'htmlFor',

  // Values (controlled inputs)
  'value',
  'defaultValue',
  'checked',
  'defaultChecked',

  // Event handlers
  'onClick',
  'onChange',
  'onSubmit',
  'onBlur',
  'onFocus',
]);

// ============================================================================
// SKIP PATTERNS
// ============================================================================

/**
 * File patterns to skip for i18n detection
 */
export const I18N_SKIP_FILE_PATTERNS: RegExp[] = [
  // Tests
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /\.stories\.(ts|tsx|js|jsx)$/,
  /__tests__\//,
  /__mocks__\//,

  // Type definitions
  /\.d\.ts$/,

  // Existing translations
  /i18n\/locales?\//,
  /translations?\//,
  /lang\//,

  // Configuration
  /\.config\.(ts|js|mjs|cjs)$/,
  /config\//,
  /constants?\//,
  /types?\//,
  /schemas?\//,

  // Build artifacts
  /dist\//,
  /build\//,
  /\.next\//,
  /node_modules\//,
];

/**
 * String content patterns that are technical (not user-facing)
 */
export const TECHNICAL_STRING_PATTERNS: RegExp[] = [
  // CSS/styling
  /^#[0-9A-Fa-f]{3,8}$/, // Hex colors
  /^(px|em|rem|%|vh|vw|fr|auto|inherit|initial|unset)$/,
  /^(flex|grid|block|inline|none|hidden|visible)$/,
  /^(absolute|relative|fixed|sticky|static)$/,

  // Technical identifiers
  /^[a-z]+[-_][a-z]+[-_]?[a-z]*$/, // kebab-case/snake_case
  /^[A-Z][A-Z0-9_]+$/, // SCREAMING_SNAKE_CASE
  /^[a-f0-9-]{36}$/i, // UUIDs

  // Numbers
  /^\d+(\.\d+)?$/, // Pure numbers
  /^0x[0-9A-Fa-f]+$/, // Hex numbers

  // URLs and paths
  /^https?:\/\//, // URLs
  /^\/[a-zA-Z0-9/_-]+$/, // Absolute paths
  /^\.\.?\//, // Relative paths
  /^[a-zA-Z]:[\\/]/, // Windows paths

  // Code patterns
  /^[a-z]+\.[a-z]+(\.[a-z]+)*$/, // dot.notation.path
  /^\$\{.*\}$/, // Template expression only
  /^[<>{}[\]()]+$/, // Only brackets

  // Common technical values
  /^(true|false|null|undefined|NaN|Infinity)$/,
  /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/,
  /^(asc|desc|ASC|DESC)$/,
  /^(sm|md|lg|xl|2xl|3xl)$/, // Tailwind breakpoints

  // File extensions
  /^\.[a-z0-9]+$/i,

  // Empty or whitespace only
  /^\s*$/,
];

/**
 * Patterns indicating i18n is already in use
 */
export const I18N_FUNCTION_PATTERNS: RegExp[] = [
  /\bt\s*\(/, // t() function
  /\buseTranslation\s*\(/, // useTranslation hook
  /\buseTranslate\s*\(/, // useTranslate hook
  /\bformatMessage\s*\(/, // react-intl
  /\bi18n\./, // i18n namespace
  /\btrans\s*\(/, // trans function
  /\b__\s*\(/, // __ function (gettext style)
];

// ============================================================================
// PRIORITY CONFIGURATION
// ============================================================================

/**
 * Priority weights by context type
 * Lower number = higher priority
 */
export const CONTEXT_PRIORITY: Record<string, number> = {
  // Highest priority - always visible UI
  'jsx-text': 1,
  'jsx-attribute:title': 1,
  'jsx-attribute:placeholder': 1,
  'jsx-attribute:aria-label': 1,
  'jsx-attribute:label': 1,

  // High priority - messages and descriptions
  'jsx-attribute:errorMessage': 2,
  'jsx-attribute:successMessage': 2,
  'jsx-attribute:helperText': 2,
  'jsx-attribute:description': 2,
  'string-literal:toast': 2,
  'string-literal:error': 2,
  'template-literal': 2,

  // Medium priority - less visible
  'jsx-attribute:alt': 3,
  'jsx-attribute:tooltip': 3,
  'jsx-attribute:hint': 3,
  'object-property': 3,
  'string-literal': 3,

  // Lower priority - edge cases
  conditional: 4,
  'array-element': 4,
};

/**
 * Text category detection based on context
 */
export const CATEGORY_BY_ATTRIBUTE: Record<string, string> = {
  placeholder: 'placeholder',
  title: 'title',
  label: 'ui-label',
  description: 'description',
  helperText: 'description',
  hint: 'description',
  'aria-label': 'ui-label',
  'aria-description': 'description',
  alt: 'description',
  tooltip: 'tooltip',
  errorMessage: 'validation',
  successMessage: 'message',
  message: 'message',
  caption: 'description',
  header: 'title',
  footer: 'description',
  buttonText: 'action',
  linkText: 'navigation',
  submitText: 'action',
  cancelText: 'action',
  confirmText: 'action',
};

/**
 * Text category detection based on parent component
 */
export const CATEGORY_BY_COMPONENT: Record<string, string> = {
  Button: 'action',
  IconButton: 'action',
  Link: 'navigation',
  NavLink: 'navigation',
  Modal: 'modal',
  Dialog: 'modal',
  Drawer: 'modal',
  Sheet: 'modal',
  Toast: 'toast',
  Toaster: 'toast',
  Alert: 'message',
  AlertDialog: 'modal',
  Breadcrumb: 'navigation',
  Nav: 'navigation',
  Navbar: 'navigation',
  Menu: 'navigation',
  MenuItem: 'navigation',
  Tab: 'navigation',
  Tabs: 'navigation',
  Form: 'ui-label',
  FormField: 'ui-label',
  Input: 'placeholder',
  TextInput: 'placeholder',
  Textarea: 'placeholder',
  Select: 'placeholder',
  Tooltip: 'tooltip',
  Table: 'title',
  TableHeader: 'title',
  Card: 'title',
  CardTitle: 'title',
  CardDescription: 'description',
  Badge: 'ui-label',
  Label: 'ui-label',
  Heading: 'title',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a string contains significant Cyrillic text
 */
export function hasCyrillicText(text: string): boolean {
  return RUSSIAN_TEXT_PATTERN.test(text);
}

/**
 * Check if a string is primarily Russian
 */
export function isRussianText(text: string): boolean {
  if (!CYRILLIC_PATTERN.test(text)) return false;

  // Count Cyrillic vs Latin characters
  const cyrillicCount = (text.match(/[А-Яа-яЁё]/g) ?? []).length;
  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;

  // Primarily Russian if more Cyrillic than Latin
  return cyrillicCount > latinCount;
}

/**
 * Check if a string matches any technical pattern
 */
export function isTechnicalString(text: string): boolean {
  // Too short or too long
  if (text.length < MIN_USER_FACING_LENGTH || text.length > MAX_STRING_LENGTH) {
    return true;
  }

  // Check against technical patterns
  return TECHNICAL_STRING_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Check if a file should be skipped for i18n analysis
 */
export function shouldSkipFile(filePath: string): boolean {
  return I18N_SKIP_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Check if an attribute is relevant for i18n
 */
export function isI18nRelevantAttribute(attrName: string): boolean {
  return I18N_RELEVANT_ATTRIBUTES.has(attrName) && !SKIP_ATTRIBUTES.has(attrName);
}

/**
 * Get priority for a context type
 */
export function getPriority(context: string): number {
  return CONTEXT_PRIORITY[context] ?? 5;
}

/**
 * Get category from attribute name
 */
export function getCategoryFromAttribute(attrName: string): string | null {
  return CATEGORY_BY_ATTRIBUTE[attrName] ?? null;
}

/**
 * Get category from component name
 */
export function getCategoryFromComponent(componentName: string): string | null {
  return CATEGORY_BY_COMPONENT[componentName] ?? null;
}
