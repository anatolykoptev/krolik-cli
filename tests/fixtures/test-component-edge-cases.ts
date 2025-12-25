/**
 * Test edge cases for SWC-based component parser
 */

import { parseComponents } from './src/commands/context/parsers/components-swc';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Test cases
const testCases = [
  {
    name: 'ServerComponent.tsx',
    content: `// Server component (no 'use client')
export default function ServerComponent() {
  return <div>Server</div>;
}`,
    expected: {
      type: 'server',
      hooks: [],
      fields: [],
    }
  },
  {
    name: 'FormWithController.tsx',
    content: `'use client';
import { Controller } from 'react-hook-form';

export default function FormWithController() {
  return (
    <Controller
      name="email"
      render={({ field }) => <input {...field} />}
    />
  );
}`,
    expected: {
      type: 'client',
      fields: ['email'],
    }
  },
  {
    name: 'ErrorBoundaryComponent.tsx',
    content: `'use client';
export default function ErrorBoundaryComponent() {
  return (
    <ErrorBoundary onError={(error) => console.error(error)}>
      <Content />
    </ErrorBoundary>
  );
}`,
    expected: {
      type: 'client',
      errorHandling: 'callback, boundary',
    }
  },
  {
    name: 'ZustandStore.tsx',
    content: `import { create } from 'zustand';

export const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));`,
    expected: {
      type: 'server',
      state: 'zustand',
    }
  },
  {
    name: 'NoFalsePositives.tsx',
    content: `'use client';
// This has "register" in a string: "Please register here"
// And "useState" in a comment
const description = "register('field')";

export default function NoFalsePositives() {
  return <div>Test</div>;
}`,
    expected: {
      type: 'client',
      hooks: [],
      fields: [], // Should NOT detect "field" from string
    }
  },
];

// Create temp directory
const tempDir = path.join(process.cwd(), '.test-edge-cases');
fs.mkdirSync(tempDir, { recursive: true });

try {
  console.log('Testing edge cases...\n');

  for (const testCase of testCases) {
    const testFile = path.join(tempDir, testCase.name);
    fs.writeFileSync(testFile, testCase.content);

    const results = parseComponents(tempDir, [testCase.name.replace('.tsx', '')]);

    console.log(`=== ${testCase.name} ===`);

    if (results.length === 0) {
      console.log('❌ No results returned');
      continue;
    }

    const result = results[0];
    let allPassed = true;

    // Check expected fields
    for (const [key, expectedValue] of Object.entries(testCase.expected)) {
      const actualValue = result?.[key as keyof typeof result];

      if (Array.isArray(expectedValue)) {
        const match = JSON.stringify(expectedValue.sort()) === JSON.stringify((actualValue as string[] || []).sort());
        console.log(`  ${key}: ${match ? '✅' : '❌'} ${JSON.stringify(actualValue)} (expected: ${JSON.stringify(expectedValue)})`);
        if (!match) allPassed = false;
      } else if (typeof expectedValue === 'string') {
        const match = actualValue === expectedValue;
        console.log(`  ${key}: ${match ? '✅' : '❌'} "${actualValue}" (expected: "${expectedValue}")`);
        if (!match) allPassed = false;
      }
    }

    console.log(`  Overall: ${allPassed ? '✅ PASS' : '❌ FAIL'}\n`);

    // Cleanup individual file
    fs.unlinkSync(testFile);
  }

  console.log('✅ All edge case tests completed');
} finally {
  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
}
