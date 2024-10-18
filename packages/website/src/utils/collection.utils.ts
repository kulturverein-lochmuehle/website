import type { ContentCollectionKey } from 'astro:content';

export type CollectionParams = {
  collection: ContentCollectionKey;
  slug?: string;
  page?: string;
  section?: string;
};

/**
 * Retrieve all relevant collection data from the eventually given path.
 * @param path
 */
export function getCollectionParams(path?: string): CollectionParams {
  const collection = 'pages';
  const [page, section] = path?.split('/') ?? [];
  let slug: string | undefined = [page, section].filter(Boolean).join('/');
  slug = slug.trim() === '' ? undefined : slug;
  return { collection, slug, page, section };
}
