import { z } from 'astro:content';

export const schema = z.object({
  title: z.string().describe('Titel'),
  blocks: z
    .array(
      z.discriminatedUnion('type', [
        z
          .object({
            title: z.string().describe('Titel'),
            slug: z.string().describe('Slug'),
            theme: z.enum(['dark', 'light']).describe('Farbschema'),
            contents: z
              .array(
                z.discriminatedUnion('type', [
                  z
                    .object({
                      typo: z
                        .array(
                          z.discriminatedUnion('type', [
                            z
                              .object({
                                text: z.string().describe('Text'),
                                level: z
                                  .number()
                                  .finite()
                                  .int()
                                  .min(1)
                                  .max(6)
                                  .default(1)
                                  .describe('Ebene'),
                                style: z
                                  .enum(['none', 'title'])
                                  .default('none')
                                  .describe('Variante'),
                              })
                              .extend({ type: z.literal('heading') }),
                            z
                              .object({
                                text: z.string().describe('Text'),
                                style: z
                                  .enum(['lead', 'body'])
                                  .default('body')
                                  .describe('Variante'),
                              })
                              .extend({ type: z.literal('text') }),
                          ]),
                        )
                        .describe('Typografie'),
                    })
                    .extend({ type: z.literal('typo') }),
                ]),
              )
              .describe('Inhalte'),
          })
          .extend({ type: z.literal('section') }),
      ]),
    )
    .describe('Blöcke'),
});
