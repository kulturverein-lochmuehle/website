import { z } from 'astro:content';

export const schema = z.object({
  layout: z.string().or(z.number()).or(z.boolean()).default('blog').describe('Layout'),
  title: z.string().describe('Title'),
  published: z.boolean().nullish().describe('Published'),
  color: z.string().describe('Color'),
  place: z.string().describe('Place'),
  date: z.string().datetime({ precision: 0 }).describe('Publish Date'),
  thumbnail: z.string().describe('Featured Image(s)'),
  rating: z.number().finite().int().max(5).describe('Rating (scale of 1-5)'),
  code: z.string().describe('Code'),
  body: z.string().describe('Body'),
});
