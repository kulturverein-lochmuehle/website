import type { CollectionEntry } from 'astro:content';
import * as React from 'react';
import { Typo } from './typo.component.jsx';

export type ContentProps = NonNullable<
  CollectionEntry<'pages'>['data']['blocks']
>[number]['contents'][number];

export const Content: React.FC<ContentProps> = ({ type, typo }) => {
  switch (type) {
    case 'typo':
      return (
        <kvlm-typo>
          {typo?.map((data, index) => (
            <Typo key={`typo-${index}`} {...data} />
          ))}
        </kvlm-typo>
      );

    default:
      return null;
  }
};
