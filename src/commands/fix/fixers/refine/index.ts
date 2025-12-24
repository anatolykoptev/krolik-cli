/**
 * @module commands/fix/fixers/refine
 * @description Namespace structure fixer
 *
 * Detects @namespace pattern violations in lib/ directory
 * and applies migration to proper structure.
 *
 * Uses the existing refine command logic for analysis and migration.
 */

import type { Fixer, QualityIssue, FixOperation } from '../../core/types';
import { createFixerMetadata } from '../../core/registry';

export const metadata = createFixerMetadata('refine', 'Namespace Structure', 'refine', {
  description: 'Migrate lib/ to @namespace pattern',
  difficulty: 'risky',
  cliFlag: '--fix-refine',
  tags: ['risky', 'refactoring', 'architecture'],
});

// Reserved for future namespace structure validation
// const EXPECTED_NAMESPACES = ['@core', '@domain', '@integrations', '@ui', '@seo', '@utils'];
// const BAD_PATTERNS = [/^(?!@)[\w-]+$/];

/**
 * Analyze for @namespace violations
 *
 * Since refine analyzes directory structure, not file content,
 * this analyzer detects files that should be in @namespace but aren't.
 */
function analyzeRefine(_content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Only analyze files in lib/ or similar directories
  if (!file.includes('/lib/') && !file.includes('/src/lib/')) {
    return issues;
  }

  // Check if file is in a proper @namespace
  const libMatch = file.match(/\/lib\/(.+?)\/|\/src\/lib\/(.+?)\//);
  if (!libMatch) return issues;

  const dirName = libMatch[1] || libMatch[2] || '';

  // If not in @namespace, it's a violation
  if (dirName && !dirName.startsWith('@')) {
    // Suggest namespace based on directory name
    let suggestedNamespace = '@utils';

    if (/auth|config|env/.test(dirName)) {
      suggestedNamespace = '@core';
    } else if (/db|prisma|data|state|store/.test(dirName)) {
      suggestedNamespace = '@domain';
    } else if (/storage|api|supabase|stripe|external/.test(dirName)) {
      suggestedNamespace = '@integrations';
    } else if (/hooks?|provider|context|ui/.test(dirName)) {
      suggestedNamespace = '@ui';
    } else if (/seo|meta|schema|structured/.test(dirName)) {
      suggestedNamespace = '@seo';
    }

    issues.push({
      file,
      line: 1,
      severity: 'warning',
      category: 'refine',
      message: `File in '${dirName}/' should be in '${suggestedNamespace}/${dirName}/'`,
      suggestion: `Run 'krolik refine --apply' to migrate to @namespace structure`,
      fixerId: 'refine',
    });
  }

  return issues;
}

/**
 * Fix refine issue by moving file to proper @namespace
 */
function fixRefineIssue(issue: QualityIssue, _content: string): FixOperation | null {
  if (!issue.file) return null;

  // Extract suggested namespace from message
  const match = issue.message.match(/should be in '(@\w+)/);
  if (!match) return null;

  const namespace = match[1];
  const currentDir = issue.file.match(/\/lib\/([^/]+)\//)?.[1] || '';

  // Calculate new path
  const newPath = issue.file.replace(
    `/lib/${currentDir}/`,
    `/lib/${namespace}/${currentDir}/`
  );

  return {
    action: 'move-file',
    file: issue.file,
    moveTo: newPath,
  };
}

export const refineFixer: Fixer = {
  metadata,
  analyze: analyzeRefine,
  fix: fixRefineIssue,
  shouldSkip(issue, _content) {
    // Skip if file is already in a namespace
    return issue.file.includes('/@');
  },
};
