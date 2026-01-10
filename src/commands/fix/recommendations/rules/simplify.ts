/**
 * @module commands/fix/recommendations/rules/simplify
 * @description Code simplification recommendations (Google/Airbnb style)
 *
 * These rules detect opportunities to make code more readable, concise,
 * and maintainable without changing functionality.
 *
 * Philosophy:
 * - Clarity over cleverness
 * - Explicit over implicit
 * - Simple over complex
 * - Flat over nested
 *
 * Implementation:
 * - Uses AST-based analysis via SWC for accurate detection
 * - Zero false positives > high recall (Google principle)
 */

import {
  analyzeCallbackHell,
  analyzeComplexTernary,
  analyzeEmptyFunctions,
  analyzeInefficientArrayChain,
  analyzeNegationChain,
  analyzeObjectShorthand,
  analyzeRedundantBoolean,
  analyzeStringConcatenation,
  analyzeSwitchToLookup,
  analyzeUnnecessaryElse,
  analyzeVerboseConditionals,
} from '@/lib/@ast/swc';
import type { Recommendation } from '../types';

/**
 * Code simplification rules following Google/Airbnb style guides.
 * Focus: readability, maintainability, clarity over cleverness.
 *
 * All rules use AST-based analysis for accurate detection.
 */
export const SIMPLIFY_RULES: Recommendation[] = [
  {
    id: 'simplify-verbose-conditionals',
    title: 'Replace verbose if-else chain with lookup table',
    description:
      'If-else chains that map values to other values can be simplified to an object lookup. ' +
      'This improves readability and makes the mapping explicit.',
    category: 'simplify',
    severity: 'recommendation',
    check: (content, analysis) => {
      const result = analyzeVerboseConditionals(content, analysis?.path);
      return result.detected;
    },
    link: 'https://google.github.io/styleguide/tsguide.html#switch-statements',
  },
  {
    id: 'simplify-switch-to-lookup',
    title: 'Replace switch statement with lookup table',
    description:
      'Switch statements that only return values can be simplified to object lookups. ' +
      'This reduces boilerplate and makes the code more declarative.',
    category: 'simplify',
    severity: 'suggestion',
    check: (content, analysis) => {
      const result = analyzeSwitchToLookup(content, analysis?.path);
      return result.detected;
    },
  },
  {
    id: 'simplify-redundant-boolean',
    title: 'Remove redundant boolean expressions',
    description:
      'Expressions like `x === true`, `x ? true : false`, or `Boolean(x)` on booleans ' +
      'are redundant. Use the boolean value directly.',
    category: 'simplify',
    severity: 'best-practice',
    check: (content, analysis) => {
      const result = analyzeRedundantBoolean(content, analysis?.path);
      if (!result.detected) return false;
      // Return rich result with location and fix
      if (result.firstLocation) {
        const loc = result.firstLocation;
        return {
          detected: true,
          line: loc.line,
          snippet: loc.snippet,
          ...(loc.fix && { fix: loc.fix }),
        };
      }
      return result.detected;
    },
    link: 'https://eslint.org/docs/rules/no-extra-boolean-cast',
  },
  {
    id: 'simplify-unnecessary-else',
    title: 'Remove unnecessary else after return/throw',
    description:
      'When a block ends with return, throw, continue, or break, the else is unnecessary. ' +
      'Use early returns to reduce nesting and improve readability.',
    category: 'simplify',
    severity: 'recommendation',
    check: (content, analysis) => {
      const result = analyzeUnnecessaryElse(content, analysis?.path);
      return result.detected;
    },
    link: 'https://eslint.org/docs/rules/no-else-return',
  },
  {
    id: 'simplify-object-shorthand',
    title: 'Use object property shorthand',
    description:
      'When property name matches variable name, use shorthand: `{ name }` instead of `{ name: name }`. ' +
      'This reduces noise and makes code cleaner.',
    category: 'simplify',
    severity: 'best-practice',
    check: (content, analysis) => {
      const result = analyzeObjectShorthand(content, analysis?.path);
      return result.detected;
    },
    link: 'https://eslint.org/docs/rules/object-shorthand',
  },
  {
    id: 'simplify-callback-hell',
    title: 'Flatten nested callbacks with async/await',
    description:
      'Deeply nested callbacks (3+ levels) create "pyramid of doom". ' +
      'Use async/await or Promise chains for better readability.',
    category: 'simplify',
    severity: 'recommendation',
    check: (content, analysis) => {
      const result = analyzeCallbackHell(content, analysis?.path);
      return result.detected;
    },
    link: 'https://javascript.info/async-await',
  },
  {
    id: 'simplify-complex-ternary',
    title: 'Replace complex ternary with if-else',
    description:
      'Nested ternaries or ternaries with complex expressions harm readability. ' +
      'Use if-else for complex conditions, save ternary for simple cases.',
    category: 'simplify',
    severity: 'recommendation',
    check: (content, analysis) => {
      const result = analyzeComplexTernary(content, analysis?.path);
      return result.detected;
    },
    link: 'https://google.github.io/styleguide/tsguide.html#ternary-expressions',
  },
  {
    id: 'simplify-array-chain',
    title: 'Consider combining array method chains',
    description:
      'Multiple filter/map operations iterate the array multiple times. ' +
      'Consider combining into a single reduce for better performance.',
    category: 'simplify',
    severity: 'suggestion',
    check: (content, analysis) => {
      const result = analyzeInefficientArrayChain(content, analysis?.path);
      return result.detected;
    },
  },
  {
    id: 'simplify-string-concat',
    title: 'Use template literals instead of string concatenation',
    description:
      'Template literals (`Hello, ${name}`) are more readable than string concatenation ' +
      '("Hello, " + name). They also preserve formatting better.',
    category: 'simplify',
    severity: 'best-practice',
    check: (content, analysis) => {
      const result = analyzeStringConcatenation(content, analysis?.path);
      return result.detected;
    },
    link: 'https://eslint.org/docs/rules/prefer-template',
  },
  {
    id: 'simplify-negation-chain',
    title: 'Simplify double/triple negations',
    description:
      'Expressions like `!!value` or `!!!value` are confusing. ' +
      'Use explicit Boolean conversion or direct boolean checks.',
    category: 'simplify',
    severity: 'suggestion',
    check: (content, analysis) => {
      const result = analyzeNegationChain(content, analysis?.path);
      return result.detected;
    },
  },
  {
    id: 'simplify-empty-functions',
    title: 'Replace empty function with noop constant',
    description:
      'Multiple empty functions (`() => {}`) should use a shared noop constant. ' +
      'This improves reference equality and reduces memory allocation.',
    category: 'simplify',
    severity: 'suggestion',
    check: (content, analysis) => {
      const result = analyzeEmptyFunctions(content, analysis?.path);
      return result.detected;
    },
  },
  {
    id: 'simplify-spread-vs-assign',
    title: 'Prefer Object.assign for single property updates',
    description:
      'For single property updates, Object.assign is often clearer than spread. ' +
      'Use spread for combining multiple objects.',
    category: 'simplify',
    severity: 'suggestion',
    check: (content) => {
      // Detect { ...obj, key: value } where only one property is added
      // This is a simple pattern check - full AST analysis would be overkill
      const singleSpread = /\{\s*\.\.\.\w+\s*,\s*\w+\s*:\s*[^,}]+\s*\}/g;
      const matches = content.match(singleSpread) || [];
      return matches.length >= 3;
    },
  },
];
