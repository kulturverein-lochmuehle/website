import { defineCollection } from 'astro:content';

import { schema as navigation } from '@/collections/navigation.schema.js';
import { schema as pages } from '@/collections/pages.schema.js';

export const collections = {
  navigation: defineCollection({ type: 'data', schema: navigation }),
  pages: defineCollection({ type: 'content', schema: pages }),
};
