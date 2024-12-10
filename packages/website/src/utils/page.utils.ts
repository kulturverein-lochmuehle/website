import { markdown } from '@astropub/md';
import type { CollectionEntry } from 'astro:content';
import type { ResolveMultiple, ResolveSingle } from './collection.utils.js';

// infer that darn type as convenient util for nested components,
// as we drill that props in the good ol' React way down the tree
export type ResolvedPage = NonNullable<Awaited<ReturnType<typeof preparePage>>>;

// like for the navigation, we need a mapping mechanism that resolves contents
// with a given function - thus, the data resolution can be replaced, as long
// as it returns the same shape (in our case Astro's collection definition)
export async function preparePage(
  id: string,
  resolvePage: ResolveSingle<'pages'>,
  resolveChronicle: ResolveMultiple<'chronicle'>,
) {
  const page = await resolvePage(id);
  if (page === undefined) return;

  // resolve references
  return {
    ...page,
    data: {
      ...page.data,
      sections: await Promise.all(
        page.data.sections.map(async section => {
          return {
            ...section,
            page: page.id,
            contents: await Promise.all(
              section.contents.map(async content => {
                switch (content.type) {
                  case 'teaser': {
                    return await prepareTeaser(content, resolveChronicle);
                  }
                  default:
                    return content;
                }
              }),
            ),
          };
        }),
      ),
    },
  };
}

// enriches the teaser data with the resolved items from configured relation
export async function prepareTeaser(
  teaser: Extract<
    CollectionEntry<'pages'>['data']['sections'][number]['contents'][number],
    { type: 'teaser' }
  >,
  resolve: ResolveMultiple<'chronicle'>,
) {
  let entries: CollectionEntry<'chronicle'>[] = [];
  switch (teaser.scope) {
    case 'chronicle:all':
      const all = await resolve();
      entries = all.reverse();
      break;

    case 'chronicle:past':
      const past = await resolve(({ data }) => data.date < Date.now());
      entries = past.reverse();
      break;

    case 'chronicle:upcoming':
      entries = await resolve(({ data }) => data.date > Date.now());
      break;

    case 'chronicle:next':
      const [next] = await resolve(({ data }) => data.date > Date.now());
      entries = [next];
      break;

    default:
      break;
  }

  const items = await Promise.all(
    entries.map(async entry => ({
      ...entry,
      teaser: await markdown(entry.data.teaser),
    })),
  );

  return { ...teaser, items };
}
