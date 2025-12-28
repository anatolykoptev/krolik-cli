/**
 * @module commands/refactor/output/sections/navigation
 * @description AI navigation hints section formatter
 */

import type { EnhancedRefactorAnalysis } from '../../core';

/**
 * Format AI navigation section
 */
export function formatAiNavigation(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { aiNavigation } = analysis;

  lines.push('  <ai-navigation>');
  lines.push('    <!-- WHERE TO ADD NEW CODE -->');
  lines.push('    <add-new-code>');
  lines.push(`      <server-logic>${aiNavigation.addNewCode.serverLogic}</server-logic>`);
  lines.push(`      <client-hook>${aiNavigation.addNewCode.clientHook}</client-hook>`);
  lines.push(`      <utility>${aiNavigation.addNewCode.utility}</utility>`);
  lines.push(`      <constant>${aiNavigation.addNewCode.constant}</constant>`);
  lines.push(`      <integration>${aiNavigation.addNewCode.integration}</integration>`);
  lines.push(`      <component>${aiNavigation.addNewCode.component}</component>`);
  lines.push(`      <api-route>${aiNavigation.addNewCode.apiRoute}</api-route>`);
  lines.push(`      <test>${aiNavigation.addNewCode.test}</test>`);
  lines.push('    </add-new-code>');

  lines.push('    <!-- FILE PATTERNS -->');
  lines.push('    <file-patterns>');
  for (const fp of aiNavigation.filePatterns) {
    lines.push(
      `      <pattern type="${fp.pattern}" meaning="${fp.meaning}" example="${fp.example}" />`,
    );
  }
  lines.push('    </file-patterns>');

  lines.push('    <!-- IMPORT CONVENTIONS -->');
  lines.push('    <import-conventions>');
  lines.push(
    `      <absolute-imports>${aiNavigation.importConventions.absoluteImports}</absolute-imports>`,
  );
  if (aiNavigation.importConventions.alias) {
    lines.push(`      <alias>${aiNavigation.importConventions.alias}</alias>`);
  }
  lines.push(
    `      <barrel-exports>${aiNavigation.importConventions.barrelExports}</barrel-exports>`,
  );
  lines.push('      <preferred-order>');
  for (const order of aiNavigation.importConventions.preferredOrder) {
    lines.push(`        <item>${order}</item>`);
  }
  lines.push('      </preferred-order>');
  lines.push('    </import-conventions>');

  lines.push('    <!-- NAMING CONVENTIONS -->');
  lines.push('    <naming-conventions>');
  lines.push(`      <files>${aiNavigation.namingConventions.files}</files>`);
  lines.push(`      <components>${aiNavigation.namingConventions.components}</components>`);
  lines.push(`      <hooks>${aiNavigation.namingConventions.hooks}</hooks>`);
  lines.push(`      <utilities>${aiNavigation.namingConventions.utilities}</utilities>`);
  lines.push(`      <constants>${aiNavigation.namingConventions.constants}</constants>`);
  lines.push(`      <types>${aiNavigation.namingConventions.types}</types>`);
  lines.push('    </naming-conventions>');

  lines.push('  </ai-navigation>');
}
