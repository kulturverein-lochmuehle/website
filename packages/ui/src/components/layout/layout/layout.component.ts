import { html, LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import styles from './layout.component.scss';

/**
 * A component to introduce the application layout.
 *
 * @slot header - The header slot
 * @slot - The default slot
 *
 * @cssprop [--kvlm-layout-min-height=100svh] - The minimum height of the layout
 * @cssprop [--kvlm-layout-header-offset-mobile=12.6rem] - The offset of the header on mobile devices
 * @cssprop [--kvlm-layout-header-offset-desktop=16rem] - The offset of the header on desktop devices
 * @cssprop --kvlm-layout-header-offset - Sets the offset of the header for **all devices**.
 *  _Will be overwritten by the specific mobile and desktop values if not set._
 */
@customElement('kvlm-layout')
export class Layout extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  render() {
    return html`
      <header>
        <slot name="header"></slot>
      </header>
      <main>
        <slot></slot>
      </main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-layout': Layout;
  }
}
