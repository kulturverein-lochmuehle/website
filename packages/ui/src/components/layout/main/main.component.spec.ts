import '../../../../dist/components/layout/main/main.component.js';

import { ssrFixture } from '@lit-labs/testing/fixtures.js';
import { expect, fixture, html } from '@open-wc/testing';

import type { Main } from './main.component.js';

describe('Main', () => {
  it('renders with shadow dom', async () => {
    const el = await fixture<Main>(html`<kvlm-main></kvlm-main>`);

    expect(el.shadowRoot).not.to.be.null;
  });

  it('renders on server', async () => {
    const el = await ssrFixture<Main>(html`<kvlm-main></kvlm-main>`, {
      modules: ['../../../../dist/components/layout/main/main.component.js']
    });
    expect(el.shadowRoot?.querySelector('slot')).not.to.be.null;
  });
});
