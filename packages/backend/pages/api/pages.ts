import { initPages } from '@alinea/content/pages';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  const pages = initPages();
  const allPages = await pages
    .whereType('Page')
    .select(({ id, title, description }) => ({ id, title, description }));
  response.status(200).json(allPages);
}
