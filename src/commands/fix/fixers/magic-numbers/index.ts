/**
 * @module commands/fix/fixers/magic-numbers
 * @description Magic numbers fixer using AST
 *
 * Detects hardcoded numbers and extracts them to named constants.
 * Uses ts-morph AST for accurate detection that:
 * - Correctly identifies numbers in expressions
 * - Skips numbers in const declarations (they define constants)
 * - Skips array indices, enum values, and type literals
 * - Generates semantic constant names based on context
 */

import { createFixerMetadata } from '../../core/registry';
import type { Fixer } from '../../core/types';
import { analyzeMagicNumbersAST } from './ast-analyzer';
import { fixMagicNumberAST } from './ast-fixer';

export const metadata = createFixerMetadata('magic-numbers', 'Magic Numbers', 'hardcoded', {
  description: 'Extract magic numbers to named constants',
  difficulty: 'safe', // AST-based analysis is reliable
  cliFlag: '--fix-magic-numbers',
  tags: ['safe', 'hardcoded', 'refactoring'],
});

export const magicNumbersFixer: Fixer = {
  metadata,
  analyze: analyzeMagicNumbersAST,
  fix: fixMagicNumberAST,
};
