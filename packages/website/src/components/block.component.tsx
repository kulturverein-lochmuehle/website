import type { CollectionEntry } from 'astro:content';
import * as React from 'react';
import { Typo } from './typo.component.jsx';

export type BlockProps = NonNullable<CollectionEntry<'verein'>['data']['blocks']>[number];

export const Block: React.FC<BlockProps> = ({ theme, type, id, typo }) => {
  switch (type) {
    case 'section':
      return (
        <kvlm-section
          id={id}
          style={
            {
              '--kvlm-section-background-from': theme === 'light' ? '#75f0de' : '#525252',
              '--kvlm-section-background-to': theme === 'light' ? '#6fbad9' : '#101010',
              '--kvlm-section-color': `var(--kvlm-color-grey-${theme === 'light' ? 'dark' : 'light'})`,
            } as any
          }
        >
          {typo?.length && (
            <kvlm-typo>
              {typo.map((data, index) => (
                <Typo key={index} {...data} />
              ))}
            </kvlm-typo>
          )}
        </kvlm-section>
      );

    default:
      return null;
  }
};
