/**
 * @module commands/agent/capabilities/parser
 * @description Parse agent definitions into searchable capabilities
 */

import type { AgentDefinition } from '../types';
import type { AgentCapabilities } from './types';

/**
 * Tech stack patterns to detect in descriptions
 */
const TECH_STACK_PATTERNS: Record<string, RegExp> = {
  // Frameworks
  nextjs: /\bnext\.?js\b/i,
  react: /\breact(?:\s|$|\.)/i,
  vue: /\bvue(?:\.?js)?\b/i,
  svelte: /\bsvelte(?:kit)?\b/i,
  express: /\bexpress(?:\.?js)?\b/i,
  fastify: /\bfastify\b/i,
  nestjs: /\bnest\.?js\b/i,
  hono: /\bhono\b/i,

  // Databases & ORMs
  prisma: /\bprisma\b/i,
  drizzle: /\bdrizzle\b/i,
  typeorm: /\btypeorm\b/i,
  mongoose: /\bmongoose\b/i,
  postgres: /\b(postgres|postgresql|pg)\b/i,
  mysql: /\bmysql\b/i,
  mongodb: /\bmongodb?\b/i,
  redis: /\bredis\b/i,
  sqlite: /\bsqlite\b/i,

  // API
  trpc: /\btrpc\b/i,
  graphql: /\bgraphql\b/i,
  rest: /\brest(\s|ful|api)/i,
  grpc: /\bgrpc\b/i,

  // Cloud & DevOps
  aws: /\baws\b/i,
  gcp: /\b(gcp|google\s*cloud)\b/i,
  azure: /\bazure\b/i,
  kubernetes: /\b(kubernetes|k8s)\b/i,
  docker: /\bdocker\b/i,
  terraform: /\bterraform\b/i,

  // Testing
  jest: /\bjest\b/i,
  vitest: /\bvitest\b/i,
  playwright: /\bplaywright\b/i,
  cypress: /\bcypress\b/i,

  // Mobile
  expo: /\bexpo\b/i,
  'react-native': /\breact[\s-]native\b/i,

  // Languages
  typescript: /\btypescript\b/i,
  javascript: /\bjavascript\b/i,
  python: /\bpython\b/i,
  go: /\bgolang|\bgo\s+(code|lang)/i,
  rust: /\brust\b/i,
};

/**
 * Keywords to extract from descriptions (domain-specific terms)
 */
const DOMAIN_KEYWORDS = [
  // Security
  'security',
  'audit',
  'vulnerability',
  'penetration',
  'xss',
  'csrf',
  'sql injection',
  'authentication',
  'authorization',
  'encryption',
  'owasp',
  'secure',
  'compliance',
  'gdpr',
  'pci',
  'soc2',

  // Performance
  'performance',
  'optimization',
  'profiling',
  'benchmark',
  'latency',
  'throughput',
  'caching',
  'memory',
  'cpu',
  'bundle',
  'lighthouse',
  'web vitals',
  'observability',

  // Architecture
  'architecture',
  'design',
  'pattern',
  'microservice',
  'monolith',
  'event-driven',
  'cqrs',
  'ddd',
  'clean architecture',
  'hexagonal',
  'c4',
  'system design',
  'scalability',
  'domain',

  // Quality
  'review',
  'refactor',
  'clean code',
  'solid',
  'lint',
  'code quality',
  'technical debt',
  'legacy',
  'modernize',
  'best practice',

  // Debugging
  'debug',
  'error',
  'bug',
  'issue',
  'incident',
  'troubleshoot',
  'diagnose',
  'trace',
  'log',
  'monitor',

  // Documentation
  'documentation',
  'api doc',
  'readme',
  'comment',
  'jsdoc',
  'swagger',
  'openapi',
  'diagram',
  'mermaid',

  // Testing
  'test',
  'unit test',
  'integration test',
  'e2e',
  'tdd',
  'bdd',
  'coverage',
  'mock',
  'stub',

  // Frontend
  'ui',
  'ux',
  'component',
  'accessibility',
  'a11y',
  'responsive',
  'animation',
  'state',
  'form',
  'validation',

  // Backend
  'api',
  'endpoint',
  'route',
  'middleware',
  'controller',
  'service',
  'repository',
  'crud',
  'webhook',

  // Database
  'database',
  'schema',
  'migration',
  'query',
  'index',
  'transaction',
  'relation',
  'model',

  // DevOps
  'ci/cd',
  'pipeline',
  'deployment',
  'infrastructure',
  'container',
  'cluster',
  'scaling',
  'load balancer',
];

/**
 * Parse agent definition into capabilities
 */
export function parseAgentCapabilities(agent: AgentDefinition): AgentCapabilities {
  const description = agent.description.toLowerCase();
  const content = agent.content.toLowerCase();
  const combinedText = `${description} ${content}`;

  return {
    name: agent.name,
    description: agent.description,
    category: agent.category,
    plugin: agent.plugin,
    keywords: extractKeywords(combinedText),
    techStack: extractTechStack(combinedText),
    projectTypes: inferProjectTypes(agent.category, combinedText),
    model: agent.model ?? 'inherit',
    filePath: agent.filePath,
  };
}

/**
 * Extract domain keywords from text
 */
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const normalizedText = text.toLowerCase();

  for (const keyword of DOMAIN_KEYWORDS) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      keywords.push(keyword);
    }
  }

  return [...new Set(keywords)];
}

/**
 * Extract tech stack from text using patterns
 */
function extractTechStack(text: string): string[] {
  const stack: string[] = [];

  for (const [tech, pattern] of Object.entries(TECH_STACK_PATTERNS)) {
    if (pattern.test(text)) {
      stack.push(tech);
    }
  }

  return stack;
}

/**
 * Infer suitable project types from category and description
 */
function inferProjectTypes(
  category: string,
  text: string,
): ('monorepo' | 'single' | 'backend' | 'frontend' | 'fullstack')[] {
  const types: ('monorepo' | 'single' | 'backend' | 'frontend' | 'fullstack')[] = [];

  // Category-based inference
  switch (category) {
    case 'backend':
    case 'database':
    case 'devops':
      types.push('backend', 'fullstack');
      break;
    case 'frontend':
      types.push('frontend', 'fullstack');
      break;
    case 'architecture':
    case 'quality':
    case 'security':
    case 'performance':
      types.push('backend', 'frontend', 'fullstack');
      break;
    default:
      types.push('fullstack');
  }

  // Text-based inference
  if (/monorepo|lerna|turborepo|workspace/i.test(text)) {
    types.push('monorepo');
  }

  if (/full[\s-]?stack|end[\s-]?to[\s-]?end/i.test(text)) {
    if (!types.includes('fullstack')) types.push('fullstack');
  }

  return [...new Set(types)];
}

/**
 * Parse multiple agents into capabilities
 */
export function parseAllAgentCapabilities(agents: AgentDefinition[]): AgentCapabilities[] {
  return agents.map(parseAgentCapabilities);
}
