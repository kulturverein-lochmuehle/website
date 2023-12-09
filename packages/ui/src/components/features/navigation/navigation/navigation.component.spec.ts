import '../../../../../dist/components/features/navigation/navigation/navigation.component.js';

import { ssrFixture } from '@lit-labs/testing/fixtures.js';
import { expect, fixture, html } from '@open-wc/testing';

import type { Navigation } from './navigation.component.js';

describe('Navigation', () => {
  it('renders with shadow dom', async () => {
    const el = await fixture<Navigation>(html`<kvlm-navigation></kvlm-navigation>`);

    expect(el.shadowRoot).not.to.be.null;
  });

  it('renders on server', async () => {
    const el = await ssrFixture<Navigation>(html`<kvlm-navigation></kvlm-navigation>`, {
      modules: [
        '../../../../../dist/components/features/navigation/navigation/navigation.component.js'
      ]
    });
    expect(el.shadowRoot?.querySelector('nav')).not.to.be.null;
  });
});
