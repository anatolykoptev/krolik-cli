/**
 * @module commands/context/formatters/ai/sections/schema-routes
 * @description Schema and Routes section formatters
 */

import type { InlineField } from '../../../../routes/inline-schema';
import type { RoutesOutput } from '../../../../routes/output';
import type { AiContextData } from '../../../types';
import { filterEnumsByModels, filterModelsByKeywords, filterRoutersByKeywords } from '../filters';
import {
  DEFAULT_PAGE_SIZE,
  MAX_ITEMS_LARGE,
  MAX_ITEMS_MEDIUM,
  MAX_LIMIT,
  MAX_SIZE,
} from '../helpers';

/**
 * Format schema section
 */
export function formatSchemaSection(
  lines: string[],
  data: AiContextData,
  keywords: { primary: string[]; secondary: string[] },
): void {
  const { schema } = data;
  if (!schema || schema.models.length === 0) return;

  const relevantModels = filterModelsByKeywords(schema.models, keywords);
  if (relevantModels.length === 0) return;

  lines.push('  <schema>');
  formatModels(lines, relevantModels);

  if (relevantModels.length > 10) {
    lines.push(`    <!-- ${relevantModels.length - 10} more models in this domain -->`);
  }
  lines.push('  </schema>');

  // Enums section
  const relevantEnums = filterEnumsByModels(schema.enums, relevantModels);
  if (relevantEnums.length > 0) {
    formatEnums(lines, relevantEnums);
  }
}

/**
 * Format models list
 */
function formatModels(
  lines: string[],
  models: AiContextData['schema'] extends infer S
    ? S extends { models: infer M }
      ? M
      : never
    : never,
): void {
  for (const model of (
    models as Array<{
      name: string;
      file: string;
      fields: Array<{
        name: string;
        type: string;
        isArray?: boolean;
        isRequired?: boolean;
        isId?: boolean;
        isUnique?: boolean;
      }>;
      relations: string[];
    }>
  ).slice(0, 10)) {
    const totalFields = model.fields.length;
    const maxFields = totalFields <= DEFAULT_PAGE_SIZE ? totalFields : MAX_SIZE;
    const fieldsAttr = totalFields > maxFields ? ` totalFields="${totalFields}"` : '';

    lines.push(`    <model name="${model.name}" file="${model.file}"${fieldsAttr}>`);
    formatModelFields(lines, model.fields.slice(0, maxFields), model.relations);

    if (totalFields > maxFields) {
      const omittedCount = totalFields - maxFields;
      lines.push(
        `      <omitted count="${omittedCount}">timestamps, metadata, internal flags</omitted>`,
      );
    }
    lines.push('    </model>');
  }
}

/**
 * Format model fields
 */
function formatModelFields(
  lines: string[],
  fields: Array<{
    name: string;
    type: string;
    isArray?: boolean;
    isRequired?: boolean;
    isId?: boolean;
    isUnique?: boolean;
  }>,
  relations: string[],
): void {
  for (const field of fields) {
    const attrs: string[] = [];
    attrs.push(`type="${field.type}${field.isArray ? '[]' : ''}"`);
    if (!field.isRequired) attrs.push('optional="true"');
    if (field.isId) attrs.push('primary="true"');
    if (field.isUnique) attrs.push('unique="true"');
    if (relations.includes(field.type)) {
      attrs.push(`relation="${field.type}"`);
    }
    lines.push(`      <field name="${field.name}" ${attrs.join(' ')}/>`);
  }
}

/**
 * Format enums section
 */
function formatEnums(lines: string[], enums: Array<{ name: string; values: string[] }>): void {
  lines.push('  <enums>');
  for (const e of enums.slice(0, MAX_SIZE)) {
    const values = e.values.slice(0, 10).join(', ');
    const more = e.values.length > 10 ? `, +${e.values.length - 10} more` : '';
    lines.push(`    <enum name="${e.name}">${values}${more}</enum>`);
  }
  if (enums.length > MAX_SIZE) {
    lines.push(`    <!-- ${enums.length - MAX_SIZE} more enums -->`);
  }
  lines.push('  </enums>');
}

/**
 * Format routes section
 */
export function formatRoutesSection(
  lines: string[],
  data: AiContextData,
  keywords: { primary: string[]; secondary: string[] },
): void {
  const { routes } = data;
  if (!routes || routes.routers.length === 0) return;

  const relevantRouters = filterRoutersByKeywords(routes.routers, keywords);
  if (relevantRouters.length === 0) return;

  lines.push('  <routes basePath="packages/api/src/routers">');

  for (const router of relevantRouters.slice(0, MAX_ITEMS_LARGE)) {
    formatRouter(lines, router);
  }

  if (relevantRouters.length > MAX_ITEMS_LARGE) {
    lines.push(
      `    <!-- ${relevantRouters.length - MAX_ITEMS_LARGE} more routers in this domain -->`,
    );
  }
  lines.push('  </routes>');
}

/**
 * Format single router
 */
function formatRouter(lines: string[], router: RoutesOutput['routers'][0]): void {
  const routerName = router.file.replace(/\.ts$/, '');
  lines.push(`    <router name="${routerName}" file="${router.file}.ts">`);

  const queries = router.procedures.filter((p) => p.type === 'query');
  const mutations = router.procedures.filter((p) => p.type === 'mutation');

  // Queries
  formatProcedures(lines, queries, 'query', MAX_ITEMS_LARGE, MAX_ITEMS_MEDIUM);

  // Mutations
  formatProcedures(lines, mutations, 'mutation', MAX_ITEMS_LARGE, MAX_ITEMS_MEDIUM);

  lines.push('    </router>');
}

/**
 * Format procedures (queries or mutations)
 */
function formatProcedures(
  lines: string[],
  procedures: RoutesOutput['routers'][0]['procedures'],
  tag: string,
  threshold: number,
  maxItems: number,
): void {
  const limit = procedures.length <= threshold ? procedures.length : maxItems;

  for (const proc of procedures.slice(0, limit)) {
    formatProcedure(lines, proc, tag);
  }

  if (procedures.length > limit) {
    lines.push(`      <${tag}s-omitted count="${procedures.length - limit}"/>`);
  }
}

/**
 * Format a single procedure (query or mutation)
 */
function formatProcedure(
  lines: string[],
  proc: RoutesOutput['routers'][0]['procedures'][0],
  tag: string,
): void {
  const prot = proc.isProtected ? ' protected="true"' : '';
  const outputAttr = proc.outputSchema ? ` output="${proc.outputSchema}"` : '';

  if (proc.inputFields && proc.inputFields.length > 0) {
    const inputStr = formatInputFields(proc.inputFields);
    lines.push(`      <${tag}${prot}${outputAttr}>${proc.name}(${inputStr})</${tag}>`);
  } else {
    const inputAttr = proc.inputSchema
      ? ` input="${proc.inputSchema}"`
      : proc.hasInput
        ? ' input="true"'
        : '';
    lines.push(`      <${tag}${prot}${inputAttr}${outputAttr}>${proc.name}</${tag}>`);
  }
}

/**
 * Format input fields for compact display
 */
function formatInputFields(fields: InlineField[]): string {
  const formatted = fields.slice(0, MAX_LIMIT).map((f) => {
    let str = f.name;
    if (!f.required) str += '?';
    str += `: ${f.type}`;
    if (f.validation) str += ` (${f.validation})`;
    if (f.defaultValue) str += ` = ${f.defaultValue}`;
    return str;
  });

  const suffix = fields.length > MAX_LIMIT ? `, +${fields.length - MAX_LIMIT} more` : '';

  return formatted.join(', ') + suffix;
}
