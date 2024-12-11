import * as React from 'react';
import type { ResolvedPage } from '@/utils/page.utils.js';
import { Content } from '@/components/content.component.jsx';

export type SectionProps = ResolvedPage['data']['sections'][number];

export const Section: React.FC<SectionProps> = props => {
  switch (props.type) {
    case 'section':
      const { theme, page, id, contents } = props;
      return (
        <kvlm-section
          id={`/${page}/${id}`}
          style={
            {
              '--kvlm-section-background-from': theme === 'light' ? '#75f0de' : '#525252',
              '--kvlm-section-background-to': theme === 'light' ? '#6fbad9' : '#101010',
              '--kvlm-section-color': `var(--kvlm-color-grey-${theme === 'light' ? 'dark' : 'light'})`,
              '--kvlm-brook-color': theme === 'light' ? '#fff' : '#52bcdd',
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
