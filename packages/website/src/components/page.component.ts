import type { CollectionEntry } from 'astro:content';

import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('kvlm-astro-page')
export class AstroPage extends LitElement {
  @property({ type: String, reflect: true })
  slug?: string;

  @property({ type: Object, reflect: true })
  data!: CollectionEntry<'pages'>['data'];

  render() {
    console.log('slug', this.slug);
    console.log(this.data);
    return html`
      <h2>${this.data.title}, Mäusschen!</h2>
      <slot></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-astro-page': AstroPage;
  }
}
