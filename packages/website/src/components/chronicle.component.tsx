import type { CollectionEntry } from 'astro:content';
import * as React from 'react';

export type ChronicleProps = CollectionEntry<'chronicle'>['data'];

export const Chronicle: React.FC<ChronicleProps> = ({ scope, title, type }) => {
  console.log({ scope, title, type });
  return (
    <kvlm-typo>
      <h2 className="title">{title}</h2>
    </kvlm-typo>
  );
};
