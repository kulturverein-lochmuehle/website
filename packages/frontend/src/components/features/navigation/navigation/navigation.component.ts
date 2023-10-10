import { LitElement, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import styles from './navigation.component.scss';

@customElement('kvlm-navigation')
export class Navigation extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  private readonly handleScrollBound = this.handleScroll.bind(this);

  @property({ reflect: true, type: Boolean })
  opened = false;

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

  handleClick(event: Event) {
    event.preventDefault();
    this.opened = !this.opened;
  }

  render() {
    return html`
      <nav @click="${this.handleClick}">
        <a href="/">
          <kvlm-logo></kvlm-logo>

          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37.4 37.4">
            <path d="M1.4 1.4 18.7 18.7 36 1.4" />
            <path d="M18.7 18.7 18.7 18.7" />
            <path d="M18.7 18.7 18.7 18.7" />
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
