/**
 * @module commands/review/output
 * @description Review output formatters
 */

import type { Logger, ReviewResult, ReviewIssue } from "../../types";

/**
 * Group items by a key
 */
function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const k = String(item[key]);
      result[k] = result[k] || [];
      result[k].push(item);
      return result;
    },
    {} as Record<string, T[]>,
  );
}

/**
 * Print review to console
 */
export function printReview(review: ReviewResult, logger: Logger): void {
  logger.section(`Review: ${review.title}`);
  console.log(`\x1b[2m${review.baseBranch} → ${review.headBranch}\x1b[0m\n`);

  // Summary
  const riskIcon = { low: "🟢", medium: "🟡", high: "🔴" }[
    review.summary.riskLevel
  ];
  console.log("=== Summary ===");
  console.log(
    `Files: ${review.summary.totalFiles} | +${review.summary.additions} -${review.summary.deletions}`,
  );
  console.log(`Risk: ${riskIcon} ${review.summary.riskLevel.toUpperCase()}`);
  if (review.summary.testsRequired) console.log("⚠️  Tests: REQUIRED");
  if (review.summary.docsRequired) console.log("⚠️  Docs: REQUIRED");
  console.log("");

  // Affected features
  if (review.affectedFeatures.length <= 0) return;

  console.log("=== Affected Features ===");
  for (const feature of review.affectedFeatures) {
    console.log(`  - ${feature}`);
  }
  console.log("");

  // Files
  console.log("=== Changed Files ===");
  for (const file of review.files) {
    const stats = file.binary
      ? "binary"
      : `+${file.additions} -${file.deletions}`;
    const status = file.status[0].toUpperCase();
    console.log(`  [${status}] ${file.path} (${stats})`);
  }
  console.log("");

  // Issues
  if (review.issues.length > 0) {
    console.log("=== Issues Found ===");
    const grouped = groupBy(review.issues, "severity");

    if (grouped.error) {
      console.log("\x1b[31mERRORS:\x1b[0m");
      for (const issue of grouped.error) {
        console.log(`  [${issue.category}] ${issue.file}: ${issue.message}`);
      }
    }

    if (grouped.warning) {
      console.log("\x1b[33mWARNINGS:\x1b[0m");
      for (const issue of grouped.warning) {
        console.log(`  [${issue.category}] ${issue.file}: ${issue.message}`);
      }
    }

    if (grouped.info) {
      console.log("\x1b[34mINFO:\x1b[0m");
      for (const issue of grouped.info) {
        console.log(`  [${issue.category}] ${issue.file}: ${issue.message}`);
      }
    }
  } else {
    console.log("=== No Issues Found ===");
  }

  console.log("");
}

/**
 * Format review as JSON
 */
export function formatJson(review: ReviewResult): string {
  return JSON.stringify(review, null, 2);
}

/**
 * Format review as markdown
 */
export function formatMarkdown(review: ReviewResult): string {
  const lines: string[] = [];

  lines.push(`# ${review.title}`);
  lines.push("");
  lines.push(`> \`${review.baseBranch}\` → \`${review.headBranch}\``);
  lines.push("");

  // Summary
  const riskBadge = { low: "🟢 Low", medium: "🟡 Medium", high: "🔴 High" }[
    review.summary.riskLevel
  ];

  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Files | ${review.summary.totalFiles} |`);
  lines.push(`| Additions | +${review.summary.additions} |`);
  lines.push(`| Deletions | -${review.summary.deletions} |`);
  lines.push(`| Risk Level | ${riskBadge} |`);
  lines.push(
    `| Tests Required | ${review.summary.testsRequired ? "⚠️ Yes" : "✅ No"} |`,
  );
  lines.push(
    `| Docs Required | ${review.summary.docsRequired ? "⚠️ Yes" : "✅ No"} |`,
  );
  lines.push("");

  // Features
  if (review.affectedFeatures.length > 0) {
    lines.push("## Affected Features");
    lines.push("");
    for (const feature of review.affectedFeatures) {
      lines.push(`- ${feature}`);
    }
    lines.push("");
  }

  // Files
  lines.push("## Changed Files");
  lines.push("");
  for (const file of review.files) {
    const stats = file.binary
      ? "(binary)"
      : `+${file.additions} -${file.deletions}`;
    const icon = { added: "🆕", modified: "📝", deleted: "🗑️", renamed: "📋" }[
      file.status
    ];
    lines.push(`- ${icon} \`${file.path}\` ${stats}`);
  }
  lines.push("");

  // Issues
  if (review.issues.length > 0) {
    lines.push("## Issues");
    lines.push("");
    const grouped = groupBy(review.issues, "severity");

    if (grouped.error) {
      lines.push("### 🔴 Errors");
      lines.push("");
      for (const issue of grouped.error) {
        lines.push(
          `- **[${issue.category}]** \`${issue.file}\`: ${issue.message}`,
        );
      }
      lines.push("");
    }

    if (grouped.warning) {
      lines.push("### 🟡 Warnings");
      lines.push("");
      for (const issue of grouped.warning) {
        lines.push(
          `- **[${issue.category}]** \`${issue.file}\`: ${issue.message}`,
        );
      }
      lines.push("");
    }

    if (grouped.info) {
      lines.push("### 🔵 Info");
      lines.push("");
      for (const issue of grouped.info) {
        lines.push(
          `- **[${issue.category}]** \`${issue.file}\`: ${issue.message}`,
        );
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push("*Generated by krolik-cli*");

  return lines.join("\n");
}
