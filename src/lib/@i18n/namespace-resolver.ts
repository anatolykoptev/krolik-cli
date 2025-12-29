/**
 * @module lib/@i18n/namespace-resolver
 * @description Project-structure-aware namespace detection for i18n keys
 *
 * Detects appropriate namespaces from file paths based on project conventions.
 * Supports monorepo structures with apps/web, packages/ui, etc.
 *
 * @example
 * ```typescript
 * import { detectNamespace } from '@/lib/@i18n/namespace-resolver';
 *
 * detectNamespace('apps/web/app/panel/events/page.tsx');
 * // => 'panel.events'
 *
 * detectNamespace('apps/web/components/cards/PlaceCard.tsx');
 * // => 'components.cards'
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Namespace detection rule.
 *
 * Each rule maps a path pattern to a namespace generator function.
 * Rules are ordered by priority and checked sequentially.
 */
export interface NamespaceRule {
  /** Pattern to match against file path */
  readonly pattern: RegExp;
  /** Function to extract namespace from match groups */
  readonly namespace: (match: RegExpMatchArray) => string;
  /** Rule priority (higher = checked first) */
  readonly priority: number;
  /** Optional description for debugging */
  readonly description?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalizes a namespace part by converting to lowercase and removing special characters.
 *
 * Transformations applied:
 * - Removes route group markers like (public)
 * - Removes file extensions
 * - Converts kebab-case to dot-separated notation
 * - Converts to lowercase
 *
 * @param part - Raw namespace part from path
 * @returns Normalized namespace part
 *
 * @example
 * ```typescript
 * normalizeNamespacePart('(public)');
 * // => 'public'
 *
 * normalizeNamespacePart('event-list');
 * // => 'event.list'
 *
 * normalizeNamespacePart('PlaceCard.tsx');
 * // => 'placecard'
 * ```
 */
export function normalizeNamespacePart(part: string): string {
  // Remove route group markers like (public)
  let normalized = part.replace(/^\(|\)$/g, '');

  // Remove file extensions
  normalized = normalized.replace(/\.[^.]+$/, '');

  // Convert kebab-case to dot-separated notation
  normalized = normalized.replace(/-([a-z])/g, (_, c: string) => `.${c}`);

  // Convert to lowercase
  normalized = normalized.toLowerCase();

  return normalized;
}

/**
 * Validates namespace format.
 *
 * Valid namespaces:
 * - Start with lowercase letter
 * - End with lowercase letter or digit
 * - Contain only lowercase letters, digits, and dots
 * - Have at least 2 characters
 *
 * @param namespace - Namespace string to validate
 * @returns True if namespace is valid
 */
function isValidNamespace(namespace: string): boolean {
  return namespace.length > 0 && /^[a-z][a-z0-9.]*[a-z0-9]$/.test(namespace);
}

// ============================================================================
// NAMESPACE RULES
// ============================================================================

/**
 * Ordered list of namespace detection rules for the project structure.
 * Rules are checked in order of priority (highest first).
 *
 * Rule categories:
 * - Priority 100: Specific app routes (panel, public, auth)
 * - Priority 90: Component library
 * - Priority 85: UI package
 * - Priority 80: Generic app routes
 * - Priority 75: Mobile app
 * - Priority 70: Shared packages (shared, api)
 * - Priority 60: Generic lib folder
 * - Priority 50: Generic src folder
 */
export const NAMESPACE_RULES: readonly NamespaceRule[] = [
  // Admin panel pages: apps/web/app/panel/{feature}/... -> panel.{feature}
  {
    pattern: /apps\/web\/app\/panel\/([^/]+)/,
    namespace: (m: RegExpMatchArray) => `panel.${normalizeNamespacePart(m[1] ?? '')}`,
    priority: 100,
    description: 'Admin panel pages',
  },
  // Public pages: apps/web/app/(public)/{feature}/... -> public.{feature}
  {
    pattern: /apps\/web\/app\/\(public\)\/([^/]+)/,
    namespace: (m: RegExpMatchArray) => `public.${normalizeNamespacePart(m[1] ?? '')}`,
    priority: 100,
    description: 'Public pages',
  },
  // Auth pages: apps/web/app/(auth)/... -> auth
  {
    pattern: /apps\/web\/app\/\(auth\)/,
    namespace: () => 'auth',
    priority: 100,
    description: 'Auth pages',
  },
  // Generic app routes: apps/web/app/{route}/... -> pages.{route}
  {
    pattern: /apps\/web\/app\/([a-z][^/]*)/,
    namespace: (m: RegExpMatchArray) => `pages.${normalizeNamespacePart(m[1] ?? '')}`,
    priority: 80,
    description: 'Generic app routes',
  },
  // Component library: apps/web/components/{category}/... -> components.{category}
  {
    pattern: /apps\/web\/components\/([^/]+)/,
    namespace: (m: RegExpMatchArray) => `components.${normalizeNamespacePart(m[1] ?? '')}`,
    priority: 90,
    description: 'Component library',
  },
  // UI package: packages/ui/src/{component}/... -> ui.{component}
  {
    pattern: /packages\/ui\/src\/([^/]+)/,
    namespace: (m: RegExpMatchArray) => `ui.${normalizeNamespacePart(m[1] ?? '')}`,
    priority: 85,
    description: 'UI package',
  },
  // Shared package: packages/shared/... -> shared
  {
    pattern: /packages\/shared/,
    namespace: () => 'shared',
    priority: 70,
    description: 'Shared package',
  },
  // API package: packages/api/... -> api
  {
    pattern: /packages\/api/,
    namespace: () => 'api',
    priority: 70,
    description: 'API package',
  },
  // Mobile app: apps/mobile/... -> mobile
  {
    pattern: /apps\/mobile/,
    namespace: () => 'mobile',
    priority: 75,
    description: 'Mobile app',
  },
  // Generic lib folder: lib/{module}/... -> lib.{module}
  {
    pattern: /lib\/([^/]+)/,
    namespace: (m: RegExpMatchArray) => `lib.${normalizeNamespacePart(m[1] ?? '')}`,
    priority: 60,
    description: 'Lib folder',
  },
  // Generic src folder: src/{module}/... -> {module}
  {
    pattern: /src\/([^/]+)/,
    namespace: (m: RegExpMatchArray) => normalizeNamespacePart(m[1] ?? ''),
    priority: 50,
    description: 'Src folder',
  },
].sort((a, b) => b.priority - a.priority);

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Detects the appropriate i18n namespace from a file path.
 * Uses project structure conventions to determine the namespace.
 *
 * @param filePath - Relative or absolute file path
 * @returns Detected namespace string, or 'common' if no match
 *
 * @example
 * ```typescript
 * detectNamespace('apps/web/app/panel/events/page.tsx');
 * // => 'panel.events'
 *
 * detectNamespace('apps/web/components/cards/PlaceCard.tsx');
 * // => 'components.cards'
 *
 * detectNamespace('apps/web/app/(public)/explore/page.tsx');
 * // => 'public.explore'
 *
 * detectNamespace('packages/ui/src/Button/index.tsx');
 * // => 'ui.button'
 *
 * detectNamespace('some/unknown/path.ts');
 * // => 'common'
 * ```
 */
export function detectNamespace(filePath: string): string {
  if (!filePath) {
    return 'common';
  }

  // Normalize path separators for cross-platform compatibility
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Try each rule in priority order
  for (const rule of NAMESPACE_RULES) {
    const match = normalizedPath.match(rule.pattern);
    if (match) {
      const namespace = rule.namespace(match);
      if (isValidNamespace(namespace)) {
        return namespace;
      }
    }
  }

  return 'common';
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a custom namespace rule.
 *
 * Use this to extend the default rules with project-specific patterns.
 *
 * @param pattern - RegExp pattern to match against file paths
 * @param namespace - Function to extract namespace from match groups
 * @param priority - Rule priority (default: 50)
 * @param description - Optional description for debugging
 * @returns New namespace rule
 *
 * @example
 * ```typescript
 * const customRule = createNamespaceRule(
 *   /apps\/admin\/([^/]+)/,
 *   (m) => `admin.${normalizeNamespacePart(m[1] ?? '')}`,
 *   95,
 *   'Admin app routes'
 * );
 * ```
 */
export function createNamespaceRule(
  pattern: RegExp,
  namespace: (match: RegExpMatchArray) => string,
  priority: number = 50,
  description?: string,
): NamespaceRule {
  return description !== undefined
    ? { pattern, namespace, priority, description }
    : { pattern, namespace, priority };
}

/**
 * Creates a namespace detector with custom rules.
 *
 * Allows extending or replacing the default rules for specific projects.
 *
 * @param customRules - Additional rules to merge with defaults
 * @param replaceDefaults - If true, only use custom rules (default: false)
 * @returns Custom detectNamespace function
 *
 * @example
 * ```typescript
 * const customDetector = createNamespaceDetector([
 *   createNamespaceRule(
 *     /apps\/admin\/([^/]+)/,
 *     (m) => `admin.${normalizeNamespacePart(m[1] ?? '')}`,
 *     95
 *   )
 * ]);
 *
 * customDetector('apps/admin/users/page.tsx');
 * // => 'admin.users'
 * ```
 */
export function createNamespaceDetector(
  customRules: readonly NamespaceRule[],
  replaceDefaults: boolean = false,
): (filePath: string) => string {
  const rules = replaceDefaults
    ? [...customRules].sort((a, b) => b.priority - a.priority)
    : [...customRules, ...NAMESPACE_RULES].sort((a, b) => b.priority - a.priority);

  return (filePath: string): string => {
    if (!filePath) {
      return 'common';
    }

    const normalizedPath = filePath.replace(/\\/g, '/');

    for (const rule of rules) {
      const match = normalizedPath.match(rule.pattern);
      if (match) {
        const namespace = rule.namespace(match);
        if (isValidNamespace(namespace)) {
          return namespace;
        }
      }
    }

    return 'common';
  };
}
