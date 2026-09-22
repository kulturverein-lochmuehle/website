import { html, isServer, LitElement, nothing, unsafeCSS } from 'lit';
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

  override render() {
    // a binding inside a style element is nothing a server can render, and
    // styles for the light DOM belong in the document anyway - the page
    // ships them itself and this only catches up in the browser
    if (isServer) {
      return nothing;
    }

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
