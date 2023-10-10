import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import styles from './navigation.component.scss';

@customElement('kvlm-navigation')
export class Navigation extends LitElement {
  static override readonly styles = [
    css`
      ${unsafeCSS(styles)}
    `
  ];

  render() {
    return html`
      <kvlm-logo></kvlm-logo>
      <slot></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-navigation': Navigation;
  }
}
