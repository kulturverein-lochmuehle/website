import type { User } from '@prisma/client';
import { Handler, Request, response } from 'express';
import createError, { type HttpError } from 'http-errors';
import jwt from 'jsonwebtoken';

export type AuthorizedUser = Omit<User, 'password'> & { accessToken: string };

type RequestWithAuth = Request & {
  user: AuthorizedUser;
};

export const signAccessToken = async (payload: string | object | Buffer) => {
  return new Promise((resolve, reject) => {
    jwt.sign({ payload }, process.env.ACCESS_TOKEN_SECRET!, {}, (error, token) => {
      if (error) {
        reject(createError.InternalServerError());
      }
      resolve(token);
    });
  });
};

export const verifyAccessToken = async (token: string): Promise<AuthorizedUser> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!, (error, payload) => {
      if (error) {
        const message = error.name == 'JsonWebTokenError' ? 'Unauthorized' : error.message;
        return reject(createError.Unauthorized(message));
      }
      resolve(payload as AuthorizedUser);
    });
  });
};

export const checkAuth: Handler = async (request, response, next) => {
  let token: string | undefined;

  if (request.headers.authorization) {
    token = request.headers.authorization.split(' ')[1];
  } else if (request.cookies?.access_token) {
    token = request.cookies.access_token;
  }

  if (!token) {
    return next(createError.Unauthorized());
  }

  try {
    const user = await verifyAccessToken(token);
    (request as RequestWithAuth).user = user;
    next();
  } catch (error) {
    // @EVALUATE: explicitly remove cookie on logout only
    // response.clearCookie('access_token');
    const { message } = error as HttpError;
    next(createError.Unauthorized(message));
  }
};
