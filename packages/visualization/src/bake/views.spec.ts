import { expect } from '@open-wc/testing';

import { readPalette } from '../scene/palette.js';
import { createModel } from '../scene/scene.js';
import { bakeView } from './prefab.js';
import { VIEWS } from './views.js';

/** Every baked view, by the file it was written to. */
const BAKED = import.meta.glob<string>('../../views/*.view.bin', {
  query: '?url',
  import: 'default',
  eager: true,
});

describe('the baked views', () => {
  Object.entries(VIEWS).forEach(([name, view]) =>
    it(`should bake ${name} from the model as it stands`, async function () {
      // the whole model is built for this, which takes a moment
      this.timeout(60000);
      const palette = readPalette();
      const { model } = createModel(palette);
      const fresh = new Uint8Array(bakeView(model, view, palette));

      const url = BAKED[`../../views/${name}.view.bin`];
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
  );
});
