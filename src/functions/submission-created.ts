/// <reference lib="dom" />
import { env } from 'node:process';
import type { Handler } from '@netlify/functions';

const handler: Handler = async ({ body }) => {
  const { email, ...metadata } = JSON.parse(body).payload;
  console.log(`Recieved a submission: ${email}`);
  const { EMAIL_TOKEN } = env;
  try {
    const submit = await fetch('https://api.buttondown.email/v1/subscribers', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${EMAIL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, metadata }),
    });
    const data = await submit.json();
    console.log(`Submitted to Buttondown:\n ${data}`);
  } catch (error) {
    return { statusCode: 422, body: String(error) };
  }
};

export { handler };
