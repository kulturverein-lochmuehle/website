import type { Handler } from 'express';

export type Controller = Record<string, Handler>;
export const defineController = <T extends Controller>(controller: T): T => controller;
