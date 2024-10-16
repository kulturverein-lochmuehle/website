import '../../../../../dist/components/features/navigation/navigation-item/navigation-item.component.js';

import { ssrFixture } from '@lit-labs/testing/fixtures.js';
import { expect, fixture, html } from '@open-wc/testing';

import type { NavigationItem } from './navigation-item.component.js';

describe('Navigation Item', () => {
  it('renders with shadow dom', async () => {
    const el = await fixture<NavigationItem>(
      html`<kvlm-navigation-item>Foo</kvlm-navigation-item>`,
    );

    expect(el.shadowRoot).not.to.be.null;
  });

  it('renders on server', async () => {
    const el = await ssrFixture<NavigationItem>(
      html`<kvlm-navigation-item>Foo</kvlm-navigation-item>`,
      {
        modules: [
          '../../../../../dist/components/features/navigation/navigation-item/navigation-item.component.js',
        ],
      },
    );
    expect(el.shadowRoot?.querySelector('a')).not.to.be.null;
  });
});
