import type { Point } from '../../data/data.js';
import { BUILDINGS, TERRAIN, WAYS, YARD_TERRAIN } from '../../data/data.js';
import { clamp, smooth, smoothstep } from '../../utils/geometry.utils.js';
import { distanceToBuildings, YARD_CENTER } from '../buildings/footprint.js';

/**
 * The height field: the survey's grid read and levelled around the yard, the ways' corridors, and how far the valley reaches.
 */
export { YARD_CENTER };

/**
 * Radius in meters of the levelled ground the houses stand on. It is kept small
 * on purpose: the survey's own meter grid has the paths, the retaining walls and
 * the bank behind the houses in it, and a wide flat would wipe all of that out.
 */
export const YARD_MARGIN = 1.5;

/** Over this many meters the yard blends into the real slope of the valley. */
export const YARD_BLEND = 4;

/** Radius in meters the terrain is modelled up to. */
export const TERRAIN_RADIUS = 300;

/**
 * How far inside the rim everything laid on the ground stops, in meters. One
 * margin for all of it: the bands, the lines the ground is held to and the
 * strip of field the road is cut out of. Held apart, the ground is cleared for
 * a road that is not drawn there and not held anywhere, which is a hole with
 * slivers in it.
 */
export const RIM_MARGIN = 0;

/** How much of the ground at the rim is kept whole, whatever is laid over it. */
export const RIM_KEEP = 12;

/** How long and how thin a triangle has to be before it is thrown away. */
export const NEEDLE_LENGTH = 20;
export const NEEDLE_WIDTH = 0.2;

/** How far beside a carriageway the ground keeps its own height, in meters. */
export const FIELD_CLEAR = 4;

/** How far out the rings grow too coarse to fill the ground beside a road. */
export const FLANK_BEYOND = 80;

/** And how far apart the points laid there are, in stations of two meters. */
export const FLANK_STRIDE = 2;

/** How deep the terrain slab hangs below its lowest point, in meters. */
export const SKIRT_DEPTH = 25;

/**
 * The DGM1 gives the Lotzebachtal its real shape - fifty meters of slope within
 * two hundred - and it needs no help at all: at one the terrain is true to the
 * survey. The factor stays as the one knob that would lie about the place.
 */
const EXAGGERATION = 1;

/** Bilinear read of one of the two height grids, its edges held. */
function readGrid(
  grid: { size: number; resolution: number; elevations: readonly number[] },
  x: number,
  y: number
): number {
  const { resolution: count, elevations: heights } = grid;
  const cell = grid.size / (count - 1);
  const column = clamp((x + grid.size / 2) / cell, 0, count - 1);
  const row = clamp((y + grid.size / 2) / cell, 0, count - 1);
  const [c0, r0] = [Math.floor(column), Math.floor(row)];
  const [fx, fy] = [column - c0, row - r0];
  const at = (r: number, c: number) =>
    heights[clamp(r, 0, count - 1) * count + clamp(c, 0, count - 1)] ?? 0;

  const south = at(r0, c0) * (1 - fx) + at(r0, c0 + 1) * fx;
  const north = at(r0 + 1, c0) * (1 - fx) + at(r0 + 1, c0 + 1) * fx;
  return south * (1 - fy) + north * fy;
}

/** Over how many meters the dense patch hands back over to the valley's grid. */
const YARD_GRID_FADE = 8;

/**
 * Height above sea level at a point of the local grid. Around the buildings the
 * survey's own meter grid answers, everywhere else the coarse one, and over the
 * last few meters of the patch the two are faded into each other - a step
 * between them would run right around the yard.
 */
export function elevationAt(x: number, y: number): number {
  const valley = readGrid(TERRAIN, x, y);
  const [dx, dy] = [x - YARD_TERRAIN.center[0], y - YARD_TERRAIN.center[1]];
  const inset = YARD_TERRAIN.size / 2 - Math.max(Math.abs(dx), Math.abs(dy));
  if (inset <= 0) {
    return valley;
  }

  const close = readGrid(YARD_TERRAIN, dx, dy);
  return valley + (close - valley) * smoothstep(0, YARD_GRID_FADE, inset);
}

const CORNERS = BUILDINGS.flatMap(({ footprint }) => footprint);

/**
 * Everything is measured from the yard, not from sea level: the mean height
 * under the buildings is where the ground is flat and where the walls start.
 */
export const BASE_ELEVATION =
  CORNERS.reduce((sum, [x, y]) => sum + elevationAt(x, y), 0) / CORNERS.length;

/**
 * The bare ground: the yard is flat - the buildings stand on a terrace, levelled
 * around their walls - and the valley takes over within a few meters of it. The
 * flat runs along the buildings rather than around a circle, so the slope behind
 * the mill stays as close and as steep as it is.
 *
 * Uphill the levelling alone would push the hill back much too far. The houses
 * are cut into the slope there, so the bank climbs its first five meters within
 * a few steps of the walls and only then follows the survey again.
 */
export function groundAt(x: number, y: number): number {
  const natural = (elevationAt(x, y) - BASE_ELEVATION) * EXAGGERATION;
  const blend = smoothstep(YARD_MARGIN, YARD_MARGIN + YARD_BLEND, distanceToBuildings([x, y]));
  return natural * blend;
}

/** How far beside a road the terrain is pulled towards its level, in meters. */
export const ROAD_SHOULDER = 8;

/** Distance between two points of a road's own height profile, in meters. */
export const ROAD_STEP = 2;

/** Half the length of the window the profile is smoothed over, in samples. */
export const ROAD_SMOOTHING = 7;

export interface Corridor {
  points: Point[];
  /** Height of the middle at each point: the line's own gradient, not the ground's. */
  heights: number[];
  half: number;
  /** How far beside it the terrain is drawn to its level, in meters. */
  shoulder: number;
}

/** The roads as the scene draws them: rounded, and the same line everything uses. */
export const ROADS = WAYS.map(way => ({ ...way, points: smooth(way.points) }));

/** And how deep it stands in that bed, in meters. */
export const WATER_FILL = 0.08;

/** How far the brook may be moved across onto the valley's own bottom, in meters. */
export const BROOK_SNAP = 4;

/** Over how many of its points that move is smoothed, so the line keeps its run. */
export const BROOK_EASE = 6;

/** And how far it still looks across itself for the bottom once it is there. */
export const BROOK_SEARCH = 1;

/**
 * The corner of the bridge's deck the wall starts behind, measured off the map
 * with the rest of the deck.
 */
export const DECK_CORNER: Point = [20.31, 18.98];

/** How far the wall beside the road runs on from the crossing, in meters. */
export const ROAD_WALL_RUN = 28;

/** The footway between the carriageway and that wall, in meters. */
export const ROAD_WALL_VERGE = 0.5;

/** How wide the Lotzebach is drawn, in meters. */
export const BROOK_WIDTH = 2.4;

/** How deep the brook's bed lies under the ground beside it, in meters. */
export const BROOK_DEPTH = 0.4;

/** Runs a window along a profile and averages it, which is what takes the bumps out. */
export const averaged = (profile: number[], reach: number) =>
  profile.map((_, index) => {
    const window = profile.slice(Math.max(0, index - reach), index + reach + 1);
    return window.reduce((sum, height) => sum + height, 0) / window.length;
  });

/**
 * The height one line holds at a point of its own run. A band is drawn from
 * this and not from the ground under its edges: the corridor is what the
 * terrain was cut to, so reading it back keeps every cross section level -
 * an edge read off the ground tips the band wherever the bank beside it rises.
 */
export function profileOf({ points, heights }: Corridor): (x: number, y: number) => number {
  return (x, y) =>
    points.reduce(
      (closest, [ax, ay], index) => {
        const next = points[index + 1];
        if (next === undefined) {
          return closest;
        }
        const [bx, by] = next;
        const length = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
        const t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length, 0, 1);
        const distance = Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
        const from = heights[index] as number;
        const to = heights[index + 1] as number;
        return distance < closest.distance ? { distance, height: from + (to - from) * t } : closest;
      },
      { distance: Infinity, height: 0 }
    ).height;
}

/** A piece of a corridor, as the lookup below holds it. */
export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  from: number;
  to: number;
  half: number;
  shoulder: number;
}

/**
 * Past this distance from a line the ground is the ground, in meters. It has to
 * cover the widest carve there is - half the main road, the level verge that
 * grows with the mesh, and the shoulder beyond it - or a segment drops out of
 * the lookup and its band surfaces through the hill it was cut into.
 */
export const CORRIDOR_REACH = 24;

/** Side of a cell of the lookup grid, in meters. */
export const LOOKUP_CELL = CORRIDOR_REACH;

export const cellKey = (x: number, y: number) =>
  `${Math.floor(x / LOOKUP_CELL)}:${Math.floor(y / LOOKUP_CELL)}`;

/**
 * Ring radii of the terrain mesh: three meters apart where the yard and the
 * slope behind it are, then coarser the further out the hills go.
 */
/**
 * How far apart the rings lie at a radius: a meter over the yard, where the
 * paths and banks are, and coarser the further out the hills go.
 */
export const ringStep = (radius: number) =>
  radius < 45 ? 1 : radius < 120 ? 2 : radius < 200 ? 6 : 10;

export function ringRadii(): number[] {
  const radii = [0];
  while ((radii[radii.length - 1] as number) < TERRAIN_RADIUS) {
    const radius = radii[radii.length - 1] as number;
    radii.push(Math.min(radius + ringStep(radius), TERRAIN_RADIUS));
  }
  return radii;
}

/** How far from a line of the seam a point of the field may stand, in meters. */
export const SEAM_CLEAR = 0.5;

/** How far past a kerb the carriageway is looked for, in meters. */
export const CARRIAGEWAY_REACH = 0.5;

/** How close to a way's edge or a bank a point of the seam lies on it, in meters. */
export const FLOOR_ON = 0.01;

/** How finely kept ground is filled in, in meters. */
export const KEEP_CELL = 1;

export const distanceToYard = ([x, y]: Point) => {
  const [ox, oy] = YARD_CENTER;
  return Math.hypot(x - ox, y - oy);
};

export const insideTerrain = (point: Point, margin = 0) =>
  distanceToYard(point) <= TERRAIN_RADIUS - margin;

/**
 * A point pulled back onto the modelled ground if it reaches past its rim. A
 * band and a kerb are both set out from a line, so where one meets the rim at
 * an angle its outer edge gets there first and would hang over nothing.
 */
export const onGround = ([x, y]: Point): Point => {
  const [ox, oy] = YARD_CENTER;
  const out = Math.hypot(x - ox, y - oy);
  if (out <= TERRAIN_RADIUS) {
    return [x, y];
  }
  const share = TERRAIN_RADIUS / out;
  return [ox + (x - ox) * share, oy + (y - oy) * share];
};

/**
 * Cuts a polyline into the pieces that stay on the modelled terrain, well
 * inside the rim: the terrain mesh is coarser than the height samples, and a
 * ribbon running onto the rim would poke through the slope it lies on.
 */
export function clipToTerrain(points: Point[], margin = RIM_MARGIN): Point[][] {
  const edge = TERRAIN_RADIUS - margin;
  const [ox, oy] = YARD_CENTER;
  const out = ([x, y]: Point) => Math.hypot(x - ox, y - oy);

  /** Where the line between two points crosses the rim, to a centimeter. */
  const met = (from: Point, to: Point): Point => {
    const [near, far] = out(from) <= edge ? [from, to] : [to, from];
    const closer = (one: Point, other: Point): Point => {
      const middle: Point = [(one[0] + other[0]) / 2, (one[1] + other[1]) / 2];
      if (Math.hypot(other[0] - one[0], other[1] - one[1]) < 0.01) {
        return middle;
      }
      return out(middle) <= edge ? closer(middle, other) : closer(one, middle);
    };
    return closer(near, far);
  };

  return points.reduce<Point[][]>((segments, point, step) => {
    const current = segments[segments.length - 1];
    const before = points[step - 1];
    const inside = out(point) <= edge;
    // a line is cut where it leaves the ground, not at the last point that was
    // still on it: dropped whole, it ends a stride short of the rim
    if (!inside) {
      return current?.length && before !== undefined
        ? [...segments.slice(0, -1), [...current, met(before, point)], []]
        : segments;
    }
    if (current === undefined || current.length === 0) {
      const from = before === undefined ? [] : [met(before, point)];
      return [
        ...segments.slice(0, segments.length && current?.length === 0 ? -1 : undefined),
        [...from, point],
      ];
    }
    return [...segments.slice(0, -1), [...current, point]];
  }, []);
}
