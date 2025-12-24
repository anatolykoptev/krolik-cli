/**
 * @module commands/context/helpers/patterns
 * @description Domain to file pattern mapping
 */

export interface DomainPatterns {
  zod: string[];
  components: string[];
  tests: string[];
}

/**
 * Domain to file pattern mapping
 */
export const DOMAIN_FILE_PATTERNS: Record<string, DomainPatterns> = {
  booking: {
    zod: ['booking', 'availability', 'schedule'],
    components: ['Booking', 'Calendar', 'Schedule', 'Availability'],
    tests: ['booking', 'availability'],
  },
  events: {
    zod: ['event', 'ticket', 'venue'],
    components: ['Event', 'Ticket', 'Venue', 'Ticketing'],
    tests: ['event', 'ticket'],
  },
  crm: {
    zod: ['customer', 'interaction', 'lead', 'crm'],
    components: ['Customer', 'CRM', 'Lead', 'Interaction'],
    tests: ['customer', 'crm'],
  },
  places: {
    zod: ['place', 'business', 'location'],
    components: ['Place', 'Business', 'Location'],
    tests: ['place', 'business'],
  },
  users: {
    zod: ['user', 'auth', 'profile'],
    components: ['User', 'Auth', 'Profile'],
    tests: ['user', 'auth'],
  },
};

/**
 * Get patterns for a domain (case-insensitive)
 */
export function getDomainPatterns(domain: string): DomainPatterns | undefined {
  return DOMAIN_FILE_PATTERNS[domain.toLowerCase()];
}
