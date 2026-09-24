import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import styles from './scroll-down.component.css?inline&lit';

/**
 * A round button that says there is more below, and scrolls the next section
 * into view. It sits in the content, not over it, and scrolls away with it.
 *
 * @cssprop --kvlm-scroll-down-background-from - Background gradient start color
 * @cssprop --kvlm-scroll-down-background-to - Background gradient end color
 * @cssprop --kvlm-scroll-down-color - Color of the arrow
 */
@customElement('kvlm-scroll-down')
export class ScrollDown extends LitElement {
  static override readonly styles = styles;

  /** What it says to whoever cannot see the arrow. */
  @property({ type: String })
  label = 'Weiter';

  /** The section after the one it stands in, else the element after its own. */
  #next(): Element | null {
    const section = this.closest('kvlm-section') ?? this;
    return section.nextElementSibling;
  }

  #scroll() {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#next()?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  }

  override render() {
    return html`
      <button
        type="button"
        aria-label="${this.label}"
        title="${this.label}"
        @click="${this.#scroll}"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37.4 37.4" aria-hidden="true">
          <path d="M1.4 1.4 18.7 18.7 36 1.4" />
        </svg>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-scroll-down': ScrollDown;
  }
}
