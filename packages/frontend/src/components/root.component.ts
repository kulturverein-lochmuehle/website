import { Router } from '@vaadin/router';
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';

import { ROOT_ROUTES } from './root.routes';

@customElement('kvlm-root')
export class Root extends LitElement {
  private readonly router = new Router();

  configureRouter(outlet?: Element) {
    this.router.setRoutes(ROOT_ROUTES);
    this.router.setOutlet(outlet!);
  }

  render() {
    return html`
      <header>
        <slot name="header"></slot>
      </header>
      <main role="main" ${ref(this.configureRouter)}></main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-root': Root;
  }
}
