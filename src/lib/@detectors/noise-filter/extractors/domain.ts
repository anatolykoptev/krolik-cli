/**
 * @module lib/@detectors/noise-filter/extractors/domain
 * @description Domain Boundary Detection
 *
 * Extracts domain context from file paths to prevent cross-domain
 * duplicate detection. Functions in different domains are intentionally
 * similar, not duplicates.
 */

// ============================================================================
// TYPES
// ============================================================================

export type DomainLayer = 'core' | 'domain' | 'ui' | 'integration' | 'api' | 'shared';

export interface DomainContext {
  domain: string | null;
  layer: DomainLayer;
  feature?: string | undefined;
  routeSegment?: string | undefined;
}

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

interface DomainPattern {
  pattern: RegExp;
  layer: DomainLayer;
  domainGroup: number;
  featureGroup?: number;
}

const DOMAIN_PATTERNS: DomainPattern[] = [
  // Feature-based organization
  { pattern: /\/features\/(\w+)(?:\/(\w+))?/, layer: 'domain', domainGroup: 1, featureGroup: 2 },

  // Library modules
  { pattern: /\/lib\/@(\w+)\//, layer: 'core', domainGroup: 1 },

  // Components by domain
  { pattern: /\/components\/(\w+)\//, layer: 'ui', domainGroup: 1 },

  // tRPC routers
  { pattern: /\/routers\/(\w+)/, layer: 'api', domainGroup: 1 },

  // API routes (Next.js)
  { pattern: /\/api\/(\w+)/, layer: 'api', domainGroup: 1 },

  // Integrations
  { pattern: /\/integrations\/(\w+)/, layer: 'integration', domainGroup: 1 },

  // Packages in monorepo
  { pattern: /\/packages\/(\w+)\//, layer: 'shared', domainGroup: 1 },

  // App router segments
  { pattern: /\/app\/([^/]+)\//, layer: 'ui', domainGroup: 1 },

  // Panel/admin sections
  { pattern: /\/panel\/(\w+)/, layer: 'domain', domainGroup: 1 },

  // Services
  { pattern: /\/services\/(\w+)/, layer: 'domain', domainGroup: 1 },

  // Hooks by domain
  { pattern: /\/hooks\/(\w+)\//, layer: 'domain', domainGroup: 1 },
];

// ============================================================================
// ROUTE SEGMENT EXTRACTION
// ============================================================================

/**
 * Extract Next.js route segment from path.
 *
 * @example
 * extractRouteSegment('/app/panel/customers/page.tsx') → '/panel/customers'
 */
export function extractRouteSegment(filepath: string): string | undefined {
  // Match app router paths: /app/.../page.tsx or /app/.../route.tsx
  const match = filepath.match(/\/app(\/[^.]+)\/(?:page|route|layout)\.tsx?$/);
  return match?.[1];
}

/**
 * Check if two files are in different route segments.
 */
export function areDifferentRouteSegments(path1: string, path2: string): boolean {
  const seg1 = extractRouteSegment(path1);
  const seg2 = extractRouteSegment(path2);

  // If either is not a route, they're not "different routes"
  if (!seg1 || !seg2) return false;

  // Different segments = different routes
  return seg1 !== seg2;
}

// ============================================================================
// DOMAIN EXTRACTION
// ============================================================================

/**
 * Extract domain context from a file path.
 *
 * @param filepath - Path to analyze
 * @returns Domain context with domain name, layer, and optional feature
 *
 * @example
 * extractDomain('/features/booking/hooks/useBooking.ts')
 * // → { domain: 'booking', layer: 'domain', feature: 'hooks' }
 *
 * extractDomain('/lib/@cache/redis.ts')
 * // → { domain: 'cache', layer: 'core' }
 *
 * extractDomain('/components/CRM/CustomerCard.tsx')
 * // → { domain: 'CRM', layer: 'ui' }
 */
export function extractDomain(filepath: string): DomainContext {
  const normalizedPath = filepath.replace(/\\/g, '/');

  // Try each pattern
  for (const { pattern, layer, domainGroup, featureGroup } of DOMAIN_PATTERNS) {
    const match = normalizedPath.match(pattern);
    if (match) {
      const routeSegment = extractRouteSegment(normalizedPath);
      return {
        domain: match[domainGroup] ?? null,
        layer,
        feature: featureGroup !== undefined ? match[featureGroup] : undefined,
        routeSegment,
      };
    }
  }

  // Default: no specific domain
  const routeSegment = extractRouteSegment(normalizedPath);
  return {
    domain: null,
    layer: 'core',
    routeSegment,
  };
}

/**
 * Check if two files are in different domains.
 */
export function areDifferentDomains(path1: string, path2: string): boolean {
  const domain1 = extractDomain(path1);
  const domain2 = extractDomain(path2);

  // If both have domains and they differ
  if (domain1.domain && domain2.domain && domain1.domain !== domain2.domain) {
    return true;
  }

  // Check route segments for page files
  return areDifferentRouteSegments(path1, path2);
}

/**
 * Check if all paths in an array are in different domains.
 */
export function areAllDifferentDomains(paths: string[]): boolean {
  if (paths.length < 2) return false;

  const domains = paths.map(extractDomain);
  const domainNames = domains.map((d) => d.domain).filter(Boolean);

  // If we have domain names, check if all unique
  if (domainNames.length >= 2) {
    const uniqueDomains = new Set(domainNames);
    return uniqueDomains.size === domainNames.length;
  }

  // Check route segments
  const routeSegments = domains.map((d) => d.routeSegment).filter(Boolean);
  if (routeSegments.length >= 2) {
    const uniqueSegments = new Set(routeSegments);
    return uniqueSegments.size === routeSegments.length;
  }

  return false;
}

/**
 * Group paths by their domain.
 */
export function groupByDomain(paths: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const filepath of paths) {
    const { domain } = extractDomain(filepath);
    const key = domain ?? '__no_domain__';
    const existing = groups.get(key) ?? [];
    existing.push(filepath);
    groups.set(key, existing);
  }

  return groups;
}
