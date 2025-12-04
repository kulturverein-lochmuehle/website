import { type CollectionEntry, getEntry } from 'astro:content';
import type { ResolveSingle } from './collection.utils.js';

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
  resolve: ResolveSingle<'pages'>,
  current?: string,
): Promise<NavigationItem[]> {
  return items.reduce(
    async (all, item) => {
      if (!item) return all;

      // lazy load the page
      const page = await resolve(item.page.id);
      if (!page) return all;

      // do not use the page itself but its sections
      if (item.useSections) {
        if (!page.data.sections) return all;
        return [
          ...(await all),
          ...page.data.sections.reduce((subs, section) => {
            if (!section) return subs;
            return [
              ...subs,
              {
                ...prepareLink(`${page.slug}/${section.id}`, current),
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

export async function prepareNavigation(
  resolve: ResolveSingle<'pages'>,
  current?: string,
): Promise<NavigationItem[]> {
  const navigation = await getEntry('navigation', 'main');
  if (!navigation) return [];
  return prepareItems(navigation.data.pages, resolve, current);
}

export async function getDefaultRoute(): Promise<string> {
  const { data } = await getEntry('navigation', 'main')!;
  const [{ page, useSections }] = data.pages;
  if (!useSections) return page.id;

  const sectioned = await getEntry('pages', page.id);
  if (sectioned === undefined) return page.id;

  const slug = sectioned.data.sections[0]?.id;
  if (slug === undefined) return page.id;

  return `/${page.id}/${slug}`;
}
