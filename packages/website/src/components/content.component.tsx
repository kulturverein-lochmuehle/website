import * as React from 'react';
import type { ResolvedPage } from '@/utils/page.utils.js';
import { Teaser } from '@/components/teaser.component.jsx';

export type ContentProps = ResolvedPage['data']['sections'][number]['contents'][number] & {};

export const Content: React.FC<ContentProps> = props => {
  switch (props.type) {
    case 'typo':
      const Headline = `h${props.heading.level}` as any;
      return (
        <kvlm-typo>
          <Headline
            className={[
              props.heading.isTitle && 'title',
              props.heading.isSticky && 'sticky',
              props.heading.isRightAligned && 'right-aligned',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {props.heading.text}
          </Headline>
          {props.text && <p className={props.text.style ?? ''}>{props.text.text}</p>}
        </kvlm-typo>
      );

    case 'teaser':
      return <Teaser {...props} />;

    default:
      return null;
  }
};
