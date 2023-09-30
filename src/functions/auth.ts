import { env } from 'node:process';
import type { Handler } from '@netlify/functions';
import { getCorsHeaders } from './utils/cors.utils.js';


const handler: Handler = async ({ body, httpMethod }) => {
  // retrieve cors headers
  const headers = getCorsHeaders(httpMethod);

  // handle options requests
  if (httpMethod === 'OPTIONS') return { headers, statusCode: 200 };

  try {
    const { KVLM_PROTOCOL_TOKEN } = JSON.parse(body);
    const success = KVLM_PROTOCOL_TOKEN === env.KVLM_PROTOCOL_TOKEN;

    return {
      headers,
      statusCode: success ? 200 : 400,
      body: JSON.stringify({ success }),
    };
  } catch (message) {
    return {
      headers,
      statusCode: 401,
      body: JSON.stringify({ error: 'Failed authentication', message }),
    };
  }
};

export { handler };
