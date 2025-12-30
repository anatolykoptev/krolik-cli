/**
 * @module commands/review/output
 * @description Review output formatters
 */

import { groupByPropertyToRecord } from '@/lib/@core';
import { escapeXml, formatJson as formatJsonBase } from '@/lib/@format';
import type { Logger } from '../../types/commands/base';
import type { ReviewResult } from '../../types/commands/review';

/**
 * Print review to console
 */
export function printReview(review: ReviewResult, logger: Logger): void {
  logger.section(`Review: ${review.title}`);
  console.log(`\x1b[2m${review.baseBranch} → ${review.headBranch}\x1b[0m\n`);

  // Summary
  const riskIcon = { low: '🟢', medium: '🟡', high: '🔴' }[review.summary.riskLevel];
  console.log('=== Summary ===');
  console.log(
    `Files: ${review.summary.totalFiles} | +${review.summary.additions} -${review.summary.deletions}`,
  );
  console.log(`Risk: ${riskIcon} ${review.summary.riskLevel.toUpperCase()}`);
  if (review.summary.testsRequired) console.log('⚠️  Tests: REQUIRED');
  if (review.summary.docsRequired) console.log('⚠️  Docs: REQUIRED');
  console.log('');

  // Affected features
  if (review.affectedFeatures.length > 0) {
    console.log('=== Affected Features ===');
    for (const feature of review.affectedFeatures) {
      console.log(`  - ${feature}`);
    }
    console.log('');
  }

  // Files
  console.log('=== Changed Files ===');
  for (const file of review.files) {
    const stats = file.binary ? 'binary' : `+${file.additions} -${file.deletions}`;
    const status = file.status[0]?.toUpperCase() ?? 'M';
    console.log(`  [${status}] ${file.path} (${stats})`);
  }
  console.log('');

  // Issues
  if (review.issues.length > 0) {
    console.log('=== Issues Found ===');
    const grouped = groupByPropertyToRecord(review.issues, 'severity');

    if (grouped.error) {
      console.log('\x1b[31mERRORS:\x1b[0m');
      for (const issue of grouped.error) {
        console.log(`  [${issue.category}] ${issue.file}: ${issue.message}`);
      }
    }

    if (grouped.warning) {
      console.log('\x1b[33mWARNINGS:\x1b[0m');
      for (const issue of grouped.warning) {
        console.log(`  [${issue.category}] ${issue.file}: ${issue.message}`);
      }
    }

    if (grouped.info) {
      console.log('\x1b[34mINFO:\x1b[0m');
      for (const issue of grouped.info) {
        console.log(`  [${issue.category}] ${issue.file}: ${issue.message}`);
      }
    }
  } else {
    console.log('=== No Issues Found ===');
  }
  console.log('');

  // Documentation references
  if (review.docsReferences && review.docsReferences.length > 0) {
    console.log('=== Best Practices ===');
    console.log('\x1b[36mRelevant documentation from cached library docs:\x1b[0m');
    for (const ref of review.docsReferences) {
      console.log(`  \x1b[1m${ref.title}\x1b[0m (${ref.library})`);
      console.log(`    ${ref.snippet}`);
    }
    console.log('');
  }
}

/**
 * Format review as JSON
 */
export function formatJson(review: ReviewResult): string {
  return formatJsonBase(review);
}

/**
 * Format review as AI-friendly XML
 */
export function formatAI(review: ReviewResult): string {
  const lines: string[] = [];

  lines.push('<code-review>');
  lines.push(`  <title>${escapeXml(review.title)}</title>`);
  lines.push(
    `  <branches base="${escapeXml(review.baseBranch)}" head="${escapeXml(review.headBranch)}" />`,
  );
  lines.push('');

  // Summary
  lines.push('  <summary>');
  lines.push(`    <files count="${review.summary.totalFiles}" />`);
  lines.push(
    `    <changes additions="${review.summary.additions}" deletions="${review.summary.deletions}" />`,
  );
  lines.push(`    <risk level="${review.summary.riskLevel}" />`);
  lines.push(`    <tests_required>${review.summary.testsRequired}</tests_required>`);
  lines.push(`    <docs_required>${review.summary.docsRequired}</docs_required>`);
  lines.push('  </summary>');
  lines.push('');

  // Affected features
  if (review.affectedFeatures.length > 0) {
    lines.push('  <affected-features>');
    for (const feature of review.affectedFeatures) {
      lines.push(`    <feature>${escapeXml(feature)}</feature>`);
    }
    lines.push('  </affected-features>');
    lines.push('');
  }

  // Changed files
  lines.push('  <changed-files>');
  for (const file of review.files) {
    lines.push(
      `    <file path="${escapeXml(file.path)}" status="${file.status}" additions="${file.additions}" deletions="${file.deletions}" binary="${file.binary}" />`,
    );
  }
  lines.push('  </changed-files>');
  lines.push('');

  // Issues
  if (review.issues.length > 0) {
    lines.push('  <issues>');
    for (const issue of review.issues) {
      lines.push(`    <issue severity="${issue.severity}" category="${issue.category}">`);
      lines.push(`      <file>${escapeXml(issue.file)}</file>`);
      if (issue.line) lines.push(`      <line>${issue.line}</line>`);
      lines.push(`      <message>${escapeXml(issue.message)}</message>`);
      if (issue.suggestion)
        lines.push(`      <suggestion>${escapeXml(issue.suggestion)}</suggestion>`);
      lines.push('    </issue>');
    }
    lines.push('  </issues>');
  } else {
    lines.push('  <issues count="0" />');
  }

  // Documentation references (best practices from cached docs)
  if (review.docsReferences && review.docsReferences.length > 0) {
    lines.push('');
    lines.push('  <docs-references>');
    for (const ref of review.docsReferences) {
      lines.push(`    <reference library="${escapeXml(ref.library)}">`);
      lines.push(`      <title>${escapeXml(ref.title)}</title>`);
      lines.push(`      <snippet>${escapeXml(ref.snippet)}</snippet>`);
      lines.push('    </reference>');
    }
    lines.push('  </docs-references>');
  }

  lines.push('</code-review>');

  return lines.join('\n');
}

/**
 * Format review as markdown
 */
export function formatMarkdown(review: ReviewResult): string {
  const lines: string[] = [];

  lines.push(`# ${review.title}`);
  lines.push('');
  lines.push(`> \`${review.baseBranch}\` → \`${review.headBranch}\``);
  lines.push('');

  // Summary
  const riskBadge = { low: '🟢 Low', medium: '🟡 Medium', high: '🔴 High' }[
    review.summary.riskLevel
  ];

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Files | ${review.summary.totalFiles} |`);
  lines.push(`| Additions | +${review.summary.additions} |`);
  lines.push(`| Deletions | -${review.summary.deletions} |`);
  lines.push(`| Risk Level | ${riskBadge} |`);
  lines.push(`| Tests Required | ${review.summary.testsRequired ? '⚠️ Yes' : '✅ No'} |`);
  lines.push(`| Docs Required | ${review.summary.docsRequired ? '⚠️ Yes' : '✅ No'} |`);
  lines.push('');

  // Features
  if (review.affectedFeatures.length > 0) {
    lines.push('## Affected Features');
    lines.push('');
    for (const feature of review.affectedFeatures) {
      lines.push(`- ${feature}`);
    }
    lines.push('');
  }

  // Files
  lines.push('## Changed Files');
  lines.push('');
  for (const file of review.files) {
    const stats = file.binary ? '(binary)' : `+${file.additions} -${file.deletions}`;
    const icon = { added: '🆕', modified: '📝', deleted: '🗑️', renamed: '📋' }[file.status];
    lines.push(`- ${icon} \`${file.path}\` ${stats}`);
  }
  lines.push('');

  // Issues
  if (review.issues.length > 0) {
    lines.push('## Issues');
    lines.push('');
    const grouped = groupByPropertyToRecord(review.issues, 'severity');

    if (grouped.error) {
      lines.push('### 🔴 Errors');
      lines.push('');
      for (const issue of grouped.error) {
        lines.push(`- **[${issue.category}]** \`${issue.file}\`: ${issue.message}`);
      }
      lines.push('');
    }

    if (grouped.warning) {
      lines.push('### 🟡 Warnings');
      lines.push('');
      for (const issue of grouped.warning) {
        lines.push(`- **[${issue.category}]** \`${issue.file}\`: ${issue.message}`);
      }
      lines.push('');
    }

    if (grouped.info) {
      lines.push('### 🔵 Info');
      lines.push('');
      for (const issue of grouped.info) {
        lines.push(`- **[${issue.category}]** \`${issue.file}\`: ${issue.message}`);
      }
      lines.push('');
    }
  }

  // Documentation references
  if (review.docsReferences && review.docsReferences.length > 0) {
    lines.push('## Best Practices');
    lines.push('');
    lines.push('Relevant documentation from cached library docs:');
    lines.push('');
    for (const ref of review.docsReferences) {
      lines.push(`### ${ref.title} (${ref.library})`);
      lines.push('');
      lines.push(`> ${ref.snippet}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('*Generated by krolik-cli*');

  return lines.join('\n');
}
