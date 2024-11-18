import * as React from 'react';
import { prepareLink, type NavigationItem } from '@/utils/navigation.utils.js';

export type NavigationProps = {
  items: NavigationItem[];
  current?: string;
  href?: string;
  slot?: string;
};

export const Navigation: React.FC<NavigationProps> = ({ href = '/', current, items, slot }) => {
  const { inline } = prepareLink(href, current);

  return (
    <kvlm-navigation
      scroll-fade-distance="100"
      slot={slot}
      href={href}
      href-inline={inline ? true : undefined}
    >
      {items.map(({ active, inline, ...item }, index) => (
        <kvlm-navigation-item
          {...(item as any)}
          key={index}
          active={active ? true : undefined}
          inline={inline ? true : undefined}
        />
      ))}
    </kvlm-navigation>
  );
};
