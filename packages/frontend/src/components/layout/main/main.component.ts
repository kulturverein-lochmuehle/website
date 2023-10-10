import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, eventOptions, property, queryAssignedElements } from 'lit/decorators.js';

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

  @property({ reflect: true, attribute: 'scroll-visible-attribute', type: String })
  scrollVisibleAttribute = 'visible';

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
      'inline-location-changed',
      this.handleInlineLocationChangedBound,
      false
    );
  }

  override disconnectedCallback() {
    // don not check for intersections
    this.intersectionObserver.disconnect();

    window.removeEventListener(
      'inline-location-changed',
      this.handleInlineLocationChangedBound,
      false
    );
    super.disconnectedCallback();
  }

  getObservableContents(): HTMLElement[] {
    return this.assignedElements.filter(element => element.matches(this.scrollObserveSelector));
  }

  observeContents() {
    this.intersectionObserver.disconnect();
    this.getObservableContents().forEach(element => {
      this.intersectionObserver.observe(element);
    });
  }

  @eventOptions({ passive: true })
  handleIntersections(entries: IntersectionObserverEntry[]) {
    const entry = entries.find(entry => entry.intersectionRatio > 0.5);
    if (entry) {
      const active = entry.target as HTMLElement;
      this.getObservableContents()
        .filter(element => !element.isSameNode(active))
        .forEach(element => element.removeAttribute(this.scrollVisibleAttribute));
      active.setAttribute(this.scrollVisibleAttribute, '');
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
  handleInlineLocationChanged() {
    const { pathname } = window.location;
    this.scrollToContent(pathname, true);
  }

  scrollToContent(id: string, animate: boolean) {
    const target = this.assignedElements.find(element => element.id === id);
    if (target !== undefined) {
      window.scrollTo({
        top: target.offsetTop,
        behavior: animate ? 'smooth' : undefined
      });
    }
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
