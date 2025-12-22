/**
 * @module commands/schema/grouping
 * @description Group models by domain/file
 */

import type { PrismaModel } from './parser';

/**
 * Default domain mapping based on filename
 */
const DEFAULT_DOMAINS: Record<string, string> = {
  auth: 'Authentication',
  user: 'Users',
  content: 'Content',
  booking: 'Bookings',
  event: 'Events',
  ticket: 'Ticketing',
  business: 'Business',
  social: 'Social',
  gamification: 'Gamification',
  payment: 'Payments',
  notification: 'Notifications',
  integration: 'Integrations',
  system: 'System',
};

/**
 * Group models by file
 */
export function groupByFile(models: PrismaModel[]): Map<string, PrismaModel[]> {
  const grouped = new Map<string, PrismaModel[]>();

  for (const model of models) {
    const group = grouped.get(model.file) || [];
    group.push(model);
    grouped.set(model.file, group);
  }

  return grouped;
}

/**
 * Group models by domain (inferred from filename)
 */
export function groupByDomain(models: PrismaModel[]): Map<string, PrismaModel[]> {
  const grouped = new Map<string, PrismaModel[]>();

  for (const model of models) {
    const domain = inferDomain(model.file);
    const group = grouped.get(domain) || [];
    group.push(model);
    grouped.set(domain, group);
  }

  return grouped;
}

/**
 * Infer domain from filename
 */
function inferDomain(filename: string): string {
  const base = filename.replace('.prisma', '').toLowerCase();

  for (const [key, label] of Object.entries(DEFAULT_DOMAINS)) {
    if (base.includes(key)) {
      return label;
    }
  }

  return 'Other';
}

/**
 * Sort models alphabetically within groups
 */
export function sortModels(models: PrismaModel[]): PrismaModel[] {
  return [...models].sort((a, b) => a.name.localeCompare(b.name));
}
