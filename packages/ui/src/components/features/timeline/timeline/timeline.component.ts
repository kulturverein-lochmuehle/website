import { html, LitElement } from 'lit';
import { customElement, eventOptions, property, queryAssignedElements } from 'lit/decorators.js';

import styles from './timeline.component.css?inline&lit';

/**
 * Wraps a timeline items.
 */
@customElement('kvlm-timeline')
export class Timeline extends LitElement {
  static override readonly styles = styles;

  @queryAssignedElements({ selector: 'kvlm-timeline-item' })
  private readonly items!: HTMLElement[];

  @property({ type: String, reflect: true })
  override readonly role = 'list';

  @property({ type: String, reflect: true })
  direction: 'forward' | 'backward' = 'backward';

  @eventOptions({ passive: true })
  private handleSlotChange() {
    this.markItems();
  }

  // items rendered on the server are assigned before the element upgrades, so
  // no slot change follows to mark them - they carry the marker from the start
  // and this only catches up with whatever was added later
  override firstUpdated() {
    this.markItems();
  }

  private markItems() {
    this.items.forEach(item => {
      item.dataset[this.direction] = '';
    });
  }

  override render() {
    return html`<slot @slotchange="${this.handleSlotChange}"></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-timeline': Timeline;
  }
}
