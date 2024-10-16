import '../../../../dist/components/layout/section/section.component.js';

import { ssrFixture } from '@lit-labs/testing/fixtures.js';
import { expect, fixture, html } from '@open-wc/testing';

import type { Layout } from './layout.component.js';

describe('Layout', () => {
  it('renders with shadow dom', async () => {
    const el = await fixture<Layout>(html`<kvlm-layout></kvlm-layout>`);

    expect(el.shadowRoot).not.to.be.null;
  });

  it('renders on server', async () => {
    const el = await ssrFixture<Layout>(html`<kvlm-layout></kvlm-layout>`, {
      modules: ['../../../../dist/components/layout/layout/layout.component.js'],
    });
    expect(el.shadowRoot?.querySelector('slot')).not.to.be.null;
  });
});
