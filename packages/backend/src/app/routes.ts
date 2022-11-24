import express from 'express';
import { userRoutes } from './user/user.routes';
import { statusRoutes } from './status/status.routes';

export const routes = express.Router();
routes.use('/user', userRoutes);
routes.use('/status', statusRoutes);
