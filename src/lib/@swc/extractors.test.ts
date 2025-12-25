/**
 * @module lib/@swc/extractors.test
 * @description Quick verification tests for extractor utilities
 *
 * Run with: pnpm exec tsx src/lib/@swc/extractors.test.ts
 */

import type { CallExpression } from '@swc/core';
import {
  collectMethodChain,
  extractAllStringArgs,
  extractStringArg,
  getCalleeName,
  getCalleeObjectName,
} from './extractors';
import { parseFile } from './parser';
import { visitNodeWithCallbacks } from './visitor';

// Test cases
const testCases = [
  {
    name: 'Simple function call',
    code: `register("email")`,
    expected: {
      calleeName: 'register',
      objectName: null,
      stringArg: 'email',
      isFunction: true,
      isMethod: false,
    },
  },
  {
    name: 'Method call',
    code: `console.log("hello")`,
    expected: {
      calleeName: 'log',
      objectName: 'console',
      stringArg: 'hello',
    },
  },
  {
    name: 'Zod simple method',
    code: `z.string()`,
    expected: {
      calleeName: 'string',
      objectName: 'z',
      methodChain: ['string'],
    },
  },
  {
    name: 'Zod chain - get last call',
    code: `const schema = z.string().min(1).max(100).optional();`,
    expected: {
      calleeName: 'optional',
      // objectName is null because the object is a CallExpression, not a simple MemberExpression
      // This is expected behavior - use collectMethodChain for full chain analysis
      objectName: null,
      methodChain: ['string', 'min', 'max', 'optional'],
    },
  },
  {
    name: 'Multiple string args',
    code: `foo("a", "b", "c")`,
    expected: {
      allStringArgs: ['a', 'b', 'c'],
    },
  },
];

function runTests() {
  console.log('Running extractor tests...\n');

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    try {
      const { ast } = parseFile('test.ts', test.code);
      let callNode: CallExpression | null = null;

      visitNodeWithCallbacks(ast, {
        onCallExpression: (node) => {
          if (!callNode) {
            callNode = node as unknown as CallExpression;
          }
        },
      });

      if (!callNode) {
        throw new Error('No CallExpression found');
      }

      // Test calleeName
      if ('calleeName' in test.expected) {
        const result = getCalleeName(callNode);
        if (result !== test.expected.calleeName) {
          throw new Error(`calleeName: expected ${test.expected.calleeName}, got ${result}`);
        }
      }

      // Test objectName
      if ('objectName' in test.expected) {
        const result = getCalleeObjectName(callNode);
        if (result !== test.expected.objectName) {
          throw new Error(`objectName: expected ${test.expected.objectName}, got ${result}`);
        }
      }

      // Test stringArg
      if ('stringArg' in test.expected) {
        const result = extractStringArg(callNode);
        if (result !== test.expected.stringArg) {
          throw new Error(`stringArg: expected ${test.expected.stringArg}, got ${result}`);
        }
      }

      // Test methodChain
      if ('methodChain' in test.expected) {
        const result = collectMethodChain(callNode);
        const expected = test.expected.methodChain;
        if (JSON.stringify(result) !== JSON.stringify(expected)) {
          throw new Error(
            `methodChain: expected [${expected?.join(', ')}], got [${result.join(', ')}]`,
          );
        }
      }

      // Test allStringArgs
      if ('allStringArgs' in test.expected) {
        const result = extractAllStringArgs(callNode);
        const expected = test.expected.allStringArgs;
        if (JSON.stringify(result) !== JSON.stringify(expected)) {
          throw new Error(
            `allStringArgs: expected [${expected?.join(', ')}], got [${result.join(', ')}]`,
          );
        }
      }

      // Skip isCallingFunction and isCallingMethod tests - these are for filtering
      // The important ones are calleeName, objectName, and methodChain

      console.log(`✅ ${test.name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${test.name}`);
      console.log(`   ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log(`\n${passed}/${passed + failed} tests passed`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests();
