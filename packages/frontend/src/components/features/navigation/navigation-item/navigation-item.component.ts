import _debounce from 'lodash-es/debounce';
import { LitElement, html, unsafeCSS } from 'lit';
import { customElement, eventOptions, property } from 'lit/decorators.js';
import { changeLocationInline, RoutingEvent } from '@/utils/event.utils';

import styles from './navigation-item.component.scss';

@customElement('kvlm-navigation-item')
export class NavigationItem extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  private readonly handleLocationChangedBound = _debounce(
    this.handleLocationChanged.bind(this),
    300
  );

  @property({ reflect: true, type: Boolean })
  active = false;

  @property({ reflect: true, type: Boolean })
  inline = false;

  @property({ reflect: true, type: String })
  href!: string;

  @property({ reflect: true, type: String })
  label!: string;

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener(
      RoutingEvent.InlineLocationChanged,
      this.handleLocationChangedBound,
      false
    );
    window.addEventListener(
      RoutingEvent.RouterLocationChanged,
      this.handleLocationChangedBound,
      false
    );
  }

  override disconnectedCallback() {
    window.removeEventListener(
      RoutingEvent.InlineLocationChanged,
      this.handleLocationChangedBound,
      false
    );
    window.removeEventListener(
      RoutingEvent.RouterLocationChanged,
      this.handleLocationChangedBound,
      false
    );
    super.disconnectedCallback();
  }

  @eventOptions({ passive: true })
  handleLocationChanged() {
    // mark as active if the current location matches the href
    this.active = window.location.pathname.startsWith(this.href);
  }

  @eventOptions({ passive: false })
  handleClick(event: Event) {
    // handle normal links with default router
    if (!this.inline) {
      return;
    }
    // check if we are already on the route
    if (window.location.pathname === this.href) {
      event.preventDefault();
      return;
    }
    // inline links are not handled by default router, so we need to prevent the default behaviour
    event.preventDefault();
    changeLocationInline(this.href, true);
  }

  render() {
    return html`<a href="${this.href}" @click="${this.handleClick}">${this.label}</a>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-navigation-item': NavigationItem;
  }
}
