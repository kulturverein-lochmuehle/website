/**
 * Bakes the views of the model the site shows (`VIEWS`): the model built in
 * full here, each view cut down to what its eye can see - or kept whole, for a
 * free one - and written to `views/<name>.view.bin` for the site's scene
 * component to draw as it is, no modelling in the browser at all. And a list
 * of them in `views/index.json`, which the site's demo is built from. Each is
 * baked in every season (`BAKED_SEASONS`): summer to its own name, the others
 * to `<name>.<season>.view.bin`.
 *
 * Run with `npm run data:views` after changing the model or a view. Run under
 * node, as the terrain's bake is.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

import { bakeView } from '../src/bake/prefab.js';
import { BAKED_SEASONS, viewFile, VIEWS } from '../src/bake/views.js';
import { seasonTrees } from '../src/models/terrain/trees.js';
import { readPalette } from '../src/scene/palette.js';
import { createModel } from '../src/scene/scene.js';

const OUTPUT = new URL('../views/', import.meta.url);

const started = performance.now();
const palette = readPalette();
const { model } = createModel(palette);
const trees = model.getObjectByName('trees');
await mkdir(OUTPUT, { recursive: true });
// each view in each season written, and listed with what the site shows
// beside it - the woods and the snow set for the season before its bakes
const listed = BAKED_SEASONS.flatMap(season => {
  if (trees !== undefined) {
    seasonTrees(trees, palette, season);
  }
  const snow = season === 'winter' ? 1 : 0;
  return Object.entries(VIEWS).map(([name, view]) => {
    const buffer = bakeView(model, view, palette, { snow });
    const packed = gzipSync(new Uint8Array(buffer), { level: 9 });
    return { name, season, view, buffer, packed };
  });
});
await Promise.all(
  listed.map(({ name, season, packed }) =>
    writeFile(new URL(viewFile(name, season), OUTPUT), packed)
  )
);
const index = Object.entries(VIEWS).map(([name, view]) => {
  const seasons = listed.filter(one => one.name === name);
  const summer = seasons.find(({ season }) => season === 'summer');
  const measured = seasons.map(({ season, buffer, packed }) => {
    const header = JSON.parse(
      new TextDecoder().decode(new Uint8Array(buffer, 8, new DataView(buffer).getUint32(4, true)))
    ) as { groups: { indices: number }[] };
    const triangles = header.groups.reduce((sum, { indices }) => sum + indices / 3, 0);
    console.log(
      `${name} (${season}): ${triangles} triangles in ${header.groups.length} groups, ` +
        `${Math.round(buffer.byteLength / 1024)} KiB, ${Math.round(packed.byteLength / 1024)} KiB packed`
    );
    return { season, triangles, groups: header.groups.length, bytes: packed.byteLength };
  });
  const own = measured.find(({ season }) => season === summer?.season) ?? measured[0];
  return {
    name,
    title: view.title,
    kind: view.kind,
    file: viewFile(name, 'summer'),
    triangles: own?.triangles ?? 0,
    groups: own?.groups ?? 0,
    bytes: own?.bytes ?? 0,
    // the same view in every season, by the file it is drawn from
    seasons: Object.fromEntries(
      measured.map(({ season, triangles, bytes }) => [
        season,
        { file: viewFile(name, season), triangles, bytes },
      ])
    ),
  };
});
await writeFile(new URL('index.json', OUTPUT), `${JSON.stringify(index, null, 2)}\n`);
console.log(`baked in ${Math.round(performance.now() - started)}ms`);
