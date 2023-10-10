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

  @property({ reflect: true, type: String })
  href: string;

  @property({ reflect: true, type: String })
  label: string;

  render() {
    return html`<a href="${this.href}">${this.label}</a>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-navigation-item': NavigationItem;
  }
}
