/**
 * XML Formatter for PRD output
 *
 * @module commands/prd/formatters/xml
 */

import { escapeXml } from '@/lib/@format';
import type { PRD, PrdGenerationResult } from '../types';

/**
 * Format PRD as AI-friendly XML
 */
export function formatPrdXml(prd: PRD): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<prd version="${escapeXml(prd.version)}" project="${escapeXml(prd.project)}">`);

  if (prd.title) {
    lines.push(`  <title>${escapeXml(prd.title)}</title>`);
  }

  if (prd.description) {
    lines.push(`  <description>${escapeXml(prd.description)}</description>`);
  }

  // Config section
  if (prd.config) {
    lines.push('  <config>');
    lines.push(`    <max-attempts>${prd.config.maxAttempts}</max-attempts>`);
    lines.push(`    <model>${escapeXml(prd.config.model)}</model>`);
    lines.push(`    <temperature>${prd.config.temperature}</temperature>`);
    lines.push(`    <auto-commit>${prd.config.autoCommit}</auto-commit>`);
    lines.push(`    <continue-on-failure>${prd.config.continueOnFailure}</continue-on-failure>`);
    lines.push('  </config>');
  }

  // Tasks
  lines.push(`  <tasks count="${prd.tasks.length}">`);
  for (const task of prd.tasks) {
    lines.push(`    <task id="${escapeXml(task.id)}" priority="${task.priority}">`);
    lines.push(`      <title>${escapeXml(task.title)}</title>`);
    lines.push(`      <description>${escapeXml(task.description)}</description>`);

    if (task.complexity) {
      lines.push(`      <complexity>${task.complexity}</complexity>`);
    }

    // Acceptance criteria
    lines.push('      <acceptance-criteria>');
    for (const criterion of task.acceptance_criteria) {
      if (typeof criterion === 'string') {
        lines.push(`        <criterion>${escapeXml(criterion)}</criterion>`);
      } else {
        lines.push(`        <criterion id="${escapeXml(criterion.id)}">`);
        lines.push(`          <description>${escapeXml(criterion.description)}</description>`);
        if (criterion.testCommand) {
          lines.push(`          <test-command>${escapeXml(criterion.testCommand)}</test-command>`);
        }
        lines.push('        </criterion>');
      }
    }
    lines.push('      </acceptance-criteria>');

    // Files affected
    if (task.files_affected.length > 0) {
      lines.push('      <files-affected>');
      for (const file of task.files_affected) {
        lines.push(`        <file>${escapeXml(file)}</file>`);
      }
      lines.push('      </files-affected>');
    }

    // Dependencies
    if (task.dependencies.length > 0) {
      lines.push(
        `      <dependencies>${task.dependencies.map((d) => escapeXml(d)).join(', ')}</dependencies>`,
      );
    }

    // Tags
    if (task.tags.length > 0) {
      lines.push(`      <tags>${task.tags.map((t) => escapeXml(t)).join(', ')}</tags>`);
    }

    lines.push('    </task>');
  }
  lines.push('  </tasks>');

  // Metadata
  if (prd.metadata) {
    lines.push('  <metadata>');
    if (prd.metadata.author) {
      lines.push(`    <author>${escapeXml(prd.metadata.author)}</author>`);
    }
    if (prd.metadata.tags?.length) {
      lines.push(`    <tags>${prd.metadata.tags.map((t) => escapeXml(t)).join(', ')}</tags>`);
    }
    if (prd.metadata.notes) {
      lines.push(`    <notes>${escapeXml(prd.metadata.notes)}</notes>`);
    }
    lines.push('  </metadata>');
  }

  lines.push('</prd>');

  return lines.join('\n');
}

/**
 * Format generation result as XML
 */
export function formatResultXml(result: PrdGenerationResult): string {
  if (!result.success) {
    const errors = result.errors?.map((e) => `<error>${escapeXml(e)}</error>`).join('\n  ') ?? '';
    return `<prd-generation error="true">
  <message>Failed to generate PRD</message>
  ${errors}
  <meta>
    <issue>${result.meta.issueNumber}</issue>
    <duration-ms>${result.meta.durationMs}</duration-ms>
  </meta>
</prd-generation>`;
  }

  if (result.prd) {
    const prdXml = formatPrdXml(result.prd);
    const savedPath = result.meta.savedPath
      ? `\n<!-- Saved to: ${escapeXml(result.meta.savedPath)} -->`
      : '';
    return prdXml + savedPath;
  }

  return (
    result.xml ??
    '<prd-generation error="true"><message>No PRD generated</message></prd-generation>'
  );
}
