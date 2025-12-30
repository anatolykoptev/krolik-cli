/**
 * @module commands/review/risk
 * @description Risk assessment for code changes
 */

import type { FileChange, ReviewIssue } from '../../types/commands/review';

export type RiskLevel = 'low' | 'medium' | 'high';

const HTTP_INTERNAL_SERVER_ERROR = 500;

/**
 * Assess overall risk level based on changes and issues
 */
export function assessRisk(files: FileChange[], issues: ReviewIssue[]): RiskLevel {
  // High risk indicators
  const hasSecurityErrors = issues.some((i) => i.category === 'security' && i.severity === 'error');
  const modifiesAuth = files.some((f) => f.path.includes('auth') || f.path.includes('Auth'));
  const modifiesDB = files.some((f) => f.path.includes('prisma') || f.path.includes('migration'));
  const totalChanges = files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
  const largeChange = totalChanges > HTTP_INTERNAL_SERVER_ERROR;

  if (hasSecurityErrors) return 'high';
  if (modifiesAuth && modifiesDB) return 'high';
  if (modifiesDB && largeChange) return 'high';

  // Medium risk indicators
  const hasErrors = issues.some((i) => i.severity === 'error');
  const modifiesAPI = files.some((f) => f.path.includes('router') || f.path.includes('api/'));
  const modifiesCore = files.some((f) => f.path.includes('lib/') || f.path.includes('middleware'));

  if (hasErrors) return 'medium';
  if (modifiesAPI || modifiesCore) return 'medium';
  if (largeChange) return 'medium';

  return 'low';
}

/**
 * Check if tests are required for changes
 */
export function needsTests(files: FileChange[]): boolean {
  const hasNewCode = files.some(
    (f) => f.status === 'added' && (f.path.endsWith('.ts') || f.path.endsWith('.tsx')),
  );
  const modifiesLogic = files.some(
    (f) => f.path.includes('router') || f.path.includes('lib/') || f.path.includes('hooks/'),
  );
  const hasTestChanges = files.some((f) => f.path.includes('test') || f.path.includes('spec'));

  return (hasNewCode || modifiesLogic) && !hasTestChanges;
}

/**
 * Check if documentation is required for changes
 */
export function needsDocs(files: FileChange[]): boolean {
  const modifiesAPI = files.some((f) => f.path.includes('router') || f.path.includes('api/'));
  const modifiesPublic = files.some((f) => f.path.includes('app/') && !f.path.includes('admin'));
  const hasDocChanges = files.some((f) => f.path.endsWith('.md') || f.path.includes('docs/'));

  return (modifiesAPI || modifiesPublic) && !hasDocChanges;
}

/**
 * Detect affected features from file changes
 */
export function detectAffectedFeatures(files: FileChange[]): string[] {
  const featureMappings: Record<string, string[]> = {
    'Booking System': ['booking', 'Booking', 'reservation'],
    Reviews: ['review', 'Review', 'rating', 'Rating'],
    Favorites: ['favorite', 'Favorite', 'useFavorites'],
    Authentication: ['auth', 'Auth', 'session', 'login', 'logout'],
    Places: ['place', 'Place', 'PlaceCard', 'PlaceDetails'],
    Maps: ['Map', 'map', 'Yandex', 'geolocation'],
    'Admin Panel': ['admin', 'Admin'],
    'Business Dashboard': ['business', 'Business'],
    API: ['trpc', 'router', 'procedure', 'api/'],
    Database: ['prisma', 'Prisma', 'schema', 'migration'],
    'UI Components': ['components/', 'ui/', 'Button', 'Modal', 'Card'],
    Tests: ['test', 'spec', '__tests__', 'vitest'],
  };

  const features = new Set<string>();

  for (const file of files) {
    for (const [feature, patterns] of Object.entries(featureMappings)) {
      if (patterns.some((p) => file.path.includes(p))) {
        features.add(feature);
      }
    }
  }

  return Array.from(features);
}
