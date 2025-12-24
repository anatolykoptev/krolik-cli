/**
 * @module commands/context/parsers/hints
 * @description Context hints generation based on project patterns
 */

/**
 * Generate context hints based on detected domains
 */
export function generateContextHints(domains: string[]): Record<string, string> {
  const hints: Record<string, string> = {
    'no-placeholders':
      'Zero TODOs. All features fully implemented. Error handling for every edge case.',
    quality:
      'Components must be: responsive, accessible (a11y), performant (no unnecessary re-renders).',
  };

  // Add domain-specific hints
  if (domains.includes('booking')) {
    hints.concurrency = 'Booking creation must prevent double-booking via Prisma $transaction.';
    hints.timezone =
      'All dates stored as UTC in DB. Convert to user timezone in UI using date-fns-tz.';
    hints.relations =
      'Booking.place is required (cascade delete). Booking.user is optional (set null on delete).';
    hints.validation =
      'Validate: minAdvanceHours, maxAdvanceDays, minPartySize, maxPartySize from BookingSettings.';
  }

  if (domains.includes('events')) {
    hints.tickets = 'Ticket quantity must be tracked atomically. Use $transaction for purchases.';
    hints.capacity =
      'Check venue capacity before ticket creation. Track soldCount + reservedCount.';
    hints.relations = 'Event.place is optional. TicketType.event is required (cascade delete).';
    hints.pricing = 'Prices stored as integers (kopecks/cents). Convert for display only.';
  }

  if (domains.includes('crm')) {
    hints.privacy = 'Customer data is sensitive. Apply proper access controls via ctx.session.';
    hints.deduplication = 'Customers identified by phone+placeId. Merge duplicates on conflict.';
    hints.relations =
      'Customer.place is required (cascade delete). CustomerNote/Tag cascade with customer.';
  }

  if (domains.includes('places')) {
    hints.relations =
      'Place.owner (User) required. Delete place cascades to bookings, events, customers.';
    hints.geolocation =
      'Latitude/longitude stored as Float. Use PostGIS or calculate distance in app.';
  }

  if (domains.includes('users')) {
    hints.auth = 'Use ctx.session.user for authenticated user. Never trust client-provided userId.';
    hints.relations =
      'User deletion sets null on bookings/interactions. Does NOT delete owned places.';
  }

  return hints;
}
