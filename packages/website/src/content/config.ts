import { defineCollection, z } from 'astro:content';

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().min(1),
    blocks: z.array(
      z.object({
        type: z.enum(['section']),
        theme: z.enum(['light', 'dark']),
        typo: z.array(
          z.object({
            type: z.enum(['heading', 'text'])
          })
        )
      })
    )
  })
});

export const collections = { pages };
