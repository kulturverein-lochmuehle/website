import '../../../../dist/components/layout/section/section.component.js';

import { ssrFixture } from '@lit-labs/testing/fixtures.js';
import { expect, fixture, html } from '@open-wc/testing';

import type { Section } from './section.component.js';

describe('Section', () => {
  it('renders with shadow dom', async () => {
    const el = await fixture<Section>(html`<kvlm-section></kvlm-section>`);

    expect(el.shadowRoot).not.to.be.null;
  });

  it('renders on server', async () => {
    const el = await ssrFixture<Section>(html`<kvlm-section></kvlm-section>`, {
      modules: ['../../../../dist/components/layout/section/section.component.js']
    });
    expect(el.shadowRoot?.querySelector('section')).not.to.be.null;
  });
});
