import { LitElement, html, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import styles from './logo.component.scss';

@customElement('kvlm-logo')
export class Logo extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  render() {
    return html`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 246.2 46.1"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          class="brook"
          d="M52.2 46c-9.8 0-20.3-2.8-27.8-8.2-1.7-1.3-3.9-.7-7.3.4-4.9 1.5-11.6 3.5-17.1-4.9l4.3-2.8c3.2 5 6.1 4.3 11.3 2.7 3.7-1.1 7.9-2.4 11.8.4A43.5 43.5 0 0 0 66 38.3c6-2.7 9.5-7.1 10.2-13.2a6.2 6.2 0 0 1 3.2-4.8c4.1-2.3 10.7-.4 13.1.8 5.7 2.9 10.1 3.8 13.1 2.7 3.4-1.2 5-5.1 6.6-8.8 1.6-3.7 3.2-7.4 6.6-8.8a8.8 8.8 0 0 1 6.9.6 9.6 9.6 0 0 1 3.5 3.1l.8.9c15.5-5 25.7-.5 36.4 4.4a74.3 74.3 0 0 0 37 8.5c3 0 3.8-1 5.1-2.8 1.6-2.3 4-5.3 10.6-5.5a106.3 106.3 0 0 1 16.6.6c3.5.5 4.5.6 8.6-1l1.9 4.7c-5 2-7 2-11.1 1.5a101.2 101.2 0 0 0-15.8-.6c-4.2 0-5.3 1.4-6.6 3.3-1.5 2-3.6 4.8-9 5-18 .7-29.4-4.4-39.4-9-10.8-4.8-19.3-8.7-33-4.1-3.2 1-5.1-1.4-6.1-2.7a5.7 5.7 0 0 0-1.6-1.6 4 4 0 0 0-3-.4c-1.3.5-2.5 3.2-3.7 5.9-1.8 4.3-4 9.6-9.5 11.6-4.4 1.7-10 .7-17.2-2.9-2-1-6.6-1.9-8.4-.9a1 1 0 0 0-.5 1A21 21 0 0 1 68 43a39.5 39.5 0 0 1-15.9 3Z"
        />
        <path d="M7.8 0h5.1v7l4.2-7h6l-5.5 8.5 6 10.1h-6l-4.6-8v8H7.7Z" />
        <path
          d="M36.7 19.1a9.3 9.3 0 0 1-3.2-.5 7.4 7.4 0 0 1-2.5-1.5 6.7 6.7 0 0 1-1.6-2.3 7.9 7.9 0 0 1-.6-3.2V0h5.1v11.9a2.8 2.8 0 0 0 .2 1.2 2.2 2.2 0 0 0 .6.8 2.6 2.6 0 0 0 1 .4 3.5 3.5 0 0 0 2 0 2.5 2.5 0 0 0 .8-.4 2.2 2.2 0 0 0 .6-.8 2.8 2.8 0 0 0 .3-1.2V0h5.1v11.6a8 8 0 0 1-.6 3.2 6.8 6.8 0 0 1-1.6 2.3 7.4 7.4 0 0 1-2.5 1.5 9.3 9.3 0 0 1-3.1.5Z"
        />
        <path d="M52.3 0h5.2v14h6l-.6 4.6H52.3Z" />
        <path d="M72.2 4.7h-3.8l.5-4.7h11.9l.5 4.7h-3.9v14h-5.2Z" />
        <path
          d="M94.4 19.1a9.3 9.3 0 0 1-3.2-.5 7.4 7.4 0 0 1-2.5-1.5 6.7 6.7 0 0 1-1.6-2.3 7.9 7.9 0 0 1-.6-3.2V0h5.1v11.9a2.8 2.8 0 0 0 .3 1.2 2.2 2.2 0 0 0 .6.8 2.6 2.6 0 0 0 .8.4 3.5 3.5 0 0 0 2 0 2.5 2.5 0 0 0 1-.4 2.2 2.2 0 0 0 .6-.8 2.8 2.8 0 0 0 .2-1.2V0h5.2v11.6a8 8 0 0 1-.6 3.2A6.8 6.8 0 0 1 100 17a7.4 7.4 0 0 1-2.5 1.5 9.2 9.2 0 0 1-3.1.5Z"
        />
        <path d="M129.2 0h5.4l2.7 10.9L140 0h5.5l-5.2 18.6h-5.8Z" />
        <path d="M150.5 0h11.1l.5 4.7h-6.4V7h5.7v4.4h-5.7V14h6.4l-.5 4.6h-11.1Z" />
        <path d="M190.3 0h11.2l.5 4.7h-6.5V7h5.7v4.4h-5.7V14h6.5l-.5 4.6h-11.2Z" />
        <path d="M209.7 0h5.2v18.6h-5.2Z" />
        <path d="M222.7 0h4.6l6 8.8V0h5.2v18.6h-4.7l-5.9-8.8v8.8h-5.2Z" />
        <path d="M7.8 26.4h5.1v14h6l-.5 4.6H7.8Z" />
        <path
          d="M33.9 45.5a9.8 9.8 0 0 1-4-.7 9.6 9.6 0 0 1-5.1-5.3 10.3 10.3 0 0 1 0-7.6 9.6 9.6 0 0 1 5.1-5.3 10.4 10.4 0 0 1 8 0 9.5 9.5 0 0 1 5 5.3 10.3 10.3 0 0 1 0 7.6 9.5 9.5 0 0 1-5 5.2 9.8 9.8 0 0 1-4 .8Zm0-4.6a4.5 4.5 0 0 0 1.8-.4 4.5 4.5 0 0 0 1.5-1 4.8 4.8 0 0 0 1-1.7 6.4 6.4 0 0 0 0-4.2 4.8 4.8 0 0 0-1-1.7 4.6 4.6 0 0 0-1.5-1 4.6 4.6 0 0 0-3.6 0 4.6 4.6 0 0 0-1.5 1 4.8 4.8 0 0 0-1 1.7 6.4 6.4 0 0 0 0 4.2 4.8 4.8 0 0 0 1 1.7 4.6 4.6 0 0 0 1.5 1 4.4 4.4 0 0 0 1.8.4Z"
        />
        <path
          d="M58.7 45.5a10.3 10.3 0 0 1-4-.7 9.2 9.2 0 0 1-5-5.2 11 11 0 0 1 0-7.8 9.2 9.2 0 0 1 5-5.2 10.3 10.3 0 0 1 4-.7 11.8 11.8 0 0 1 3.5.5 7.3 7.3 0 0 1 3 1.8l-2.6 4.4a6 6 0 0 0-1.9-1.6 4.6 4.6 0 0 0-3.8-.1 4.7 4.7 0 0 0-1.5 1 4.9 4.9 0 0 0-1 1.7 6.4 6.4 0 0 0 0 4.2 4.9 4.9 0 0 0 1 1.7 4.6 4.6 0 0 0 1.5 1 4.5 4.5 0 0 0 1.8.4 4.1 4.1 0 0 0 2.1-.6 5.5 5.5 0 0 0 1.8-1.8l2.8 4.2a6.2 6.2 0 0 1-2.7 2 10.3 10.3 0 0 1-4 .8Z"
        />
        <path d="M70.6 26.4h5.2V33h5.7v-6.7h5.2V45h-5.2v-7.2h-5.7V45h-5.2Z" />
        <path d="M94.4 26.4h5.2l4.6 7.2 4.7-7.2h5.2V45h-5.2v-9.6l-4.7 6.5-4.6-6.5V45h-5.2Z" />
        <path
          d="M129.7 45.5a9.2 9.2 0 0 1-3.1-.5 7.3 7.3 0 0 1-2.5-1.5 6.7 6.7 0 0 1-1.7-2.3 7.9 7.9 0 0 1-.6-3.2V26.4h5.2v11.9a2.9 2.9 0 0 0 .2 1.2 2.2 2.2 0 0 0 .6.8 2.6 2.6 0 0 0 .9.4 3.5 3.5 0 0 0 2 0 2.6 2.6 0 0 0 1-.4 2.2 2.2 0 0 0 .5-.8 2.8 2.8 0 0 0 .2-1.2v-12h5.2V38a7.9 7.9 0 0 1-.6 3.2 6.8 6.8 0 0 1-1.6 2.3 7.3 7.3 0 0 1-2.5 1.5 9.2 9.2 0 0 1-3.2.5Zm-5.4-24.8h4.1v4.1h-4.1Zm6.7 0h4.2v4.1H131Z"
        />
        <path d="M145.4 26.4h5.1V33h5.7v-6.7h5.2V45h-5.2v-7.2h-5.7V45h-5.1Z" />
        <path d="M169.2 26.4h5.2v14h6l-.6 4.6h-10.6Z" />
        <path d="M188 26.4h11.2l.5 4.6h-6.5v2.4h5.7v4.4h-5.7v2.6h6.5l-.5 4.6H188Z" />
        <path
          d="M110 0h7.3a7.4 7.4 0 0 1 2.5.4 6.1 6.1 0 0 1 2 1.2 5.6 5.6 0 0 1 1.4 1.9 6.3 6.3 0 0 1 .2 4.3 4.5 4.5 0 0 1-.7 1.4 4.7 4.7 0 0 1-1 1 7.9 7.9 0 0 1-1.3.7l4.9 7.7h-6l-4-7h-.1v7H110Zm6.2 7.8a3 3 0 0 0 1.7-.5 1.8 1.8 0 0 0 0-2.8 3 3 0 0 0-1.7-.4h-1v3.7Z"
        />
        <path
          d="M169.9 0h7.2a7.4 7.4 0 0 1 2.6.4 6.1 6.1 0 0 1 2 1.2 5.7 5.7 0 0 1 1.4 1.9 6.3 6.3 0 0 1 .2 4.3 4.5 4.5 0 0 1-.7 1.4 4.7 4.7 0 0 1-1 1 7.8 7.8 0 0 1-1.3.7l4.9 7.7h-6l-4-7h-.1v7h-5.2Zm6.2 7.8a3 3 0 0 0 1.7-.5 1.5 1.5 0 0 0 .6-1.4 1.5 1.5 0 0 0-.6-1.4 3 3 0 0 0-1.7-.4h-1v3.7Z"
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
