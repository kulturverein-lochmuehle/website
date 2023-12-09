import { html, LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import styles from './section.component.scss';

/**
 * A layout component to wrap sections of the page.
 *
 * @slot - The default slot
 *
 * @cssprop --kvlm-section-background-from - Background gradient start color
 * @cssprop --kvlm-section-background-to - Background gradient end color
 * @cssprop --kvlm-section-color - Color of the content
 */
@customElement('kvlm-section')
export class Section extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  render() {
    return html`
      <kvlm-brook></kvlm-brook>
      <section>
        <slot></slot>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-section': Section;
  }
}
