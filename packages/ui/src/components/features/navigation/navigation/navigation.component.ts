import '../../../../components/ui/logo/logo.component.js';

import { html, isServer, LitElement } from 'lit';
import { customElement, eventOptions, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import type { NavigationProgressEvent } from '../../../../utils/router.utils.js';
import { RoutingEvent } from '../../../../utils/router.utils.js';
import { injectGlobalStyle } from '../../../../utils/style.utils.js';
import styles from './navigation.component.css?inline&lit';
import globalStyles from './navigation.global.css?inline&lit';

/**
 * @slot - Receives the navigation items.
 * @slot secondary - Receives secondary items, only shown in the mobile menu.
 *
 * @cssprop --kvlm-navigation-background-from - Background gradient start color of the navigation bar.
 * @cssprop --kvlm-navigation-background-to - Background gradient end color of the navigation bar.
 * @cssprop --kvlm-navigation-color-typo - Color of the navigation bar text.
 * @cssprop --kvlm-navigation-stroke-color - Color of the navigation bar stroke.
 * @cssprop --kvlm-navigation-stroke-width - Width of the navigation bar stroke.
 * @cssprop --kvlm-navigation-height - Height of the navigation bar.
 */
@customElement('kvlm-navigation')
export class Navigation extends LitElement {
  static override readonly styles = styles;

  /**
   * How far the navigation in flight has come, filling the brook of the logo.
   * `undefined` whenever none is, which is what hides it again.
   */
  @state()
  private loaded: number | undefined = undefined;
  #shownAt = 0;
  #hideTimeout?: ReturnType<typeof setTimeout>;

  readonly #handleNavigationStart = () => {
    clearTimeout(this.#hideTimeout);
    this.loaded = 0;
    this.#shownAt = performance.now();
  };

  readonly #handleNavigationProgress = ({ detail }: NavigationProgressEvent) => {
    this.loaded = Math.min(100, (detail.loaded / detail.total) * 100);
  };

  readonly #handleNavigationEnd = () => {
    // a navigation nothing measured has been at nought the whole time, so the
    // brook runs full here rather than never filling at all
    this.loaded = 100;

    // and it stays long enough to have been seen
    const seen = performance.now() - this.#shownAt;
    clearTimeout(this.#hideTimeout);
    this.#hideTimeout = setTimeout(() => (this.loaded = undefined), Math.max(0, 500 - seen));
  };

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
  @property({ reflect: true, type: Boolean })
  opened = false;

  constructor() {
    super();
    injectGlobalStyle(globalStyles);
  }

  override connectedCallback() {
    super.connectedCallback();

    // ssr has no `window`, but calls this hook
    if (isServer) {
      return;
    }

    window.addEventListener(RoutingEvent.NavigationStart, this.#handleNavigationStart, false);
    window.addEventListener(RoutingEvent.NavigationProgress, this.#handleNavigationProgress, false);
    window.addEventListener(RoutingEvent.NavigationEnd, this.#handleNavigationEnd, false);
  }

  override disconnectedCallback() {
    if (!isServer) {
      window.removeEventListener(RoutingEvent.NavigationStart, this.#handleNavigationStart, false);
      window.removeEventListener(
        RoutingEvent.NavigationProgress,
        this.#handleNavigationProgress,
        false
      );
      window.removeEventListener(RoutingEvent.NavigationEnd, this.#handleNavigationEnd, false);
      clearTimeout(this.#hideTimeout);
    }
    super.disconnectedCallback();
  }

  @eventOptions({ passive: true })
  handleClick(event: Event) {
    if (!this.#isMobile) {
      return;
    }
    if (!event.defaultPrevented) {
      return;
    }
    this.toggle();
  }

  @eventOptions({ capture: true })
  handleLogoClick(event: Event) {
    if (this.#isMobile) {
      event.preventDefault();
      return;
    }
  }

  toggle() {
    this.opened = !this.opened;
    document.documentElement.classList.toggle('no-scroll', this.opened);
  }

  override render() {
    return html`
      <nav @click="${this.handleClick}" @keydown="${this.handleClick}">
        <a @click="${this.handleLogoClick}" href="${this.href}">
          <kvlm-logo loaded="${ifDefined(this.loaded)}"></kvlm-logo>

          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37.4 37.4">
            <path d="M1.4 1.4 18.7 18.7 36 1.4" />
            <path d="M18.7 18.7 36 36" />
            <path d="M18.7 18.7 1.4 36" />
          </svg>
        </a>
        <slot></slot>
        <slot name="secondary"></slot>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-navigation': Navigation;
  }
}
