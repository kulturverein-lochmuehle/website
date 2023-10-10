import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import styles from './navigation-item.component.scss';

@customElement('kvlm-navigation-item')
export class NavigationItem extends LitElement {
  static override readonly styles = [
    css`
      ${unsafeCSS(styles)}
    `
  ];

  @property({ reflect: true, type: Boolean })
  inline = false;

  @property({ reflect: true, type: String })
  href: string;

  @property({ reflect: true, type: String })
  label: string;

  handleClick(event: Event) {
    // handle normal links with default router
    if (!this.inline) return;
    // inline links are not handled by default router, so we need to prevent the default behavior
    event.preventDefault();
    window.history.pushState({}, '', this.href);
    window.dispatchEvent(new CustomEvent('inline-location-changed', { detail: this.href }));
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
