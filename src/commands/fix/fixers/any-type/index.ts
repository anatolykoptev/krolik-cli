/**
 * @module commands/fix/fixers/any-type
 * @description Any type fixer (AST-based)
 *
 * Detects `any` type usage and replaces with `unknown`.
 * Uses ts-morph AST for 100% accurate detection and fixing.
 *
 * Benefits over regex-based approach:
 * - Correctly skips `any` inside strings and comments
 * - Correctly skips `any` as part of identifiers (e.g., `company`)
 * - Exact byte positions for precise replacement
 * - Rich context information (type annotation, assertion, generic param)
 */

import { createFixerMetadata } from '../../core/registry';
import type { Fixer } from '../../core/types';
import { analyzeAnyTypeAST } from './analyzer';
import { fixAnyTypeIssue } from './fixer';

export const metadata = createFixerMetadata('any-type', 'Any Type Usage', 'type-safety', {
  description: 'Replace `any` with `unknown`',
  difficulty: 'safe', // Now safe with ts-morph AST-based implementation
  cliFlag: '--fix-any',
  negateFlag: '--no-any',
  tags: ['safe', 'type-safety'],
});

export const anyTypeFixer: Fixer = {
  metadata,
  analyze: analyzeAnyTypeAST,
  fix: fixAnyTypeIssue,
};

// Re-export for direct access
export { analyzeAnyTypeAST } from './analyzer';
export { fixAllAnyInFile, fixAnyTypeIssue } from './fixer';
