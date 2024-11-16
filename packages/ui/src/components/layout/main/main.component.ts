import { html, isServer, LitElement, unsafeCSS } from 'lit';
import { customElement, eventOptions, property, queryAssignedElements } from 'lit/decorators.js';

import { readCustomProperty } from '@/utils/custom-property.utils.js';
import {
  changeLocationInline,
  type InlineLocationChangedEvent,
  RoutingEvent,
  setNavigationTheme,
} from '@/utils/event.utils.js';

import styles from './main.component.scss';

/**
 * A layout component to wrap the page content.
 *
 * @slot - The default slot
 */
@customElement('kvlm-main')
export class Main extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  // ssr doesn't support IntersectionObserver
  private readonly intersectionOptions: IntersectionObserverInit = { threshold: 0.5 };
  private readonly intersectionObserver =
    !isServer && new IntersectionObserver(this.handleIntersections, this.intersectionOptions);

  @queryAssignedElements()
  private readonly assignedElements!: HTMLElement[];

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

  @property({ reflect: true, attribute: 'scroll-observe-selector', type: String })
  scrollObserveSelector?: string;

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
    // broadcast latest color theme to navigation
    // this.changeNavigationTheme(detail.href);
    if (detail.scroll) {
      // scroll to target section
      this.scrollToContent(detail.href, true);
    }
  }

  getActiveElement(id: string): HTMLElement | undefined {
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

  changeNavigationTheme(id: string) {
    // get active target for id
    const target = this.getActiveElement(id);
    if (target === undefined) return;

    // read custom properties and build a navigation theme
    const backgroundColorFrom = readCustomProperty(target, '---kvlm-section-background-from');
    const backgroundColorTo = readCustomProperty(target, '---kvlm-section-background-to');
    const brookColor = readCustomProperty(target, '---kvlm-section-color');
    const fontColor = readCustomProperty(target, '---kvlm-section-color');

    // apply the colors
    setNavigationTheme({ backgroundColorFrom, backgroundColorTo, brookColor, fontColor });
  }

  scrollToContent(id: string, animate: boolean) {
    // get active target for id
    const target = this.getActiveElement(id);
    if (target === undefined) return;

    // use built-in scroll behavior
    window.scrollTo({
      top: target.offsetTop,
      behavior: animate ? 'smooth' : undefined,
    });
  }

  render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-main': Main;
  }
}
