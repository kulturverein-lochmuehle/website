import { env } from 'node:process';

export type MailjetDataResponse<P> = {
  Count: number;
  Data: P[];
  Total: number;
};

export type MailjetError = {
  ErrorInfo: string;
  ErrorMessage: string;
  StatusCode: number;
};

export type MailjetContactData = {
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

const { MAILJET_API_KEY_PUBLIC, MAILJET_API_KEY_PRIVATE } = env;
export const prepareBasicAuth = (key = MAILJET_API_KEY_PUBLIC, secret = MAILJET_API_KEY_PRIVATE) => {
  const encoded = Buffer.from(`${key}:${secret}`).toString('base64');
  return `Basic ${encoded}`;
};

export const isError = (data: any): data is MailjetError => {
  return data.ErrorInfo !== undefined;
};
