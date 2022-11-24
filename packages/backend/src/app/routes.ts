import express from 'express';
import createError from 'http-errors';

import { userRoutes } from './user/user.routes';
import { statusRoutes } from './status/status.routes';

export const routes = express.Router();
routes.use('/user', userRoutes);
routes.use('/status', statusRoutes);

routes.use(async (_request, _response, next) => {
  next(createError.NotFound('Route not Found'));
});
// routes.use((err, req, res, next) => {
//   res.status(err.status || 500).json({
//     status: false,
//     message: err.message
//   });
// });
