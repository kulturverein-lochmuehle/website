/**
 * Subscription links to the public calendar, derived from the very feed the
 * `events` collection is read from. Without a feed there is nothing to
 * subscribe to, the links stay empty then.
 */
export function getCalendarLinks(): { google: string; apple: string } {
  const url = process.env['KVLM_CALENDAR_URL'];
  if (url === undefined || url === '') return { google: '', apple: '' };

  // calendar apps take over from `webcal:`, google needs it as a parameter
  const webcal = url.replace(/^https?:/, 'webcal:');
  return {
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    apple: webcal,
  };
}
