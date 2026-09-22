import { html, isServer, LitElement } from 'lit';
import {
  customElement,
  eventOptions,
  property,
  query,
  queryAssignedElements,
} from 'lit/decorators.js';

import type { LocationChangedEvent } from '../../../utils/router.utils.js';
import { RoutingEvent, stripTrailingSlash, syncLocation } from '../../../utils/router.utils.js';
import styles from './layout.component.css?inline&lit';

/**
 * A component to introduce the application layout.
 *
 * @slot header - The header slot
 * @slot - The default slot
 * @slot footer - The footer slot
 *
 * The layout is an app shell: header and footer are rows of their own and
 * the content between them is the only scroll container. Its size is what
 * the sections measure themselves against, in container query units.
 *
 * @cssprop --kvlm-layout-color-typo - The color of the typography
 */
@customElement('kvlm-layout')
export class Layout extends LitElement {
  static override readonly styles = styles;

  // sections can be taller than the viewport and would never reach a
  // ratio threshold, so the one crossing the middle of the screen wins
  private readonly intersectionOptions: IntersectionObserverInit = {
    threshold: 0,
    rootMargin: '-50% 0px -50% 0px',
  };
  private intersectionObserver?: IntersectionObserver;

  @query('main')
  private readonly main!: HTMLElement;

  @queryAssignedElements()
  private readonly assignedElements!: HTMLElement[];

  @property({ reflect: true, attribute: 'scroll-observe-selector', type: String })
  readonly scrollObserveSelector?: string;

  readonly #handleLocationChanged = this.handleLocationChanged.bind(this);

  /**
   * @private
   */
  get #observableElements() {
    return this.assignedElements.reduce((observed, element) => {
      if (this.scrollObserveSelector === undefined) {
        return observed;
      }

      const itself = element.matches(this.scrollObserveSelector);
      if (itself) {
        return [...observed, element];
      }

      const within = element.querySelectorAll<HTMLElement>(this.scrollObserveSelector);
      if (within.length) {
        return [...observed, ...within];
      }

      return observed;
    }, [] as HTMLElement[]);
  }

  /**
   * @private
   */
  #observeContents() {
    // the content scroller is the root of the observation
    this.intersectionObserver ??= new IntersectionObserver(this.handleIntersections, {
      ...this.intersectionOptions,
      root: this.main,
    });

    // don't check for orphaned intersections any more
    this.intersectionObserver.disconnect();

    // add new intersection observations
    this.#observableElements.forEach(element => {
      this.intersectionObserver?.observe(element);
    });
  }

  /**
   * @private
   */
  #getActiveElement(id: string): HTMLElement | undefined {
    const wanted = stripTrailingSlash(id);
    return this.assignedElements.reduce(
      (_, element) => {
        // either the element itself has the id
        if (stripTrailingSlash(element.id) === wanted) {
          return element;
        }
        // or one of the nested elements
        const child = [...element.querySelectorAll<HTMLElement>('[id]')].find(
          nested => stripTrailingSlash(nested.id) === wanted
        );
        if (child !== undefined) {
          return child;
        }
        // if not, deliver previous result (or undefined)
        return _;
      },
      undefined as HTMLElement | undefined
    );
  }

  override connectedCallback() {
    super.connectedCallback();

    // the router decides where the location points, this only follows it
    window.addEventListener(RoutingEvent.LocationChanged, this.#handleLocationChanged, false);
  }

  override firstUpdated() {
    if (isServer) {
      return;
    }

    // observe contents once scrolled
    this.main.addEventListener('scroll', () => this.#observeContents(), {
      passive: true,
      once: true,
    });

    // scroll to initial location
    window.setTimeout(() => this.scrollToContent(window.location.pathname, false), 100);
  }

  override disconnectedCallback() {
    // do not check for intersections any more
    this.intersectionObserver?.disconnect();

    window.removeEventListener(RoutingEvent.LocationChanged, this.#handleLocationChanged, false);
    super.disconnectedCallback();
  }

  @eventOptions({ passive: true })
  handleIntersections(entries: IntersectionObserverEntry[]) {
    const entry = entries.find(entry => entry.isIntersecting);
    if (entry) {
      const active = entry.target as HTMLElement;
      // the address bar follows the scroll, it does not drive it
      syncLocation(active.id);
    }
  }

  @eventOptions({ passive: true })
  handleLocationChanged({ detail }: LocationChangedEvent) {
    // a scroll reporting its own section must not scroll again
    if (detail.reason === 'sync') {
      return;
    }

    const animate = detail.reason === 'anchor';
    if (!animate) {
      // the content is new: the scroll container still holds the offset of the
      // page just left, and the sections to watch are different ones
      this.main.scrollTo({ top: 0, behavior: 'instant' });
      this.#observeContents();
    }

    this.scrollToContent(detail.href, animate);
  }

  scrollToContent(id: string, animate: boolean) {
    // get active target for id
    const target = this.#getActiveElement(id);
    if (target === undefined) {
      return;
    }

    // the content scrolls, not the document, so the target is measured
    // against the scroll container - the header is no part of it
    const top =
      this.main.scrollTop +
      target.getBoundingClientRect().top -
      this.main.getBoundingClientRect().top;
    this.main.scrollTo({ top: Math.max(top, 0), behavior: animate ? 'smooth' : 'instant' });
  }

  override render() {
    return html`
      <header>
        <slot name="header"></slot>
      </header>
      <main>
        <slot></slot>
      </main>
      <footer>
        <slot name="footer"></slot>
      </footer>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-layout': Layout;
  }
}
