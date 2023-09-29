import fetch from 'node-fetch';
import { Handler } from '@netlify/functions';
import { parseICS } from 'ical/ical';
import { UpcomingEvent } from '../types/event.types';

const handler: Handler = async () => {
  try {
    const response = await fetch(process.env.KVLM_CALENDAR_URL, { redirect: 'follow' });
    const calendar = parseICS(await response.text());
    const now = new Date();
    const upcoming = Object
      // read all entries
      .values(calendar)
      // keep events only
      .filter(({ type }) => type === 'VEVENT')
      // just future (or ongoing) events
      .filter(({ end }) => end > now)
      // map relevant information
      .map(({ start, end, location, summary }) => ({ start, end, location, summary } as UpcomingEvent))
      // order all events descending
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, x-requested-with',
      },
      body: JSON.stringify(upcoming),
    };
  } catch (message) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed fetching calendar data', message }),
    };
  }
};

export { handler };
