/**
 * @module commands/context/formatters/ai/sections/types-imports
 * @description TypeScript types and import graph formatters
 */

import type { AiContextData } from '../../../types';
import { escapeXml, MAX_ITEMS_LARGE, MAX_SIZE } from '../helpers';

/**
 * Format TypeScript types section
 */
export function formatTypesSection(lines: string[], data: AiContextData): void {
  const { types } = data;
  if (!types || types.length === 0) return;

  lines.push('  <types>');

  for (const type of types.slice(0, MAX_SIZE)) {
    formatType(lines, type);
  }

  if (types.length > MAX_SIZE) {
    lines.push(`    <!-- +${types.length - MAX_SIZE} more types -->`);
  }

  lines.push('  </types>');
}

/**
 * Format single type/interface
 */
function formatType(lines: string[], type: NonNullable<AiContextData['types']>[0]): void {
  const extendsAttr = type.extends?.length ? ` extends="${type.extends.join(', ')}"` : '';
  const descAttr = type.description ? ` desc="${escapeXml(type.description.slice(0, 100))}"` : '';

  if (type.properties && type.properties.length > 0) {
    lines.push(
      `    <${type.kind} name="${type.name}" file="${type.file}"${extendsAttr}${descAttr}>`,
    );

    for (const prop of type.properties.slice(0, MAX_ITEMS_LARGE)) {
      const optMark = prop.optional ? '?' : '';
      lines.push(`      ${prop.name}${optMark}: ${escapeXml(prop.type)}`);
    }

    if (type.properties.length > MAX_ITEMS_LARGE) {
      lines.push(`      <!-- +${type.properties.length - MAX_ITEMS_LARGE} more properties -->`);
    }

    lines.push(`    </${type.kind}>`);
  } else {
    // Simple type alias
    lines.push(`    <${type.kind} name="${type.name}" file="${type.file}"${descAttr}/>`);
  }
}

/**
 * Format import graph section
 */
export function formatImportsSection(lines: string[], data: AiContextData): void {
  const { imports } = data;
  if (!imports || imports.length === 0) return;

  lines.push('  <dependencies>');

  for (const relation of imports.slice(0, MAX_SIZE)) {
    formatImportRelation(lines, relation);
  }

  if (imports.length > MAX_SIZE) {
    lines.push(`    <!-- +${imports.length - MAX_SIZE} more files -->`);
  }

  lines.push('  </dependencies>');
}

/**
 * Format single file's imports
 */
function formatImportRelation(
  lines: string[],
  relation: NonNullable<AiContextData['imports']>[0],
): void {
  // Group imports by source
  const localImports = relation.imports.filter((i) => i.from.startsWith('.'));

  if (localImports.length === 0) return;

  lines.push(`    <file path="${relation.file}">`);

  for (const imp of localImports.slice(0, 5)) {
    const typeAttr = imp.isTypeOnly ? ' type="true"' : '';
    const names = imp.names.slice(0, 5).join(', ');
    const more = imp.names.length > 5 ? ` +${imp.names.length - 5}` : '';
    lines.push(`      <imports from="${imp.from}"${typeAttr}>${names}${more}</imports>`);
  }

  lines.push('    </file>');
}
