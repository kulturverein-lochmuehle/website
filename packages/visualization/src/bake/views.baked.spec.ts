import { expect } from '@open-wc/testing';

import type { ViewSpec } from './views.js';
import { bakeCost, VIEWS } from './views.js';

// The baked views compared with the model, every one baked afresh: a minute
// and a half and more, so not part of `npm test` - `npm run test:views` runs
// it, after a change to the model or a view.

/**
 * How many workers bake side by side at most. Each holds the whole model,
 * and the workers of one page share its heap, however much memory the
 * machine has: five and six ran out of it, four held, three leave room.
 */
const WORKERS = 3;

/** Every baked view, by the file it was written to. */
const BAKED = import.meta.glob<string>('../../views/*.view.bin', {
  query: '?url',
  import: 'default',
  eager: true,
});

describe('the baked views', () => {
  // the whole model built in each of a few workers, and the views baked across
  // them, the longest first - a view is the same baked alone or after any
  // other, which is what lets the bake script share them out too
  const baked = new Map<string, Promise<Uint8Array>>();
  let workers: Worker[] = [];
  before(() => {
    const due = Object.entries<ViewSpec>(VIEWS)
      .sort(([, one], [, other]) => bakeCost(other) - bakeCost(one))
      .map(([name]) => name);
    const settle = new Map<
      string,
      { resolve: (buffer: Uint8Array) => void; reject: (error: unknown) => void }
    >();
    due.forEach(name =>
      baked.set(
        name,
        new Promise<Uint8Array>((resolve, reject) => settle.set(name, { resolve, reject }))
      )
    );
    // what each worker is on, for a crash - its memory run out - to fail that view, not hang it
    const on = new Map<Worker, string>();
    // every worker holds a model of its own, in the one page: a few, not one a core
    workers = Array.from(
      { length: Math.min(Math.max(navigator.hardwareConcurrency - 2, 1), WORKERS, due.length) },
      () => {
        const worker = new Worker(new URL('./views.baked.worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.onmessage = ({ data }: MessageEvent<{ name: string; buffer: ArrayBuffer }>) => {
          settle.get(data.name)?.resolve(new Uint8Array(data.buffer));
          next(worker);
        };
        worker.onerror = event => {
          settle.get(on.get(worker) ?? '')?.reject(new Error(`baking: ${event.message}`));
          next(worker);
        };
        return worker;
      }
    );
    const next = (worker: Worker) => {
      const name = due.shift();
      if (name !== undefined) {
        on.set(worker, name);
        worker.postMessage(name);
      }
    };
    workers.forEach(next);
  });
  after(() => workers.forEach(worker => worker.terminate()));

  Object.keys(VIEWS).forEach(name =>
    it(`should bake ${name} from the model as it stands`, async function () {
      // waiting its turn among the rest: the whole bake, at most
      this.timeout(600000);
      const fresh = await (baked.get(name) as Promise<Uint8Array>);

      const url = BAKED[`../../views/${name}.view.bin`];
      expect(url, 'not baked: run npm run data:views').to.exist;
      const response = await fetch(url as string);
      const stored = new Uint8Array(
        await new Response(
          response.body?.pipeThrough(new DecompressionStream('gzip')) ?? null
        ).arrayBuffer()
      );

      expect(stored.byteLength, 'stale: run npm run data:views').to.equal(fresh.byteLength);
      expect(
        stored.every((byte, at) => byte === fresh[at]),
        'stale: run npm run data:views'
      ).to.be.true;
    })
  );
});
