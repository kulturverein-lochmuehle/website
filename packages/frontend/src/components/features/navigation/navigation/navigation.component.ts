import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import styles from './navigation.component.scss';

@customElement('kvlm-navigation')
export class Navigation extends LitElement {
  static override readonly styles = [
    css`
      ${unsafeCSS(styles)}
    `
  ];

  private readonly handleScrollBound = this.handleScroll.bind(this);

  @property({ reflect: true, attribute: 'scroll-fade-distance', type: Number })
  scrollFadeDistance = 100;

  constructor() {
    super();
    window.addEventListener('scroll', this.handleScrollBound, false);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('scroll', this.handleScrollBound, false);
  }

  handleScroll() {
    requestAnimationFrame(() => {
      const distance = Math.min(1, document.documentElement.scrollTop / this.scrollFadeDistance);
      this.style.setProperty('--kvlm-navigation-scroll-distance', `${distance}`);
    });
  }

  render() {
    return html`
      <nav>
        <a href="/">
          <kvlm-logo></kvlm-logo>

          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30.556 20.795">
            <path
              d="M927.335,4843.929l13.731,16.4,13.76-16.4"
              transform="translate(-925.801 -4842.643)"
            />
          </svg>
        </a>
        <slot></slot>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-navigation': Navigation;
  }
}
