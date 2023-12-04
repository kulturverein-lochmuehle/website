import type { ContentCollectionKey } from 'astro:content';

export type CollectionParams = {
  collection?: ContentCollectionKey;
  slug?: string;
  page?: string;
  section?: string;
  hasSections: boolean;
};

/**
 * Retrieve all relevant collection data from the eventually given path.
 * @param path
 */
export function getCollectionParams(path?: string): CollectionParams {
  const [collection, page, section] = path?.split('/') ?? [];
  const slug = [page, section].filter(Boolean).join('/');
  const hasSections = section !== undefined;
  return { collection, slug, page, section, hasSections } as CollectionParams;
}
