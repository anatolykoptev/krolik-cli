/**
 * @module commands/agent/categories
 * @description Agent category definitions and mappings
 */

import type { AgentCategory, AgentCategoryInfo } from './types';

/**
 * Agent category definitions
 */
export const AGENT_CATEGORIES: Record<AgentCategory, AgentCategoryInfo> = {
  security: {
    name: 'security',
    label: 'Security',
    description: 'Security auditing, vulnerability detection, and secure coding',
    aliases: ['sec', 'audit'],
    plugins: [
      'security-scanning',
      'security-compliance',
      'backend-api-security',
      'frontend-mobile-security',
    ],
    primaryAgents: ['security-auditor', 'backend-security-coder', 'frontend-security-coder'],
  },
  performance: {
    name: 'performance',
    label: 'Performance',
    description: 'Performance optimization, profiling, and observability',
    aliases: ['perf', 'speed', 'optimize'],
    plugins: [
      'application-performance',
      'performance-testing-review',
      'database-cloud-optimization',
    ],
    primaryAgents: ['performance-engineer', 'database-optimizer', 'observability-engineer'],
  },
  architecture: {
    name: 'architecture',
    label: 'Architecture',
    description: 'System design, architecture diagrams, and patterns',
    aliases: ['arch', 'design', 'c4'],
    plugins: ['c4-architecture', 'backend-development', 'cloud-infrastructure'],
    primaryAgents: ['backend-architect', 'c4-context', 'c4-container', 'c4-component'],
  },
  quality: {
    name: 'quality',
    label: 'Code Quality',
    description: 'Code review, refactoring, and best practices',
    aliases: ['review', 'refactor', 'clean'],
    plugins: ['code-review-ai', 'codebase-cleanup', 'code-refactoring', 'comprehensive-review'],
    primaryAgents: ['code-reviewer', 'architect-review', 'legacy-modernizer'],
  },
  debugging: {
    name: 'debugging',
    label: 'Debugging',
    description: 'Error analysis, debugging, and incident response',
    aliases: ['debug', 'error', 'incident', 'fix'],
    plugins: [
      'debugging-toolkit',
      'error-debugging',
      'error-diagnostics',
      'incident-response',
      'distributed-debugging',
    ],
    primaryAgents: ['debugger', 'error-detective', 'incident-responder', 'devops-troubleshooter'],
  },
  docs: {
    name: 'docs',
    label: 'Documentation',
    description: 'Documentation generation, API docs, and diagrams',
    aliases: ['doc', 'documentation', 'api'],
    plugins: ['documentation-generation', 'code-documentation', 'api-testing-observability'],
    primaryAgents: ['docs-architect', 'api-documenter', 'mermaid-expert', 'tutorial-engineer'],
  },
  frontend: {
    name: 'frontend',
    label: 'Frontend',
    description: 'Frontend development, React, and UI patterns',
    aliases: ['ui', 'react', 'web'],
    plugins: ['frontend-mobile-development', 'accessibility-compliance'],
    primaryAgents: ['frontend-developer', 'ui-visual-validator'],
  },
  backend: {
    name: 'backend',
    label: 'Backend',
    description: 'Backend development, APIs, and microservices',
    aliases: ['api', 'server'],
    plugins: ['backend-development', 'api-scaffolding', 'data-engineering'],
    primaryAgents: [
      'backend-architect',
      'graphql-architect',
      'event-sourcing-architect',
      'data-engineer',
    ],
  },
  database: {
    name: 'database',
    label: 'Database',
    description: 'Database design, optimization, and migrations',
    aliases: ['db', 'sql', 'prisma'],
    plugins: ['database-design', 'database-migrations', 'database-cloud-optimization'],
    primaryAgents: ['database-architect', 'database-optimizer', 'database-admin', 'sql-pro'],
  },
  devops: {
    name: 'devops',
    label: 'DevOps',
    description: 'CI/CD, infrastructure, and deployment',
    aliases: ['cicd', 'infra', 'deploy', 'k8s'],
    plugins: [
      'cicd-automation',
      'cloud-infrastructure',
      'kubernetes-operations',
      'deployment-strategies',
    ],
    primaryAgents: [
      'deployment-engineer',
      'kubernetes-architect',
      'terraform-specialist',
      'cloud-architect',
    ],
  },
  testing: {
    name: 'testing',
    label: 'Testing',
    description: 'Unit testing, TDD, and test automation',
    aliases: ['test', 'tdd', 'unit'],
    plugins: ['unit-testing', 'tdd-workflows', 'full-stack-orchestration'],
    primaryAgents: ['test-automator', 'tdd-orchestrator'],
  },
  other: {
    name: 'other',
    label: 'Other',
    description: 'Other specialized agents',
    aliases: [],
    plugins: [],
    primaryAgents: [],
  },
};

/**
 * Resolve category from alias or name
 */
export function resolveCategory(input: string): AgentCategory | null {
  const normalized = input.toLowerCase().trim();

  // Direct match
  if (normalized in AGENT_CATEGORIES) {
    return normalized as AgentCategory;
  }

  // Alias match
  for (const [category, info] of Object.entries(AGENT_CATEGORIES)) {
    if (info.aliases.includes(normalized)) {
      return category as AgentCategory;
    }
  }

  return null;
}

/**
 * Get category for a plugin name
 */
export function getCategoryForPlugin(pluginName: string): AgentCategory {
  for (const [category, info] of Object.entries(AGENT_CATEGORIES)) {
    if (info.plugins.includes(pluginName)) {
      return category as AgentCategory;
    }
  }
  return 'other';
}

/**
 * Get all category names
 */
export function getAllCategories(): AgentCategory[] {
  return Object.keys(AGENT_CATEGORIES) as AgentCategory[];
}
