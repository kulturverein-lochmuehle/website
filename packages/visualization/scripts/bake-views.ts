/**
 * Bakes the views of the model the site shows (`VIEWS`): the model built in
 * full here, each view cut down to what its eye can see - or kept whole, for a
 * free one - and written to `views/<name>.view.bin` for the site's scene
 * component to draw as it is, no modelling in the browser at all. And a list
 * of them in `views/manifest.json`, which the site's demo is built from. Each is
 * baked in its own season - another season is another view.
 *
 * Run with `npm run data:views` after changing the model or a view. Run under
 * node, as the terrain's bake is. Given names - `npm run data:views -- loop` -
 * only the views whose names hold one of them are baked again, and the rest
 * keep their files and their place in the list.
 *
 * A view takes up to a minute, and none depends on another - each comes
 * out the same baked alone or after any other - so they are baked side by
 * side: a worker a core, as many as the memory holds, each building the model
 * once and taking the next view due, the largest first. And within a view,
 * what takes longest - what each eye along a path sees - is shared out too:
 * every eye stands on its own, so a view reaching them hands them out in
 * pieces, which whatever worker is free takes before another view, its own
 * among them while it waits. Each view is written as soon as it is done, and
 * said. `BAKE_WORKERS=4 npm run data:views` bakes with as many workers as that.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { availableParallelism, totalmem } from 'node:os';
import { isMainThread, parentPort, threadId, Worker } from 'node:worker_threads';
import { gzipSync } from 'node:zlib';

import { Vector3 } from 'three';

import type { Occluder } from '../src/bake/occlusion.js';
import { visibleFrom } from '../src/bake/occlusion.js';
import type { Sight } from '../src/bake/prefab.js';
import { bakeViewAsync, setUpView } from '../src/bake/prefab.js';
import type { ViewSpec } from '../src/bake/views.js';
import { bakeCost, VIEWS } from '../src/bake/views.js';
import { readPalette } from '../src/scene/palette.js';
import { createModel } from '../src/scene/scene.js';

const OUTPUT = new URL('../views/', import.meta.url);

/**
 * How long each view took the last time it was baked, kept off the record:
 * the longest are started first, so none is left to run on alone at the end.
 */
const TIMES = new URL('../node_modules/.cache/bake-views.json', import.meta.url);

/**
 * How much memory a worker takes at most - the model and a view's bake - and
 * how much is left to the rest of the machine, in bytes. The memory free is
 * no measure: what the system keeps cached counts as taken.
 */
const MEMORY = { worker: 3 * 1024 ** 3, kept: 8 * 1024 ** 3 };

/** How long a view never baked here might take, from what it is. */
const guess = (name: string) => bakeCost((VIEWS as Record<string, ViewSpec>)[name] as ViewSpec);

/** Into how many pieces a view's eyes are shared out, for each worker there is. */
const PIECES = 2;

/**
 * A sight as it crosses between threads: every triangle's corners, nine
 * numbers each, and whether it is pulled - in memory the threads share, the
 * numbers as they are, so every thread tests the very same triangles - and
 * each eye as six: where it stands, and the way it looks.
 */
interface Shared {
  corners: Float64Array;
  pulled: Uint8Array;
  eyes: number[][];
  size: number | undefined;
}

/** What the main thread asks of a worker. */
type Asked =
  | { kind: 'view'; name: string }
  | { kind: 'look'; job: string; shared: Shared; from: number; to: number }
  | { kind: 'saw'; job: string; seen: Uint8Array }
  | { kind: 'drop'; job: string };

/** And what a worker tells it. */
type Told =
  | { kind: 'ready' }
  | { kind: 'sight'; job: string; shared: Shared }
  | { kind: 'seen'; job: string; seen: Uint8Array }
  | {
      kind: 'baked';
      name: string;
      triangles: number;
      groups: number;
      bytes: number;
      packed: number;
      took: number;
    };

/**
 * An entry of the bake's manifest, as the site reads it: the view, its file,
 * what it holds, and the file's size as it is served - packed, which is what
 * a page loading it counts against where the host sends no length.
 */
interface Listed {
  name: string;
  title: string;
  kind: ViewSpec['kind'];
  loop: boolean;
  season: ViewSpec['season'];
  file: string;
  triangles: number;
  groups: number;
  /** The file's size, packed - as it is served. */
  bytes: number;
}

if (isMainThread) {
  const started = performance.now();
  await mkdir(OUTPUT, { recursive: true });
  const only = process.argv.slice(2);
  const before = await readFile(new URL('manifest.json', OUTPUT), 'utf8')
    .then(text => JSON.parse(text) as Listed[])
    .catch(() => [] as Listed[]);
  const times = await readFile(TIMES, 'utf8')
    .then(text => JSON.parse(text) as Record<string, number>)
    .catch(() => ({}) as Record<string, number>);
  // the longest first, as the last bake took them - or, never baked here, as
  // long as what it is says it takes: what is left at the end is short
  const due = Object.keys(VIEWS)
    .filter(name => only.length === 0 || only.some(part => name.includes(part)))
    .sort((one, other) => (times[other] ?? guess(other)) - (times[one] ?? guess(one)));
  const total = due.length;
  const count =
    Number(process.env['BAKE_WORKERS']) ||
    Math.max(
      1,
      Math.min(
        total,
        availableParallelism() - 2,
        Math.floor((totalmem() - MEMORY.kept) / MEMORY.worker)
      )
    );
  console.log(`baking ${total} views in ${count} workers`);

  /**
   * Each worker, and what it is on: nothing, a view, or a view whose eyes
   * it waits for - which leaves it free to look for others - and whether it
   * is looking through a piece of eyes now.
   */
  const workers = Array.from({ length: count }, () => ({
    // run as this file is, the loader for its types registered first: hooks
    // registered on the main thread do not reach a worker, and not every node
    // hands a worker the flags it was started with
    worker: new Worker(
      `import(${JSON.stringify(import.meta.resolve('tsx/esm/api'))})` +
        `.then(({ register }) => (register(), import(${JSON.stringify(import.meta.url)})));`,
      { eval: true, execArgv: [] }
    ),
    on: 'starting' as 'starting' | 'idle' | 'view' | 'waiting',
    looking: false,
  }));
  /** The eyes shared out, piece by piece, and for each view waiting what they saw so far. */
  const pieces: { job: string; shared: Shared; from: number; to: number }[] = [];
  const jobs = new Map<
    string,
    { owner: (typeof workers)[number]; seen: Uint8Array; left: number }
  >();
  const baked: Listed[] = [];

  await new Promise<void>((resolve, reject) => {
    /** Hands out what is due: pieces of eyes before views, and ends when nothing is left. */
    const dispatch = () => {
      workers.forEach(one => {
        if ((one.on !== 'idle' && one.on !== 'waiting') || one.looking) {
          return;
        }
        const piece = pieces.shift();
        if (piece !== undefined) {
          one.looking = true;
          one.worker.postMessage({ kind: 'look', ...piece } satisfies Asked);
          return;
        }
        const name = one.on === 'idle' ? due.shift() : undefined;
        if (name !== undefined) {
          one.on = 'view';
          one.worker.postMessage({ kind: 'view', name } satisfies Asked);
        }
      });
      if (
        due.length === 0 &&
        pieces.length === 0 &&
        workers.every(({ on, looking }) => on === 'idle' && !looking)
      ) {
        void Promise.all(workers.map(({ worker }) => worker.terminate())).then(() => resolve());
      }
    };
    workers.forEach(one => {
      one.worker.on('error', reject);
      one.worker.on('message', (told: Told) => {
        if (told.kind === 'ready') {
          one.on = 'idle';
        } else if (told.kind === 'sight') {
          // its eyes in pieces, a few for every worker there is
          const eyes = told.shared.eyes.length;
          const step = Math.max(1, Math.ceil(eyes / (count * PIECES)));
          const starts = Array.from({ length: Math.ceil(eyes / step) }, (_, piece) => piece * step);
          starts.forEach(from =>
            pieces.push({ job: told.job, shared: told.shared, from, to: from + step })
          );
          jobs.set(told.job, {
            owner: one,
            seen: new Uint8Array(told.shared.pulled.length),
            left: starts.length,
          });
          one.on = 'waiting';
        } else if (told.kind === 'seen') {
          one.looking = false;
          const job = jobs.get(told.job);
          if (job !== undefined) {
            told.seen.forEach((kept, at) => {
              if (kept === 1) {
                job.seen[at] = 1;
              }
            });
            job.left -= 1;
            if (job.left === 0) {
              jobs.delete(told.job);
              job.owner.on = 'view';
              job.owner.worker.postMessage(
                { kind: 'saw', job: told.job, seen: job.seen } satisfies Asked,
                [job.seen.buffer as ArrayBuffer]
              );
              workers.forEach(({ worker }) =>
                worker.postMessage({ kind: 'drop', job: told.job } satisfies Asked)
              );
            }
          }
        } else {
          one.on = 'idle';
          const view = (VIEWS as Record<string, ViewSpec>)[told.name] as ViewSpec;
          times[told.name] = Math.round(told.took);
          baked.push({
            name: told.name,
            title: view.title,
            kind: view.kind,
            loop: 'loop' in view && view.loop === true,
            season: view.season,
            file: `${told.name}.view.bin`,
            triangles: told.triangles,
            groups: told.groups,
            bytes: told.packed,
          });
          console.log(
            `[${baked.length}/${total}] ${told.name}: ` +
              `${told.triangles} triangles in ${told.groups} groups, ` +
              `${Math.round(told.bytes / 1024)} KiB, ${Math.round(told.packed / 1024)} KiB packed, ` +
              `${Math.round(told.took / 1000)}s`
          );
        }
        dispatch();
      });
    });
  });

  // the list in the order the views are set out, the ones not baked again as they were
  const listing = Object.keys(VIEWS).flatMap(
    name => [...baked, ...before].find(entry => entry.name === name) ?? []
  );
  await writeFile(new URL('manifest.json', OUTPUT), `${JSON.stringify(listing, null, 2)}\n`);
  await mkdir(new URL('.', TIMES), { recursive: true });
  await writeFile(TIMES, `${JSON.stringify(times, null, 2)}\n`);
  console.log(`baked in ${Math.round((performance.now() - started) / 1000)}s`);
} else {
  const port = parentPort;
  // the woods, the windows and the snow set for each view before it is baked
  const palette = readPalette();
  const { model } = createModel(palette);
  /** The triangles of each sight being looked at here, made once for all its pieces. */
  const looked = new Map<string, Occluder[]>();
  /** The views here waiting for what their eyes saw. */
  const waiting = new Map<string, (seen: boolean[]) => void>();
  let jobs = 0;

  /** A sight's triangles from what crossed over, the very numbers they were. */
  const occluders = ({ corners, pulled }: Shared): Occluder[] =>
    Array.from(pulled, (pull, triangle) => ({
      corners: [0, 1, 2].map(k =>
        new Vector3().fromArray(corners, triangle * 9 + k * 3)
      ) as Occluder['corners'],
      pulled: pull === 1,
    }));

  /** Shares a view's sight out through the main thread, and waits for what was seen. */
  const sees = ({ eyes, triangles, size }: Sight) =>
    new Promise<boolean[]>(resolve => {
      const job = `${threadId}:${(jobs += 1)}`;
      const corners = new Float64Array(new SharedArrayBuffer(triangles.length * 9 * 8));
      const pulled = new Uint8Array(new SharedArrayBuffer(triangles.length));
      triangles.forEach(({ corners: three, pulled: pull }, triangle) => {
        three.forEach((corner, k) => corner.toArray(corners, triangle * 9 + k * 3));
        pulled[triangle] = pull ? 1 : 0;
      });
      // its own pieces looked at with the triangles it has
      looked.set(job, triangles);
      waiting.set(job, resolve);
      const shared: Shared = {
        corners,
        pulled,
        eyes: eyes.map(({ at, forward }) => [...at.toArray(), ...forward.toArray()]),
        size,
      };
      port?.postMessage({ kind: 'sight', job, shared } satisfies Told);
    });

  port?.on('message', async (asked: Asked) => {
    if (asked.kind === 'look') {
      const triangles = looked.get(asked.job) ?? occluders(asked.shared);
      looked.set(asked.job, triangles);
      const seen = new Uint8Array(triangles.length);
      asked.shared.eyes.slice(asked.from, asked.to).forEach(eye => {
        const [ax, ay, az, fx, fy, fz] = eye as [number, number, number, number, number, number];
        visibleFrom(
          new Vector3(ax, ay, az),
          new Vector3(fx, fy, fz),
          triangles,
          asked.shared.size
        ).forEach((kept, at) => {
          if (kept) {
            seen[at] = 1;
          }
        });
      });
      port.postMessage({ kind: 'seen', job: asked.job, seen } satisfies Told, [seen.buffer]);
      return;
    }
    if (asked.kind === 'saw') {
      waiting.get(asked.job)?.(Array.from(asked.seen, kept => kept === 1));
      waiting.delete(asked.job);
      return;
    }
    if (asked.kind === 'drop') {
      looked.delete(asked.job);
      return;
    }
    const started = performance.now();
    const view = (VIEWS as Record<string, ViewSpec>)[asked.name] as ViewSpec;
    const buffer = await bakeViewAsync(model, view, palette, {
      ...setUpView(model, view, palette),
      sees,
    });
    const packed = gzipSync(new Uint8Array(buffer), { level: 9 });
    await writeFile(new URL(`${asked.name}.view.bin`, OUTPUT), packed);
    const header = JSON.parse(
      new TextDecoder().decode(new Uint8Array(buffer, 8, new DataView(buffer).getUint32(4, true)))
    ) as { groups: { indices: number }[] };
    port.postMessage({
      kind: 'baked',
      name: asked.name,
      triangles: header.groups.reduce((sum, { indices }) => sum + indices / 3, 0),
      groups: header.groups.length,
      bytes: buffer.byteLength,
      packed: packed.byteLength,
      took: performance.now() - started,
    } satisfies Told);
  });
  port?.postMessage({ kind: 'ready' } satisfies Told);
}
