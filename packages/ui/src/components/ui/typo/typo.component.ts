import { html, LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import styles from './typo.component.scss';

@customElement('kvlm-typo')
export class Typo extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  /**
   * Disable shadow DOM
   * @private
   */
  override createRenderRoot() {
    return this;
  }

  override render() {
    return html`
      <style>
        ${Typo.styles}
      </style>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-typo': Typo;
  }
}
