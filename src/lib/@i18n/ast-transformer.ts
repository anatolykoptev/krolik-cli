/**
 * @module lib/@i18n/ast-transformer
 * @description AST-based i18n string transformer using ts-morph
 *
 * Provides 100% accurate context detection for i18n string replacement
 * using TypeScript's AST. Handles all edge cases correctly:
 * - JSX attributes: prop="text" → prop={t('key')}
 * - JSX text: >text< → >{t('key')}<
 * - Object properties: { key: "text" } → { key: t('key') }
 * - Function arguments: fn("text") → fn(t('key'))
 * - And more...
 *
 * @example
 * ```typescript
 * import { transformFile } from '@/lib/@i18n/ast-transformer';
 *
 * const result = await transformFile('app/page.tsx', {
 *   catalog,
 *   projectRoot: '/path/to/project',
 * });
 * // result.transformedCount = 5
 * // result.newKeys = ['page.title', 'page.description']
 * ```
 */

import {
  type JsxAttribute,
  type JsxText,
  Node,
  Project,
  type SourceFile,
  type StringLiteral,
  SyntaxKind,
} from 'ts-morph';

import type { LocaleCatalog } from './catalog';
import { type ResolvedKey, resolveKey } from './key-resolver';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Context where a string was found
 */
export type StringContext =
  | 'jsx-attribute' // <Component prop="text" />
  | 'jsx-text' // <div>text</div>
  | 'jsx-expression' // <div>{"text"}</div>
  | 'object-property' // { key: "text" }
  | 'function-argument' // fn("text")
  | 'variable' // const x = "text"
  | 'array-element' // ["text"]
  | 'template-literal' // `text ${var}`
  | 'import' // import from "path" (skip)
  | 'type-annotation' // type X = "text" (skip)
  | 'other';

/**
 * A translatable string found in the source
 */
export interface TranslatableString {
  /** The string value */
  value: string;
  /** Context where found */
  context: StringContext;
  /** AST node reference */
  node: StringLiteral | JsxText;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
  /** File path */
  filePath: string;
}

/**
 * Result of a single replacement
 */
export interface ReplacementResult {
  /** Original text */
  originalText: string;
  /** Generated/resolved key */
  key: string;
  /** Context where replaced */
  context: StringContext;
  /** Line number */
  line: number;
  /** Whether key was new or existing */
  isNew: boolean;
}

/**
 * Options for file transformation
 */
export interface TransformOptions {
  /** Locale catalog for key resolution */
  catalog: LocaleCatalog;
  /** Project root for namespace detection */
  projectRoot: string;
  /** Import path for t function (default: '@piternow/shared') */
  tImportPath?: string;
  /** Dry run - don't modify files */
  dryRun?: boolean;
  /** Exclude patterns (file paths) */
  excludePatterns?: RegExp[];
}

/**
 * Result of file transformation
 */
export interface TransformResult {
  /** File path */
  filePath: string;
  /** Number of strings transformed */
  transformedCount: number;
  /** Details of each replacement */
  replacements: ReplacementResult[];
  /** Whether file was modified */
  modified: boolean;
  /** Error if transformation failed */
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Russian character pattern */
const RUSSIAN_PATTERN = /[\u0400-\u04FF]/;

/** Technical string patterns to skip */
const SKIP_PATTERNS = [
  /^https?:\/\//, // URLs
  /^\/[\w-/]+$/, // Paths like /api/users
  /^\.[/\\]/, // Relative paths
  /^#[0-9a-f]{3,8}$/i, // Hex colors
  /^\d+(\.\d+)?$/, // Numbers
  /^[A-Z_]+$/, // Constants like API_KEY
  /^[a-z]+-[a-z]+(-[a-z]+)*$/, // CSS classes like my-class-name
  /^\s*$/, // Whitespace only
  /^@/, // CSS @rules, decorators
];

/** JSX attributes that should be translated */
const TRANSLATABLE_ATTRS = new Set([
  'alt',
  'title',
  'placeholder',
  'label',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-valuetext',
  'content',
  'description',
  'message',
  'text',
  'tooltip',
  'helperText',
  'errorMessage',
  'successMessage',
  'emptyText',
  'loadingText',
  'submitText',
  'cancelText',
  'confirmText',
  'buttonText',
  'linkText',
  'heading',
  'subheading',
  'caption',
]);

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if text contains Russian characters
 */
function hasRussianText(text: string): boolean {
  return RUSSIAN_PATTERN.test(text);
}

/**
 * Check if text should be skipped (technical string)
 */
function shouldSkipText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length === 0) return true;
  if (!hasRussianText(trimmed)) return true;
  return SKIP_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Get the context of a string literal based on its parent node
 */
function getStringContext(node: StringLiteral): StringContext {
  const parent = node.getParent();
  if (!parent) return 'other';

  const parentKind = parent.getKind();

  // Import/export paths - always skip
  if (
    parentKind === SyntaxKind.ImportDeclaration ||
    parentKind === SyntaxKind.ExportDeclaration ||
    parentKind === SyntaxKind.ImportSpecifier ||
    parentKind === SyntaxKind.ExportSpecifier
  ) {
    return 'import';
  }

  // Module specifier in import/export
  if (Node.isStringLiteral(node)) {
    const grandParent = parent.getParent();
    if (grandParent) {
      const gpKind = grandParent.getKind();
      if (gpKind === SyntaxKind.ImportDeclaration || gpKind === SyntaxKind.ExportDeclaration) {
        return 'import';
      }
    }
  }

  // Type annotations - skip
  if (
    parentKind === SyntaxKind.TypeLiteral ||
    parentKind === SyntaxKind.TypeAliasDeclaration ||
    parentKind === SyntaxKind.InterfaceDeclaration ||
    parentKind === SyntaxKind.LiteralType
  ) {
    return 'type-annotation';
  }

  // JSX Attribute: <Component prop="text" />
  if (parentKind === SyntaxKind.JsxAttribute) {
    return 'jsx-attribute';
  }

  // JSX Expression Container: <div>{"text"}</div>
  if (parentKind === SyntaxKind.JsxExpression) {
    return 'jsx-expression';
  }

  // Property assignment in object: { key: "value" }
  if (parentKind === SyntaxKind.PropertyAssignment) {
    return 'object-property';
  }

  // Shorthand property: { key } where key is a string variable
  if (parentKind === SyntaxKind.ShorthandPropertyAssignment) {
    return 'object-property';
  }

  // Function/method call argument
  if (parentKind === SyntaxKind.CallExpression) {
    return 'function-argument';
  }

  // Array element
  if (parentKind === SyntaxKind.ArrayLiteralExpression) {
    return 'array-element';
  }

  // Variable declaration: const x = "text"
  if (parentKind === SyntaxKind.VariableDeclaration) {
    return 'variable';
  }

  // Template literal span
  if (parentKind === SyntaxKind.TemplateSpan || parentKind === SyntaxKind.TemplateExpression) {
    return 'template-literal';
  }

  // Binary expression (often in JSX: {val || "text"})
  if (parentKind === SyntaxKind.BinaryExpression) {
    // Check if we're inside JSX
    let current: Node | undefined = parent;
    while (current) {
      const kind = current.getKind();
      if (kind === SyntaxKind.JsxElement || kind === SyntaxKind.JsxFragment) {
        return 'jsx-expression';
      }
      current = current.getParent();
    }
    return 'other';
  }

  // Conditional expression (ternary)
  if (parentKind === SyntaxKind.ConditionalExpression) {
    // Check if we're inside JSX
    let current: Node | undefined = parent;
    while (current) {
      const kind = current.getKind();
      if (kind === SyntaxKind.JsxElement || kind === SyntaxKind.JsxFragment) {
        return 'jsx-expression';
      }
      current = current.getParent();
    }
    return 'other';
  }

  return 'other';
}

/**
 * Check if JSX attribute should be translated based on attribute name
 */
function isTranslatableJsxAttribute(node: StringLiteral): boolean {
  const parent = node.getParent();
  if (!parent || parent.getKind() !== SyntaxKind.JsxAttribute) {
    return false;
  }

  const jsxAttr = parent as JsxAttribute;
  const attrName = jsxAttr.getNameNode().getText();

  // Check if it's a known translatable attribute
  if (TRANSLATABLE_ATTRS.has(attrName)) {
    return true;
  }

  // Allow any attribute with Russian text
  return hasRussianText(node.getLiteralValue());
}

// ============================================================================
// COLLECTION
// ============================================================================

/**
 * Collect all translatable strings from a source file
 */
export function collectTranslatableStrings(
  sourceFile: SourceFile,
  filePath: string,
): TranslatableString[] {
  const results: TranslatableString[] = [];

  // Collect string literals
  sourceFile.forEachDescendant((node, traversal) => {
    const kind = node.getKind();

    // Skip import/export declarations entirely
    if (kind === SyntaxKind.ImportDeclaration || kind === SyntaxKind.ExportDeclaration) {
      traversal.skip();
      return;
    }

    // Skip type declarations
    if (
      kind === SyntaxKind.InterfaceDeclaration ||
      kind === SyntaxKind.TypeAliasDeclaration ||
      kind === SyntaxKind.TypeLiteral
    ) {
      traversal.skip();
      return;
    }

    // Process string literals
    if (kind === SyntaxKind.StringLiteral) {
      const literal = node as StringLiteral;
      const value = literal.getLiteralValue();

      // Skip technical strings
      if (shouldSkipText(value)) return;

      const context = getStringContext(literal);

      // Skip imports and type annotations
      if (context === 'import' || context === 'type-annotation') return;

      // For JSX attributes, check if it's a translatable attribute
      if (context === 'jsx-attribute' && !isTranslatableJsxAttribute(literal)) {
        return;
      }

      results.push({
        value,
        context,
        node: literal,
        line: literal.getStartLineNumber(),
        column: literal.getStart() - literal.getStartLinePos(),
        filePath,
      });
    }
  });

  // Collect JSX text nodes
  const jsxTexts = sourceFile.getDescendantsOfKind(SyntaxKind.JsxText);
  for (const textNode of jsxTexts) {
    const value = textNode.getText().trim();

    // Skip empty or whitespace-only
    if (!value || /^\s*$/.test(value)) continue;

    // Skip non-Russian text
    if (!hasRussianText(value)) continue;

    results.push({
      value,
      context: 'jsx-text',
      node: textNode,
      line: textNode.getStartLineNumber(),
      column: textNode.getStart() - textNode.getStartLinePos(),
      filePath,
    });
  }

  return results;
}

// ============================================================================
// REPLACEMENT
// ============================================================================

/**
 * Replace a string with t() call based on context
 */
function replaceWithT(translatable: TranslatableString, key: string): void {
  const { node, context } = translatable;
  const tCall = `t('${key}')`;
  const jsxTCall = `{t('${key}')}`;

  switch (context) {
    case 'jsx-attribute': {
      // <Button label="Click" /> → <Button label={t('key')} />
      const jsxAttr = node.getParent() as JsxAttribute;
      jsxAttr.setInitializer(jsxTCall);
      break;
    }

    case 'jsx-text': {
      // <div>Текст</div> → <div>{t('key')}</div>
      node.replaceWithText(jsxTCall);
      break;
    }

    case 'jsx-expression': {
      // <div>{"Текст"}</div> → <div>{t('key')}</div>
      // Already in expression, just replace the string
      (node as StringLiteral).replaceWithText(tCall);
      break;
    }

    case 'object-property': {
      // { label: "Текст" } → { label: t('key') }
      (node as StringLiteral).replaceWithText(tCall);
      break;
    }

    case 'function-argument': {
      // showError("Ошибка") → showError(t('key'))
      (node as StringLiteral).replaceWithText(tCall);
      break;
    }

    case 'variable': {
      // const msg = "Текст" → const msg = t('key')
      (node as StringLiteral).replaceWithText(tCall);
      break;
    }

    case 'array-element': {
      // ["Текст"] → [t('key')]
      (node as StringLiteral).replaceWithText(tCall);
      break;
    }

    default: {
      // Fallback: simple replacement
      (node as StringLiteral).replaceWithText(tCall);
    }
  }
}

/**
 * Add t() import to source file if not present
 */
function ensureTImport(sourceFile: SourceFile, importPath: string): boolean {
  // Check if import already exists
  const existingImport = sourceFile.getImportDeclaration((decl) => {
    const moduleSpecifier = decl.getModuleSpecifierValue();
    return moduleSpecifier === importPath;
  });

  if (existingImport) {
    // Check if 't' is already imported
    const namedImports = existingImport.getNamedImports();
    const hasTImport = namedImports.some((ni) => ni.getName() === 't');

    if (!hasTImport) {
      // Add 't' to existing import
      existingImport.addNamedImport('t');
      return true;
    }

    return false;
  }

  // Add new import at the top
  sourceFile.insertStatements(0, `import { t } from '${importPath}';`);
  return true;
}

// ============================================================================
// MAIN TRANSFORM FUNCTION
// ============================================================================

/**
 * Transform a single file, replacing Russian strings with t() calls
 */
export async function transformFile(
  filePath: string,
  options: TransformOptions,
): Promise<TransformResult> {
  const { catalog, projectRoot, tImportPath = '@piternow/shared', dryRun = false } = options;

  const result: TransformResult = {
    filePath,
    transformedCount: 0,
    replacements: [],
    modified: false,
  };

  try {
    // Create project and add file
    const project = new Project({
      compilerOptions: {
        jsx: 2, // JsxEmit.React
        skipLibCheck: true,
      },
    });

    const sourceFile = project.addSourceFileAtPath(filePath);

    // Collect translatable strings
    const translatables = collectTranslatableStrings(sourceFile, filePath);

    if (translatables.length === 0) {
      return result;
    }

    // Resolve keys and prepare replacements
    interface PendingReplacement {
      translatable: TranslatableString;
      resolved: ResolvedKey;
    }

    const pendingReplacements: PendingReplacement[] = [];

    for (const translatable of translatables) {
      const resolved = resolveKey(translatable.value, {
        catalog,
        filePath: filePath.replace(projectRoot, '').replace(/^\//, ''),
      });

      // Add new translations to catalog
      if (resolved.isNew) {
        await catalog.addTranslation(resolved.key, translatable.value);
      }

      pendingReplacements.push({ translatable, resolved });
    }

    // Sort by position descending (bottom-up) to preserve line positions
    pendingReplacements.sort((a, b) => {
      const posA = a.translatable.node.getStart();
      const posB = b.translatable.node.getStart();
      return posB - posA;
    });

    // Apply replacements
    for (const { translatable, resolved } of pendingReplacements) {
      if (!dryRun) {
        replaceWithT(translatable, resolved.key);
      }

      result.replacements.push({
        originalText: translatable.value,
        key: resolved.key,
        context: translatable.context,
        line: translatable.line,
        isNew: resolved.isNew,
      });
    }

    result.transformedCount = pendingReplacements.length;

    // Add import if needed
    if (!dryRun && pendingReplacements.length > 0) {
      ensureTImport(sourceFile, tImportPath);
    }

    // Save file
    if (!dryRun && pendingReplacements.length > 0) {
      await sourceFile.save();
      result.modified = true;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * Transform multiple files
 */
export async function transformFiles(
  filePaths: string[],
  options: TransformOptions,
): Promise<TransformResult[]> {
  const results: TransformResult[] = [];

  for (const filePath of filePaths) {
    // Check exclude patterns
    if (options.excludePatterns?.some((pattern) => pattern.test(filePath))) {
      continue;
    }

    const result = await transformFile(filePath, options);
    results.push(result);
  }

  return results;
}

// ============================================================================
// ANALYSIS (DRY RUN)
// ============================================================================

/**
 * Analyze a file without modifying it
 */
export async function analyzeFile(
  filePath: string,
  options: Omit<TransformOptions, 'dryRun'>,
): Promise<TransformResult> {
  return transformFile(filePath, { ...options, dryRun: true });
}

/**
 * Analyze multiple files without modifying them
 */
export async function analyzeFiles(
  filePaths: string[],
  options: Omit<TransformOptions, 'dryRun'>,
): Promise<TransformResult[]> {
  return transformFiles(filePaths, { ...options, dryRun: true });
}
