/**
 * @module commands/fix/fixers/ts-ignore
 * @description TypeScript ignore comment fixer using AST
 *
 * Detects and removes @ts-expect-error, @ts-expect-error and @ts-nocheck comments.
 * Uses ts-morph AST for accurate detection that:
 * - Correctly ignores directives inside string literals
 * - Handles both single-line and multi-line comments
 * - Provides exact positions for accurate fixes
 */

import { createFixerMetadata } from '../../core/registry';
import type { Fixer } from '../../core/types';
import { analyzeTsIgnoreAST } from './ast-analyzer';
import { fixTsIgnoreAST } from './ast-fixer';

export const metadata = createFixerMetadata('ts-ignore', 'TS-Ignore Comments', 'type-safety', {
  description: 'Remove @ts-ignore/@ts-nocheck comments',
  difficulty: 'safe', // AST-based analysis is reliable
  cliFlag: '--fix-ts-ignore',
  tags: ['safe', 'type-safety'],
});

export const tsIgnoreFixer: Fixer = {
  metadata,
  analyze: analyzeTsIgnoreAST,
  fix: fixTsIgnoreAST,
};
