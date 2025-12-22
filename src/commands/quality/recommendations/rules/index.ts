/**
 * @module commands/quality/recommendations/rules
 * @description All recommendation rules
 */

import type { Recommendation } from '../types';
import { NAMING_RULES } from './naming';
import { STRUCTURE_RULES } from './structure';
import { TYPESCRIPT_RULES } from './typescript';
import { REACT_RULES } from './react';
import { PERFORMANCE_RULES } from './performance';
import { IMPORTS_RULES } from './imports';
import { TESTING_RULES } from './testing';
import { ASYNC_RULES } from './async';
import { SECURITY_RULES } from './security';

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
];

// Re-export individual rule sets
export {
  NAMING_RULES,
  STRUCTURE_RULES,
  TYPESCRIPT_RULES,
  REACT_RULES,
  PERFORMANCE_RULES,
  IMPORTS_RULES,
  TESTING_RULES,
  ASYNC_RULES,
  SECURITY_RULES,
};
