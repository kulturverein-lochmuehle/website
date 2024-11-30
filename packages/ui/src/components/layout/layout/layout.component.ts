import { html, isServer, LitElement, unsafeCSS } from 'lit';
import {
  customElement,
  eventOptions,
  property,
  query,
  queryAssignedElements,
} from 'lit/decorators.js';

import {
  changeLocationInline,
  type InlineLocationChangedEvent,
  RoutingEvent,
} from '../../../utils/event.utils';

import styles from './layout.component.scss';

/**
 * A component to introduce the application layout.
 *
 * @slot header - The header slot
 * @slot - The default slot
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

  // ssr doesn't support IntersectionObserver
  private readonly intersectionOptions: IntersectionObserverInit = { threshold: 0.5 };
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
      if (this.scrollObserveSelector === undefined) return observed;

      const itself = element.matches(this.scrollObserveSelector);
      if (itself) return [...observed, element];

      const within = element.querySelectorAll<HTMLElement>(this.scrollObserveSelector);
      if (within.length) return [...observed, ...within];

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
    return this.assignedElements.reduce(
      (_, element) => {
        // either the element itself has the id
        if (element.id === id) return element;
        // or one of the nested elements
        const child = element.querySelector<HTMLElement>(`[id="${id}"]`);
        if (child !== null) return child;
        // if not, deliver previous result (or undefined)
        return _;
      },
      undefined as HTMLElement | undefined,
    );
  }

  override connectedCallback() {
    super.connectedCallback();

    // watch for inline location changes
    window.addEventListener(
      RoutingEvent.InlineLocationChanged,
      this.#handleInlineLocationChanged,
      false,
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
      false,
    );
    super.disconnectedCallback();
  }

  @eventOptions({ passive: true })
  handleIntersections(entries: IntersectionObserverEntry[]) {
    const entry = entries.find(entry => entry.intersectionRatio > 0.5);
    if (entry) {
      const active = entry.target as HTMLElement;
      changeLocationInline(active.id, false);
    }
  }

  @eventOptions({ passive: true })
  handleInlineLocationChanged({ detail }: InlineLocationChangedEvent) {
    if (!detail.scroll) return;

    // scroll to target section
    this.scrollToContent(detail.href, true);
  }

  scrollToContent(id: string, animate: boolean) {
    // get active target for id
    const target = this.#getActiveElement(id);
    if (target === undefined) return;

    // use built-in scroll behavior
    const headerOffset = this.header?.offsetHeight ?? 0;
    window.scrollTo({
      top: Math.max(target.offsetTop - headerOffset, 0),
      behavior: animate ? 'smooth' : undefined,
    });
  }

  render() {
    return html`
      <header>
        <slot name="header"></slot>
      </header>
      <main>
        <slot></slot>
      </main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-layout': Layout;
  }
}
