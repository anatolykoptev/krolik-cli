/**
 * @module commands/context/formatters/ai/sections/details
 * @description Component, Test, Hints, Approach, and PreCommit section formatters
 */

import type { AiContextData } from "../../../types";
import { escapeXml, MAX_ITEMS_SMALL, MAX_ITEMS_MEDIUM, MAX_ITEMS_LARGE } from "../helpers";

/**
 * Format components detail section
 */
export function formatComponentsSection(lines: string[], data: AiContextData): void {
  const { componentDetails } = data;
  if (!componentDetails || componentDetails.length === 0) return;

  lines.push("  <components-detail>");
  for (const comp of componentDetails.slice(0, MAX_ITEMS_LARGE)) {
    formatComponentDetail(lines, comp);
  }
  if (componentDetails.length > MAX_ITEMS_LARGE) {
    lines.push(`    <!-- +${componentDetails.length - MAX_ITEMS_LARGE} more components -->`);
  }
  lines.push("  </components-detail>");
}

/**
 * Format single component detail
 */
function formatComponentDetail(
  lines: string[],
  comp: NonNullable<AiContextData["componentDetails"]>[0],
): void {
  lines.push(`    <component name="${comp.name}" type="${comp.type}">`);

  if (comp.purpose) {
    lines.push(`      <purpose>${escapeXml(comp.purpose)}</purpose>`);
  }
  if (comp.fields && comp.fields.length > 0) {
    lines.push(`      <fields>${comp.fields.join(", ")}</fields>`);
  }
  if (comp.state) {
    lines.push(`      <state>${comp.state}</state>`);
  }
  if (comp.hooks.length > 0) {
    lines.push(`      <hooks>${comp.hooks.join(", ")}</hooks>`);
  }
  if (comp.imports.length > 0) {
    lines.push(`      <imports>${comp.imports.slice(0, MAX_ITEMS_LARGE).join(", ")}</imports>`);
  }
  if (comp.errorHandling) {
    lines.push(`      <error-handling>${comp.errorHandling}</error-handling>`);
  }
  if (comp.features && comp.features.length > 0) {
    lines.push(`      <features>${comp.features.join(", ")}</features>`);
  }

  lines.push("    </component>");
}

/**
 * Format tests detail section
 */
export function formatTestsSection(lines: string[], data: AiContextData): void {
  const { testDetails } = data;
  if (!testDetails || testDetails.length === 0) return;

  lines.push("  <tests-detail>");
  for (const test of testDetails.slice(0, MAX_ITEMS_MEDIUM)) {
    formatTestDetail(lines, test);
  }
  lines.push("  </tests-detail>");
}

/**
 * Format single test detail
 */
function formatTestDetail(
  lines: string[],
  test: NonNullable<AiContextData["testDetails"]>[0],
): void {
  lines.push(`    <test file="${test.file}">`);

  for (const desc of test.describes.slice(0, MAX_ITEMS_SMALL)) {
    lines.push(`      <describe name="${escapeXml(desc.name)}">`);

    for (const t of desc.tests.slice(0, MAX_ITEMS_LARGE)) {
      lines.push(`        <it>${escapeXml(t)}</it>`);
    }

    if (desc.tests.length > MAX_ITEMS_LARGE) {
      lines.push(`        <!-- +${desc.tests.length - MAX_ITEMS_LARGE} more tests -->`);
    }
    lines.push("      </describe>");
  }

  lines.push("    </test>");
}

/**
 * Format hints section
 */
export function formatHintsSection(lines: string[], data: AiContextData): void {
  const { hints } = data;
  if (!hints || Object.keys(hints).length === 0) return;

  lines.push("  <context-hints>");
  for (const [key, value] of Object.entries(hints)) {
    lines.push(`    <hint key="${key}">${escapeXml(value)}</hint>`);
  }
  lines.push("  </context-hints>");
}

/**
 * Format approach section
 */
export function formatApproachSection(lines: string[], data: AiContextData): void {
  const { context } = data;
  if (context.approach.length === 0) return;

  lines.push("  <approach>");
  let priority = 1;

  for (const step of context.approach) {
    const cleanStep = step.replace(/^\d+\.\s*/, "");
    // Skip typecheck/lint step (handled in pre-commit)
    if (cleanStep.includes("typecheck") && cleanStep.includes("lint")) continue;

    lines.push(`    <step priority="${priority}">${cleanStep}</step>`);
    priority++;
  }

  lines.push("  </approach>");
}

/**
 * Format pre-commit section
 */
export function formatPreCommitSection(lines: string[]): void {
  lines.push("  <pre-commit>");
  lines.push("    <check>pnpm typecheck</check>");
  lines.push("    <check>pnpm lint:fix</check>");
  lines.push("    <check>pnpm test -- ${domain}</check>");
  lines.push("    <check>pnpm build</check>");
  lines.push("  </pre-commit>");
}
