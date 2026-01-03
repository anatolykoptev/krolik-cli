/**
 * @module lib/domains
 * @description Domain resolution utilities for universal CLI support
 */

import type { DomainConfig, KrolikConfig } from '../types/config';

/**
 * Resolved domain keywords for filtering
 */
export interface ResolvedDomainKeywords {
  primary: string[];
  secondary: string[];
}

/**
 * Built-in domain definitions (defaults)
 * These are used when no custom domains are configured
 */
const BUILTIN_DOMAINS: Record<string, DomainConfig> = {
  booking: {
    primary: ['booking', 'availability'],
    secondary: ['slot', 'schedule', 'reschedule', 'appointment', 'reservation'],
  },
  events: {
    primary: ['event', 'ticket', 'ticketing'],
    secondary: ['venue', 'checkin', 'concert', 'festival'],
  },
  crm: {
    primary: ['crm', 'customer'],
    secondary: ['note', 'tag', 'interaction', 'conversation', 'lead', 'contact'],
  },
  places: {
    primary: ['place'],
    secondary: ['location', 'business', 'venue'],
  },
  users: {
    primary: ['user', 'auth'],
    secondary: ['profile', 'account', 'login', 'session'],
  },
  payments: {
    primary: ['payment', 'billing'],
    secondary: ['invoice', 'subscription', 'refund', 'stripe'],
  },
  notifications: {
    primary: ['notification'],
    secondary: ['email', 'sms', 'push', 'reminder'],
  },
  admin: {
    primary: ['admin'],
    secondary: ['dashboard', 'analytics', 'moderation'],
  },
};

/**
 * Get domain keywords for filtering
 *
 * Resolution order:
 * 1. Custom domains from config.domains
 * 2. Built-in domains (BUILTIN_DOMAINS)
 * 3. Fallback: use domain name directly as primary keyword
 *
 * @param domainNames - Domain names to resolve (e.g., ['booking', 'crm'])
 * @param config - Optional krolik config with custom domains
 * @returns Resolved keywords for filtering
 */
export function getDomainKeywords(
  domainNames: string[],
  config?: KrolikConfig,
): ResolvedDomainKeywords {
  const primary: string[] = [];
  const secondary: string[] = [];

  for (const name of domainNames) {
    const lowerName = name.toLowerCase();

    // 1. Check custom config domains first
    if (config?.domains?.[lowerName]) {
      const custom = config.domains[lowerName];
      primary.push(...custom.primary);
      if (custom.secondary) {
        secondary.push(...custom.secondary);
      }
      continue;
    }

    // 2. Check built-in domains
    if (BUILTIN_DOMAINS[lowerName]) {
      const builtin = BUILTIN_DOMAINS[lowerName];
      primary.push(...builtin.primary);
      if (builtin.secondary) {
        secondary.push(...builtin.secondary);
      }
      continue;
    }

    // 3. Fallback: use domain name as primary keyword
    primary.push(lowerName);
  }

  return {
    primary: [...new Set(primary)],
    secondary: [...new Set(secondary)],
  };
}

/**
 * Detect domains from text using config or built-in keywords
 *
 * @param text - Text to analyze (issue title, feature name, etc.)
 * @param config - Optional krolik config with custom domains
 * @returns Array of detected domain names
 */
export function detectDomainsFromText(text: string, config?: KrolikConfig): string[] {
  const lowerText = text.toLowerCase();
  const detected: string[] = [];

  // Merge custom and built-in domains
  const allDomains: Record<string, DomainConfig> = {
    ...BUILTIN_DOMAINS,
    ...config?.domains,
  };

  for (const [domainName, domainConfig] of Object.entries(allDomains)) {
    // Skip domains without proper keyword structure (e.g., path-only configs)
    if (!Array.isArray(domainConfig.primary)) {
      continue;
    }
    const allKeywords = [...domainConfig.primary, ...(domainConfig.secondary || [])];

    for (const keyword of allKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        if (!detected.includes(domainName)) {
          detected.push(domainName);
        }
        break;
      }
    }
  }

  // If nothing detected but text is non-empty, use text as domain name
  if (detected.length === 0 && text.trim()) {
    detected.push(text.trim().toLowerCase());
  }

  return detected;
}

/**
 * Get domain hints for AI context
 *
 * @param domainNames - Domain names
 * @param config - Optional krolik config
 * @returns Combined hints from all domains
 */
export function getDomainHints(
  domainNames: string[],
  config?: KrolikConfig,
): Record<string, string> {
  const hints: Record<string, string> = {};

  for (const name of domainNames) {
    const lowerName = name.toLowerCase();

    // Check custom config domains first
    if (config?.domains?.[lowerName]?.hints) {
      Object.assign(hints, config.domains[lowerName].hints);
    }
  }

  return hints;
}

/**
 * Get all available domain names (from config + built-in)
 */
export function getAvailableDomains(config?: KrolikConfig): string[] {
  const domains = new Set<string>(Object.keys(BUILTIN_DOMAINS));

  if (config?.domains) {
    for (const name of Object.keys(config.domains)) {
      domains.add(name);
    }
  }

  return Array.from(domains).sort();
}
