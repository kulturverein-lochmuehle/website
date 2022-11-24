import { PrismaClient } from '@prisma/client';
import express, { json } from 'express';
import cookies from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';

import { routes } from './routes';

export const prisma = new PrismaClient();
export const app = express();

app.use(helmet());
app.use(cookies());
app.use(cors());
app.use(json());

app.use(routes);
