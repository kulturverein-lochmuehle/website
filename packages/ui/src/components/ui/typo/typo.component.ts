import { html, LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import styles from './typo.component.scss?inline';

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

  render() {
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
