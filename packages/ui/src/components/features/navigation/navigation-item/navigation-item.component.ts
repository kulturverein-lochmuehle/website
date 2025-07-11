import { html, isServer, LitElement, unsafeCSS } from 'lit';
import { customElement, eventOptions, property } from 'lit/decorators.js';
import _debounce from 'lodash-es/debounce.js';

import { changeLocationInline, RoutingEvent } from '@/utils/event.utils.js';

import styles from './navigation-item.component.scss?inline';

@customElement('kvlm-navigation-item')
export class NavigationItem extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  private readonly handleLocationChangedBound = _debounce(
    this.handleLocationChanged.bind(this),
    300,
  );

  @property({ reflect: true, type: String })
  readonly role = 'listitem';

  @property({ reflect: true, type: Boolean })
  inline = false;

  @property({ reflect: true, type: String })
  href!: string;

  @property({ reflect: true, type: String })
  label!: string;

  @property({ reflect: true, type: Boolean })
  active = false;

  override connectedCallback() {
    super.connectedCallback();

    // ssr does not support `window` global, but calls this hook
    // https://lit.dev/docs/ssr/authoring/#browser-only-code
    // https://github.com/lit/lit/tree/main/packages/labs/ssr#notes-and-limitations
    if (isServer) return;

    window.addEventListener(
      RoutingEvent.InlineLocationChanged,
      this.handleLocationChangedBound,
      false,
    );
    window.addEventListener(
      RoutingEvent.RouterLocationChanged,
      this.handleLocationChangedBound,
      false,
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();

    // ssr does not support `window` global, but calls this hook
    // https://lit.dev/docs/ssr/authoring/#browser-only-code
    // https://github.com/lit/lit/tree/main/packages/labs/ssr#notes-and-limitations
    if (isServer) return;

    window.removeEventListener(
      RoutingEvent.InlineLocationChanged,
      this.handleLocationChangedBound,
      false,
    );
    window.removeEventListener(
      RoutingEvent.RouterLocationChanged,
      this.handleLocationChangedBound,
      false,
    );
  }

  @eventOptions({ passive: true })
  handleLocationChanged() {
    // mark as active if the current location matches the href
    this.active = window.location.pathname.startsWith(this.href);
  }

  @eventOptions({ capture: true })
  handleClick(event: Event) {
    // handle normal links with default router
    if (this.inline) {
      // prevent other listeners from handling this event
      event.preventDefault();
      // scroll to related section
      changeLocationInline(this.href, true);
    }
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
