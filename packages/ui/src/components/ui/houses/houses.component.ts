import { LitElement, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import styles from './houses.component.scss';

@customElement('kvlm-houses')
export class Houses extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  @property({ type: String, reflect: true })
  src!: string;

  render() {
    return html`<img src="${this.src}" alt="Willkommen" />`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-houses': Houses;
  }
}
