import '@/components/ui/logo/logo.component.js';

import { html, isServer, LitElement, unsafeCSS } from 'lit';
import { customElement, eventOptions, property } from 'lit/decorators.js';

import { changeLocationInline } from '@/utils/event.utils.js';
import { injectGlobalStyle } from '@/utils/style.utils.js';

import styles from './navigation.component.scss?inline';
import globalStyles from './navigation.global.scss?inline';

/**
 * @slot - Receives the navigation items.
 *
 * @cssprop --kvlm-navigation-background-from - Background gradient start color of the navigation bar.
 * @cssprop --kvlm-navigation-background-to - Background gradient end color of the navigation bar.
 * @cssprop --kvlm-navigation-color-typo - Color of the navigation bar text.
 * @cssprop --kvlm-navigation-stroke-color - Color of the navigation bar stroke.
 * @cssprop --kvlm-navigation-stroke-width - Width of the navigation bar stroke.
 * @cssprop --kvlm-navigation-height - Height of the navigation bar. Will be computed based on layout.
 * @cssprop --kvlm-navigation-scroll-distance - Distance scrolled in pixels. Internally set by the component.
 * @cssprop --kvlm-navigation-shadow-spread - Spread of the navigation bar shadow. Computed from the scroll distance.
 * @cssprop --kvlm-navigation-shadow-opacity - Opacity of the navigation bar shadow. Computed from the scroll distance.
 */
@customElement('kvlm-navigation')
export class Navigation extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  readonly #handleScroll = this.handleScroll.bind(this);

  get #isMobile(): boolean {
    return window.getComputedStyle(this).getPropertyValue('---kvlm-navigation-mobile') === '1';
  }

  /**
   * The href of the logo link.
   */
  @property({ reflect: true, type: String })
  readonly href = '/';

  /**
   * Whether the logo link should be handled as inline.
   * That means that the page will be scrolled to the related content.
   */
  @property({ reflect: true, type: Boolean, attribute: 'href-inline' })
  hrefInline = false;

  /**
   * The amount of pixels the user has to scroll to fully fade the navigation bar shadow.
   * This maybe is the most detailed option you'll configure today.
   */
  @property({ reflect: true, attribute: 'scroll-fade-distance', type: Number })
  scrollFadeDistance = 100;

  @property({ reflect: true, type: Boolean })
  opened = false;

  constructor() {
    super();
    injectGlobalStyle(unsafeCSS(globalStyles));
  }

  override connectedCallback() {
    super.connectedCallback();

    // ssr does not support `window` global, but calls this hook
    // https://lit.dev/docs/ssr/authoring/#browser-only-code
    // https://github.com/lit/lit/tree/main/packages/labs/ssr#notes-and-limitations
    if (isServer) return;

    window.addEventListener('scroll', this.#handleScroll, false);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();

    // ssr does not support `window` global, but calls this hook
    // https://lit.dev/docs/ssr/authoring/#browser-only-code
    // https://github.com/lit/lit/tree/main/packages/labs/ssr#notes-and-limitations
    if (isServer) return;

    window.removeEventListener('scroll', this.#handleScroll, false);
  }

  @eventOptions({ passive: true })
  handleScroll() {
    requestAnimationFrame(() => {
      const distance = Math.min(1, document.documentElement.scrollTop / this.scrollFadeDistance);
      this.style.setProperty('--kvlm-navigation-scroll-distance', `${distance}`);
    });
  }

  @eventOptions({ passive: true })
  handleClick(event: Event) {
    if (!this.#isMobile) return;
    if (!event.defaultPrevented) return;
    this.toggle();
  }

  @eventOptions({ capture: true })
  handleLogoClick(event: Event) {
    if (this.#isMobile) {
      event.preventDefault();
      return;
    }

    if (this.hrefInline) {
      event.preventDefault();
      changeLocationInline(this.href, true);
    }
  }

  toggle() {
    this.opened = !this.opened;
    document.documentElement.classList.toggle('no-scroll', this.opened);
  }

  render() {
    return html`
      <nav @click="${this.handleClick}" @keydown="${this.handleClick}">
        <a @click="${this.handleLogoClick}" href="${this.href}">
          <kvlm-logo></kvlm-logo>

          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37.4 37.4">
            <path d="M1.4 1.4 18.7 18.7 36 1.4" />
            <path d="M18.7 18.7 36 36" />
            <path d="M18.7 18.7 1.4 36" />
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
