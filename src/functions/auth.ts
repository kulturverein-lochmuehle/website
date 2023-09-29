import { env } from 'node:process';
import type { Handler } from '@netlify/functions';

const handler: Handler = async ({ body, httpMethod }) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-requested-with',
  };

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
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed authentication', message }),
    };
  }
};

export { handler };
