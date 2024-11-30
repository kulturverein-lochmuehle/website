import * as React from 'react';
import type { ResolvedPage } from '@/utils/page.utils.js';
import { Section } from './section.component.jsx';

export const Page: React.FC<ResolvedPage> = ({ data: { sections } }) => {
  return (
    <>{sections?.map((data, index) => <Section key={`block-${index}`} {...data} />)}</>
  );
};
