import { prepareSchema } from 'astro-decap-collection';
import { defineCollection } from 'astro:content';

import { schema as vereinSchema } from './config.verein.js';

export const collections = {
  verein: defineCollection(prepareSchema(vereinSchema)),
};
