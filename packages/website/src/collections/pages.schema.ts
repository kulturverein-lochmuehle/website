import { z } from 'astro:content';

export const schema = z.object({
  title: z.string().describe('Titel'),
  sections: z
    .array(
      z.discriminatedUnion('type', [
        z
          .object({
            title: z.string().describe('Titel'),
            id: z.string().describe('URL-Slug'),
            theme: z.enum(['dark', 'light']).describe('Farbschema'),
            contents: z
              .array(
                z.discriminatedUnion('type', [
                  z
                    .object({
                      scope: z
                        .enum([
                          'chronicle:all',
                          'chronicle:past',
                          'chronicle:upcoming',
                          'chronicle:next',
                        ])
                        .describe('Umfang'),
                      title: z.string().describe('Titel'),
                    })
                    .extend({ type: z.literal('teaser') }),
                  z
                    .object({
                      heading: z
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
                          isTitle: z.boolean().default(false).describe('Als Titel'),
                          isRightAligned: z
                            .boolean()
                            .default(false)
                            .describe('Rechts ausgerichtet'),
                          isSticky: z.boolean().default(false).describe('Fixiert'),
                        })
                        .describe('Überschrift'),
                      text: z
                        .object({
                          text: z.string().nullish().describe('Text'),
                          style: z
                            .enum(['lead', 'body'])
                            .nullish()
                            .default('body')
                            .describe('Variante'),
                        })
                        .nullish()
                        .describe('Text'),
                    })
                    .extend({ type: z.literal('typo') }),
                ]),
              )
              .describe('Inhalte'),
          })
          .extend({ type: z.literal('section') }),
      ]),
    )
    .describe('Abschnitte'),
});
