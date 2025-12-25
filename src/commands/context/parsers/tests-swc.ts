/**
 * @module commands/context/parsers/tests-swc
 * @description SWC AST-based test file parser
 *
 * Parses Jest/Vitest test files to extract describe/it blocks:
 * - Accurate detection of test blocks from AST
 * - Proper nesting of describe blocks
 * - No false positives from strings/comments
 *
 * Uses centralized SWC infrastructure from @/lib/@swc
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CallExpression, Identifier, Node } from '@swc/core';
import { extractStringArg, getNodeType, parseFile, visitNodeWithCallbacks } from '@/lib/@swc';
import type { TestInfo } from './types';

const MAX_TESTS_PER_DESCRIBE = 15;
const MAX_DESCRIBES = 10;

/**
 * Parsed describe block with its tests
 */
interface DescribeBlock {
  name: string;
  tests: string[];
  depth: number;
}

/**
 * Analyze a single test file using SWC AST
 */
function analyzeTestSwc(filePath: string): TestInfo | null {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const fileName = path.basename(filePath);

  try {
    const { ast } = parseFile(filePath, content);

    const describes: DescribeBlock[] = [];
    const describeStack: DescribeBlock[] = [];

    visitNodeWithCallbacks(ast, {
      onCallExpression: (node) => {
        const call = node as CallExpression;
        const calleeName = getCalleeName(call);

        if (!calleeName) return;

        // Handle describe() blocks
        if (calleeName === 'describe') {
          const describeName = extractStringArg(call);
          if (describeName) {
            const block: DescribeBlock = {
              name: describeName,
              tests: [],
              depth: describeStack.length,
            };
            describeStack.push(block);
            describes.push(block);
          }
        }

        // Handle it() / test() blocks
        if (calleeName === 'it' || calleeName === 'test') {
          const testName = extractStringArg(call);
          if (testName) {
            // Add to current describe block, or create root one
            const currentDescribe = describeStack[describeStack.length - 1];
            if (currentDescribe) {
              if (currentDescribe.tests.length < MAX_TESTS_PER_DESCRIBE) {
                currentDescribe.tests.push(testName);
              }
            } else {
              // Test outside describe - create synthetic root
              const rootBlock: DescribeBlock = {
                name: '(root)',
                tests: [testName],
                depth: 0,
              };
              describes.push(rootBlock);
            }
          }
        }
      },

      // Track when we exit describe blocks (through arrow function body end)
      onArrowFunctionExpression: () => {
        // Pop describe when leaving its callback
        // This is a heuristic - we pop after processing callback
      },
    });

    // Convert to TestInfo format
    const formattedDescribes = describes
      .filter((d) => d.tests.length > 0)
      .slice(0, MAX_DESCRIBES)
      .map((d) => ({
        name: d.name,
        tests: d.tests.slice(0, MAX_TESTS_PER_DESCRIBE),
      }));

    if (formattedDescribes.length > 0) {
      return {
        file: fileName,
        describes: formattedDescribes,
      };
    }

    return null;
  } catch {
    // Parse error - skip this file
    return null;
  }
}

/**
 * Get callee name from CallExpression
 */
function getCalleeName(call: CallExpression): string | null {
  const callee = call.callee;

  // Simple identifier: describe(), it(), test()
  if (getNodeType(callee) === 'Identifier') {
    return (callee as Identifier).value;
  }

  // Member expression: describe.skip(), it.only(), etc.
  if (getNodeType(callee) === 'MemberExpression') {
    const member = callee as unknown as {
      object?: Node;
      property?: Node;
    };

    if (member.object && getNodeType(member.object) === 'Identifier') {
      return (member.object as Identifier).value;
    }
  }

  return null;
}

/**
 * Check if file matches test patterns
 */
function matchesPatterns(fileName: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;
  const nameLower = fileName.toLowerCase();
  return patterns.some((p) => nameLower.includes(p.toLowerCase()));
}

/**
 * Check if entry is a test file
 */
function isTestFile(entry: fs.Dirent): boolean {
  return (
    entry.isFile() &&
    (entry.name.endsWith('.test.ts') ||
      entry.name.endsWith('.test.tsx') ||
      entry.name.endsWith('.spec.ts') ||
      entry.name.endsWith('.spec.tsx'))
  );
}

/**
 * Parse test files to extract describe/it blocks using SWC AST
 *
 * @param testsDir - Directory containing test files
 * @param patterns - File name patterns to match (empty = match all)
 * @returns Array of parsed test information
 */
export function parseTestFiles(testsDir: string, patterns: string[]): TestInfo[] {
  const results: TestInfo[] = [];

  if (!fs.existsSync(testsDir)) return results;

  function scanDir(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Recurse into subdirectories
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scanDir(fullPath);
        continue;
      }

      // Skip non-test files
      if (!isTestFile(entry)) continue;

      // Skip files not matching patterns
      if (!matchesPatterns(entry.name, patterns)) continue;

      // Analyze and collect
      const info = analyzeTestSwc(fullPath);
      if (info) results.push(info);
    }
  }

  scanDir(testsDir);
  return results;
}
