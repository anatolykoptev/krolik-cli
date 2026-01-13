/**
 * @module commands/context/formatters/ai/sections/details/artifacts
 * @description Component and Test section formatters
 */

import type { AiContextData } from '../../../../types';
import { escapeXml, MAX_ITEMS_LARGE, MAX_ITEMS_MEDIUM, MAX_ITEMS_SMALL } from '../../helpers';

/**
 * Format components detail section
 */
export function formatComponentsSection(lines: string[], data: AiContextData): void {
  const { componentDetails } = data;
  if (!componentDetails || componentDetails.length === 0) return;

  lines.push('  <components-detail>');
  for (const comp of componentDetails.slice(0, MAX_ITEMS_LARGE)) {
    formatComponentDetail(lines, comp);
  }
  if (componentDetails.length > MAX_ITEMS_LARGE) {
    lines.push(`    <!-- +${componentDetails.length - MAX_ITEMS_LARGE} more components -->`);
  }
  lines.push('  </components-detail>');
}

/**
 * Format single component detail
 */
function formatComponentDetail(
  lines: string[],
  comp: NonNullable<AiContextData['componentDetails']>[0],
): void {
  lines.push(`    <component name="${comp.name}" type="${comp.type}">`);

  if (comp.purpose) {
    lines.push(`      <purpose>${escapeXml(comp.purpose)}</purpose>`);
  }
  if (comp.fields && comp.fields.length > 0) {
    lines.push(`      <fields>${comp.fields.join(', ')}</fields>`);
  }
  if (comp.state) {
    lines.push(`      <state>${comp.state}</state>`);
  }
  if (comp.hooks.length > 0) {
    lines.push(`      <hooks>${comp.hooks.join(', ')}</hooks>`);
  }
  if (comp.imports.length > 0) {
    lines.push(`      <imports>${comp.imports.slice(0, MAX_ITEMS_LARGE).join(', ')}</imports>`);
  }
  if (comp.errorHandling) {
    lines.push(`      <error-handling>${comp.errorHandling}</error-handling>`);
  }
  if (comp.features && comp.features.length > 0) {
    lines.push(`      <features>${comp.features.join(', ')}</features>`);
  }

  lines.push('    </component>');
}

/**
 * Format tests detail section
 */
export function formatTestsSection(lines: string[], data: AiContextData): void {
  const { testDetails } = data;
  if (!testDetails || testDetails.length === 0) return;

  lines.push('  <tests-detail>');
  for (const test of testDetails.slice(0, MAX_ITEMS_MEDIUM)) {
    formatTestDetail(lines, test);
  }
  lines.push('  </tests-detail>');
}

/**
 * Format single test detail
 */
function formatTestDetail(
  lines: string[],
  test: NonNullable<AiContextData['testDetails']>[0],
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
    lines.push('      </describe>');
  }

  lines.push('    </test>');
}
