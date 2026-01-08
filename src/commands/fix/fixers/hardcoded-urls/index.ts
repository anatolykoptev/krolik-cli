/**
 * @module commands/fix/fixers/hardcoded-urls
 * @description Hardcoded URLs fixer using AST
 *
 * Detects hardcoded URLs and extracts them to named constants.
 * Uses ts-morph AST for accurate detection that:
 * - Finds URLs in string and template literals
 * - Skips URLs in comments and const declarations
 * - Generates semantic constant names from URL structure
 */

import { createFixerMetadata } from '../../core/registry';
import type { Fixer } from '../../core/types';
import { analyzeUrlsAST } from './ast-analyzer';
import { fixUrlAST } from './ast-fixer';

export const metadata = createFixerMetadata('hardcoded-urls', 'Hardcoded URLs', 'hardcoded', {
  description: 'Extract hardcoded URLs to constants',
  difficulty: 'safe', // AST-based analysis is reliable
  cliFlag: '--fix-urls',
  tags: ['safe', 'hardcoded', 'refactoring'],
});

export const hardcodedUrlsFixer: Fixer = {
  metadata,
  analyze: analyzeUrlsAST,
  fix: fixUrlAST,
};
