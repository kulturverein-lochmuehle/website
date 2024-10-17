import type { CollectionEntry } from 'astro:content';
import * as React from 'react';
import { Block } from './block.component.jsx';

export type PageProps = {
  slug: string;
  data: CollectionEntry<'pages'>['data'];
};

export const Page: React.FC<PageProps> = ({ data: { blocks } }) => {
  return (
    <>
      {blocks.map((data, index) => (
        <Block key={index} {...data} />
      ))}
    </>
  );
};
