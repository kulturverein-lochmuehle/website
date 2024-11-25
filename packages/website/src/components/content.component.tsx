import type { CollectionEntry } from 'astro:content';
import * as React from 'react';
import { Chronicle } from './chronicle.component.jsx';

export type ContentProps = NonNullable<
  CollectionEntry<'pages'>['data']['sections']
>[number]['contents'][number];

export const Content: React.FC<ContentProps> = props => {
  switch (props.type) {
    case 'typo':
      const Headline = `h${props.heading.level}` as any;
      return (
        <kvlm-typo>
          <Headline className={props.heading.style}>{props.heading.text}</Headline>
          {props.text && <p className={props.text.style ?? ''}>{props.text.text}</p>}
        </kvlm-typo>
      );

    case 'teaser':
      return <Chronicle {...props} />;

    default:
      return null;
  }
};
