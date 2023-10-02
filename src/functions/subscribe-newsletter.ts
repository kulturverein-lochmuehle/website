/// <reference lib="dom" /> - required for 'fetch' to work
import { env } from 'node:process';
import type { Handler } from '@netlify/functions';

import type { NewsletterSubscription } from '../types/form.types.js';
import { getCorsHeaders } from './utils/cors.utils.js';

const { MAILJET_SUBSCRIBE_URL } = env;

const handler: Handler = async ({ body, httpMethod }) => {
  // retrieve cors headers
  const headers = getCorsHeaders(httpMethod);

  // handle options requests
  if (httpMethod === 'OPTIONS') return { headers, statusCode: 200 };

  try {
    const data = JSON.parse(body) as NewsletterSubscription;

    // handle possible bot submission
    if (data.honey) {
      console.warn(`Received spam submission: ${data.email}`);
      return { headers, statusCode: 200, body: 'OK' };
    }

    // prepare form data
    const fields = [];
    if (data.first_name) fields.push({ ID: 221728, Value: data.first_name });
    if (data.last_name) fields.push({ ID: 221729, Value: data.last_name });
    const payload = { Email: data.email, Fields: fields };

    // send request to mailjet by mimicking a widget form submission
    const response = await fetch(MAILJET_SUBSCRIBE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      body: JSON.stringify(payload),
    });

    return {
      headers,
      statusCode: response.ok ? 200 : 400,
      body: await response.text(),
    };
  } catch (message) {
    return {
      headers,
      statusCode: 503,
      body: JSON.stringify({ error: `Subscription couldn't be processed: ${message}` }),
    };
  }
};

export { handler };
