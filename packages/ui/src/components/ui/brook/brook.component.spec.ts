import { ssrFixture } from '@lit-labs/testing/fixtures.js';
import { html, fixture, expect } from '@open-wc/testing';

import type { Brook } from './brook.component';
import '../../../../dist/components/ui/brook/brook.component.js';

describe('Brook', () => {
  it('renders with shadow dom', async () => {
    const el = await fixture<Brook>(html`<kvlm-brook></kvlm-brook>`);

    expect(el.shadowRoot).not.to.be.null;
  });

  it('renders on server', async () => {
    const el = await ssrFixture<Brook>(html`<kvlm-brook></kvlm-brook>`, {
      modules: ['../../../../dist/components/ui/brook/brook.component.js']
    });
    expect(el.shadowRoot?.querySelector('svg')).not.to.be.null;
  });
});
