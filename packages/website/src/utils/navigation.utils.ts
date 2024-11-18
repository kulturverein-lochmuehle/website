import { type CollectionEntry, getEntry } from 'astro:content';

export type NavigationItem = {
  active: boolean;
  inline: boolean;
  href: string;
  label: string;
};

export function prepareLink(
  path: string,
  current?: string,
): {
  href: string;
  active: boolean;
  inline: boolean;
} {
  path = path.replace(/^\//, '');
  current = current?.replace(/^\//, '');
  const href = `/${path}`;
  const active = current === path;
  const isSectionLink = path.indexOf('/') !== -1;
  const isCurrentPage = current?.split('/')[0] === path.split('/')[0];
  const inline = isSectionLink && isCurrentPage;
  return { href, active, inline };
}

export async function prepareItems(
  items: CollectionEntry<'navigation'>['data']['pages'],
  current?: string,
): Promise<NavigationItem[]> {
  console.log({ items });
  return items.reduce(
    async (all, item) => {
      if (!item) return all;

      // lazy load the page
      const page = await getEntry('pages', item.page);
      if (!page) return all;

      // do not use the page itself but its sections
      if (item.useSections) {
        if (!page.data.blocks) return all;
        return [
          ...(await all),
          ...page.data.blocks.reduce((subs, section) => {
            if (!section) return subs;
            return [
              ...subs,
              {
                ...prepareLink(`${page.slug}/${section.slug}`, current),
                label: section.title,
              },
            ];
          }, [] as NavigationItem[]),
        ];
      }

      // link to the page itself
      return [
        ...(await all),
        {
          ...prepareLink(page.slug, current),
          label: page.data.title,
        },
      ];
    },
    Promise.resolve([] as NavigationItem[]),
  );
}

export async function prepareNavigation(current?: string): Promise<NavigationItem[]> {
  const navigation = await getEntry('navigation', 'main');
  if (!navigation) return [];
  return prepareItems(navigation.data.pages, current);
}

export async function getDefaultRoute(): Promise<string> {
  const { data } = await getEntry('navigation', 'main');
  const [{ page, useSections }] = data.pages;
  if (!useSections) return page;

  const sectioned = await getEntry('pages', page);
  if (sectioned === undefined) return page;

  const slug = sectioned.data.blocks[0]?.slug;
  if (slug === undefined) return page;

  return `/${page}/${slug}`;
}
