import { Markdoc } from '@astrojs/markdoc/config';
import type { CollectionEntry } from 'astro:content';

export type PageSection = {
  id: string;
  title: string;
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
    return [...sections, { id, title }];
  }, [] as PageSection[]);
}
