import * as React from 'react';
import type { ResolvedPage } from '@/utils/page.utils.js';

export type ChronicleProps = Extract<
  ResolvedPage['data']['sections'][number]['contents'][number],
  { type: 'teaser' }
>;

export const Chronicle: React.FC<ChronicleProps> = ({ items, title, scope }) => (
  <>
    <kvlm-typo>
      <h2 className="title right-aligned sticky">{title}</h2>
    </kvlm-typo>
    <kvlm-timeline direction={scope === 'chronicle:upcoming' ? 'forward' : 'backward'}>
      {items.map(({ data, teaser }, index) => (
        <kvlm-timeline-item
          key={index}
          date={data.date}
          label={data.title}
          leading={index === 0 ? true : undefined}
          trailing={index === items.length - 1 ? true : undefined}
          dangerouslySetInnerHTML={{ __html: teaser }}
        ></kvlm-timeline-item>
      ))}
    </kvlm-timeline>
  </>
);
