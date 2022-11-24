import bcrypt from 'bcryptjs';
import createError, { type HttpError } from 'http-errors';

import { signAccessToken } from '../../utils/auth.utils';
import { defineController } from '../../utils/controller.utils';

import { prisma } from '../index';

export const userController = defineController({
  async getAll(_, response) {
    const users = await prisma.user.findMany();
    response.json(users);
  },

  async login({ body }, response, next) {
    try {
      if (!body?.email || !body?.password) {
        throw createError.BadRequest('Email address and password must be provided');
      }

      const user = await prisma.user.findUnique({ where: { email: body.email } });
      if (user === null) {
        throw createError.Unauthorized('Email address or password not valid');
      }

      if (!bcrypt.compareSync(body.password, user.password)) {
        throw createError.Unauthorized('Email address or password not valid');
      }

      const accessToken = await signAccessToken(user);
      const { password, ...userWithoutPassword } = user;

      response
        .cookie('access_token', accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 3600000
        })
        .status(200)
        .json({ accessToken, ...userWithoutPassword });
    } catch (error) {
      const { statusCode, message } = error as HttpError;
      next(createError(statusCode, message));
    }
  },

  async logout(_request, response) {
    response
      .clearCookie('access_token')
      .status(200)
      .json({ message: 'Logout successful' });
  }
});
