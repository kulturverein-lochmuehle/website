import { defineCollection, z } from 'astro:content';
import { text } from 'stream/consumers';

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().min(1),
    blocks: z.array(
      z.object({
        id: z.string().min(1),
        type: z.enum(['section']),
        theme: z.enum(['light', 'dark']),
        typo: z.array(
          z.discriminatedUnion('type', [
            z.object({
              type: z.literal('heading'),
              text: z.string().min(1),
              level: z.number().min(1).max(6),
              style: z.enum(['', 'title'])
            }),
            z.object({
              type: z.literal('text'),
              text: z.string().min(1),
              style: z.enum(['lead', 'body'])
            })
          ])
        )
      })
    )
  })
});

export const collections = { pages };
