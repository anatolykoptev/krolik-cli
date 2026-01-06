/**
 * @module commands/schema/output
 * @description Schema output formatters (text, json, markdown)
 */

import { formatJson as formatJsonBase } from '@/lib/@format';
import type { Logger } from '../../types/commands/base';
import { groupByDomain, groupByFile } from './grouping';
import type { PrismaEnum, PrismaField, PrismaModel } from './parser';

/**
 * Schema result type
 */
export interface SchemaOutput {
  models: PrismaModel[];
  enums: PrismaEnum[];
  modelCount: number;
  enumCount: number;
}

/**
 * Print schema to console
 */
export function printSchema(
  data: SchemaOutput,
  logger: Logger,
  groupBy: 'file' | 'domain' = 'file',
): void {
  logger.section('Prisma Schema');
  logger.info(`Found ${data.modelCount} models, ${data.enumCount} enums\n`);

  const grouped = groupBy === 'domain' ? groupByDomain(data.models) : groupByFile(data.models);

  for (const [group, models] of grouped) {
    console.log(`\x1b[36m${group}\x1b[0m`);
    for (const model of models) {
      const relInfo =
        model.relations.length > 0 ? ` \x1b[2m→ ${model.relations.join(', ')}\x1b[0m` : '';
      console.log(`  \x1b[32m${model.name}\x1b[0m (${model.fields.length} fields)${relInfo}`);
    }
    console.log('');
  }

  if (data.enums.length > 0) {
    logger.section('Enums');
    for (const e of data.enums) {
      const preview = e.values.slice(0, 5).join(', ');
      const more = e.values.length > 5 ? '...' : '';
      console.log(`  \x1b[33m${e.name}\x1b[0m: ${preview}${more}`);
    }
    console.log('');
  }
}

/**
 * Format schema as JSON
 */
export function formatJson(data: SchemaOutput): string {
  return formatJsonBase(data);
}

/**
 * Format schema as AI-friendly XML
 */
export function formatAI(data: SchemaOutput): string {
  const lines: string[] = [];

  lines.push('<prisma-schema>');
  lines.push(`  <stats models="${data.modelCount}" enums="${data.enumCount}" />`);
  lines.push('');

  const byDomain = groupByDomain(data.models);

  for (const [domain, models] of byDomain) {
    lines.push(`  <domain name="${domain}">`);
    for (const model of models) {
      lines.push(`    <model name="${model.name}" fields="${model.fields.length}">`);
      if (model.relations.length > 0) {
        lines.push(`      <relations>${model.relations.join(', ')}</relations>`);
      }
      lines.push(`      <fields>`);
      for (const field of model.fields) {
        const attrs: string[] = [];
        if (field.isId) attrs.push('pk');
        if (field.isUnique) attrs.push('unique');
        if (!field.isRequired) attrs.push('optional');
        if (field.isArray) attrs.push('array');
        const attrStr = attrs.length > 0 ? ` attrs="${attrs.join(',')}"` : '';
        const defaultStr = field.default ? ` default="${field.default}"` : '';
        lines.push(
          `        <field name="${field.name}" type="${field.type}"${attrStr}${defaultStr} />`,
        );
      }
      lines.push('      </fields>');
      lines.push('    </model>');
    }
    lines.push('  </domain>');
    lines.push('');
  }

  if (data.enums.length > 0) {
    lines.push('  <enums>');
    for (const e of data.enums) {
      lines.push(`    <enum name="${e.name}">${e.values.join(', ')}</enum>`);
    }
    lines.push('  </enums>');
  }

  lines.push('</prisma-schema>');

  return lines.join('\n');
}

/**
 * Generate markdown documentation
 */
export function formatMarkdown(data: SchemaOutput): string {
  const lines: string[] = [
    '# Database Schema',
    '',
    `> Auto-generated: ${new Date().toISOString().split('T')[0]}`,
    '',
    `**Models:** ${data.modelCount} | **Enums:** ${data.enumCount}`,
    '',
    '---',
    '',
  ];

  const byDomain = groupByDomain(data.models);

  for (const [domain, models] of byDomain) {
    lines.push(`## ${domain}`);
    lines.push('');

    for (const model of models) {
      lines.push(`### ${model.name}`);
      lines.push('');

      if (model.relations.length > 0) {
        lines.push(`**Relations:** ${model.relations.join(', ')}`);
        lines.push('');
      }

      lines.push('| Field | Type | Required | Notes |');
      lines.push('|-------|------|----------|-------|');

      for (const field of model.fields) {
        const notes: string[] = [];
        if (field.isId) notes.push('PK');
        if (field.isUnique) notes.push('Unique');
        if (field.default) notes.push(`Default: ${field.default}`);

        const typeStr = `${field.type}${field.isArray ? '[]' : ''}`;
        lines.push(
          `| ${field.name} | ${typeStr} | ${field.isRequired ? 'Yes' : 'No'} | ${notes.join(', ')} |`,
        );
      }

      lines.push('');
    }
  }

  if (data.enums.length > 0) {
    lines.push('## Enums');
    lines.push('');

    for (const e of data.enums) {
      lines.push(`### ${e.name}`);
      lines.push('');
      lines.push('```');
      lines.push(e.values.join('\n'));
      lines.push('```');
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('*Generated by krolik-cli*');

  return lines.join('\n');
}

// ============================================================================
// FIELD CLASSIFICATION
// ============================================================================

/** Standard fields that AI knows exist in every model */
const STANDARD_FIELDS = new Set(['id', 'createdAt', 'updatedAt']);

/** Obvious defaults that don't need to be shown */
const OBVIOUS_DEFAULTS = new Set([
  'cuid(',
  'uuid(',
  'now(',
  'autoincrement(',
  'false',
  'true',
  '0',
  '1',
  '""',
]);

/** Check if a default value is obvious and can be hidden */
function isObviousDefault(value: string | undefined): boolean {
  if (!value) return false;
  return OBVIOUS_DEFAULTS.has(value) || value.startsWith('"') || value.startsWith("'");
}

/** Check if field is a relation array (duplicates <relations> block) */
function isRelationArray(field: PrismaField): boolean {
  return (
    field.isArray &&
    field.type.charAt(0) === field.type.charAt(0).toUpperCase() &&
    ![
      'String',
      'Int',
      'Float',
      'Boolean',
      'DateTime',
      'Json',
      'Bytes',
      'BigInt',
      'Decimal',
    ].includes(field.type)
  );
}

/** Classify field importance for AI */
function classifyField(field: PrismaField): 'key' | 'business' | 'meta' | 'skip' {
  // Skip standard fields
  if (STANDARD_FIELDS.has(field.name)) return 'skip';

  // Skip relation arrays (shown in relations block)
  if (isRelationArray(field)) return 'skip';

  // Key fields: FK, unique, id-like
  if (field.name.endsWith('Id') || field.isUnique || field.isId) return 'key';

  // Meta fields: timestamps, audit
  if (
    field.name.includes('At') ||
    field.name.includes('Date') ||
    field.name.startsWith('created') ||
    field.name.startsWith('updated')
  ) {
    return 'meta';
  }

  // Everything else is business data
  return 'business';
}

// ============================================================================
// SMART FORMAT (default for AI)
// ============================================================================

/**
 * Format schema as smart XML - optimized for AI consumption
 * - Hides standard fields (id, createdAt, updatedAt)
 * - Hides obvious defaults
 * - Groups fields by importance
 * - Shows relation arrays in relations block
 */
export function formatSmart(data: SchemaOutput, fullData?: SchemaOutput): string {
  const lines: string[] = [];
  const total = fullData ?? data;
  const isFiltered = fullData && data.modelCount !== fullData.modelCount;

  lines.push('<prisma-schema>');

  if (isFiltered) {
    lines.push(
      `  <stats models="${data.modelCount}" enums="${data.enumCount}" filtered="true" total="${total.modelCount}" />`,
    );
  } else {
    lines.push(`  <stats models="${data.modelCount}" enums="${data.enumCount}" />`);
  }

  const byDomain = groupByDomain(data.models);
  const domains = Array.from(byDomain.keys()).sort();
  lines.push(`  <domains>${domains.join(', ')}</domains>`);
  lines.push('');

  for (const [domain, models] of byDomain) {
    lines.push(`  <domain name="${domain}">`);

    for (const model of models) {
      // Classify fields
      const keyFields: string[] = [];
      const businessFields: string[] = [];
      const metaFields: string[] = [];
      const relationArrays: string[] = [];

      for (const field of model.fields) {
        // Collect relation arrays for relations block
        if (isRelationArray(field)) {
          relationArrays.push(`${field.name}→${field.type}[]`);
          continue;
        }

        const category = classifyField(field);
        if (category === 'skip') continue;

        // Format field compactly
        const formatted = formatFieldSmart(field);

        switch (category) {
          case 'key':
            keyFields.push(formatted);
            break;
          case 'business':
            businessFields.push(formatted);
            break;
          case 'meta':
            metaFields.push(formatted);
            break;
        }
      }

      // Build model output
      lines.push(`    <model name="${model.name}">`);

      // Relations (direct + arrays)
      const allRelations = [
        ...model.relations,
        ...(relationArrays.length > 0 ? relationArrays : []),
      ];
      if (allRelations.length > 0) {
        lines.push(`      <relations>${allRelations.join(', ')}</relations>`);
      }

      // Key fields (FK, unique)
      if (keyFields.length > 0) {
        lines.push(`      <keys>${keyFields.join(', ')}</keys>`);
      }

      // Business fields
      if (businessFields.length > 0) {
        lines.push(`      <data>${businessFields.join(', ')}</data>`);
      }

      // Meta fields (optional, less important)
      if (metaFields.length > 0) {
        lines.push(`      <meta>${metaFields.join(', ')}</meta>`);
      }

      lines.push('    </model>');
    }

    lines.push('  </domain>');
    lines.push('');
  }

  // Enums - just names grouped by prefix
  if (data.enums.length > 0) {
    lines.push('  <enums>');
    const enumsByPrefix = groupEnumsByPrefix(data.enums);
    for (const [prefix, names] of enumsByPrefix) {
      if (names.length === 1) {
        lines.push(`    ${names[0]}`);
      } else {
        lines.push(`    ${prefix}*: ${names.join(', ')}`);
      }
    }
    lines.push('  </enums>');
  }

  lines.push('</prisma-schema>');
  return lines.join('\n');
}

/**
 * Format a single field in smart compact format
 * Examples:
 * - "name" (plain string)
 * - "email?" (optional)
 * - "status:BookingStatus" (enum type)
 * - "phone!" (unique)
 */
function formatFieldSmart(field: PrismaField): string {
  let result = field.name;

  // Type suffix for non-obvious types
  const simpleTypes = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json'];
  if (!simpleTypes.includes(field.type)) {
    result += `:${field.type}`;
  }

  // Modifiers
  if (!field.isRequired) result += '?';
  if (field.isUnique && !field.name.endsWith('Id')) result += '!';
  if (field.isArray) result += '[]';

  // Non-obvious default
  if (field.default && !isObviousDefault(field.default)) {
    result += `=${field.default}`;
  }

  return result;
}

/**
 * Group enums by common prefix for compact display
 */
function groupEnumsByPrefix(enums: PrismaEnum[]): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const e of enums) {
    // Extract prefix (e.g., "Booking" from "BookingStatus")
    const match = e.name.match(/^([A-Z][a-z]+)/);
    const prefix = match?.[1] ?? 'Other';

    if (!result.has(prefix)) result.set(prefix, []);
    result.get(prefix)!.push(e.name);
  }

  // Sort by prefix
  return new Map([...result.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

// ============================================================================
// COMPACT FORMAT
// ============================================================================

/**
 * Format schema as compact XML (no field details, just structure)
 * For large schemas - shows models with relations only
 */
export function formatCompact(data: SchemaOutput, fullData?: SchemaOutput): string {
  const lines: string[] = [];
  const total = fullData ?? data;
  const isFiltered = fullData && data.modelCount !== fullData.modelCount;

  lines.push('<prisma-schema mode="compact">');

  if (isFiltered) {
    lines.push(
      `  <stats models="${data.modelCount}" enums="${data.enumCount}" filtered="true" total-models="${total.modelCount}" total-enums="${total.enumCount}" />`,
    );
  } else {
    lines.push(`  <stats models="${data.modelCount}" enums="${data.enumCount}" />`);
  }

  // List available domains for navigation
  const byDomain = groupByDomain(data.models);
  const domains = Array.from(byDomain.keys()).sort();
  lines.push(`  <domains>${domains.join(', ')}</domains>`);
  lines.push('');

  for (const [domain, models] of byDomain) {
    const modelCount = models.length;
    lines.push(`  <domain name="${domain}" models="${modelCount}">`);

    for (const model of models) {
      const relStr = model.relations.length > 0 ? ` relations="${model.relations.join(', ')}"` : '';
      // Show key fields only: id fields, unique fields, foreign keys
      const keyFields = model.fields.filter((f) => f.isId || f.isUnique || f.name.endsWith('Id'));
      const keyFieldNames = keyFields.map((f) => f.name).slice(0, 5);
      const keyStr = keyFieldNames.length > 0 ? ` keys="${keyFieldNames.join(', ')}"` : '';

      lines.push(
        `    <model name="${model.name}" fields="${model.fields.length}"${relStr}${keyStr} />`,
      );
    }

    lines.push('  </domain>');
  }

  // Compact enum list (just names grouped)
  if (data.enums.length > 0) {
    lines.push('');
    lines.push(`  <enums count="${data.enums.length}">`);
    const enumNames = data.enums.map((e) => e.name).sort();
    // Group by prefix if many enums
    if (enumNames.length > 20) {
      const byPrefix = new Map<string, string[]>();
      for (const name of enumNames) {
        const prefix =
          name.replace(/[A-Z][a-z]+$/, '').replace(/Status$|Type$|Role$|State$/, '') || 'General';
        if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
        byPrefix.get(prefix)!.push(name);
      }
      for (const [prefix, names] of byPrefix) {
        lines.push(`    <group prefix="${prefix}">${names.join(', ')}</group>`);
      }
    } else {
      lines.push(`    ${enumNames.join(', ')}`);
    }
    lines.push('  </enums>');
  }

  lines.push('');
  lines.push('  <hint>Use --model "Name" or --domain "Domain" for details</hint>');
  lines.push('</prisma-schema>');

  return lines.join('\n');
}
