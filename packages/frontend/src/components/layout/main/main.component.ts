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

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.intersectionObserver.disconnect();
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
  handleSlotChange() {
    this.observeContents();
  }

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

  render() {
    return html`<slot @slotchange="${this.handleSlotChange}"></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-main': Main;
  }
}
