import { html, isServer, LitElement } from 'lit';
import { customElement, eventOptions, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import _debounce from 'lodash-es/debounce.js';

import { RoutingEvent, stripTrailingSlash } from '../../../../utils/router.utils.js';
import styles from './navigation-item.component.css?inline&lit';

@customElement('kvlm-navigation-item')
export class NavigationItem extends LitElement {
  static override readonly styles = styles;

  private readonly handleLocationChangedBound = _debounce(
    this.handleLocationChanged.bind(this),
    300
  );

  @property({ reflect: true, type: String })
  override readonly role = 'listitem';

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
    if (isServer) {
      return;
    }

    window.addEventListener(RoutingEvent.LocationChanged, this.handleLocationChangedBound, false);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();

    // ssr does not support `window` global, but calls this hook
    // https://lit.dev/docs/ssr/authoring/#browser-only-code
    // https://github.com/lit/lit/tree/main/packages/labs/ssr#notes-and-limitations
    if (isServer) {
      return;
    }

    window.removeEventListener(
      RoutingEvent.LocationChanged,
      this.handleLocationChangedBound,
      false
    );
  }

  @eventOptions({ passive: true })
  handleLocationChanged() {
    // mark as active if the current location matches the href
    this.active = stripTrailingSlash(window.location.pathname).startsWith(
      stripTrailingSlash(this.href)
    );
  }

  override render() {
    // an item pointing to another site opens in its own tab
    const external = /^https?:\/\//.test(this.href);

    return html`<a
      href="${this.href}"
      target="${ifDefined(external ? '_blank' : undefined)}"
      rel="${ifDefined(external ? 'noopener noreferrer' : undefined)}"
      >${this.label}</a
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-navigation-item': NavigationItem;
  }
}
