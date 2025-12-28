/**
 * @module commands/codegen/templates/enhanced/test
 * @description Docs-enhanced test file template
 */

import { toPascalCase } from '@/lib/format';
import type { DocHints } from '../../services/types';

/**
 * Generate test file with docs enhancement
 */
export function testEnhanced(
  componentName: string,
  componentPath: string,
  isReact: boolean,
  hints: DocHints,
): string {
  const pascalName = toPascalCase(componentName);
  const relativePath = componentPath.replace(/\.(tsx?|jsx?)$/, '');

  const sourceComment = hints.enhanced ? `\n * @enhanced Sources: ${hints.sources.join(', ')}` : '';

  if (isReact) {
    return `/**
 * @module tests/${componentName}
 * @description Tests for ${pascalName} component${sourceComment}
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ${pascalName} } from '${relativePath}';

describe('${pascalName}', () => {
  it('renders without crashing', () => {
    render(<${pascalName} />);
    // Add specific assertions based on component
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<${pascalName} />);

    // Example: clicking a button
    // const button = screen.getByRole('button');
    // await user.click(button);
    // expect(...).toBe(...);
  });

  it('displays correct content', () => {
    render(<${pascalName} />);
    // Add content assertions
  });
});
`;
  }

  return `/**
 * @module tests/${componentName}
 * @description Tests for ${pascalName}${sourceComment}
 */

import { describe, expect, it, vi } from 'vitest';
import { ${pascalName} } from '${relativePath}';

describe('${pascalName}', () => {
  it('works correctly', () => {
    // Add test implementation
    expect(true).toBe(true);
  });

  it('handles edge cases', () => {
    // Add edge case tests
  });

  it('handles errors gracefully', () => {
    // Add error handling tests
  });
});
`;
}
