import * as React from 'react';
import type { ResolvedPage } from '@/utils/page.utils.js';

export type ChronicleProps = Extract<
  ResolvedPage['data']['sections'][number]['contents'][number],
  { type: 'teaser' }
>;

export const Chronicle: React.FC<ChronicleProps> = ({ items, title }) => (
  <>
    <kvlm-typo>
      <h2 className="title right-aligned sticky">{title}</h2>
    </kvlm-typo>
    <kvlm-timeline>
      {items.map(({ data, teaser }, index) => (
        <kvlm-timeline-item
          key={index}
          date={data.date}
          title={data.title}
          leading={index === 0 ? true : undefined}
          trailing={index === items.length - 1 ? true : undefined}
          dangerouslySetInnerHTML={{ __html: teaser }}
        ></kvlm-timeline-item>
      ))}
    </kvlm-timeline>
  </>
);
