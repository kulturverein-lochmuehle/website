import { Markdoc } from '@astrojs/markdoc/config';
import type { CollectionEntry } from 'astro:content';

export type PageSection = {
  id: string;
  title: string;
  /** scopes of the teasers the section shows, e.g. `chronicle:past` */
  scopes: string[];
};

/**
 * Sections are part of the page body, not of its frontmatter, so both the
 * navigation and the static paths have to read them from the Markdoc AST.
 */
export function getSections(entry: CollectionEntry<'pages'>): PageSection[] {
  const ast = Markdoc.parse(entry.body ?? '');
  return [...ast.walk()].reduce((sections, node) => {
    if (node.type !== 'tag' || node.tag !== 'section') return sections;
    const { id, title } = node.attributes as Partial<PageSection>;
    if (id === undefined || title === undefined) return sections;

    // the teasers are nested in the section, their scope tells what it lists
    const scopes = [...node.walk()].reduce((scopes, child) => {
      if (child.type !== 'tag' || child.tag !== 'teaser') return scopes;
      const { scope } = child.attributes as { scope?: string };
      return scope === undefined ? scopes : [...scopes, scope];
    }, [] as string[]);

    return [...sections, { id, title, scopes }];
  }, [] as PageSection[]);
}
