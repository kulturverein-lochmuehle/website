import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import styles from './root.component.scss';

@customElement('kvlm-root')
export class Root extends LitElement {
  static override readonly styles = [
    css`
      ${unsafeCSS(styles)}
    `
  ];

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
    'kvlm-root': Root;
  }
}
