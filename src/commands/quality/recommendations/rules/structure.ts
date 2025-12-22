/**
 * @module commands/quality/recommendations/rules/structure
 * @description Code structure recommendations
 */

import type { Recommendation } from '../types';

export const STRUCTURE_RULES: Recommendation[] = [
  {
    id: 'structure-early-return',
    title: 'Use early returns to reduce nesting',
    description: 'Instead of if-else chains, use early returns for guard clauses',
    category: 'structure',
    severity: 'recommendation',
    check: (content) => {
      const lines = content.split('\n');
      let maxIndent = 0;
      for (const line of lines) {
        if (line.includes('if') || line.includes('else')) {
          const indent = line.search(/\S/);
          maxIndent = Math.max(maxIndent, indent);
        }
      }
      return maxIndent > 16;
    },
  },
  {
    id: 'structure-no-nested-ternary',
    title: 'Avoid nested ternary operators',
    description: 'Use if-else or extract to variables for complex conditions',
    category: 'structure',
    severity: 'recommendation',
    pattern: /\?[^:]+\?[^:]+:/,
  },
  {
    id: 'structure-destructure-props',
    title: 'Destructure props in function signature',
    description: 'Use ({ name, age }) instead of (props) then props.name',
    category: 'structure',
    severity: 'suggestion',
    antiPattern: /function\s+\w+\s*\(\s*props\s*[):]/,
  },
  {
    id: 'structure-prefer-const',
    title: 'Prefer const over let',
    description: 'Use const by default, let only when reassignment is needed',
    category: 'structure',
    severity: 'best-practice',
    check: (content) => {
      const letCount = (content.match(/\blet\s+/g) || []).length;
      const constCount = (content.match(/\bconst\s+/g) || []).length;
      return letCount > constCount * 0.3;
    },
  },
  {
    id: 'structure-single-responsibility',
    title: 'Keep functions focused on a single task',
    description: 'Functions doing multiple things should be split',
    category: 'structure',
    severity: 'recommendation',
    check: (content, analysis) => {
      // Check if any function has multiple "await" with different purposes
      return analysis.functions.some((f) => f.lines > 40 && f.complexity > 8);
    },
  },
  {
    id: 'structure-no-magic-strings',
    title: 'Extract repeated strings to constants',
    description: 'Avoid magic strings scattered throughout code',
    category: 'structure',
    severity: 'suggestion',
    check: (content) => {
      // Find strings that appear more than twice
      const stringPattern = /'[^']{3,}'|"[^"]{3,}"/g;
      const strings = content.match(stringPattern) || [];
      const counts = new Map<string, number>();
      for (const s of strings) {
        counts.set(s, (counts.get(s) || 0) + 1);
      }
      return [...counts.values()].some((c) => c > 2);
    },
  },
];
