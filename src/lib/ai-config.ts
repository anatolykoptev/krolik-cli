/**
 * AI Configuration & Namespace Map
 *
 * This file defines the semantic structure of the codebase for AI assistants.
 * It provides context about what each namespace contains and how to navigate the code.
 *
 * @ai-context This is the PRIMARY reference for understanding project structure
 * @generated 2025-12-23T00:57:37.261Z
 * @generator krolik-cli refine --generate-config
 */

// ============================================================================
// NAMESPACE DEFINITIONS
// ============================================================================

export const AI_NAMESPACES = {
  /**
   * @utils — Common utility functions used across the codebase
   * Common utility functions used across the codebase
   */
  '@utils': {
    path: 'lib/@utils',
    description: 'Shared utilities and helpers',
    modules: {
      ast: '4 files',
      discovery: '4 files',
      formatters: '5 files',
    },
    dependsOn: [],
    usedBy: ["@core","@domain","@ui"],
  },
} as const;

// ============================================================================
// COMPONENT STRUCTURE MAP (customize for your project)
// ============================================================================

export const AI_COMPONENT_STRUCTURE = {
  /**
   * components/features/ — Feature components organized by domain
   */
  'features': {
    path: 'components/features',
    description: 'Domain-specific feature components',
    domains: {},
  },

  /**
   * components/shared/ — Cross-feature shared components
   */
  'shared': {
    path: 'components/shared',
    description: 'Shared components used across features',
    components: [],
  },

  /**
   * components/layouts/ — Page layouts
   */
  'layouts': {
    path: 'components/layouts',
    description: 'Page layout components',
    components: [],
  },
} as const;

// ============================================================================
// AI NAVIGATION HELPERS
// ============================================================================

/**
 * Quick reference for common tasks
 * @ai-hint Use this to find the right location for new code
 */
export const AI_QUICK_REFERENCE = {
  // Where to add new code
  newServerLogic: '@domain or packages/api/routers',
  newClientHook: '@ui/hooks',
  newUtility: '@core/utils',
  newConstant: '@domain/data',
  newIntegration: '@integrations',
  newComponent: 'components/features/<domain>',

  // Import patterns
  imports: {
    auth: "import { auth } from '@/src/lib/@core/auth'",
    hooks: "import { useHook } from '@/src/lib/@ui/hooks'",
    utils: "import { util } from '@/src/lib/@core/utils'",
    data: "import { DATA } from '@/src/lib/@domain/data'",
    seo: "import { generateMetadata } from '@/src/lib/@seo'",
  },

  // File naming conventions
  naming: {
    components: 'PascalCase.tsx (e.g., PlaceCard.tsx)',
    hooks: 'camelCase with use prefix (e.g., useFavorites.ts)',
    utils: 'camelCase.ts (e.g., formatDate.ts)',
    constants: 'camelCase.ts or UPPER_SNAKE_CASE exports',
    types: 'types.ts within module directory',
  },
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type NamespaceKey = keyof typeof AI_NAMESPACES;
export type ComponentStructureKey = keyof typeof AI_COMPONENT_STRUCTURE;
