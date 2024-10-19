import { z } from 'astro:content';

export const schema = z.object({
  sorting: z
    .lazy(() => {
      const literal = z.union([z.string(), z.number(), z.boolean(), z.null()]);
      type Literal = Zod.infer<typeof literal>;
      type Json = Literal | { [key: string]: Json } | Json[];
      const json: Zod.ZodType<Json> = z.lazy(() =>
        z.union([literal, z.array(json), z.record(json)]),
      );
      return json;
    })
    .describe('sorting'),
  uuid: z.never().describe('UUID'),
  layout: z
    .lazy(() => {
      const literal = z.union([z.string(), z.number(), z.boolean(), z.null()]);
      type Literal = Zod.infer<typeof literal>;
      type Json = Literal | { [key: string]: Json } | Json[];
      const json: Zod.ZodType<Json> = z.lazy(() =>
        z.union([literal, z.array(json), z.record(json)]),
      );
      return json;
    })
    .default('blog')
    .describe('Layout'),
  title: z.string().describe('Title'),
  published: z.boolean().nullish().describe('Published'),
  color: z.string().describe('Color'),
  place: z.string().describe('Place'),
  date: z.date().describe('Publish Date'),
  thumbnail: z.string().describe('Featured Image(s)'),
  rating: z.number().finite().int().max(5).describe('Rating (scale of 1-5)'),
  code: z.string().describe('Code'),
});
