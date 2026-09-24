/**
 * Bakes the editor's preview off the page's thread: the model built once, the
 * first time it is asked for, and every preview after set up and baked from
 * it - the very bake the site's views are, gzipped as they are.
 */

import type { ViewSpec } from '@kvlm/visualization';
import { bakeView, buildModel, readPalette, setUpView, viewFrom } from '@kvlm/visualization';

export type PreviewRequest = Parameters<typeof viewFrom>[1];

const palette = readPalette();
let model: Awaited<ReturnType<typeof buildModel>>['model'] | undefined;

self.onmessage = async ({ data }: MessageEvent<PreviewRequest>) => {
  try {
    // the model the first time a third of the way, the bake the rest
    const first = model === undefined;
    const say = (share: number, stage: string) => self.postMessage({ progress: share, stage });
    model ??= (
      await buildModel(palette, (done, of, step) => say((0.3 * done) / of, `building ${step}`))
    ).model;
    const view: ViewSpec = viewFrom(model, data);
    let last = -1;
    const buffer = bakeView(model, view, palette, {
      ...setUpView(model, view, palette),
      progress: (share, stage) => {
        const at = first ? 0.3 + 0.7 * share : share;
        // said every percent, not every step
        if (Math.floor(at * 100) !== last) {
          last = Math.floor(at * 100);
          say(at, stage);
        }
      },
    });
    const packed = await new Response(
      new Blob([buffer]).stream().pipeThrough(new CompressionStream('gzip'))
    ).arrayBuffer();
    self.postMessage({ packed }, { transfer: [packed] });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
