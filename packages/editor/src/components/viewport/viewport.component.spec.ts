import './viewport.component.js';

import { BUILDINGS } from '@kvlm/visualization';
import { expect, fixture, html } from '@open-wc/testing';

import type { EditorViewport } from './viewport.component.js';

describe('kvlm-editor-viewport', () => {
  it('should carry the three buildings of the Lochmühle', () => {
    expect(BUILDINGS).to.have.lengthOf(3);
    expect(BUILDINGS.map(({ name }) => name)).to.contain('Lochmühle');
  });

  it('should render a canvas to draw into', async () => {
    const element = await fixture<EditorViewport>(
      html`<kvlm-editor-viewport></kvlm-editor-viewport>`
    );

    expect(element.shadowRoot?.querySelector('canvas')).to.exist;
  });

  it('should take the camera properties as attributes', async () => {
    const element = await fixture<EditorViewport>(
      html`<kvlm-editor-viewport azimuth="90" elevation="45" span="200"></kvlm-editor-viewport>`
    );

    expect(element.azimuth).to.equal(90);
    expect(element.elevation).to.equal(45);
    expect(element.span).to.equal(200);
  });
});
