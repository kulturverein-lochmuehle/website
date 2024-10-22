import type { CmsCollection } from 'decap-cms-core';
import { List, Map, type Record } from 'immutable';
import React from 'react';

import { prepareItems, prepareLists } from '../utils/decap-sortable.utils.js';

export type Entry<E> = {
  author: string;
  collection: string;
  data: Partial<E>;
  i18n: object;
  isFetching: boolean | null;
  isModification: boolean | null;
  label: string | null;
  mediaFiles: string[];
  meta: { path: string };
  partial: boolean;
  path: string;
  raw: string;
  slug: string;
};

export type EntryListingProps<E> = {
  collectionName: string;
  collections: Record<CmsCollection>;
  cursor: string;
  entries: List<Entry<E>>;
  page: number;
  viewStyle: 'VIEW_STYLE_LIST';
};

export function draftSortChange(store: any, entry: Entry<any>, sorting: number) {
  store.dispatch({
    type: 'DRAFT_CHANGE_FIELD',
    payload: {
      field: Map({
        name: 'sorting',
        label: 'Sorting',
        widget: 'number',
      }),
      value: sorting,
      entries: List([Map(entry)]),
    },
  });
}

export function sortCollection(
  store: any,
  collection: string,
  key = 'sorting',
  direction = 'Ascending',
) {
  store.dispatch({
    type: 'SORT_ENTRIES_REQUEST',
    payload: { collection, key, direction },
  });
}

export function isEntryListing(props: React.Attributes): boolean {
  return (
    props !== null &&
    'collections' in props &&
    'cursor' in props &&
    'entries' in props &&
    'page' in props &&
    'viewStyle' in props &&
    props.viewStyle === 'VIEW_STYLE_LIST'
  );
}

export function wrapEntryListing<E>(
  create: typeof React.createElement,
  entryListing: React.ComponentType<E>,
): React.ComponentType<any> {
  return function EntryListingWrapper(props: EntryListingProps<E>, ...children: React.ReactNode[]) {
    // inject the store
    const [store, setStore] = React.useState<any | null>(null);
    React.useEffect(() => {
      if (store !== null) return;
      // @ts-expect-error -- module not typed
      import('decap-cms-core/dist/esm/redux/index.js').then(({ store }) => setStore(store));
    }, [setStore, store]);

    // patch drag and drop directly to the dom
    React.useLayoutEffect(() => {
      if (store === null) return;

      // test
      const items = props.entries.toJSON();
      items.splice(1, 0, items.splice(0, 1)[0]);
      items.forEach((entry, index) => draftSortChange(store, entry, index));
      // sortCollection(store, props.collections.toJSON().name);

      prepareItems();
      prepareLists((from, to) => {
        // const items = props.entries.toJSON();
        // items.splice(to, 0, items.splice(from, 1)[0]);
        // items.forEach((entry, index) => draftSortChange(store, entry, index));
      });
    }, [store]);

    // the original component
    if (store !== null)
      return create.call(
        React,
        entryListing as React.ComponentType,
        props as React.Attributes,
        ...children,
      );
    return null;
  } as any;
}
