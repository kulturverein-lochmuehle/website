import { WOODS } from '../../data/data.js';
import { GROUND } from '../../data/terrain.baked.js';
import type { Palette } from '../../scene/palette.js';
import { contains, once, smoothstep } from '../../utils/geometry.utils.js';
import { distanceToBuildings } from '../buildings/footprint.js';
import { SKIRT_DEPTH, YARD_BLEND, YARD_MARGIN } from './terrain.field.js';

/**
 * The ground as it is drawn: the baked terrain unpacked, read at any point of the plan, and tinted.
 */
/** A baked buffer back into the numbers it was written from. */
export const unpacked = (text: string) =>
  Uint8Array.from(atob(text), char => char.charCodeAt(0)).buffer;

/**
 * The ground as it is drawn, read off the baked terrain: the height at a point
 * of the plan, if any ground is there. What a handle on the ground is set to,
 * where the ground is not the height field - beside a road it is spanned from
 * the kerb to the field 4m off. A seam traced to such a handle holds the ground
 * at the height it already has, so the next bake gives it back the same.
 */
export const DRAWN_GROUND = once(() => {
  const positions = new Float32Array(unpacked(GROUND.positions));
  const count = positions.length / 3;
  const indices =
    count > 0xffff
      ? new Uint32Array(unpacked(GROUND.indices))
      : new Uint16Array(unpacked(GROUND.indices));
  type Corner = [x: number, y: number, height: number];
  const vertex = (index: number): Corner => [
    positions[index * 3] as number,
    -(positions[index * 3 + 2] as number),
    positions[index * 3 + 1] as number,
  ];
  const facesOf = (face: number) =>
    [0, 1, 2].map(k => vertex(indices[face * 3 + k] as number)) as [Corner, Corner, Corner];
  const cell = 4;
  const grid = new Map<string, number[]>();
  for (let face = 0; face < indices.length / 3; face++) {
    const corners = facesOf(face);
    const xs = corners.map(([x]) => x);
    const ys = corners.map(([, y]) => y);
    for (let x = Math.floor(Math.min(...xs) / cell); x <= Math.floor(Math.max(...xs) / cell); x++) {
      for (
        let y = Math.floor(Math.min(...ys) / cell);
        y <= Math.floor(Math.max(...ys) / cell);
        y++
      ) {
        const key = `${x}:${y}`;
        grid.set(key, [...(grid.get(key) ?? []), face]);
      }
    }
  }
  return (x: number, y: number): number | undefined =>
    (grid.get(`${Math.floor(x / cell)}:${Math.floor(y / cell)}`) ?? []).reduce<number | undefined>(
      (found, face) => {
        const [[ax, ay, ah], [bx, by, bh], [cx, cy, ch]] = facesOf(face);
        const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
        if (Math.abs(d) < 1e-12) {
          return found;
        }
        const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
        const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
        const l3 = 1 - l1 - l2;
        // the skirt hangs under the rim, and is no ground
        if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9 || Math.min(ah, bh, ch) < -20) {
          return found;
        }
        const height = l1 * ah + l2 * bh + l3 * ch;
        return found === undefined ? height : Math.max(found, height);
      },
      undefined
    );
});

/**
 * The terrain as it was baked from the seam: positions and indices only, since
 * cutting it takes longer than the rest of the scene together. The colours are
 * laid on here, so that the palette still drives them.
 */
/** The baked terrain's heights: its skirt's floor, the lowest ground above it, and the relief between. */
export const RELIEF = once(() => {
  const positions = new Float32Array(unpacked(GROUND.positions));
  const heights = Array.from(
    { length: positions.length / 3 },
    (_, vertex) => positions[vertex * 3 + 1] as number
  );
  // the skirt hangs to one depth, below everything else
  const floor = heights.reduce((low, height) => Math.min(low, height), Infinity);
  const lowest = floor + SKIRT_DEPTH;
  const highest = heights.reduce((high, height) => Math.max(high, height), -Infinity);
  return { floor, lowest, relief: Math.max(highest - lowest, 1) };
});

/**
 * The ground's color at a point and height: the yard is the dark ground of the
 * drawing, and the slopes rise out of it along the same fade the terrain uses -
 * a hard ring would draw a circle. Whatever is piled on it is tinted the same.
 */
export function terrainTint(palette: Palette): (x: number, y: number, height: number) => number[] {
  const { lowest, relief } = RELIEF();
  return (x, y, height) => {
    const slope = smoothstep(YARD_MARGIN, YARD_MARGIN + YARD_BLEND, distanceToBuildings([x, y]));
    const ground = palette.ground
      .clone()
      .lerp(palette.hills, slope * 0.75 + ((height - lowest) / relief) * 0.25);
    // under the trees the ground darkens towards their own color, which keeps
    // the forest floor from shining through the canopy as bare hillside
    const wooded = WOODS.some(polygon => contains(polygon, [x, y]));
    const { r, g, b } = wooded ? ground.lerp(palette.foliage, 0.22) : ground;
    return [r, g, b];
  };
}
