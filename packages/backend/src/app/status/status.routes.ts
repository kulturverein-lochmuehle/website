import express from 'express';
import { statusController } from './status.controller';

export const statusRoutes = express.Router();
statusRoutes.get('/health', statusController.getHealth);
