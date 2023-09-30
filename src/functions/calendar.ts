import { env } from 'node:process';
import type { Handler } from '@netlify/functions';
import * as ical from 'ical';

import type { UpcomingEvent } from '../types/event.types.js';
import { getCorsHeaders } from './utils/cors.utils.js';

declare const fetch: Function;

const handler: Handler = async ({ httpMethod }) => {
  // retrieve cors headers
  const headers = getCorsHeaders(httpMethod);

  // handle options requests
  if (httpMethod === 'OPTIONS') return { headers, statusCode: 200 };

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
      statusCode: 503,
      body: JSON.stringify({ error: 'Failed fetching calendar data', message }),
    };
  }
};

export { handler };
