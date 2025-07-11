import { html, LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import placeholder from './placeholder.png';

import styles from './houses.component.scss?inline';

@customElement('kvlm-houses')
export class Houses extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  render() {
    return html`<img src="${placeholder}" alt="Willkommen" />`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-houses': Houses;
  }
}
