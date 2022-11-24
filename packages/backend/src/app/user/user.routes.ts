import express from 'express';
import { checkAuth } from '../../utils/auth.utils';
import { userController } from './user.controller';

export const userRoutes = express.Router();
userRoutes.post('/login', userController.login);
userRoutes.use(checkAuth).get('/logout', userController.logout);
userRoutes.use(checkAuth).get('/all', userController.getAll);
