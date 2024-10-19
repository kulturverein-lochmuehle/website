import { z } from 'astro:content';

export const schema = z.object({
  title: z.string().describe('Title'),
  sorting: z.number().finite().int().describe('Sorting'),
  blocks: z
    .array(
      z.discriminatedUnion('type', [
        z
          .object({
            id: z.string().describe('ID'),
            theme: z.enum(['dark', 'light']).describe('Theme'),
            typo: z
              .array(
                z.discriminatedUnion('type', [
                  z
                    .object({
                      text: z.string().describe('Text'),
                      level: z.number().finite().int().min(1).max(6).default(1).describe('Level'),
                      style: z.enum(['', 'title']).default('').describe('Style'),
                    })
                    .extend({ type: z.literal('heading') }),
                  z
                    .object({
                      text: z.string().describe('Text'),
                      style: z.enum(['lead', 'body']).default('body').describe('Style'),
                    })
                    .extend({ type: z.literal('text') }),
                ]),
              )
              .describe('Typography'),
          })
          .extend({ type: z.literal('section') }),
      ]),
    )
    .describe('Blocks'),
});
