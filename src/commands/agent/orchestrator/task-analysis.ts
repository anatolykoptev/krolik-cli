/**
 * @module commands/agent/orchestrator/task-analysis
 * @description Task analysis logic for agent orchestration
 */

import { CONFIDENCE } from '../constants';
import type { AgentCategory } from '../types';
import type { DetectedType, TaskAnalysis, TaskKeywordConfig, TaskType } from './types';

/**
 * Keywords mapped to task types and categories
 */
export const TASK_KEYWORDS: Record<TaskType, TaskKeywordConfig> = {
  'code-review': {
    keywords: [
      'review',
      'check',
      'quality',
      'clean',
      'refactor',
      'improve',
      'analyze code',
      'code analysis',
      // Russian aliases
      'проверь',
      'ревью',
      'проанализируй код',
    ],
    categories: ['quality'],
  },
  'security-audit': {
    keywords: [
      'security',
      'audit',
      'vulnerability',
      'secure',
      'injection',
      'xss',
      'csrf',
      'auth',
      // Russian aliases
      'безопасность',
      'уязвимост',
      'аудит',
    ],
    categories: ['security'],
  },
  'performance-optimization': {
    keywords: [
      'performance',
      'optimize',
      'speed',
      'slow',
      'fast',
      'profil',
      // Russian aliases
      'производительность',
      'оптимиз',
      'медленно',
      'быстр',
    ],
    categories: ['performance'],
  },
  'architecture-design': {
    keywords: [
      'architecture',
      'design',
      'structure',
      'pattern',
      'system',
      'diagram',
      'c4',
      // Russian aliases
      'архитектур',
      'дизайн',
      'структур',
      'паттерн',
    ],
    categories: ['architecture'],
  },
  debugging: {
    keywords: [
      'debug',
      'error',
      'bug',
      'fix',
      'issue',
      'problem',
      'crash',
      'incident',
      // Russian aliases
      'отлад',
      'ошибк',
      'баг',
      'проблем',
      'инцидент',
    ],
    categories: ['debugging'],
  },
  documentation: {
    keywords: [
      'document',
      'doc',
      'readme',
      'api doc',
      'comment',
      // Russian aliases
      'документ',
      'описа',
    ],
    categories: ['docs'],
  },
  testing: {
    keywords: [
      'test',
      'unit',
      'tdd',
      'coverage',
      'spec',
      'jest',
      'vitest',
      // Russian aliases
      'тест',
      'покрыти',
    ],
    categories: ['testing'],
  },
  refactoring: {
    keywords: [
      'refactor',
      'clean up',
      'legacy',
      'modernize',
      'restructure',
      // Russian aliases
      'рефакторинг',
      'очистить',
      'модернизир',
    ],
    categories: ['quality', 'architecture'],
  },
  'feature-implementation': {
    keywords: [
      'implement',
      'add feature',
      'create',
      'build',
      'develop',
      // Russian aliases
      'реализ',
      'добавь',
      'создай',
      'разработ',
    ],
    categories: ['backend', 'frontend'],
  },
  'multi-domain': {
    keywords: [
      'full',
      'complete',
      'comprehensive',
      'all',
      'everything',
      'multi',
      'multi-agent',
      // Russian aliases
      'полн',
      'компл',
      'всё',
      'мультиагент',
    ],
    categories: ['quality', 'security', 'performance', 'architecture'],
  },
  unknown: {
    keywords: [],
    categories: [],
  },
};

/**
 * Score task against all keyword configurations
 */
export function scoreTaskTypes(normalizedTask: string): DetectedType[] {
  const detectedTypes: DetectedType[] = [];

  for (const [taskType, config] of Object.entries(TASK_KEYWORDS)) {
    const matchedKeywords: string[] = [];
    for (const keyword of config.keywords) {
      if (normalizedTask.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }
    if (matchedKeywords.length > 0) {
      detectedTypes.push({
        type: taskType as TaskType,
        score: matchedKeywords.length,
        keywords: matchedKeywords,
      });
    }
  }

  return detectedTypes.sort((a, b) => b.score - a.score);
}

/**
 * Collect unique categories from detected types
 */
export function collectCategories(detectedTypes: DetectedType[]): AgentCategory[] {
  const categories: AgentCategory[] = [];
  for (const detected of detectedTypes) {
    const config = TASK_KEYWORDS[detected.type];
    for (const cat of config.categories) {
      if (!categories.includes(cat)) {
        categories.push(cat);
      }
    }
  }
  return categories;
}

/**
 * Determine primary task type from detected types
 */
export function determinePrimaryType(detectedTypes: DetectedType[]): {
  taskType: TaskType;
  confidence: number;
  keywords: string[];
} {
  if (detectedTypes.length === 0) {
    return { taskType: 'unknown', confidence: 0, keywords: [] };
  }

  const primary = detectedTypes[0];
  if (!primary) {
    return { taskType: 'unknown', confidence: 0, keywords: [] };
  }

  const second = detectedTypes[1];
  const isMultiDomain = detectedTypes.length >= 2 && second && second.score >= 2;

  if (isMultiDomain) {
    return {
      taskType: 'multi-domain',
      confidence: 0.8,
      keywords: detectedTypes.flatMap((d) => d.keywords),
    };
  }

  return {
    taskType: primary.type,
    confidence: Math.min(primary.score / CONFIDENCE.SCORE_DIVISOR, 1),
    keywords: primary.keywords,
  };
}

/**
 * Analyze a task and determine which agents to invoke
 */
export function analyzeTask(task: string): TaskAnalysis {
  const normalizedTask = task.toLowerCase();
  const detectedTypes = scoreTaskTypes(normalizedTask);
  const { taskType, confidence, keywords } = determinePrimaryType(detectedTypes);
  const categories = collectCategories(detectedTypes);

  return {
    task,
    taskType,
    confidence,
    categories,
    agents: [],
    strategy: categories.length > 2 ? 'mixed' : 'sequential',
    keywords,
  };
}
