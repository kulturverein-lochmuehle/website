import express from 'express';
import { userController } from './user.controller';

export const userRoutes = express.Router();
userRoutes.get('/all', userController.getAll);
