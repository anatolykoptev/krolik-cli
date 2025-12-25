/**
 * @module commands/context/domains
 * @description Domain detection and file resolution for context
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { DOMAIN_FILES, getApproaches as getApproachesFromConfig } from '../../config/domains';
import { detectDomainsFromText } from '../../lib/domains';
import type { KrolikConfig } from '../../types';

/**
 * Detect domains from text content
 * Uses config domains if available, otherwise falls back to built-in defaults
 * If nothing matches, uses the text itself as domain name
 */
export function detectDomains(text: string, config?: KrolikConfig): string[] {
  return detectDomainsFromText(text, config);
}

/**
 * Find related files for detected domains
 */
export function findRelatedFiles(domains: string[], projectRoot: string): string[] {
  const files: string[] = [];

  for (const domain of domains) {
    const patterns = DOMAIN_FILES[domain] || [];
    for (const pattern of patterns) {
      // Convert glob pattern to check
      const basePath = pattern.replace(/\*\*?\/?\*?\.?[a-z]*$/i, '');
      const fullPath = path.join(projectRoot, basePath);

      if (fs.existsSync(fullPath)) {
        files.push(basePath);
      }
    }
  }

  return [...new Set(files)];
}

/**
 * Get suggested approaches for domains
 * Re-exports canonical version from config/domains
 */
export function getApproaches(domains: string[]): string[] {
  return getApproachesFromConfig(domains);
}

/**
 * Generate a checklist for the task
 */
export function generateChecklist(domains: string[]): string[] {
  const checklist: string[] = [
    '[ ] Read CLAUDE.md for project rules',
    '[ ] Check existing components before creating new ones',
    '[ ] Follow existing patterns in the codebase',
    '[ ] Run typecheck before committing',
    '[ ] Run lint before committing',
  ];

  const datadomains = ['booking', 'events', 'crm', 'places', 'users'];
  if (domains.some((d) => datadomains.includes(d))) {
    checklist.push('[ ] Update Prisma schema if needed');
    checklist.push('[ ] Add/update tRPC router methods');
    checklist.push('[ ] Add/update Zod schemas');
  }

  return checklist;
}

/**
 * Get relevant documentation files
 */
export function getRelevantDocs(domains: string[], projectRoot: string): string[] {
  const docMappings: Record<string, string[]> = {
    booking: ['docs/BOOKING_SYSTEM.md', 'CLAUDE.md'],
    events: ['docs/TICKETING_SYSTEM.md', 'CLAUDE.md'],
    general: ['CLAUDE.md'],
  };

  const docs: string[] = [];

  for (const domain of domains) {
    const domainDocs = docMappings[domain] ?? docMappings.general ?? [];
    docs.push(...domainDocs);
  }

  // Filter to existing files
  return [...new Set(docs)].filter((doc) => {
    const fullPath = path.join(projectRoot, doc);
    return fs.existsSync(fullPath);
  });
}
