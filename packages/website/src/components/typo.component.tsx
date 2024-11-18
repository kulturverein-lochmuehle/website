import type { CollectionEntry } from 'astro:content';
import * as React from 'react';

export type TypoProps = NonNullable<
  NonNullable<CollectionEntry<'pages'>['data']['blocks']>[number]['typo']
>[number];

export const Typo: React.FC<TypoProps> = ({ type, text, style, ...props }) => {
  switch (type) {
    case 'heading':
      const Headline = `h${'level' in props && props.level}` as any;
      return <Headline className={style}>{text}</Headline>;

    case 'text':
      return <div className={style}>{text}</div>;

    default:
      return null;
  }
};
