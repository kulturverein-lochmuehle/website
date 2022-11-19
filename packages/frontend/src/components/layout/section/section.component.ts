import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import styles from './section.component.scss';

@customElement('kvlm-section')
export class Section extends LitElement {
  static override readonly styles = [
    css`
      ${unsafeCSS(styles)}
    `
  ];

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
