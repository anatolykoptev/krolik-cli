/**
 * @module lib/@core/constants/refactor
 * @description Constants for refactor command (namespaces, layers, dependencies)
 *
 * Moved from src/commands/refactor/core/constants.ts.
 * Helper functions (detectCategory, isDependencyAllowed, getLayerNumber) remain in original file.
 */

import type { NamespaceCategory } from '../../../commands/refactor/core/types';

// ============================================================================
// NAMESPACE KEYWORDS
// ============================================================================

/**
 * Keywords used to detect namespace category from directory/file names
 */
export const NAMESPACE_KEYWORDS: Record<NamespaceCategory, string[]> = {
  core: [
    'core',
    'auth',
    'session',
    'user',
    'config',
    'routes',
    'router',
    'trpc',
    'middleware',
    'api',
    'server',
    'client',
    'context',
    'providers',
    'constants',
    'env',
    'i18n',
    'locale',
    'theme',
    'settings',
    'cli',
    'commands',
    'bin',
    'shell',
    'process',
    'logger',
    'log',
    'git',
    'github',
    'vcs',
    'fs',
    'filesystem',
    'io',
  ],
  domain: [
    'domain',
    'booking',
    'event',
    'place',
    'venue',
    'ticket',
    'order',
    'payment',
    'review',
    'rating',
    'customer',
    'crm',
    'calendar',
    'schedule',
    'business',
    'admin',
    'dashboard',
    'panel',
    'notification',
    'dal',
    'stores',
    'state',
    'data',
    'analysis',
    'analyzer',
    'checker',
    'linter',
    'quality',
    'metrics',
  ],
  integrations: [
    'integrations',
    'integration',
    'storage',
    'upload',
    'email',
    'sms',
    'push',
    'analytics',
    'tracking',
    'stripe',
    'yookassa',
    'paypal',
    'twilio',
    'sendgrid',
    'firebase',
    's3',
    'cloudinary',
    'maps',
    'google',
    'facebook',
    'oauth',
    'external',
    'mcp',
    'lsp',
    'ai',
    'llm',
    'openai',
    'anthropic',
  ],
  ui: [
    'ui',
    'hooks',
    'components',
    'layout',
    'modal',
    'dialog',
    'form',
    'button',
    'input',
    'table',
    'card',
    'icon',
    'animation',
    'motion',
    'output',
    'printer',
    'terminal',
    'console',
    'chalk',
    'colors',
  ],
  utils: [
    'utils',
    'util',
    'helpers',
    'common',
    'shared',
    'tools',
    'date',
    'string',
    'array',
    'object',
    'validation',
    'sanitize',
    'ast',
    'parser',
    'lexer',
    'tokenizer',
    'transformer',
    'visitor',
    'formatters',
    'format',
    'formatting',
    'text',
    'markdown',
    'discovery',
    'finder',
    'glob',
    'pattern',
    'search',
    'timing',
    'perf',
    'measure',
    'benchmark',
  ],
  seo: [
    'seo',
    'metadata',
    'schema',
    'jsonld',
    'opengraph',
    'sitemap',
    'robots',
    'indexnow',
    'structured-data',
  ],
  unknown: [],
};

// ============================================================================
// NAMESPACE LAYER INFO
// ============================================================================

/**
 * Clean Architecture layer information for each namespace category
 */
export const NAMESPACE_INFO: Record<
  NamespaceCategory,
  {
    description: string;
    layer: number;
    dependsOn: NamespaceCategory[];
    usedBy: NamespaceCategory[];
  }
> = {
  utils: {
    description: 'Shared utilities and helpers',
    layer: 0,
    dependsOn: [],
    usedBy: ['core', 'domain', 'integrations', 'seo', 'ui'],
  },
  core: {
    description: 'Foundation layer: auth, config, infrastructure',
    layer: 1,
    dependsOn: ['utils'],
    usedBy: ['domain', 'integrations', 'seo', 'ui'],
  },
  integrations: {
    description: 'External services: storage, analytics, APIs',
    layer: 2,
    dependsOn: ['utils', 'core'],
    usedBy: ['domain', 'seo', 'ui'],
  },
  domain: {
    description: 'Business logic: data access, constants, state',
    layer: 3,
    dependsOn: ['utils', 'core', 'integrations'],
    usedBy: ['seo', 'ui'],
  },
  seo: {
    description: 'SEO: metadata, JSON-LD schemas, indexnow',
    layer: 4,
    dependsOn: ['utils', 'core', 'domain'],
    usedBy: ['ui'],
  },
  ui: {
    description: 'UI utilities: hooks, providers, client helpers',
    layer: 5,
    dependsOn: ['utils', 'core', 'domain', 'seo'],
    usedBy: [],
  },
  unknown: {
    description: 'Uncategorized modules',
    layer: -1,
    dependsOn: [],
    usedBy: [],
  },
};

// ============================================================================
// ALLOWED DEPENDENCIES
// ============================================================================

/**
 * Allowed dependencies between namespace categories
 * Based on Clean Architecture: dependencies point inward
 */
export const ALLOWED_DEPS: Record<NamespaceCategory, NamespaceCategory[]> = {
  utils: [],
  core: ['utils'],
  integrations: ['utils', 'core'],
  domain: ['utils', 'core', 'integrations'],
  seo: ['utils', 'core', 'domain'],
  ui: ['utils', 'core', 'domain', 'seo'],
  unknown: [],
};
