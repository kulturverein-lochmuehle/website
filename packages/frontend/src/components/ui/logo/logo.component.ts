import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import styles from './logo.component.scss';

@customElement('kvlm-logo')
export class Logo extends LitElement {
  static override readonly styles = [
    css`
      ${unsafeCSS(styles)}
    `
  ];

  render() {
    return html`
      <svg
        version="1.0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d="M17.2 20.9v46h17.4v10.3H7V20.9h10.2zM42.8 77.2V20.9h9.5l15.6 33.9c2.5-5.6 5.1-11.3 7.8-17 2.7-5.7 5.3-11.3 7.8-16.9H93v56.3H82.9V46.5c-1.7 3.8-3.5 7.6-5.3 11.3s-3.5 7.5-5.2 11.2c-.3.6-.6 1.4-1 2.3-.4.9-.8 1.8-1.3 2.8s-.8 1.9-1.2 2.7c-.4.9-.7 1.6-1 2.3L63.4 69c-1-2.2-1.9-4.2-2.8-6-.8-1.8-1.7-3.5-2.5-5.2-.8-1.7-1.6-3.4-2.5-5.2-.8-1.8-1.8-3.8-2.8-6.1v30.7h-10z"
          fill="currentColor"
        />
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-logo': Logo;
  }
}
