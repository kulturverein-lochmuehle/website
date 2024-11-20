import { z } from 'astro:content';

export const schema = z.object({
  title: z.string().describe('Titel'),
  date: z.date().describe('Datum'),
});
