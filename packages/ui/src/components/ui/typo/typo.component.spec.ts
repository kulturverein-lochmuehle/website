import { ssrFixture } from '@lit-labs/testing/fixtures.js';
import { html, fixture, expect } from '@open-wc/testing';

import type { Typo } from './typo.component';
import '../../../../dist/components/ui/typo/typo.component.js';

describe('Logo', () => {
  it('renders without shadow dom', async () => {
    const el = await fixture<Typo>(html`<kvlm-typo></kvlm-typo>`);

    expect(el.shadowRoot).to.be.null;
  });

  it('renders on server', async () => {
    const el = await ssrFixture<Typo>(html`
      <kvlm-typo>
        <h1 class="title">Heading 1</h1>
        <p class="info">Paragraph</p>
      </kvlm-typo>
    `, {
      modules: ['../../../../dist/components/ui/typo/typo.component.js']
    });
    expect(el.querySelector('style')).not.to.be.null;
  });
});
