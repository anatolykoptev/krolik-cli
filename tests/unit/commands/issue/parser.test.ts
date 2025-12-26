/**
 * @module tests/issue/parser
 * @description Tests for GitHub issue parser
 */

import { describe, expect, it } from 'vitest';
import {
  detectPriority,
  extractCodeBlocks,
  extractMentionedFiles,
  parseChecklist,
  parseIssue,
} from '../../../../src/commands/issue/parser';

describe('parseChecklist', () => {
  it('extracts checked items', () => {
    const body = `
- [x] First task done
- [X] Second task done
    `;
    const items = parseChecklist(body);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ text: 'First task done', checked: true });
    expect(items[1]).toEqual({ text: 'Second task done', checked: true });
  });

  it('extracts unchecked items', () => {
    const body = `
- [ ] First task pending
- [ ] Second task pending
    `;
    const items = parseChecklist(body);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ text: 'First task pending', checked: false });
    expect(items[1]).toEqual({ text: 'Second task pending', checked: false });
  });

  it('handles mixed checked and unchecked', () => {
    const body = `
- [x] Done
- [ ] Todo
- [X] Also done
    `;
    const items = parseChecklist(body);
    expect(items).toHaveLength(3);
    expect(items[0]?.checked).toBe(true);
    expect(items[1]?.checked).toBe(false);
    expect(items[2]?.checked).toBe(true);
  });

  it('handles asterisk syntax', () => {
    const body = `
* [x] Task with asterisk
* [ ] Another task
    `;
    const items = parseChecklist(body);
    expect(items).toHaveLength(2);
  });

  it('returns empty array for empty body', () => {
    expect(parseChecklist('')).toEqual([]);
  });

  it('ignores non-checklist content', () => {
    const body = `
This is regular text.
- Regular list item
[x] Not a checkbox
    `;
    const items = parseChecklist(body);
    expect(items).toHaveLength(0);
  });
});

describe('extractMentionedFiles', () => {
  it('finds src/ paths', () => {
    const body = 'Check src/components/Button.tsx for the issue';
    const files = extractMentionedFiles(body);
    expect(files).toContain('src/components/Button.tsx');
  });

  it('finds backtick-quoted paths', () => {
    const body = 'Look at `utils/helper.ts` for reference';
    const files = extractMentionedFiles(body);
    expect(files).toContain('utils/helper.ts');
  });

  it('finds markdown link paths', () => {
    const body = 'See [this file](lib/parser.ts) for details';
    const files = extractMentionedFiles(body);
    expect(files).toContain('lib/parser.ts');
  });

  it('finds multiple paths', () => {
    const body = `
Files to check:
- src/index.ts
- \`packages/api/router.ts\`
- [config](lib/config.ts)
    `;
    const files = extractMentionedFiles(body);
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it('deduplicates paths', () => {
    const body = 'Check src/app.ts and also src/app.ts again';
    const files = extractMentionedFiles(body);
    const appCount = files.filter((f) => f === 'src/app.ts').length;
    expect(appCount).toBeLessThanOrEqual(1);
  });

  it('returns empty array for no files', () => {
    const body = 'Just regular text without any file paths';
    expect(extractMentionedFiles(body)).toEqual([]);
  });

  it('returns empty array for empty body', () => {
    expect(extractMentionedFiles('')).toEqual([]);
  });
});

describe('detectPriority', () => {
  it('detects critical from labels', () => {
    expect(detectPriority(['critical'], '')).toBe('critical');
    expect(detectPriority(['urgent'], '')).toBe('critical');
    expect(detectPriority(['priority:critical'], '')).toBe('critical');
  });

  it('detects high from labels', () => {
    expect(detectPriority(['high'], '')).toBe('high');
    expect(detectPriority(['important'], '')).toBe('high');
    expect(detectPriority(['priority:high'], '')).toBe('high');
  });

  it('detects medium from labels', () => {
    expect(detectPriority(['medium'], '')).toBe('medium');
    expect(detectPriority(['priority:medium'], '')).toBe('medium');
  });

  it('detects low from labels', () => {
    expect(detectPriority(['low'], '')).toBe('low');
    expect(detectPriority(['minor'], '')).toBe('low');
    expect(detectPriority(['priority:low'], '')).toBe('low');
  });

  it('detects priority from body keywords', () => {
    expect(detectPriority([], 'This is critical')).toBe('critical');
    expect(detectPriority([], 'This is urgent')).toBe('critical');
    expect(detectPriority([], 'This is a blocker')).toBe('critical');
    expect(detectPriority([], 'This is important')).toBe('high');
    expect(detectPriority([], 'This is low priority')).toBe('low');
  });

  it('prefers labels over body', () => {
    expect(detectPriority(['low'], 'This is critical')).toBe('low');
  });

  it('defaults to medium', () => {
    expect(detectPriority([], '')).toBe('medium');
    expect(detectPriority([], 'Regular issue')).toBe('medium');
  });
});

describe('extractCodeBlocks', () => {
  it('extracts code blocks with language', () => {
    const body = `
\`\`\`typescript
const x = 1;
\`\`\`
    `;
    const blocks = extractCodeBlocks(body);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      language: 'typescript',
      code: 'const x = 1;',
    });
  });

  it('handles blocks without language', () => {
    const body = `
\`\`\`
plain text
\`\`\`
    `;
    const blocks = extractCodeBlocks(body);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.language).toBe('text');
  });

  it('extracts multiple blocks', () => {
    const body = `
\`\`\`ts
code1
\`\`\`

\`\`\`js
code2
\`\`\`
    `;
    const blocks = extractCodeBlocks(body);
    expect(blocks).toHaveLength(2);
  });

  it('returns empty array for no blocks', () => {
    expect(extractCodeBlocks('No code here')).toEqual([]);
  });

  it('returns empty array for empty body', () => {
    expect(extractCodeBlocks('')).toEqual([]);
  });
});

describe('parseIssue', () => {
  const baseIssue = {
    number: 123,
    title: 'Test Issue',
    body: '',
    state: 'open' as const,
    labels: [],
    assignees: [],
    url: 'https://github.com/owner/repo/issues/123',
  };

  it('returns all required fields', () => {
    const result = parseIssue(baseIssue);

    expect(result.number).toBe(123);
    expect(result.title).toBe('Test Issue');
    expect(result.state).toBe('open');
    expect(result.url).toBe('https://github.com/owner/repo/issues/123');
    expect(result.checklist).toEqual([]);
    expect(result.mentionedFiles).toEqual([]);
    expect(result.codeBlocks).toEqual([]);
    expect(result.priority).toBe('medium');
  });

  it('parses complex issue', () => {
    const issue = {
      ...baseIssue,
      body: `
## Problem

Check src/app.ts for the bug.

## Tasks

- [x] Fix bug
- [ ] Add tests

\`\`\`typescript
const fix = true;
\`\`\`
      `,
      labels: ['high', 'bug'],
    };

    const result = parseIssue(issue);

    expect(result.checklist).toHaveLength(2);
    expect(result.mentionedFiles).toContain('src/app.ts');
    expect(result.codeBlocks).toHaveLength(1);
    expect(result.priority).toBe('high');
  });
});
