import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import styles from './timeline.component.scss';

/**
 * Wraps a timeline items.
 */
@customElement('kvlm-timeline')
export class Timeline extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  @property({ type: String, reflect: true })
  readonly role = 'list';

  render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-timeline': Timeline;
  }
}
