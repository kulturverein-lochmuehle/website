import type { Handler } from '@netlify/functions';
import serverless from 'serverless-http';

import { app } from './app';

const handler = serverless(app) as unknown as Handler;

export { handler };
