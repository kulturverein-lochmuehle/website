import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('kvlm-page-verein')
export class VereinPage extends LitElement {
  render() {
    return html`
      <kvlm-main scroll-observe-selector="kvlm-section">
        <kvlm-section
          id="/verein/willkommen"
          style="
          --kvlm-section-background-from: #75f0de;
          --kvlm-section-background-to: #6fbad9;
          --kvlm-section-color: var(--kvlm-color-typo-dark);
        "
        >
          <kvlm-typo>
            <h1 class="title">Du hast uns gerade noch gefehlt</h1>
          </kvlm-typo>
        </kvlm-section>
        <kvlm-section
          id="/verein/neues"
          style="
          --kvlm-section-background-from: #525252;
          --kvlm-section-background-to: #101010;
          --kvlm-section-color: var(--kvlm-color-typo-light);
        "
        >
          <kvlm-typo>
            <h1 class="title">Jetzt bei uns</h1>
          </kvlm-typo>
        </kvlm-section>
        <kvlm-section
          id="/verein/bisher"
          style="
          --kvlm-section-background-from: #525252;
          --kvlm-section-background-to: #101010;
          --kvlm-section-color: var(--kvlm-color-typo-light);
        "
        >
          <kvlm-typo>
            <h1 class="title">Was bisher geschah</h1>
          </kvlm-typo>
        </kvlm-section>
      </kvlm-main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-page-verein': VereinPage;
  }
}
