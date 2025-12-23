/**
 * @module commands/context/formatters/ai/sections/files
 * @description Files and IO Schemas section formatters
 */

import type { AiContextData } from "../../../types";
import { MAX_SIZE, DEFAULT_PAGE_SIZE } from "../helpers";

/**
 * Format files section
 */
export function formatFilesSection(lines: string[], data: AiContextData): void {
  const { files, context } = data;

  if (files) {
    formatZodSchemas(lines, files.zodSchemas);
    formatComponents(lines, files.components);
    formatTests(lines, files.tests);
  }

  // Related files from context
  if (context.relatedFiles.length > 0) {
    lines.push("  <files>");
    for (const file of context.relatedFiles.slice(0, DEFAULT_PAGE_SIZE)) {
      lines.push(`    <file>${file}</file>`);
    }
    lines.push("  </files>");
  }
}

/**
 * Format Zod schemas list
 */
function formatZodSchemas(lines: string[], schemas: string[]): void {
  if (schemas.length === 0) return;

  lines.push('  <zod-schemas path="packages/shared/src/schemas">');
  for (const schemaFile of schemas.slice(0, 10)) {
    lines.push(`    <schema>${schemaFile}</schema>`);
  }
  if (schemas.length > 10) {
    lines.push(`    <!-- +${schemas.length - 10} more schemas -->`);
  }
  lines.push("  </zod-schemas>");
}

/**
 * Format components list
 */
function formatComponents(lines: string[], components: string[]): void {
  if (components.length === 0) return;

  lines.push('  <components path="apps/web/components">');
  for (const comp of components.slice(0, MAX_SIZE)) {
    lines.push(`    <component>${comp}</component>`);
  }
  if (components.length > MAX_SIZE) {
    lines.push(`    <!-- +${components.length - MAX_SIZE} more components -->`);
  }
  lines.push("  </components>");
}

/**
 * Format tests list
 */
function formatTests(lines: string[], tests: string[]): void {
  if (tests.length === 0) return;

  lines.push("  <tests>");
  for (const test of tests.slice(0, 10)) {
    lines.push(`    <test>${test}</test>`);
  }
  if (tests.length > 10) {
    lines.push(`    <!-- +${tests.length - 10} more tests -->`);
  }
  lines.push("  </tests>");
}

/**
 * Format IO schemas section
 */
export function formatIoSchemasSection(lines: string[], data: AiContextData): void {
  const { ioSchemas } = data;
  if (!ioSchemas || ioSchemas.length === 0) return;

  lines.push("  <io-schemas>");
  for (const ioSchema of ioSchemas.slice(0, 10)) {
    lines.push(`    <${ioSchema.type} name="${ioSchema.name}" file="${ioSchema.file}">`);
    formatIoSchemaFields(lines, ioSchema.fields);
    if (ioSchema.fields.length > MAX_SIZE) {
      lines.push(`      <!-- +${ioSchema.fields.length - MAX_SIZE} more fields -->`);
    }
    lines.push(`    </${ioSchema.type}>`);
  }
  lines.push("  </io-schemas>");
}

/**
 * Format IO schema fields
 */
function formatIoSchemaFields(
  lines: string[],
  fields: Array<{ name: string; type: string; required: boolean; validation?: string }>,
): void {
  for (const field of fields.slice(0, MAX_SIZE)) {
    const req = field.required ? "required" : "optional";
    const val = field.validation ? ` (${field.validation})` : "";
    lines.push(`      ${field.name}: ${field.type}${val} [${req}]`);
  }
}
