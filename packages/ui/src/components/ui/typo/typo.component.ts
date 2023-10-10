import { LitElement, html, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import styles from './typo.component.scss';

@customElement('kvlm-typo')
export class Typo extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  // disable shadow DOM
  override createRenderRoot() {
    return this;
  }

  render() {
    return html`<style .innerHTML="${Typo.styles}"></style>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-typo': Typo;
  }
}
