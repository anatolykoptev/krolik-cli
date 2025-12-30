/**
 * @module commands/fix/fixers/hardcoded-urls
 * @description Hardcoded URLs fixer
 *
 * Detects hardcoded URLs and extracts them to named constants.
 */

import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';

export const metadata = createFixerMetadata('hardcoded-urls', 'Hardcoded URLs', 'hardcoded', {
  description: 'Extract hardcoded URLs to constants',
  difficulty: 'risky', // TODO: not production-ready
  cliFlag: '--fix-urls',
  tags: ['safe', 'hardcoded', 'refactoring'],
});

// URL pattern
const URL_PATTERN = /(["'`])(https?:\/\/[^"'`\s]+)\1/g;

// URLs to skip (localhost, example.com, etc)
const SKIP_HOSTS = ['localhost', '127.0.0.1', 'example.com', 'example.org'];

function analyzeUrls(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  // Skip config and test files
  if (
    file.includes('.config.') ||
    file.includes('.test.') ||
    file.includes('.spec.') ||
    file.endsWith('.d.ts')
  ) {
    return issues;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    URL_PATTERN.lastIndex = 0;
    let match;

    // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex exec loop
    while ((match = URL_PATTERN.exec(line)) !== null) {
      const url = match[2] ?? '';

      // Skip localhost and example URLs
      try {
        const parsed = new URL(url);
        if (SKIP_HOSTS.some((h) => parsed.hostname.includes(h))) continue;
      } catch {
        continue;
      }

      issues.push({
        file,
        line: i + 1,
        severity: 'warning',
        category: 'hardcoded',
        message: `Hardcoded URL: ${url.slice(0, 40)}...`,
        suggestion: 'Extract to environment variable or constant',
        snippet: trimmed.slice(0, 60),
        fixerId: 'hardcoded-urls',
      });
    }
  }

  return issues;
}

function fixUrlIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lines = content.split('\n');
  const line = lines[issue.line - 1];
  if (!line) return null;

  // Extract URL from the line
  URL_PATTERN.lastIndex = 0;
  const match = URL_PATTERN.exec(line);
  if (!match) return null;

  const quote = match[1] ?? '"';
  const url = match[2] ?? '';

  // Generate constant name from URL
  let constName = 'API_URL';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname
      .replace(/^www\./, '')
      .replace(/\./g, '_')
      .toUpperCase();
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    if (pathParts.length > 0 && pathParts[0] !== 'api') {
      constName = `${host}_${pathParts[0]?.toUpperCase()}_URL`;
    } else {
      constName = `${host}_URL`;
    }
  } catch {
    // Keep default
  }

  // Create fix: add constant at top and replace usage
  const constDeclaration = `const ${constName} = ${quote}${url}${quote};\n`;
  const newLine = line.replace(match[0], constName);

  return {
    action: 'replace-range',
    file: issue.file,
    line: 1,
    endLine: issue.line,
    oldCode: lines.slice(0, issue.line).join('\n'),
    newCode: `${constDeclaration + lines.slice(0, issue.line - 1).join('\n')}\n${newLine}`,
  };
}

export const hardcodedUrlsFixer: Fixer = {
  metadata,
  analyze: analyzeUrls,
  fix: fixUrlIssue,
};
