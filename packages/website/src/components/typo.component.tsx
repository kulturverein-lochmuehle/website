import type { CollectionEntry } from 'astro:content';
import * as React from 'react';

export type TypoProps = NonNullable<
  NonNullable<CollectionEntry<'verein'>['data']['blocks']>[number]['typo']
>[number];

export const Typo: React.FC<TypoProps> = ({ type, text, style, ...props }) => {
  switch (type) {
    case 'heading':
      return React.createElement(`h${'level' in props && props.level}`, { className: style }, text);

    case 'text':
      return React.createElement('p', { className: style }, text);

    default:
      return null;
  }
};
