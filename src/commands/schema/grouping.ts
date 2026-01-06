/**
 * @module commands/schema/grouping
 * @description Group models by domain/file
 */

import { groupBy, groupByProperty } from '@/lib/@core';
import type { PrismaModel } from './parser';

/**
 * Known abbreviations that should stay uppercase
 */
const UPPERCASE_ABBREVS = ['crm', 'api', 'ugc', 'sso', 'oauth', 'jwt', 'sql'];

/**
 * Group models by file
 */
export function groupByFile(models: PrismaModel[]): Map<string, PrismaModel[]> {
  return groupByProperty(models, 'file');
}

/**
 * Group models by domain (inferred from filename)
 */
export function groupByDomain(models: PrismaModel[]): Map<string, PrismaModel[]> {
  return groupBy(models, (model) => inferDomain(model.file));
}

/**
 * Infer domain from filename (dynamic)
 * Converts filename to readable domain name:
 * - "auth.prisma" -> "Auth"
 * - "booking.prisma" -> "Booking"
 * - "services-ugc.prisma" -> "Services UGC"
 * - "crm.prisma" -> "CRM"
 */
function inferDomain(filename: string): string {
  // Remove extension and path
  const base = filename.replace(/\.prisma$/, '').replace(/^.*\//, '');

  if (!base) return 'Other';

  // Split by hyphen or underscore
  const parts = base.split(/[-_]/);

  // Capitalize each part, handling abbreviations
  const formatted = parts.map((part) => {
    const lower = part.toLowerCase();
    if (UPPERCASE_ABBREVS.includes(lower)) {
      return lower.toUpperCase();
    }
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  });

  return formatted.join(' ');
}

/**
 * Sort models alphabetically within groups
 */
export function sortModels(models: PrismaModel[]): PrismaModel[] {
  return [...models].sort((a, b) => a.name.localeCompare(b.name));
}
