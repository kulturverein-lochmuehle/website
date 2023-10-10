import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, eventOptions, property, queryAssignedElements } from 'lit/decorators.js';
import { readCustomProperty } from '@/utils/custom-property.utils';
import {
  changeLocationInline,
  InlineLocationChangedEvent,
  RoutingEvent,
  setNavigationTheme
} from '@/utils/event.utils';

import styles from './main.component.scss';

@customElement('kvlm-main')
export class Main extends LitElement {
  static override readonly styles = [
    css`
      ${unsafeCSS(styles)}
    `
  ];

  private readonly intersectionOptions: IntersectionObserverInit = { threshold: 0.5 };
  private readonly intersectionObserver = new IntersectionObserver(
    entries => this.handleIntersections(entries),
    this.intersectionOptions
  );

  private readonly handleInlineLocationChangedBound = this.handleInlineLocationChanged.bind(this);

  @queryAssignedElements()
  private assignedElements!: HTMLElement[];

  @property({ reflect: true, attribute: 'scroll-observe-selector', type: String })
  scrollObserveSelector?: string;

  override attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    // re-observe contents
    if (['scroll-observe-selector', 'scroll-visible-attribute'].includes(name)) {
      this.observeContents();
    }
  }

  override connectedCallback() {
    super.connectedCallback();

    // watch for inline location changes
    window.addEventListener(
      RoutingEvent.InlineLocationChanged,
      this.handleInlineLocationChangedBound,
      false
    );
  }

  override disconnectedCallback() {
    // don not check for intersections
    this.intersectionObserver.disconnect();

    window.removeEventListener(
      RoutingEvent.InlineLocationChanged,
      this.handleInlineLocationChangedBound,
      false
    );
    super.disconnectedCallback();
  }

  observeContents() {
    this.intersectionObserver.disconnect();
    this.assignedElements
      .filter(element => element.matches(this.scrollObserveSelector))
      .forEach(element => {
        this.intersectionObserver.observe(element);
      });
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
  handleSlotChange() {
    // check for intersection due to scrolling
    this.observeContents();
    // initialize correct offset
    this.scrollToContent(window.location.pathname, false);
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
    return this.assignedElements.find(element => element.id === id);
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
      behavior: animate ? 'smooth' : undefined
    });
  }

  render() {
    return html`<slot @slotchange="${this.handleSlotChange}"></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-main': Main;
  }
}
