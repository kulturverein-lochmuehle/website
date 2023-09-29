/// <reference lib="dom" />
import { env } from 'node:process';
import type { Handler } from '@netlify/functions';
import type { NewsletterSubscription } from '../types/form.types.js';

type MailjetContactRequestPayload = {
  Email: string;
  Name?: string;
  IsExcludedFromCampaigns?: 'true' | 'false';
};

type MailjetContactCreateResponse = {
  Count: number;
  Data: MailjetContactData[];
  Total: number;
};

type MailjetContactData = {
  IsExcludedFromCampaigns: boolean;
  Name: string;
  CreatedAt: string;
  DeliveredCount: number;
  Email: string;
  ExclusionFromCampaignsUpdatedAt: string;
  ID: number;
  IsOptInPending: boolean;
  IsSpamComplaining: boolean;
  LastActivityAt: string;
  LastUpdateAt: string;
  UnsubscribedAt: string;
  UnsubscribedBy: string;
};

const MAILJET_API_URL = 'https://api.mailjet.com/v3/REST';
const { MAILJET_API_KEY_PUBLIC, MAILJET_API_KEY_PRIVATE, MAILJET_API_CONTACT_LIST_ID } = env;

const prepareBasicAuth = (key = MAILJET_API_KEY_PUBLIC, secret = MAILJET_API_KEY_PRIVATE) => {
  const encoded = Buffer.from(`${key}:${secret}`).toString('base64');
  return `Basic ${encoded}`;
};

const addContact = async (email: string, firstName?: string, lastName?: string): Promise<MailjetContactData> => {
  const body: MailjetContactRequestPayload = { Email: email, IsExcludedFromCampaigns: 'true' };
  const name = [firstName, lastName].filter(Boolean).join(' ');
  if (name !== '') body.Name = name;

  const response = await fetch(`${MAILJET_API_URL}/contact`, {
    method: 'POST',
    headers: {
      'Authorization': prepareBasicAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data: MailjetContactCreateResponse = await response.json();
  return data.Data[0];
};

const subscribeToNewsletter = async (contactId: number, listId = MAILJET_API_CONTACT_LIST_ID) => {
  return await fetch(`${MAILJET_API_URL}/listrecipient`, {
    method: 'POST',
    headers: {
      'Authorization': prepareBasicAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ContactID: contactId,
      ListID: listId,
      IsUnsubscribed: 'false',
    }),
  });
};

const handler: Handler = async ({ body, httpMethod }) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-requested-with',
  };

  // handle options requests
  if (httpMethod === 'OPTIONS') return { headers, statusCode: 200 };

  try {
    const payload = JSON.parse(body) as NewsletterSubscription;

    // handle possible bot submission
    if (payload.honey) {
      console.warn(`Received spam submission: ${payload.email}`);
      return { headers, statusCode: 200, body: 'OK' };
    }

    console.log(`Received submission: ${payload.email}`);
    try {
      // first, add contact to Mailjet
      const { ID } = await addContact(payload.email, payload.first_name, payload.last_name);
      // then, subscribe to newsletter list
      await subscribeToNewsletter(ID);
      // finally, return success and log
      console.log(`Submitted to Mailjet: ID ${ID}`);
      return { headers, statusCode: 200, body: 'OK' };
    } catch (error) {
      console.warn(`Submission to Mailjet failed: ${error}`);
      return { headers, statusCode: 422, body: `${error}` };
    }
  } catch (error) {
    console.warn(`Malformed data received: ${error}`);
    return { headers, statusCode: 400, body: `${error}` };
  }
};

export { handler };
