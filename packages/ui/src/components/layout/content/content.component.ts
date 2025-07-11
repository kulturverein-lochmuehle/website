import { html, LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import styles from './content.component.scss?inline';

/**
 * A layout component to wrap contents of the page.
 *
 * @slot - The default slot
 *
 * @cssprop --kvlm-content-background - Background color
 * @cssprop --kvlm-content-color - Color of the content
 */
@customElement('kvlm-content')
export class Content extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  render() {
    return html`
      <article>
        <slot></slot>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-content': Content;
  }
}
