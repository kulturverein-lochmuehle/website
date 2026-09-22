export enum RoutingEvent {
  LocationChanged = 'kvlm-location-changed',
  NavigationStart = 'kvlm-navigation-start',
  NavigationProgress = 'kvlm-navigation-progress',
  NavigationEnd = 'kvlm-navigation-end',
}

export interface NavigationProgressEventDetail {
  loaded: number;
  total: number;
}
export type NavigationProgressEvent = CustomEvent<NavigationProgressEventDetail>;

/**
 * A routed element may carry the document title its route deserves, so a
 * scroll to a section renames the document the way loading it would have.
 */
export const ROUTER_TITLE_ATTRIBUTE = 'data-router-title';

/**
 * Why the location changed, which is what tells a listener how to react:
 * `anchor` and `navigation` were asked for and scroll, `sync` is the scroll
 * itself writing the address bar and must never scroll back.
 */
export type LocationChangeReason = 'anchor' | 'navigation' | 'popstate' | 'sync';

export interface LocationChangedEventDetail {
  href: string;
  reason: LocationChangeReason;
}
export type LocationChangedEvent = CustomEvent<LocationChangedEventDetail>;

declare global {
  interface WindowEventMap {
    [RoutingEvent.LocationChanged]: LocationChangedEvent;
    [RoutingEvent.NavigationStart]: CustomEvent<void>;
    [RoutingEvent.NavigationProgress]: NavigationProgressEvent;
    [RoutingEvent.NavigationEnd]: CustomEvent<void>;
  }
}

/** The deployed pages are served with a trailing slash, the section ids are not. */
export const stripTrailingSlash = (path: string) => path.replace(/(.)\/$/, '$1');

const announce = (href: string, reason: LocationChangeReason) =>
  window.dispatchEvent(
    new CustomEvent<LocationChangedEventDetail>(RoutingEvent.LocationChanged, {
      detail: { href, reason },
    })
  );

/**
 * Writes the address bar without navigating - the scroll observation of the
 * layout reports the section it passes, and one history entry per section
 * scrolled past would make the back button useless.
 */
export const syncLocation = (href: string) => {
  if (stripTrailingSlash(window.location.pathname) === stripTrailingSlash(href)) {
    return;
  }
  window.history.replaceState(window.history.state, '', href);
  adoptTitle(href);
  announce(href, 'sync');
};

/** A section of the document currently shown, so a navigation is a scroll. */
const routedElement = (pathname: string) => {
  const wanted = stripTrailingSlash(pathname);
  return [...document.querySelectorAll<HTMLElement>('kvlm-layout > [id]')].find(
    element => stripTrailingSlash(element.id) === wanted
  );
};

/** Renames the document after the section scrolled to, if it says so. */
const adoptTitle = (pathname: string) => {
  const title = routedElement(pathname)?.getAttribute(ROUTER_TITLE_ATTRIBUTE);
  if (title) {
    document.title = title;
  }
};

/**
 * The children of the layout that are content, not the header or the footer.
 * The layout's own declarative shadow root is one of them in a fetched
 * document, and it is markup for a shadow root the live layout already has.
 */
const contentOf = (layout: Element) =>
  [...layout.children].filter(child => !child.slot && child.localName !== 'template');

/**
 * A fetched document is markup, not a rendered page: its declarative shadow
 * roots stay inert templates because `DOMParser` does not attach them, and its
 * elements carry the `defer-hydration` the server sets. Both have to go, or the
 * components would render beside a dead template, or not at all.
 */
const cleanse = (element: Element) => {
  element.querySelectorAll('template[shadowrootmode]').forEach(template => template.remove());
  element.removeAttribute('defer-hydration');
  element.querySelectorAll('[defer-hydration]').forEach(child => {
    child.removeAttribute('defer-hydration');
  });
  return element;
};

/** Anything we cannot or should not take over stays with the browser. */
const isRoutable = (anchor: HTMLAnchorElement, event: MouseEvent) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey &&
  !anchor.target &&
  !anchor.hasAttribute('download') &&
  anchor.origin === window.location.origin &&
  // a file is a download, not a page
  !/\.[a-z0-9]+$/i.test(anchor.pathname);

export interface RouterOptions {
  /** Called before the content is exchanged, to wrap the swap in a transition. */
  transition?: (swap: () => void) => void | Promise<void>;
  /**
   * Url of the map of route to byte size the build writes. With it a
   * navigation can say how far it has come, without it only that it is
   * happening.
   */
  sizes?: string;
}

/** After the page has settled, so the map never competes with the first paint. */
const whenIdle = (task: () => void) => {
  // not every browser has it, and none of them need to for this to work
  const idle = window.requestIdleCallback as typeof window.requestIdleCallback | undefined;
  if (idle) {
    idle(task, { timeout: 3000 });
    return;
  }
  window.setTimeout(task, 1000);
};

/**
 * Reads the response in chunks, reporting what has arrived. The total is what
 * the build measured: `Content-Length` counts the gzipped bytes a static host
 * sends, while the stream hands out the decoded ones.
 */
const readReporting = async (response: Response, total: number) => {
  const reader = response.body?.getReader();
  if (!reader) {
    return response.text();
  }

  const decoder = new TextDecoder();
  let html = '';
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    html += decoder.decode(value, { stream: true });
    loaded += value.length;
    window.dispatchEvent(
      new CustomEvent<NavigationProgressEventDetail>(RoutingEvent.NavigationProgress, {
        detail: { loaded, total },
      })
    );
  }

  return html + decoder.decode();
};

export function startRouter({ transition, sizes }: RouterOptions = {}): () => void {
  const layout = () => document.querySelector('kvlm-layout');

  // a slow response must not overwrite a newer one
  let pending = 0;

  // empty until the map arrives, and every navigation before that is simply
  // one that cannot say how far it has come
  let routeSizes: Record<string, number> = {};
  if (sizes) {
    whenIdle(() => {
      void fetch(sizes)
        .then(response => (response.ok ? response.json() : {}))
        .then((loaded: Record<string, number>) => (routeSizes = loaded))
        .catch(() => undefined);
    });
  }

  // the content scrolls, not the document, so the browser has nothing to restore
  const previousScrollRestoration = window.history.scrollRestoration;
  window.history.scrollRestoration = 'manual';

  async function swapDocument(url: URL, reason: LocationChangeReason) {
    const token = ++pending;
    const current = layout();
    if (!current) {
      window.location.assign(url.href);
      return;
    }

    window.dispatchEvent(new CustomEvent(RoutingEvent.NavigationStart));

    let incoming: Element[];
    let title: string;
    try {
      const response = await fetch(url.href, { headers: { accept: 'text/html' } });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const total = routeSizes[stripTrailingSlash(url.pathname)];
      const html = total ? await readReporting(response, total) : await response.text();
      const document_ = new DOMParser().parseFromString(html, 'text/html');
      const next = document_.querySelector('kvlm-layout');
      if (!next) {
        throw new Error('no layout in the response');
      }
      incoming = contentOf(next).map(child => cleanse(child));
      title = document_.title;
    } catch {
      // the browser can always do what we cannot
      window.dispatchEvent(new CustomEvent(RoutingEvent.NavigationEnd));
      window.location.assign(url.href);
      return;
    }

    // a newer navigation started while this one was in flight; it owns the
    // indicator from here and will end it itself
    if (token !== pending) {
      return;
    }

    window.dispatchEvent(new CustomEvent(RoutingEvent.NavigationEnd));

    const swap = () => {
      contentOf(current).forEach(child => child.remove());
      current.append(...incoming.map(child => document.adoptNode(child)));
      document.title = title;
    };

    if (transition) {
      await transition(swap);
    } else {
      swap();
    }

    announce(url.pathname, reason);
  }

  function go(url: URL, reason: LocationChangeReason) {
    if (routedElement(url.pathname)) {
      adoptTitle(url.pathname);
      announce(url.pathname, reason);
      return;
    }
    void swapDocument(url, reason);
  }

  function handleClick(event: MouseEvent) {
    const anchor = event
      .composedPath()
      .find((target): target is HTMLAnchorElement => target instanceof HTMLAnchorElement);
    if (!anchor || !isRoutable(anchor, event)) {
      return;
    }

    event.preventDefault();

    const url = new URL(anchor.href);
    if (url.pathname === window.location.pathname) {
      // the same page, asked for again: scroll to it, add no history entry
      announce(url.pathname, 'anchor');
      return;
    }

    const inDocument = routedElement(url.pathname) !== undefined;
    window.history.pushState({}, '', url.href);
    go(url, inDocument ? 'anchor' : 'navigation');
  }

  function handlePopState() {
    go(new URL(window.location.href), 'popstate');
  }

  // capture, so a link inside a shadow root is seen before the component is
  document.addEventListener('click', handleClick, { capture: true });
  window.addEventListener('popstate', handlePopState, false);

  return () => {
    document.removeEventListener('click', handleClick, { capture: true });
    window.removeEventListener('popstate', handlePopState, false);
    window.history.scrollRestoration = previousScrollRestoration;
  };
}
