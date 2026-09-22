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

type Section = { page: string; id: string; title: string; scopes: string[] };

// the sections come from the markdoc bodies, parsing them once is plenty -
// a build asks for them per entry and per teaser item
let sections: Promise<Section[]> | undefined;

const getSectionIndex = (): Promise<Section[]> =>
  (sections ??= getCollection('pages').then(pages =>
    pages.flatMap(page => getSections(page).map(section => ({ ...section, page: page.id }))),
  ));

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
  const sections = await getSectionIndex();

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

/** The single place the entries live, whether they are ahead or behind. */
export const CHRONICLE_BASE = 'veranstaltung';

/** The entry's own page. */
export const getChroniclePath = (entry: CollectionEntry<'chronicle'>): string =>
  `${CHRONICLE_BASE}/${entry.id}`;
