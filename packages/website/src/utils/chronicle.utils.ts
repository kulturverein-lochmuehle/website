import { getCollection, type CollectionEntry } from 'astro:content';

import { getSections } from './section.utils.js';

/**
 * Scopes that would list an entry, the most specific one first - an upcoming
 * entry shows up in an agenda, a past one under the past teasers, and
 * `chronicle:all` catches both wherever nothing else does.
 */
const scopesOf = (upcoming: boolean): string[] =>
  upcoming
    ? ['agenda:upcoming', 'agenda:next', 'chronicle:upcoming', 'chronicle:next', 'chronicle:all']
    : ['chronicle:past', 'chronicle:all'];

export type ChronicleOrigin = {
  /** page and section the entry is listed in, e.g. `startseite/bisher` */
  path: string;
  title: string;
};

/**
 * An entry has no place of its own in the navigation, it is listed by a teaser
 * somewhere. That section is where a visitor came from and where the back link
 * leads, and its navigation item stays marked while the entry is read.
 */
export async function getChronicleOrigin(
  entry: CollectionEntry<'chronicle'>,
): Promise<ChronicleOrigin | undefined> {
  const pages = await getCollection('pages');
  const sections = pages.flatMap(page =>
    getSections(page).map(section => ({ ...section, page: page.id })),
  );

  return scopesOf(+entry.data.date >= Date.now()).reduce<ChronicleOrigin | undefined>(
    (found, scope) => {
      if (found !== undefined) return found;
      const section = sections.find(({ scopes }) => scopes.includes(scope));
      return section === undefined
        ? undefined
        : { path: `${section.page}/${section.id}`, title: section.title };
    },
    undefined,
  );
}

/** The entry's page, nested below the section listing it. */
export async function getChroniclePath(
  entry: CollectionEntry<'chronicle'>,
): Promise<string | undefined> {
  const origin = await getChronicleOrigin(entry);
  return origin === undefined ? undefined : `${origin.path}/${entry.id}`;
}
