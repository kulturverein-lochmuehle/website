/**
 * Bakes the views of the model the site shows (`VIEWS`): the model built in
 * full here, each view cut down to what its eye can see - or kept whole, for a
 * free one - and written to `views/<name>.view.bin` for the site's scene
 * component to draw as it is, no modelling in the browser at all. And a list
 * of them in `views/index.json`, which the site's demo is built from.
 *
 * Run with `npm run data:views` after changing the model or a view. Run under
 * node, as the terrain's bake is.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

import { bakeView } from '../src/bake/prefab.js';
import { VIEWS } from '../src/bake/views.js';
import { readPalette } from '../src/scene/palette.js';
import { createModel } from '../src/scene/scene.js';

const OUTPUT = new URL('../views/', import.meta.url);

const started = performance.now();
const palette = readPalette();
const { model } = createModel(palette);
await mkdir(OUTPUT, { recursive: true });
// each view written, and listed with what the site shows beside it
const listed = Object.entries(VIEWS).map(([name, view]) => {
  const buffer = bakeView(model, view, palette);
  const packed = gzipSync(new Uint8Array(buffer), { level: 9 });
  return { name, view, buffer, packed };
});
await Promise.all(
  listed.map(({ name, packed }) => writeFile(new URL(`${name}.view.bin`, OUTPUT), packed))
);
const index = listed.map(({ name, view, buffer, packed }) => {
  const header = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 8, new DataView(buffer).getUint32(4, true)))
  ) as { groups: { indices: number }[] };
  const triangles = header.groups.reduce((sum, { indices }) => sum + indices / 3, 0);
  console.log(
    `${name}: ${triangles} triangles in ${header.groups.length} groups, ` +
      `${Math.round(buffer.byteLength / 1024)} KiB, ${Math.round(packed.byteLength / 1024)} KiB packed`
  );
  return {
    name,
    title: view.title,
    kind: view.kind,
    file: `${name}.view.bin`,
    triangles,
    groups: header.groups.length,
    bytes: packed.byteLength,
  };
});
await writeFile(new URL('index.json', OUTPUT), `${JSON.stringify(index, null, 2)}\n`);
console.log(`baked in ${Math.round(performance.now() - started)}ms`);
