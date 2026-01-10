/**
 * @module commands/quality/recommendations/rules
 * @description All recommendation rules
 */

import type { Recommendation } from '../types';
import { ASYNC_RULES } from './async';
import { IMPORTS_RULES } from './imports';
import { NAMING_RULES } from './naming';
import { PERFORMANCE_RULES } from './performance';
import { REACT_RULES } from './react';
import { SECURITY_RULES } from './security';
import { SIMPLIFY_RULES } from './simplify';
import { STRUCTURE_RULES } from './structure';
import { TESTING_RULES } from './testing';
import { TYPESCRIPT_RULES } from './typescript';

/**
 * All recommendations combined
 */
export const ALL_RECOMMENDATIONS: Recommendation[] = [
  ...NAMING_RULES,
  ...STRUCTURE_RULES,
  ...TYPESCRIPT_RULES,
  ...REACT_RULES,
  ...PERFORMANCE_RULES,
  ...IMPORTS_RULES,
  ...TESTING_RULES,
  ...ASYNC_RULES,
  ...SECURITY_RULES,
  ...SIMPLIFY_RULES,
];

// Re-export individual rule sets
export {
  ASYNC_RULES,
  IMPORTS_RULES,
  NAMING_RULES,
  PERFORMANCE_RULES,
  REACT_RULES,
  SECURITY_RULES,
  SIMPLIFY_RULES,
  STRUCTURE_RULES,
  TESTING_RULES,
  TYPESCRIPT_RULES,
};
