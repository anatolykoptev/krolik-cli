/**
 * @module commands/quality/recommendations/rules/imports
 * @description Import organization recommendations
 */

import type { Recommendation } from '../types';

export const IMPORTS_RULES: Recommendation[] = [
  {
    id: 'imports-no-default-export',
    title: 'Prefer named exports over default exports',
    description: 'Named exports improve refactoring and IDE support',
    category: 'imports',
    severity: 'suggestion',
    pattern: /export\s+default\s+(?:function|class|const)/,
  },
  {
    id: 'imports-group-order',
    title: 'Organize imports: external, then internal, then relative',
    description: 'Group imports by source for better readability',
    category: 'imports',
    severity: 'suggestion',
    check: (content) => {
      const lines = content.split('\n');
      let lastType: 'external' | 'internal' | 'relative' | null = null;
      let violations = 0;

      for (const line of lines) {
        if (!line.startsWith('import')) continue;

        let currentType: 'external' | 'internal' | 'relative';
        if (line.includes("from '~") || line.includes("from '@/")) {
          currentType = 'internal';
        } else if (line.includes("from './") || line.includes("from '../")) {
          currentType = 'relative';
        } else {
          currentType = 'external';
        }

        if (lastType === 'relative' && currentType !== 'relative') violations++;
        if (lastType === 'internal' && currentType === 'external') violations++;

        lastType = currentType;
      }

      return violations > 0;
    },
  },
  {
    id: 'imports-no-star',
    title: 'Avoid import * (namespace imports)',
    description: 'Use named imports for tree-shaking and explicit dependencies',
    category: 'imports',
    severity: 'recommendation',
    pattern: /import\s+\*\s+as\s+\w+\s+from/,
  },
  {
    id: 'imports-no-side-effects',
    title: 'Avoid import statements with side effects',
    description: 'Side-effect imports make dependencies unclear',
    category: 'imports',
    severity: 'suggestion',
    pattern: /^import\s+['"][^'"]+['"];?\s*$/m,
  },
  {
    id: 'imports-barrel-files',
    title: 'Consider barrel files (index.ts) for module exports',
    description: 'Centralize exports for cleaner import paths',
    category: 'imports',
    severity: 'suggestion',
    check: (content, _analysis) => {
      // Check if there are many exports from same folder
      const relativeImports = content.match(/from\s+['"]\.\/[^'"]+['"]/g) || [];
      return relativeImports.length > 5;
    },
  },
  {
    id: 'imports-no-circular',
    title: 'Avoid potential circular dependencies',
    description: 'Circular imports can cause runtime issues',
    category: 'imports',
    severity: 'best-practice',
    check: (content, analysis) => {
      // Check if file imports from parent and is imported by parent
      const hasParentImport = content.includes("from '../");
      const hasTypeImport = content.includes('import type');
      // If importing from parent without type-only, might be circular
      return hasParentImport && !hasTypeImport && analysis.exports > 3;
    },
  },
];
