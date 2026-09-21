import { getCollection, getEntry } from 'astro:content';

import { withBase } from './base.utils.js';
import { getSections } from './section.utils.js';

export type NavigationItem = {
  active: boolean;
  inline: boolean;
  href: string;
  label: string;
};

/**
 * Both the navigation items and the scroll observer of the layout compare
 * their targets against `location.pathname`, so every href carries the base.
 */
export function prepareLink(
  path: string,
  current?: string,
): { href: string; active: boolean; inline: boolean } {
  path = path.replace(/^\//, '');
  current = current?.replace(/^\//, '');
  const href = withBase(path);
  const active = current === path;
  const isSectionLink = path.indexOf('/') !== -1;
  const isCurrentPage = current?.split('/')[0] === path.split('/')[0];
  const inline = isSectionLink && isCurrentPage;
  return { href, active, inline };
}

export async function prepareNavigation(current?: string): Promise<NavigationItem[]> {
  const navigation = await getEntry('navigation', 'navigation');
  if (!navigation) return [];

  const pages = await getCollection('pages');
  return navigation.data.reduce((items, item) => {
    const page = pages.find(({ id }) => id === item.page);
    if (page === undefined) return items;

    // do not link the page itself but each of its sections
    if (item.useSections) {
      return [
        ...items,
        ...getSections(page).map(section => ({
          ...prepareLink(`${page.id}/${section.id}`, current),
          label: section.title,
        })),
      ];
    }

    return [...items, { ...prepareLink(page.id, current), label: page.data.title }];
  }, [] as NavigationItem[]);
}

/** The first navigation entry doubles as the landing page. */
export async function getDefaultRoute(): Promise<string> {
  const navigation = await getEntry('navigation', 'navigation');
  const [first] = navigation?.data ?? [];
  if (first === undefined) return withBase('/');

  if (!first.useSections) return withBase(first.page);

  const page = await getEntry('pages', first.page);
  const [section] = page === undefined ? [] : getSections(page);
  if (section === undefined) return withBase(first.page);

  return withBase(`${first.page}/${section.id}`);
}
