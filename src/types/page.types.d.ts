import { ComponentInterface } from '@stencil/core';
import { Config } from '../utils/config.utils';

export type PageComponent = ComponentInterface & {
  config: Config;
};
