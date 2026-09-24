import { SEAM_PICKS } from '@kvlm/visualization';
import { expect } from '@open-wc/testing';
import type { Line, Material } from 'three';

import { createPicks, createTrace, markTrace } from './editor.overlays.js';

describe('the seam overlay', () => {
  it('should give every handle a dot to click on', () => {
    expect(createPicks().children).to.have.lengthOf(SEAM_PICKS.length);
  });

  it('should close a path into a seam of its own', () => {
    const group = createTrace();
    markTrace(group, [4], [[0, 1, 2]]);

    expect(group.children).to.have.lengthOf(1);
    const drawn = (group.children[0] as Line).material as Material;

    expect(drawn.type).to.equal('LineBasicMaterial');
  });
});
