import { LitElement, html, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import styles from './brook.component.scss';

@customElement('kvlm-brook')
export class Brook extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  render() {
    return html`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1934 732"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          d="M0 312c67-30 137-73 221-73 27-31 24-42 69-28 20 12 58 32 80 37 0 11 11 23 20 29 53 3 101-56 155-36 66 21 130 64 186 101 1 43 45 74 85 76 15-13 45 13 57 19 97 3 12 101 95 112 45 10 36-3 67-24 13-5 74 11 88 14 15 11 41 34 62 34 56 2 62-25 103 22 55 3 60 88 113 105 16 9 46 14 60 26 27 1 58 0 84-5 12 8 29 12 44 10 8-1 26 6 29-7 12-20 14-47 32-65 48 5 61-53 59-91-48-41 15-68 24-107 7-39-21-37-32-68 4-19 30-34 36-54 4-24 26-58 48-69 18-3 36-25 55-21 4-18 24-31 36-43 15-24-7-54-1-79 14-69 65-81 58-127"
        />
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-brook': Brook;
  }
}
