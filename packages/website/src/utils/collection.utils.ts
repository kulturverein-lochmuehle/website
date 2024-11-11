export type CollectionParams = {
  page?: string;
  slug?: string;
  isAdmin: boolean;
  section?: string;
  parts: ReadonlyArray<string | undefined>;
};

/**
 * Retrieve all relevant collection data from the eventually given path.
 *           ┌───────────────┬╴╴╴╴╴╴┬ slug, section and all trailing → parts
 * /<page(<slug>:admin)>/<section>/...
 *     │     │     │         └ optional inline section on page
 *     │     │     └ optional :admin flag, as requested by cms preview
 *     │     └ slug of the page, without any flags - used as result in parts
 *     └ page part, consists of slug and none to multiple optional flags
 */
export function getCollectionParams(path = ''): CollectionParams {
  // split paths into chunks
  const [page, section, ...rest] = path
    .split('/')
    .map(part => (part.trim() !== '' ? part : undefined));

  // page chunk may contain an admin flag
  const [slug, ...flags] = page?.split(':') ?? [];
  const isAdmin = flags.includes('admin');

  // collect all parts
  const parts = [slug, section, ...rest].filter(Boolean);
  const result = { isAdmin, page, parts, section, slug };

  // deliver the result
  return result;
}
