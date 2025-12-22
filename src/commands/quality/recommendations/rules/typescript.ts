/**
 * @module commands/quality/recommendations/rules/typescript
 * @description TypeScript best practices recommendations
 */

import type { Recommendation } from '../types';

export const TYPESCRIPT_RULES: Recommendation[] = [
  {
    id: 'ts-prefer-interface',
    title: 'Prefer interface over type for object shapes',
    description: 'Use interface for object types, type for unions/intersections',
    category: 'typescript',
    severity: 'suggestion',
    check: (content) => {
      const typeObjects = (content.match(/type\s+\w+\s*=\s*\{/g) || []).length;
      return typeObjects > 3;
    },
  },
  {
    id: 'ts-explicit-return-type',
    title: 'Add explicit return types to exported functions',
    description: 'Exported functions should have explicit return types for better documentation',
    category: 'typescript',
    severity: 'recommendation',
    antiPattern: /export\s+(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*\{/,
  },
  {
    id: 'ts-use-unknown',
    title: 'Use unknown instead of any for type safety',
    description: 'unknown forces type checking before use, any disables it',
    category: 'typescript',
    severity: 'best-practice',
    pattern: /:\s*any\b/,
  },
  {
    id: 'ts-strict-equality',
    title: 'Use strict equality (===) instead of loose (==)',
    description: 'Strict equality prevents type coercion bugs',
    category: 'typescript',
    severity: 'best-practice',
    pattern: /[^!=]==[^=]/,
  },
  {
    id: 'ts-no-non-null-assertion',
    title: 'Avoid non-null assertion operator (!)',
    description: 'Use optional chaining (?.) or proper null checks instead',
    category: 'typescript',
    severity: 'recommendation',
    pattern: /\w+!\./,
  },
  {
    id: 'ts-prefer-readonly',
    title: 'Use readonly for properties that should not change',
    description: 'Mark class properties as readonly when they are set only in constructor',
    category: 'typescript',
    severity: 'suggestion',
    check: (content) => {
      // Check for class with constructor-only assignments
      const hasClass = /class\s+\w+/.test(content);
      const hasPrivateProps = /private\s+\w+\s*[;:]/.test(content);
      const noReadonly = !content.includes('readonly');
      return hasClass && hasPrivateProps && noReadonly;
    },
  },
  {
    id: 'ts-use-satisfies',
    title: 'Use satisfies for type checking without widening',
    description: 'satisfies preserves literal types while checking assignability',
    category: 'typescript',
    severity: 'suggestion',
    check: (content) => {
      // Check for as const that could use satisfies
      return /}\s+as\s+const\s+as\s+\w+/.test(content);
    },
  },
  {
    id: 'ts-prefer-nullish',
    title: 'Use nullish coalescing (??) instead of || for defaults',
    description: '|| treats 0 and "" as falsy, ?? only treats null/undefined',
    category: 'typescript',
    severity: 'recommendation',
    check: (content) => {
      // Check for || with likely number/string defaults
      return /\|\|\s*(?:0|''|""|false)\b/.test(content);
    },
  },
];
