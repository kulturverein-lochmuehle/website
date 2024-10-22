import React from 'react';
import { isEntryListing, wrapEntryListing } from '../widgets/decap-entry-listing.widget.js';

export async function patchEntryListing<E>() {
  window.global = window;

  const originalCreateElement = React.createElement;

  React.createElement = function (
    type: React.ComponentType | string,
    props?: React.Attributes | null,
    ...children: React.ReactNode[]
  ) {
    if (!props) props = {} as {};
    if ('__noPatch' in props) {
      return originalCreateElement.call(React, type, props, ...children);
    }

    // this is our train!
    if (isEntryListing(props) && typeof type !== 'string') {
      return originalCreateElement.call(
        React,
        wrapEntryListing<E>(originalCreateElement, type as React.ComponentType<E>),
        { ...props, __noPatch: true } as any,
        ...children,
      );
    }

    return originalCreateElement.call(React, type, props, ...children);
  } as typeof React.createElement;

  return () => {
    React.createElement = originalCreateElement;
  };
}
