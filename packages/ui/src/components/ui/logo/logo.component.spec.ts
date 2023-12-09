import '../../../../dist/components/ui/logo/logo.component.js';

import { ssrFixture } from '@lit-labs/testing/fixtures.js';
import { expect, fixture, html } from '@open-wc/testing';

import type { Logo } from './logo.component.js';

describe('Logo', () => {
  it('renders with shadow dom', async () => {
    const el = await fixture<Logo>(html`<kvlm-logo></kvlm-logo>`);

    expect(el.shadowRoot).not.to.be.null;
  });

  it('renders on server', async () => {
    const el = await ssrFixture<Logo>(html`<kvlm-logo></kvlm-logo>`, {
      modules: ['../../../../dist/components/ui/logo/logo.component.js']
    });
    expect(el.shadowRoot?.querySelector('svg')).not.to.be.null;
  });
});
