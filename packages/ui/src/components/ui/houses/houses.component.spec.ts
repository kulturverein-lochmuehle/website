import { ssrFixture } from '@lit-labs/testing/fixtures.js';
import { html, fixture, expect } from '@open-wc/testing';

import type { Houses } from './houses.component';
import '../../../../dist/components/ui/houses/houses.component.js';

describe('Houses', () => {
  it('renders with shadow dom', async () => {
    const el = await fixture<Houses>(html`<kvlm-houses></kvlm-houses>`);

    expect(el.shadowRoot).not.to.be.null;
  });

  it('renders on server', async () => {
    const el = await ssrFixture<Houses>(html`<kvlm-houses></kvlm-houses>`, {
      modules: ['../../../../dist/components/ui/houses/houses.component.js']
    });
    expect(el.shadowRoot?.querySelector('img')).not.to.be.null;
  });
});
