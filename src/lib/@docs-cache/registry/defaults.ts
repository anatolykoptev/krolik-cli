/**
 * @module lib/@docs-cache/registry/defaults
 * @description Default library mappings and topics configuration
 *
 * Contains static configuration for common libraries.
 * These are used as initial seed and fallback when API is unavailable.
 */

/**
 * Default mappings for common packages.
 * Maps npm patterns to Context7 library IDs.
 */
export const DEFAULT_MAPPINGS: ReadonlyArray<{
  readonly patterns: readonly string[];
  readonly context7Id: string;
  readonly displayName: string;
}> = [
  {
    patterns: ['next', 'next.js', 'nextjs', '@next/'],
    context7Id: '/vercel/next.js',
    displayName: 'Next.js',
  },
  { patterns: ['prisma', '@prisma/client'], context7Id: '/prisma/docs', displayName: 'Prisma' },
  {
    patterns: ['trpc', '@trpc/server', '@trpc/client', '@trpc/react-query'],
    context7Id: '/trpc/trpc',
    displayName: 'tRPC',
  },
  { patterns: ['react', 'react-dom'], context7Id: '/facebook/react', displayName: 'React' },
  { patterns: ['typescript'], context7Id: '/microsoft/TypeScript', displayName: 'TypeScript' },
  { patterns: ['zod'], context7Id: '/colinhacks/zod', displayName: 'Zod' },
  {
    patterns: ['tailwindcss', 'tailwind'],
    context7Id: '/tailwindlabs/tailwindcss.com',
    displayName: 'Tailwind CSS',
  },
  {
    patterns: ['drizzle-orm', 'drizzle'],
    context7Id: '/drizzle-team/drizzle-orm',
    displayName: 'Drizzle ORM',
  },
  { patterns: ['expo'], context7Id: '/expo/expo', displayName: 'Expo' },
  { patterns: ['react-native'], context7Id: '/facebook/react-native', displayName: 'React Native' },
  { patterns: ['zustand'], context7Id: '/pmndrs/zustand', displayName: 'Zustand' },
  {
    patterns: ['@tanstack/react-query', '@tanstack/query-core', 'tanstack-query'],
    context7Id: '/TanStack/query',
    displayName: 'TanStack Query',
  },
] as const;

/**
 * Default topics for common libraries.
 * Topics are ordered by typical importance.
 */
export const DEFAULT_TOPICS: ReadonlyMap<string, readonly string[]> = new Map([
  [
    '/trpc/trpc',
    [
      'middleware',
      'procedures',
      'context',
      'authorization',
      'subscriptions',
      'error-handling',
      'adapters',
    ],
  ],
  [
    '/prisma/docs',
    ['transactions', 'relations', 'queries', 'migrations', 'raw-queries', 'middleware', 'client'],
  ],
  [
    '/vercel/next.js',
    [
      'app-router',
      'server-components',
      'data-fetching',
      'middleware',
      'api-routes',
      'caching',
      'routing',
    ],
  ],
  [
    '/colinhacks/zod',
    ['schemas', 'validation', 'transforms', 'refinements', 'error-handling', 'coercion'],
  ],
  ['/facebook/react', ['hooks', 'context', 'suspense', 'server-components', 'state', 'effects']],
  ['/expo/expo', ['navigation', 'camera', 'notifications', 'linking', 'updates', 'router']],
  [
    '/facebook/react-native',
    ['components', 'navigation', 'styling', 'native-modules', 'performance', 'gestures'],
  ],
  ['/pmndrs/zustand', ['middleware', 'persist', 'immer', 'devtools', 'subscriptions', 'selectors']],
  [
    '/TanStack/query',
    ['queries', 'mutations', 'caching', 'prefetching', 'optimistic-updates', 'infinite-queries'],
  ],
  [
    '/microsoft/TypeScript',
    ['generics', 'utility-types', 'decorators', 'modules', 'type-guards', 'mapped-types'],
  ],
  [
    '/drizzle-team/drizzle-orm',
    ['queries', 'relations', 'migrations', 'transactions', 'schemas', 'operators'],
  ],
  [
    '/tailwindlabs/tailwindcss.com',
    ['configuration', 'customization', 'plugins', 'dark-mode', 'responsive', 'animation'],
  ],
]);
