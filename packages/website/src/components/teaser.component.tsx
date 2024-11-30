import * as React from 'react';
import type { ResolvedPage } from '@/utils/page.utils.js';
import { Chronicle } from './chronicle.component.jsx';

// expand type as union if other teaser types are added in the future,
// as for now we only have chronicle teasers
export type TeaserProps = Extract<
  ResolvedPage['data']['sections'][number]['contents'][number],
  { type: 'teaser' }
>;

export const Teaser: React.FC<TeaserProps> = props => {
  switch (props.scope) {
    case 'chronicle:all':
    case 'chronicle:next':
    case 'chronicle:past':
    case 'chronicle:upcoming':
      return <Chronicle {...props} items={props.items} />;
  }
};
