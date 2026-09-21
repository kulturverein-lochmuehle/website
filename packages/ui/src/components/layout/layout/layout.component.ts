import { html, isServer, LitElement, unsafeCSS } from 'lit';
import {
  customElement,
  eventOptions,
  property,
  query,
  queryAssignedElements,
} from 'lit/decorators.js';

import type { InlineLocationChangedEvent } from '../../../utils/event.utils.js';
import { changeLocationInline, RoutingEvent } from '../../../utils/event.utils.js';

import styles from './layout.component.scss?inline';

/** The deployed pages are served with a trailing slash, the section ids are not. */
const stripTrailingSlash = (path: string) => path.replace(/(.)\/$/, '$1');

/**
 * A component to introduce the application layout.
 *
 * @slot header - The header slot
 * @slot - The default slot
 * @slot footer - The footer slot
 *
 * @cssprop --kvlm-layout-color-typo - The color of the typography
 * @cssprop [--kvlm-layout-min-height=100svh] - The minimum height of the layout
 * @cssprop [--kvlm-layout-header-offset-mobile=utils.rem(12.6)] - The offset of the header on mobile devices
 * @cssprop [--kvlm-layout-header-offset-desktop=utils.rem(16)] - The offset of the header on desktop devices
 * @cssprop --kvlm-layout-header-offset - Sets the offset of the header for **all devices**.
 */
@customElement('kvlm-layout')
export class Layout extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  // sections can be taller than the viewport and would never reach a
  // ratio threshold, so the one crossing the middle of the screen wins
  private readonly intersectionOptions: IntersectionObserverInit = {
    threshold: 0,
    rootMargin: '-50% 0px -50% 0px',
  };
  private readonly intersectionObserver =
    !isServer && new IntersectionObserver(this.handleIntersections, this.intersectionOptions);

  @query('header')
  private readonly header!: HTMLElement;

  @queryAssignedElements()
  private readonly assignedElements!: HTMLElement[];

  @property({ reflect: true, attribute: 'scroll-observe-selector', type: String })
  readonly scrollObserveSelector?: string;

  readonly #handleInlineLocationChanged = this.handleInlineLocationChanged.bind(this);

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
    // don't check for orphaned intersections any more
    this.intersectionObserver.disconnect();

    // add new intersection observations
    this.#observableElements.forEach(element => {
      this.intersectionObserver.observe(element);
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

    // watch for inline location changes
    window.addEventListener(
      RoutingEvent.InlineLocationChanged,
      this.#handleInlineLocationChanged,
      false
    );

    // observe contents once scrolled
    window.addEventListener('scroll', () => this.#observeContents(), { passive: true, once: true });

    // scroll to initial location
    window.setTimeout(() => this.scrollToContent(window.location.pathname, false), 100);
  }

  override disconnectedCallback() {
    // do not check for intersections any more
    this.intersectionObserver.disconnect();

    window.removeEventListener(
      RoutingEvent.InlineLocationChanged,
      this.#handleInlineLocationChanged,
      false
    );
    super.disconnectedCallback();
  }

  @eventOptions({ passive: true })
  handleIntersections(entries: IntersectionObserverEntry[]) {
    const entry = entries.find(entry => entry.isIntersecting);
    if (entry) {
      const active = entry.target as HTMLElement;
      changeLocationInline(active.id, false);
    }
  }

  @eventOptions({ passive: true })
  handleInlineLocationChanged({ detail }: InlineLocationChangedEvent) {
    if (!detail.scroll) {
      return;
    }

    // scroll to target section
    this.scrollToContent(detail.href, true);
  }

  scrollToContent(id: string, animate: boolean) {
    // get active target for id
    const target = this.#getActiveElement(id);
    if (target === undefined) {
      return;
    }

    // use built-in scroll behavior
    const headerOffset = this.header?.offsetHeight ?? 0;
    window.scrollTo({
      top: Math.max(target.offsetTop - headerOffset, 0),
      behavior: animate ? 'smooth' : 'instant',
    });
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-layout': Layout;
  }
}
