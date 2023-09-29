import { env } from 'node:process';
import type { Handler } from '@netlify/functions';
import * as ical from 'ical';

import type { UpcomingEvent } from '../types/event.types.js';

declare const fetch: Function;

const handler: Handler = async () => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-requested-with',
  };

  try {
    const response = await fetch(env.KVLM_CALENDAR_URL, { redirect: 'follow' });
    const calendar = ical.parseICS(await response.text());
    const now = new Date();
    const upcoming = Object
      // read all entries
      .values(calendar)
      // keep events only
      .filter(({ type }) => type === 'VEVENT')
      // just future (or ongoing) events
      .filter(({ end }) => end > now)
      // map relevant information
      .map(({ start, end, location, summary }) => ({ start, end, location, summary }) as UpcomingEvent)
      // order all events descending
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    return {
      headers,
      statusCode: 200,
      body: JSON.stringify(upcoming),
    };
  } catch (message) {
    return {
      headers,
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed fetching calendar data', message }),
    };
  }
};

export { handler };
