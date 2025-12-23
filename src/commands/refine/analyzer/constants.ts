import type { NamespaceCategory } from '../types';

// ============================================================================
// SKIP DIRECTORIES
// ============================================================================

export const SKIP_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '__tests__',
  '__mocks__',
];

// ============================================================================
// CATEGORY DETECTION
// ============================================================================

export const CATEGORY_PRIORITY: NamespaceCategory[] = [
  'core',
  'domain',
  'integrations',
  'ui',
  'utils',
  'seo',
];

/**
 * Check if name matches a category based on keywords
 */
export function matchesCategory(name: string, category: NamespaceCategory): boolean {
  const keywords = NAMESPACE_KEYWORDS[category] || [];
  return keywords.some(keyword => name.includes(keyword));
}

export const NAMESPACE_KEYWORDS: Record<NamespaceCategory, string[]> = {
  core: [
    // Namespace itself
    'core',
    // Web app core
    'auth', 'session', 'user', 'config', 'routes', 'router', 'trpc',
    'middleware', 'api', 'server', 'client', 'context', 'providers',
    'constants', 'env', 'i18n', 'locale', 'theme', 'settings',
    // CLI core
    'cli', 'commands', 'bin', 'shell', 'process', 'logger', 'log',
    'git', 'github', 'vcs', 'fs', 'filesystem', 'io',
  ],
  domain: [
    // Namespace itself
    'domain',
    // Web app domain
    'booking', 'event', 'place', 'venue', 'ticket', 'order', 'payment',
    'review', 'rating', 'customer', 'crm', 'calendar', 'schedule',
    'business', 'admin', 'dashboard', 'panel', 'notification', 'dal',
    'stores', 'state', 'data',
    // CLI domain
    'analysis', 'analyzer', 'checker', 'linter', 'quality', 'metrics',
  ],
  integrations: [
    // Namespace itself
    'integrations', 'integration',
    // External services
    'storage', 'upload', 'email', 'sms', 'push', 'analytics', 'tracking',
    'stripe', 'yookassa', 'paypal', 'twilio', 'sendgrid', 'firebase',
    's3', 'cloudinary', 'maps', 'google', 'facebook', 'oauth', 'external',
    // CLI integrations
    'mcp', 'lsp', 'ai', 'llm', 'openai', 'anthropic',
  ],
  ui: [
    // Namespace itself
    'ui',
    // Web UI
    'hooks', 'components', 'layout', 'modal', 'dialog', 'form',
    'button', 'input', 'table', 'card', 'icon', 'animation', 'motion',
    // CLI UI (terminal output)
    'output', 'printer', 'terminal', 'console', 'chalk', 'colors',
  ],
  utils: [
    // Namespace itself
    'utils', 'util',
    // General utilities
    'helpers', 'common', 'shared', 'tools',
    'date', 'string', 'array', 'object', 'validation', 'sanitize',
    // Code utilities
    'ast', 'parser', 'lexer', 'tokenizer', 'transformer', 'visitor',
    'formatters', 'format', 'formatting', 'text', 'markdown',
    'discovery', 'finder', 'glob', 'pattern', 'search',
    'timing', 'perf', 'measure', 'benchmark',
  ],
  seo: [
    // Namespace itself
    'seo',
    // SEO patterns
    'metadata', 'schema', 'jsonld', 'opengraph', 'sitemap',
    'robots', 'indexnow', 'structured-data',
  ],
  unknown: [],
};

export const NAMESPACE_INFO: Record<NamespaceCategory, {
  description: string;
  layer: string;
  dependsOn: string[];
  usedBy: string[];
}> = {
  core: {
    description: 'Foundation layer: auth, config, utilities',
    layer: 'Pure utilities, configuration, authentication. NO business logic, NO UI dependencies',
    dependsOn: [],
    usedBy: ['@domain', '@ui', '@seo', '@integrations'],
  },
  domain: {
    description: 'Business logic: data access, constants, state',
    layer: 'Data access, business rules, state management. Uses @core, provides data to @ui',
    dependsOn: ['@core'],
    usedBy: ['@ui'],
  },
  integrations: {
    description: 'External services: storage, analytics, APIs',
    layer: 'Third-party API integrations, storage, analytics. Isolated from business logic',
    dependsOn: ['@core'],
    usedBy: ['@domain', 'components'],
  },
  ui: {
    description: 'UI utilities: hooks, providers, client helpers',
    layer: 'React hooks, providers, client-side utilities. Consumes @domain',
    dependsOn: ['@core', '@domain'],
    usedBy: ['components'],
  },
  utils: {
    description: 'Shared utilities and helpers',
    layer: 'Common utility functions used across the codebase',
    dependsOn: [],
    usedBy: ['@core', '@domain', '@ui'],
  },
  seo: {
    description: 'SEO: metadata, JSON-LD schemas, indexnow',
    layer: 'Metadata generation, structured data, indexing. Self-contained module',
    dependsOn: ['@core'],
    usedBy: ['app'],
  },
  unknown: {
    description: 'Uncategorized modules',
    layer: 'Modules that need manual categorization',
    dependsOn: [],
    usedBy: [],
  },
};
