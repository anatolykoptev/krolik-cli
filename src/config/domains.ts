/**
 * @module config/domains
 * @description Domain definitions and keyword mappings for context detection
 */

/**
 * Domain keyword mappings - used to detect which domain a task belongs to
 */
export const DOMAIN_KEYWORDS: Record<string, string[]> = {
  booking: [
    'booking',
    'slot',
    'availability',
    'schedule',
    'appointment',
    'reservation',
    'calendar',
    'time slot',
    'bookingSettings',
    'busySlot',
  ],
  events: ['events', 'event', 'ticket', 'ticketing', 'venue', 'concert', 'festival'],
  places: ['places', 'place', 'business', 'location', 'restaurant', 'cafe', 'bar', 'club'],
  users: ['users', 'user', 'profile', 'account', 'auth', 'login', 'registration'],
  crm: ['crm', 'customer', 'client', 'lead', 'contact', 'interaction', 'customerNote'],
  gamification: [
    'gamification',
    'reward',
    'points',
    'achievement',
    'badge',
    'level',
    'leaderboard',
    'streak',
  ],
  payments: [
    'payment',
    'subscription',
    'invoice',
    'billing',
    'transaction',
    'refund',
    'payout',
    'stripe',
  ],
  notifications: [
    'notification',
    'email',
    'sms',
    'push',
    'reminder',
    'alert',
    'message',
    'template',
  ],
  admin: [
    'admin',
    'dashboard',
    'analytics',
    'moderation',
    'report',
    'stats',
    'metrics',
    'management',
  ],
  mobile: ['mobile', 'expo', 'react native', 'app', 'ios', 'android', 'push notification'],
};

/**
 * Domain file patterns - used to find related files for each domain
 * Patterns use glob syntax
 */
export const DOMAIN_FILES: Record<string, string[]> = {
  booking: [
    'packages/api/src/routers/booking*.ts',
    'packages/api/src/routers/business/booking*.ts',
    'apps/web/components/Business/Booking/**/*.tsx',
    'apps/web/components/booking/**/*.tsx',
    'packages/db/prisma/models/booking*.prisma',
    'packages/shared/src/schemas/booking*.ts',
  ],
  events: [
    'packages/api/src/routers/events*.ts',
    'packages/api/src/routers/business/ticketing*.ts',
    'apps/web/components/Business/Ticketing/**/*.tsx',
    'apps/web/components/events/**/*.tsx',
    'packages/db/prisma/models/event*.prisma',
    'packages/db/prisma/models/ticket*.prisma',
    'packages/shared/src/schemas/event*.ts',
  ],
  places: [
    'packages/api/src/routers/places*.ts',
    'packages/api/src/routers/business*.ts',
    'apps/web/components/Business/**/*.tsx',
    'apps/web/components/places/**/*.tsx',
    'packages/db/prisma/models/place*.prisma',
    'packages/db/prisma/models/business*.prisma',
    'packages/shared/src/schemas/place*.ts',
  ],
  users: [
    'packages/api/src/routers/user*.ts',
    'packages/api/src/routers/auth*.ts',
    'apps/web/components/auth/**/*.tsx',
    'apps/web/components/profile/**/*.tsx',
    'packages/db/prisma/models/user*.prisma',
    'packages/shared/src/schemas/user*.ts',
  ],
  crm: [
    'packages/api/src/routers/business/crm*.ts',
    'packages/api/src/routers/customer*.ts',
    'apps/web/components/Business/CRM/**/*.tsx',
    'packages/db/prisma/models/customer*.prisma',
    'packages/shared/src/schemas/customer*.ts',
  ],
  gamification: [
    'packages/api/src/routers/gamification*.ts',
    'apps/web/components/gamification/**/*.tsx',
    'packages/db/prisma/models/gamification*.prisma',
    'packages/shared/src/schemas/gamification*.ts',
  ],
  payments: [
    'packages/api/src/routers/payment*.ts',
    'packages/api/src/routers/subscription*.ts',
    'apps/web/components/payments/**/*.tsx',
    'packages/db/prisma/models/payment*.prisma',
    'packages/db/prisma/models/subscription*.prisma',
  ],
  notifications: [
    'packages/api/src/routers/notification*.ts',
    'apps/web/components/notifications/**/*.tsx',
    'packages/db/prisma/models/notification*.prisma',
  ],
  admin: [
    'packages/api/src/routers/admin*.ts',
    'apps/web/components/admin/**/*.tsx',
    'apps/web/app/admin/**/*.tsx',
  ],
  mobile: ['apps/mobile/**/*.tsx', 'apps/mobile/**/*.ts', 'packages/shared/src/mobile/**/*.ts'],
};

/**
 * Suggested approaches for each domain
 */
export const DOMAIN_APPROACHES: Record<string, string[]> = {
  booking: [
    'Check existing Booking schema in packages/db/prisma/models/',
    'Review tRPC router at packages/api/src/routers/',
    'Update Zod schemas in packages/shared/',
    'Create/update React components in apps/web/components/Business/Booking/',
    'Add tests for new booking logic',
  ],
  events: [
    'Check Event/Ticket schemas in packages/db/prisma/models/',
    'Review tRPC router for events/ticketing',
    'Update Zod schemas in packages/shared/',
    'Create/update React components in apps/web/components/Business/Ticketing/',
    'Consider event occurrence patterns',
  ],
  places: [
    'Check Place/Business schemas in packages/db/prisma/models/',
    'Review tRPC router for places/business',
    'Update Zod schemas in packages/shared/',
    'Consider business hours and availability',
  ],
  users: [
    'Check User schema in packages/db/prisma/models/',
    'Review auth router in packages/api/',
    'Update authentication middleware if needed',
    'Consider email verification flow',
  ],
  crm: [
    'Check Customer schema in packages/db/prisma/models/',
    'Review CRM router in packages/api/src/routers/business/',
    'Update customer interaction tracking',
    'Consider segmentation logic',
  ],
  gamification: [
    'Check Gamification schema in packages/db/prisma/models/',
    'Review points calculation logic',
    'Update achievement triggers',
    'Consider leaderboard queries performance',
  ],
  payments: [
    'Check Payment/Subscription schemas',
    'Review Stripe integration',
    'Update webhook handlers',
    'Consider refund flow',
  ],
  notifications: [
    'Check Notification schema',
    'Review email/SMS templates',
    'Update notification triggers',
    'Consider push notification setup',
  ],
  admin: [
    'Check admin permissions',
    'Review dashboard queries for performance',
    'Update analytics aggregations',
    'Consider data export functionality',
  ],
  mobile: [
    'Check Expo setup in apps/mobile/',
    'Review shared components from packages/shared/',
    'Update navigation structure',
    'Consider offline support',
  ],
};

/**
 * Detect domains from text (issue title, description, etc.)
 * Uses DOMAIN_KEYWORDS mapping to detect which domain a task belongs to
 * This is kept for backward compatibility with existing code
 *
 * @deprecated Use detectDomainsFromText from lib/domains for config-aware detection
 */
export function detectDomains(text: string): string[] {
  const lowerText = text.toLowerCase();
  const detected: string[] = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        if (!detected.includes(domain)) {
          detected.push(domain);
        }
        break;
      }
    }
  }

  return detected;
}

/**
 * Get related files for domains
 */
export function getRelatedFiles(domains: string[]): string[] {
  const files: string[] = [];

  for (const domain of domains) {
    const patterns = DOMAIN_FILES[domain];
    if (patterns) {
      files.push(...patterns);
    }
  }

  return [...new Set(files)];
}

/**
 * Get suggested approaches for domains
 * Includes standard first and last steps for all tasks
 */
export function getApproaches(domains: string[]): string[] {
  const approaches: string[] = ['1. Read relevant CLAUDE.md files for project rules'];

  for (const domain of domains) {
    const domainApproaches = DOMAIN_APPROACHES[domain] || [];
    for (const approach of domainApproaches) {
      if (!approaches.includes(approach)) {
        approaches.push(approach);
      }
    }
  }

  approaches.push(
    `${approaches.length + 1}. Run \`pnpm typecheck && pnpm lint\` before committing`,
  );

  return approaches;
}
