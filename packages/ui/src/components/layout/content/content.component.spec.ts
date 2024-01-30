import '../../../../dist/components/layout/content/content.component.js';

import { ssrFixture } from '@lit-labs/testing/fixtures.js';
import { expect, fixture, html } from '@open-wc/testing';

import type { Content } from './content.component.js';

describe('Content', () => {
  it('renders with shadow dom', async () => {
    const el = await fixture<Content>(html`<kvlm-content></kvlm-content>`);

    expect(el.shadowRoot).not.to.be.null;
  });

  it('renders on server', async () => {
    const el = await ssrFixture<Content>(html`<kvlm-content></kvlm-content>`, {
      modules: ['../../../../dist/components/layout/content/content.component.js']
    });
    expect(el.shadowRoot?.querySelector('article')).not.to.be.null;
  });
});
