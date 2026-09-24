import { expect } from '@open-wc/testing';

import { seasonTrees } from '../models/terrain/trees.js';
import { readPalette } from '../scene/palette.js';
import { createModel } from '../scene/scene.js';
import { bakeView } from './prefab.js';
import { BAKED_SEASONS, viewFile, VIEWS } from './views.js';

/** Every baked view, by the file it was written to. */
const BAKED = import.meta.glob<string>('../../views/*.view.bin', {
  query: '?url',
  import: 'default',
  eager: true,
});

describe('the baked views', () => {
  // the whole model built once, which takes a moment, and set for each
  // season in turn - in the order the bake sets it
  const palette = readPalette();
  let model: ReturnType<typeof createModel>['model'];
  before(function () {
    this.timeout(180000);
    ({ model } = createModel(palette));
  });

  BAKED_SEASONS.forEach(season =>
    Object.entries(VIEWS).forEach(([name, view]) =>
      it(`should bake ${name} in ${season} from the model as it stands`, async function () {
        this.timeout(180000);
        const trees = model.getObjectByName('trees');
        if (trees !== undefined) {
          seasonTrees(trees, palette, season);
        }
        const fresh = new Uint8Array(
          bakeView(model, view, palette, { snow: season === 'winter' ? 1 : 0 })
        );

        const url = BAKED[`../../views/${viewFile(name, season)}`];
        expect(url, 'not baked: run npm run data:views').to.exist;
        const response = await fetch(url as string);
        const baked = new Uint8Array(
          await new Response(
            response.body?.pipeThrough(new DecompressionStream('gzip')) ?? null
          ).arrayBuffer()
        );

        expect(baked.byteLength, 'stale: run npm run data:views').to.equal(fresh.byteLength);
        expect(
          baked.every((byte, at) => byte === fresh[at]),
          'stale: run npm run data:views'
        ).to.be.true;
      })
    )
  );
});
