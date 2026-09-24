import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

import styles from './section.component.css?inline&lit';

/**
 * A layout component to wrap sections of the page.
 *
 * @slot - The default slot
 * @slot scene - A layer the size of the screen, pinned behind the content like the backdrop
 *
 * @attr scenic - The scene is the section: the brook is not drawn over it
 *
 * @cssprop --kvlm-section-background-from - Background gradient start color
 * @cssprop --kvlm-section-background-to - Background gradient end color
 * @cssprop --kvlm-section-color - Color of the content
 */
@customElement('kvlm-section')
export class Section extends LitElement {
  static override readonly styles = styles;

  override render() {
    return html`
      <div role="figure">
        <slot name="scene"></slot>
        <kvlm-brook></kvlm-brook>
      </div>
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
