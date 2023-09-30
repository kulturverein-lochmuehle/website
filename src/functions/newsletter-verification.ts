/// <reference lib="dom" /> - required for `fetch` to work
import { env } from 'node:process';
import type { Handler } from '@netlify/functions';

import { prepareBasicAuth, type MailjetError, isError } from './utils/mailjet.utils.js';
import { getCorsHeaders } from './utils/cors.utils.js';

const { MAILJET_API_URL, MAILJET_NEWSLETTER_LIST_ID } = env;

const addContactToList = async (email: string, listId = MAILJET_NEWSLETTER_LIST_ID): Promise<void> => {
  const response = await fetch(`${MAILJET_API_URL}/REST/listrecipient`, {
    method: 'POST',
    headers: {
      'Authorization': prepareBasicAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ContactAlt: email,
      ListID: listId,
      IsUnsubscribed: false,
    }),
  });
  const payload = await response.json();
  if (isError(payload)) return Promise.reject(payload);
};

const handler: Handler = async ({ httpMethod, queryStringParameters: { token } }) => {
  const headers = getCorsHeaders(httpMethod);

  // handle options requests
  if (httpMethod === 'OPTIONS') return { headers, statusCode: 200 };

  // handle missing token
  if (token === undefined) return { headers, statusCode: 400 };

  try {
    // decode base64 token
    const email = Buffer.from(token, 'base64').toString('utf-8');
    console.log(`Received verification request for ${email}`);

    try {
      // subscribe to newsletter list
      await addContactToList(email);

      // finally, return success and log
      console.log(`Verified subscription of ${email}`);
      return { headers, statusCode: 200, body: 'OK' };
    } catch (error: MailjetError | any) {
      console.warn(`Submission to Mailjet failed: ${error.ErrorMessage ?? error}`);
      return { headers, statusCode: error.StatusCode ?? 400, body: JSON.stringify(error) };
    }
  } catch (error) {
    console.warn(`Malformed data received: ${error}`);
    return { headers, statusCode: 400, body: `${error}` };
  }
};

export { handler };
