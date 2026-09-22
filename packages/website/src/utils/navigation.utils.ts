import { getCollection, getEntry } from 'astro:content';

import { withBase } from './base.utils.js';
import { getSections } from './section.utils.js';

export type NavigationItem = {
  active: boolean;
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
  marked?: string,
): { href: string; active: boolean } {
  path = path.replace(/^\//, '');
  current = current?.replace(/^\//, '');
  marked = marked?.replace(/^\//, '');
  const href = withBase(path);
  // a page elsewhere may mark an item without being one of its sections
  const active = current === path || marked === path;
  return { href, active };
}

export type NavigationGroup = 'main' | 'footer';

export async function prepareNavigation(
  group: NavigationGroup,
  current?: string,
  marked?: string,
): Promise<NavigationItem[]> {
  const navigation = await getEntry('navigation', group);
  if (!navigation) return [];

  const pages = await getCollection('pages');
  return navigation.data.reduce((items, item) => {
    // an entry pointing elsewhere is a plain link, nothing of this site
    // is ever active by it
    if ('href' in item) {
      return [...items, { active: false, href: item.href, label: item.label }];
    }

    const page = pages.find(({ id }) => id === item.page);
    if (page === undefined) return items;

    // do not link the page itself but each of its sections
    if (item.useSections) {
      return [
        ...items,
        ...getSections(page).map(section => ({
          ...prepareLink(`${page.id}/${section.id}`, current, marked),
          label: section.title,
        })),
      ];
    }

    return [...items, { ...prepareLink(page.id, current, marked), label: page.data.title }];
  }, [] as NavigationItem[]);
}

/** The first entry of the main navigation doubles as the landing page. */
export async function getDefaultRoute(): Promise<string> {
  const navigation = await getEntry('navigation', 'main');
  const [first] = navigation?.data ?? [];
  // a link elsewhere is no page of this site, so it is no landing page either
  if (first === undefined || !('page' in first)) return withBase('/');

  if (!first.useSections) return withBase(first.page);

  const page = await getEntry('pages', first.page);
  const [section] = page === undefined ? [] : getSections(page);
  if (section === undefined) return withBase(first.page);

  return withBase(`${first.page}/${section.id}`);
}
