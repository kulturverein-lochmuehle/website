import type { CollectionEntry } from 'astro:content';
import * as React from 'react';
import { Block } from './block.component.jsx';

export type ChronicleProps = {
  slug: string;
  data: CollectionEntry<'chronicle'>['data'];
};

export const Chronicle: React.FC<ChronicleProps> = ({ data: {  }, slug }) => {
  return (
    <>{blocks?.map((data, index) => <Block key={`block-${index}`} page={slug} {...data} />)}</>
  );
};
