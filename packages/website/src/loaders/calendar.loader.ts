import type { Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import ical, { type CalendarComponent, type ParameterValue, type VEvent } from 'node-ical';

// the feed carries timezones and todos as well
const isEvent = (entry: CalendarComponent | undefined): entry is VEvent => entry?.type === 'VEVENT';

// an event without an explicit end lasts as long as its start
const ends = (event: VEvent): Date => event.end ?? event.start;

// text properties come either plain or wrapped with their ical parameters
const text = (value?: ParameterValue): string =>
  (typeof value === 'string' ? value : (value?.val ?? '')).trim();

export const calendarEvent = z.object({
  summary: z.string(),
  start: z.date(),
  end: z.date(),
  location: z.string().optional(),
});

/**
 * Reads a public ical feed of upcoming events.
 *
 * The production site did this in a netlify function on every request, which
 * static hosting has no place for - the feed is read at build time instead,
 * so a scheduled rebuild is what keeps it current.
 *
 * The store does not promise an order, so consumers sort themselves.
 *
 * The public feed of the association is
 * `https://calendar.google.com/calendar/ical/bt9jo8d4eih6jnd962kblscces%40group.calendar.google.com/public/basic.ics`,
 * no credentials involved. It is required: a site without its events is not
 * one to ship, so a build without a reachable feed fails.
 */
export function calendar({ url }: { url?: string }): Loader {
  return {
    name: 'calendar',
    load: async ({ store, logger, parseData }) => {
      store.clear();

      if (url === undefined || url === '') {
        throw new Error(
          'KVLM_CALENDAR_URL is not set, refusing to build a site without its events',
        );
      }

      // a feed that is configured but unreachable is a broken build, not a
      // page quietly missing its events
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) {
        throw new Error(`Failed reading the calendar: ${response.status} ${response.statusText}`);
      }

      const parsed = ical.sync.parseICS(await response.text());
      const now = Date.now();
      const events = Object.values(parsed)
        .filter(isEvent)
        // just future (or ongoing) ones
        .filter(event => ends(event).getTime() > now)
        // in the order they will happen
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      for (const event of events) {
        const id = event.uid;
        const location = text(event.location);
        const data = await parseData({
          id,
          data: {
            summary: text(event.summary),
            start: new Date(event.start.getTime()),
            end: new Date(ends(event).getTime()),
            location: location === '' ? undefined : location,
          },
        });
        store.set({ id, data });
      }

      logger.info(`Loaded ${events.length} upcoming events`);
    },
  };
}
