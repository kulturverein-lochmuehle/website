import type { CollectionEntry } from 'astro:content';
import * as React from 'react';
import { Section } from './section.component.jsx';

export type PageProps = {
  slug: string;
  data: CollectionEntry<'pages'>['data'];
};

export const Page: React.FC<PageProps> = ({ data: { sections }, slug }) => {
  return (
    <>{sections?.map((data, index) => <Section key={`block-${index}`} page={slug} {...data} />)}</>
  );
};
