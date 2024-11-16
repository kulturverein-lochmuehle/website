import { getEntry, type CollectionEntry } from 'astro:content';
import * as React from 'react';

export type NavigationProps = {
  data: CollectionEntry<'navigation'>['data'];
  href?: string;
  slug?: string;
  slot?: string;
};

export type NavigationItemProps = {
  active: boolean;
  inline: boolean;
  href: string;
  label: string;
};

export function prepareLink(
  path: string,
  current?: string,
): {
  href: string;
  active: boolean;
  inline: boolean;
} {
  path = path.replace(/^\//, '');
  current = current?.replace(/^\//, '');
  const href = `/${path}`;
  const active = current === path;
  const isSectionLink = path.indexOf('/') !== -1;
  const isCurrentPage = current?.split('/')[0] === path.split('/')[0];
  const inline = isSectionLink && isCurrentPage;
  return { href, active, inline };
}

export async function prepareItems(
  items: CollectionEntry<'navigation'>['data']['pages'],
  current?: string,
): Promise<NavigationItemProps[]> {
  return items.reduce(
    async (all, item) => {
      if (!item) return all;

      // lazy load the page
      const page = await getEntry('pages', item.page);
      if (!page) return all;

      // do not use the page itself but its sections
      if (item.useSections) {
        if (!page.data.blocks) return all;
        return [
          ...(await all),
          ...page.data.blocks.reduce((subs, section) => {
            if (!section) return subs;
            return [
              ...subs,
              {
                ...prepareLink(`${page.slug}/${section.slug}`, current),
                label: section.title,
              },
            ];
          }, [] as NavigationItemProps[]),
        ];
      }

      // link to the page itself
      return [
        ...(await all),
        {
          ...prepareLink(page.slug, current),
          label: page.data.title,
        },
      ];
    },
    Promise.resolve([] as NavigationItemProps[]),
  );
}

export const Navigation: React.FC<NavigationProps> = ({ href, slug, slot, data: { pages } }) => {
  const [items, setItems] = React.useState<NavigationItemProps[]>([]);
  const [hrefInline, setHrefInline] = React.useState(false);
  React.useEffect(() => {
    prepareItems(pages, slug).then(setItems);
  }, [pages, slug]);
  React.useEffect(() => {
    if (href === undefined) return;
    setHrefInline(prepareLink(href, slug).inline);
  }, [href, slug]);

  return (
    <kvlm-navigation slot={slot} href={href} href-inline={hrefInline ? true : undefined}>
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
