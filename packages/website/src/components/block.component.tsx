import type { CollectionEntry } from 'astro:content';
import * as React from 'react';
import { Content } from './content.component.jsx';

export type BlockProps = NonNullable<CollectionEntry<'pages'>['data']['blocks']>[number] & {
  page: string;
};

export const Block: React.FC<BlockProps> = ({ theme, type, page, slug, contents }) => {
  switch (type) {
    case 'section':
      return (
        <kvlm-section
          id={`/${page}/${slug}`}
          style={
            {
              '--kvlm-section-background-from': theme === 'light' ? '#75f0de' : '#525252',
              '--kvlm-section-background-to': theme === 'light' ? '#6fbad9' : '#101010',
              '--kvlm-section-color': `var(--kvlm-color-grey-${theme === 'light' ? 'dark' : 'light'})`,
            } as any
          }
        >
          {contents?.map((data, index) => <Content key={`content-${index}`} {...data} />)}
        </kvlm-section>
      );

    default:
      return null;
  }
};
