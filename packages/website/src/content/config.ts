import { prepareSchema } from 'astro-decap-collection';
import { defineCollection } from 'astro:content';

import { schema as blogSchema } from './config.blog.ts';
import { schema as pageSchema } from './config.pages.ts';

export const collections = {
  blog: defineCollection(prepareSchema(blogSchema)),
  pages: defineCollection(prepareSchema(pageSchema)),
};
