import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, eventOptions, property, queryAssignedElements } from 'lit/decorators.js';

import styles from './timeline.component.scss';

/**
 * Wraps a timeline items.
 */
@customElement('kvlm-timeline')
export class Timeline extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  @queryAssignedElements({ selector: 'kvlm-timeline-item' })
  private readonly items!: HTMLElement[];

  @property({ type: String, reflect: true })
  readonly role = 'list';

  @property({ type: String, reflect: true })
  direction: 'forward' | 'backward' = 'backward';

  @eventOptions({ passive: true })
  private handleSlotChange() {
    this.items.forEach(item => {
      item.dataset[this.direction] = '';
    });
  }

  render() {
    return html`<slot @slotchange="${this.handleSlotChange}"></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-timeline': Timeline;
  }
}
