import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import styles from './typo.component.scss';

@customElement('kvlm-typo')
export class Typo extends LitElement {
  // disable shadow DOM
  override createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <style>
        ${styles}
      </style>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-typo': Typo;
  }
}
