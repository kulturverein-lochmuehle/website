/**
 * Fetches where the trees stand, from the survey's own scans: the DOM1 less the
 * DGM1 is how tall whatever stands on the ground is, and in the woods that is
 * the canopy. Every top of it is a tree - where, how tall, and how far its
 * crown reaches before the next one's starts - and that is written as a plain
 * data module, the way the rest of the data is.
 *
 * Run with `bun run data:trees`.
 *
 * Sources:
 * - DGM1 and DOM1, © Landesamt für Geobasisinformation Sachsen, dl-de/by-2-0
 */

import { writeFile } from 'node:fs/promises';

import { YARD_CENTER } from '../src/models/buildings/footprint.js';
import { TERRAIN_RADIUS } from '../src/models/terrain/terrain.field.js';
import { surveyModel } from './geosn.js';

const OUTPUT = new URL('../src/data/trees.baked.ts', import.meta.url);

/** How far past the terrain's rim the canopy is read, so the rim's trees are whole. */
const MARGIN = 12;

/**
 * What counts as a tree's top: at least this tall, the highest point of the
 * smoothed canopy within a reach that grows with the height - a tall crown is a
 * wide one, and a small bump on it is not a tree of its own.
 */
const TOP = {
  least: 2.5,
  reach: (height: number) => Math.min(Math.max(1.5 + 0.1 * height, 2), 4.5),
};

/**
 * And not a wire: a top stands on a crown, so most of the samples round it are
 * at least half its height. A power line strung over a field is one sample
 * wide and leaves a line of lone maxima otherwise.
 */
const CROWN_SHARE = 0.75;

/**
 * Where the crown ends: where the canopy has dropped under this share of the
 * top's height, looked for along eight directions - but never past this share
 * of the way to the next top, in a closed canopy the drop never comes.
 */
const CROWN = { drop: 0.55, toNext: 0.6, least: 1.5, most: 6, look: 12 };

const [cx, cy] = YARD_CENTER;
const reach = TERRAIN_RADIUS + MARGIN;
const size = Math.ceil(reach) * 2;
const [west, north] = [Math.round(cx) - size / 2, Math.round(cy) + size / 2];

const ground = surveyModel('dgm1');
const surface = surveyModel('dom1');

// the canopy's height on the survey's own meter grid, row by row from the north
const canopy = new Float32Array(size * size);
for (let row = 0; row < size; row += 1) {
  for (let column = 0; column < size; column += 1) {
    const [x, y] = [west + column + 0.5, north - row - 0.5];
    const height = (await surface(x, y)) - (await ground(x, y));
    canopy[row * size + column] = Number.isFinite(height) ? Math.max(height, 0) : 0;
  }
}

// smoothed once, so the top of a crown is one sample and not the tallest leaf
const kernel = [-3, -2, -1, 0, 1, 2, 3].map(offset => Math.exp(-(offset ** 2) / 2));
const total = kernel.reduce((sum, weight) => sum + weight, 0);
const blur = (source: Float32Array, across: boolean) =>
  source.map((_, index) => {
    const [row, column] = [Math.floor(index / size), index % size];
    return (
      kernel.reduce((sum, weight, k) => {
        const [r, c] = across ? [row, column + k - 3] : [row + k - 3, column];
        const clamped =
          Math.min(Math.max(r, 0), size - 1) * size + Math.min(Math.max(c, 0), size - 1);
        return sum + weight * (source[clamped] ?? 0);
      }, 0) / total
    );
  });
const smooth = blur(blur(canopy, true), false);
const at = (row: number, column: number) =>
  row < 0 || column < 0 || row >= size || column >= size ? 0 : (smooth[row * size + column] ?? 0);

/** The samples within a radius of one, as offsets. */
const disc = (radius: number) =>
  Array.from({ length: (2 * radius + 1) ** 2 }, (_, k): [number, number] => [
    Math.floor(k / (2 * radius + 1)) - radius,
    (k % (2 * radius + 1)) - radius,
  ]).filter(([r, c]) => r * r + c * c <= radius * radius && (r !== 0 || c !== 0));

const tops = Array.from({ length: size * size }, (_, index) => index).flatMap(index => {
  const [row, column] = [Math.floor(index / size), index % size];
  const height = at(row, column);
  if (height < TOP.least) {
    return [];
  }
  const around = disc(Math.round(TOP.reach(height)));
  if (around.some(([r, c]) => at(row + r, column + c) >= height)) {
    return [];
  }
  const near = disc(2);
  if (
    near.filter(([r, c]) => at(row + r, column + c) > height / 2).length <
    near.length * CROWN_SHARE
  ) {
    return [];
  }
  const [x, y] = [west + column + 0.5, north - row - 0.5];
  if (Math.hypot(x - cx, y - cy) > reach) {
    return [];
  }
  // how far the crown reaches before it has dropped away, the median of eight
  const reaches = Array.from({ length: 8 }, (_, k) => {
    const [dx, dy] = [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)];
    const out = Array.from({ length: CROWN.look }, (_, step) => step + 1).find(
      step => at(Math.round(row - dy * step), Math.round(column + dx * step)) < height * CROWN.drop
    );
    return out ?? CROWN.look;
  }).sort((a, b) => a - b);
  const dropped = ((reaches[3] as number) + (reaches[4] as number)) / 2;
  // the height is the scan's own, not the smoothed one
  return [{ x, y, height: canopy[index] ?? height, dropped }];
});

const trees = tops.map(({ x, y, height, dropped }, index) => {
  const next = tops.reduce(
    (nearest, other, k) =>
      k === index ? nearest : Math.min(nearest, Math.hypot(other.x - x, other.y - y)),
    Infinity
  );
  const crown = Math.min(Math.max(Math.min(dropped, next * CROWN.toNext), CROWN.least), CROWN.most);
  return [x, y, height, crown].map(value => Math.round(value * 10) / 10);
});

const contents = `// Generated by scripts/fetch-trees.ts - do not edit by hand.
//
// Tree tops read off the survey's DOM1 less its DGM1, © Landesamt für
// Geobasisinformation Sachsen, dl-de/by-2-0: ${trees.length} trees within ${Math.round(reach)}m of
// the yard, each as x, y, its height and its crown's radius, in meters.

export const TREE_TOPS: [x: number, y: number, height: number, crown: number][] = [
${trees.map(tree => `  [${tree.join(', ')}],`).join('\n')}
];
`;

await writeFile(OUTPUT, contents);
console.info(`${trees.length} trees`);
