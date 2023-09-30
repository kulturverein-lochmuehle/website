/// <reference lib="dom" /> - required for `fetch` to work
import { env } from 'node:process';
import type { Handler } from '@netlify/functions';

import type { NewsletterSubscription } from '../types/form.types.js';
import { getCorsHeaders } from './utils/cors.utils.js';
import { prepareBasicAuth, type MailjetDataResponse, type MailjetError, isError, type MailjetContactData } from './utils/mailjet.utils.js';

type MailjetContactRequestPayload = {
  Email: string;
  Name?: string;
  IsExcludedFromCampaigns?: 'true' | 'false';
};

type MailjetSenderData = {
  EmailType: 'bulk' | 'transactional' | 'unknown';
  IsDefaultSender: boolean;
  Name: string;
  CreatedAt: string;
  DNSID: number;
  Email: string;
  Filename: string;
  ID: number;
  Status: 'Inactive' | 'Active' | 'Deleted';
};

const { MAILJET_API_URL, MAILJET_VERIFICATION_TEMPLATE_ID, MAILJET_VERIFICATION_TOKEN_VAR } = env;

const addContact = async (email: string, firstName?: string, lastName?: string): Promise<MailjetContactData> => {
  const body: MailjetContactRequestPayload = { Email: email };
  const name = [firstName, lastName].filter(Boolean).join(' ');
  if (name !== '') body.Name = name;

  const response = await fetch(`${MAILJET_API_URL}/REST/contact`, {
    method: 'POST',
    headers: {
      'Authorization': prepareBasicAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload: MailjetDataResponse<MailjetContactData> | MailjetError = await response.json();
  if (isError(payload)) return Promise.reject(payload);
  return payload.Data[0];
};

const readDefaultSender = async (): Promise<MailjetSenderData> => {
  const response = await fetch(`${MAILJET_API_URL}/REST/sender`, {
    method: 'GET',
    headers: {
      'Authorization': prepareBasicAuth(),
      'Content-Type': 'application/json',
    },
  });
  const { Data } = (await response.json()) as MailjetDataResponse<MailjetSenderData>;
  return Data.find(({ Status }) => Status === 'Active') ?? Data[0];
};

const sendVerificationEmail = async (
  email: string,
  fromEmail: string,
  fromName: string,
  templateId = MAILJET_VERIFICATION_TEMPLATE_ID,
  tokenVar = MAILJET_VERIFICATION_TOKEN_VAR,
) => {
  const payload = {
    'FromEmail': fromEmail,
    'FromName': fromName,
    'Recipients': [{ Email: email }],
    'Mj-TemplateID': templateId,
    'Mj-TemplateLanguage': 'true',
    'Vars': { [tokenVar]: Buffer.from(email).toString('base64') },
  };
  await fetch(`${MAILJET_API_URL}/send`, {
    method: 'POST',
    headers: {
      'Authorization': prepareBasicAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

const handler: Handler = async ({ body, httpMethod }) => {
  const headers = getCorsHeaders(httpMethod);

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
      await addContact(payload.email, payload.first_name, payload.last_name);

      // collect sender data
      const { Email: senderEmail, Name: senderName } = await readDefaultSender();

      // send verification email
      await sendVerificationEmail(payload.email, senderEmail, senderName);

      // finally, return success and log
      console.log(`Submitted to Mailjet: ID ${payload.email}`);
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
