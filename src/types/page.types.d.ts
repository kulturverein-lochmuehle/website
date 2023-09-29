import type { ComponentInterface } from '@stencil/core';
import type { Config } from '../utils/config.utils.js';

export type PageComponent = ComponentInterface & {
  config: Config;
};
