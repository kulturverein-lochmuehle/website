import { Group, Mesh } from 'three';

import type { Point } from '../../data/data.js';
import { BROOK } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import {
  clamp,
  crossings,
  nearestOn,
  offsetLine,
  outside,
  resample,
  runs,
  smooth,
  smoothstep,
} from '../../utils/geometry.utils.js';
import { distanceToBuildings, YARD_CENTER } from '../buildings/footprint.js';
import type { SeamEdge, SeamHandle } from '../structures/measures.js';
import {
  DECK_OUTLINE,
  TERRACE_OVER,
  TERRACE_REACH,
  UNDER_ROAD,
  WALL_FOOT,
} from '../structures/measures.js';
import type { Layer, Section } from './surfaces.js';
import { edgeLevel, edgeNear, groundMaterial, LAYERS, ribbon, ribbonSections } from './surfaces.js';
import { DRAWN_GROUND } from './terrain.drawn.js';
import type { Corridor, Segment } from './terrain.field.js';
import {
  averaged,
  BROOK_DEPTH,
  BROOK_EASE,
  BROOK_SEARCH,
  BROOK_SNAP,
  BROOK_WIDTH,
  cellKey,
  clipToTerrain,
  CORRIDOR_REACH,
  DECK_CORNER,
  groundAt,
  insideTerrain,
  LOOKUP_CELL,
  profileOf,
  RIM_MARGIN,
  ringStep,
  ROAD_SHOULDER,
  ROAD_SMOOTHING,
  ROAD_STEP,
  ROAD_WALL_RUN,
  ROAD_WALL_VERGE,
  ROADS,
  WATER_FILL,
  YARD_BLEND,
  YARD_MARGIN,
} from './terrain.field.js';

/**
 * The ground and the lines that shape it, one knot of them: the heights, the brook and the ways, the road wall and the terrace beside it, the water's edges, and the heights every edge of the seam is held to.
 */
/** The brook, rounded the same way. */
/**
 * Where the water stands: on the ground the brook has been cut into, not on the
 * line it was set out from. The two are not the same - the cut goes deeper than
 * the line asks - and a surface taken from the line alone floats over the bed by
 * whatever the difference happens to be, which is what it did.
 */
const waterLevel = (x: number, y: number) => heightAt(x, y);

/**
 * The brook, moved across onto the valley's own bottom. The laser scan is a
 * meter grid and the line is drawn on a map by hand: measured against the scan,
 * the line runs a median two meters to one side of the lowest ground and half a
 * meter above it, and at its ends several meters. Everything at the mill is set
 * out from this line - the deck, the culvert's walls, every numbered point - so
 * it is put right here, before any of them read it.
 */
function snappedBrook(): Point[] {
  const drawn = smooth(BROOK);
  const across = drawn.map((point, step): Point => {
    const next = drawn[step + 1] ?? drawn[step - 1] ?? point;
    const [dx, dy] = [next[0] - point[0], next[1] - point[1]];
    const length = Math.hypot(dx, dy) || 1;
    return [-dy / length, dx / length];
  });

  // where the scan is lowest across each point, to the nearest quarter meter
  const offsets = drawn.map((point, step) => {
    const [nx, ny] = across[step] as Point;
    return Array.from({ length: BROOK_SNAP * 8 + 1 }, (_, at) => at / 4 - BROOK_SNAP).reduce(
      (best, off) => {
        const height = groundAt(point[0] + nx * off, point[1] + ny * off);
        return height < best.height ? { off, height } : best;
      },
      { off: 0, height: Infinity }
    ).off;
  });

  // the offsets are smoothed before they are used, or the line hops from one
  // side of the channel to the other wherever the scan is flat
  const eased = offsets.map((_, step) => {
    const window = offsets.slice(Math.max(0, step - BROOK_EASE), step + BROOK_EASE + 1);
    return window.reduce((sum, off) => sum + off, 0) / window.length;
  });

  // and rounded once more at the end: the move is smoothed over a few points,
  // not over the whole run, so it leaves kinks of its own in a line everything
  // at the crossings is set out from. One pass, not the three the drawn line
  // gets - each of them doubles the points, and this one is dense already
  return smooth(
    drawn.map((point, step): Point => {
      const [nx, ny] = across[step] as Point;
      const off = eased[step] as number;
      return [point[0] + nx * off, point[1] + ny * off];
    }),
    1
  );
}

export const BROOK_LINE = snappedBrook();

/**
 * A road is built, not draped: it holds a steady gradient where the ground
 * around it rolls. Averaging the ground along the road gives that gradient, and
 * the terrain is then pulled up to it or cut down to it beside the road.
 *
 * The brook gets the same treatment for the same reason - a band drawn level
 * across a bank cuts into it otherwise - with a bed of its own and, since water
 * runs downhill, a profile that is never allowed to climb.
 */
export const CORRIDORS: Corridor[] = [
  ...ROADS.map(({ points, width }) => {
    const dense = resample(points, ROAD_STEP);
    const heights = averaged(
      dense.map(([x, y]) => groundAt(x, y)),
      ROAD_SMOOTHING
    );
    return { points: dense, heights, half: width / 2, shoulder: ROAD_SHOULDER };
  }),
  ...(() => {
    const dense = resample(BROOK_LINE, ROAD_STEP);
    /**
     * The lowest ground the scan has within reach across the line, rather than
     * the ground under the line itself. The laser scan is a meter grid; the
     * line is drawn on a map by hand. Measured against the scan, the line runs
     * a median two meters to one side of the valley's own bottom and half a
     * meter above it, and at the far ends several meters. The scan is the
     * better of the two, so the water takes its level from that.
     */
    const bottom = dense.map(([x, y], step) => {
      const next = dense[step + 1] ?? dense[step - 1] ?? [x, y];
      const [dx, dy] = [next[0] - x, next[1] - y];
      const length = Math.hypot(dx, dy) || 1;
      return Array.from({ length: BROOK_SEARCH * 4 + 1 }, (_, at) => at / 2 - BROOK_SEARCH).reduce(
        (low, off) => Math.min(low, groundAt(x - (dy / length) * off, y + (dx / length) * off)),
        Infinity
      );
    });
    const smoothed = averaged(bottom, ROAD_SMOOTHING);
    // downhill from the higher end, and never a step back up
    const downhill = (smoothed[0] as number) >= (smoothed[smoothed.length - 1] as number);
    const ordered = downhill ? smoothed : [...smoothed].reverse();
    const falling = ordered.map(
      ((lowest: number) => (height: number) => {
        lowest = Math.min(lowest, height);
        return lowest - BROOK_DEPTH;
      })(Infinity)
    );
    return [
      {
        points: dense,
        heights: downhill ? falling : [...falling].reverse(),
        half: BROOK_WIDTH / 2,
        shoulder: 6,
      },
    ];
  })(),
];

/**
 * Every corridor segment, filed under the cells it can reach into. `heightAt`
 * runs for every vertex of the terrain, every tree and every point of a band -
 * walking all fifteen hundred segments each time is what made the scene slow.
 */
const SEGMENTS: Map<string, Segment[]> = CORRIDORS.reduce((index, corridor) => {
  const { points, heights, half, shoulder } = corridor;
  points.forEach(([ax, ay], i) => {
    const next = points[i + 1];
    if (next === undefined) {
      return;
    }
    const [bx, by] = next;
    const segment: Segment = {
      ax,
      ay,
      bx,
      by,
      from: heights[i] as number,
      to: heights[i + 1] as number,
      half,
      shoulder,
    };
    const [minX, maxX] = [Math.min(ax, bx) - CORRIDOR_REACH, Math.max(ax, bx) + CORRIDOR_REACH];
    const [minY, maxY] = [Math.min(ay, by) - CORRIDOR_REACH, Math.max(ay, by) + CORRIDOR_REACH];
    for (let x = minX; x <= maxX + LOOKUP_CELL; x += LOOKUP_CELL) {
      for (let y = minY; y <= maxY + LOOKUP_CELL; y += LOOKUP_CELL) {
        const key = cellKey(x, y);
        index.set(key, [...(index.get(key) ?? []), segment]);
      }
    }
  });
  return index;
}, new Map<string, Segment[]>());

/**
 * Height in scene units: the ground, with the roads and the brook cut into it.
 * Beside them the terrain meets their level within a shoulder's width, which is
 * what makes a lane climbing a slope read as a lane and not as a stripe painted
 * on it, and what keeps the brook from cutting into its own bank.
 */
export function heightAt(x: number, y: number): number {
  const ground = groundAt(x, y);
  // the flat runs wider than the band itself: the mesh cannot hold a carve
  // narrower than its own vertices, so it grows with them - far out that is a
  // level verge beside the road, up close it is a hand's width
  const verge = 1.5 + ringStep(Math.hypot(x - YARD_CENTER[0], y - YARD_CENTER[1]));
  // the yard is levelled ground of its own, nothing digs into it
  const yard = smoothstep(YARD_MARGIN, YARD_MARGIN + YARD_BLEND, distanceToBuildings([x, y]));

  // every line within reach cuts its own trench, and the lowest of them is the
  // ground: where the brook runs along a road six meters higher, the water is
  // what the ground between them follows, not the embankment nearest to it
  const cut = (SEGMENTS.get(cellKey(x, y)) ?? []).reduce((lowest, segment) => {
    const { ax, ay, bx, by, from, to, half, shoulder } = segment;
    const length = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
    const t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length, 0, 1);
    const distance = Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
    const flat = half + verge;
    const beside = smoothstep(flat, flat + shoulder, distance);
    const carved = (1 - beside) * yard;
    const height = from + (to - from) * t;
    return Math.min(lowest, ground * (1 - carved) + height * carved);
  }, ground);

  const terrace = terraceAt(x, y);
  return terrace === undefined ? cut : Math.min(cut, terrace);
}

/** The Lotzebach, the reason a mill stands here at all. */
export function createBrook(palette: Palette): Group {
  const material = groundMaterial(palette.water, 'brook');
  const group = new Group();
  group.name = 'brook';
  group.renderOrder = LAYERS.brook;
  group.add(new Mesh(ribbon(BROOK_SECTIONS), material));
  return group;
}

/**
 * Where the foot of a wall goes: under the ground it stands on as well as under
 * whatever it holds back, so that it is either flush or buried and never hangs
 * in the air.
 */
export function footAt(x: number, y: number, level: number): number {
  return Math.min(level, heightAt(x, y)) - WALL_FOOT;
}

/**
 * North of the mill the road does not just cross the brook, it runs on beside
 * it: the wall of the crossing carries on along the road for some thirty
 * meters, and the ground it holds back lies almost at the water's level rather
 * than sloping down to it.
 */
export const ROAD_WALL = (() => {
  const index = ROADS.findIndex(({ main }) => main);
  const road = CORRIDORS[index] as Corridor;
  const brook = CORRIDORS[CORRIDORS.length - 1] as Corridor;
  const half = (ROADS[index] as (typeof ROADS)[number]).width / 2;

  // the crossing by the mill, named by where it is rather than by which of them
  // lies furthest north: carried out to the rim, the road and the brook meet
  // again far up the valley, and that one was suddenly the northernmost
  const [at] = crossings(road.points, brook.points)
    .sort(
      (one, other) =>
        Math.hypot(one.at[0] - DECK_CORNER[0], one.at[1] - DECK_CORNER[1]) -
        Math.hypot(other.at[0] - DECK_CORNER[0], other.at[1] - DECK_CORNER[1])
    )
    .map(({ along }) => along);
  if (at === undefined) {
    return undefined;
  }

  // from there back up the valley, the way the brook keeps to the road - the
  // other way it swings off across the meadow and there is nothing to hold back
  const start = Math.floor(at);
  const stretch: Point[] = [];
  let run = 0;
  for (let step = start; step >= 0 && run < ROAD_WALL_RUN; step -= 1) {
    const point = road.points[step] as Point;
    const previous = stretch[stretch.length - 1];
    run += previous === undefined ? 0 : Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    stretch.push(point);
  }

  if (stretch.length < 2) {
    return undefined;
  }

  // the brook is on one side of the road the whole way; which one is read off
  // the middle of the stretch rather than assumed
  const [mx, my] = stretch[Math.floor(stretch.length / 2)] as Point;
  const ahead = stretch[Math.floor(stretch.length / 2) + 1] ?? (stretch[0] as Point);
  const water = brook.points.reduce(
    (closest, point) =>
      Math.hypot(point[0] - mx, point[1] - my) < closest.distance
        ? { distance: Math.hypot(point[0] - mx, point[1] - my), point }
        : closest,
    { distance: Infinity, point: brook.points[0] as Point }
  ).point;
  const side = Math.sign((ahead[0] - mx) * (water[1] - my) - (ahead[1] - my) * (water[0] - mx));

  // the bank the road runs along, and the wall of the crossing that stands on
  // it: the run has to carry on from there and stay on that side of the water
  // a footway's width lies between the road and the wall, so the face stands
  // clear of the carriageway rather than on its edge, and it keeps to the bank
  // the road runs along
  // the road's own points lie two meters apart, and an offset line drawn from
  // them cuts every bend short - stepped finely first, it keeps its distance
  // the wall's own line and, drawn from the same points, the edge of the
  // carriageway it stands a footway's width off - the two have to keep step,
  // since the footway between them is built as one strip from both
  const stepped = resample(stretch, 0.5);
  const bank = ([x, y]: Point) => {
    const water = nearestOn(brook.points, x, y);
    const middle = nearestOn(stretch, x, y);
    return (
      Math.sign(water.heading[0] * (y - water.at[1]) - water.heading[1] * (x - water.at[0])) ===
      Math.sign(
        water.heading[0] * (middle.at[1] - water.at[1]) -
          water.heading[1] * (middle.at[0] - water.at[0])
      )
    );
  };
  const drawn = offsetLine(stepped, side * (half + ROAD_WALL_VERGE));
  const kerbed = offsetLine(stepped, side * half);
  const keep = drawn.reduce<number[]>(
    (steps, point, step) => (bank(point) ? [...steps, step] : steps),
    []
  );
  const laid = keep.map(step => drawn[step] as Point);
  if (laid.length < 2) {
    return undefined;
  }

  // it starts behind the deck and runs on parallel to the road, the same half
  // meter off it the whole way - the deck's own corner is where it takes over
  const behind = nearestOn(laid, DECK_CORNER[0], DECK_CORNER[1]);
  const away = (point: Point) => Math.hypot(point[0] - behind.at[0], point[1] - behind.at[1]);
  // and only what runs on from there up the valley: the points the other way
  // lie on the crossing itself, where the wall under the deck takes over, and a
  // face carried on through them stands in the brook
  const taken = keep.filter((_, step) => {
    const point = laid[step] as Point;
    return step > behind.along && away(point) > 0.5 && away(point) < ROAD_WALL_RUN;
  });
  const face = [DECK_CORNER, ...taken.map(step => drawn[step] as Point)];
  const kerb = taken.map(step => kerbed[step] as Point);

  return {
    /** The road's middle over the walled stretch. */
    middle: stretch,
    /** The brook it runs beside, to hold the ground down only as far as the water. */
    brook: brook.points,
    /** The face itself: parallel to the road, starting behind the deck. */
    face,
    /** The edge of the carriageway beside it, point for point with the face. */
    kerb,
    half,
    side,
    level: profileOf(brook),
    road: profileOf(road),
  };
})();

/**
 * The ground the wall beside the road holds back: between the road and the
 * brook it lies just over the water rather than sloping down to it. Outside
 * that strip there is nothing to say, and the ground stays the ground.
 */
export function terraceAt(x: number, y: number): number | undefined {
  if (ROAD_WALL === undefined) {
    return undefined;
  }

  const near = ROAD_WALL.middle.reduce(
    (closest, [ax, ay], index) => {
      const next = ROAD_WALL.middle[index + 1];
      if (next === undefined) {
        return closest;
      }
      const [bx, by] = next;
      const length = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length, 0, 1);
      const [px, py] = [ax + t * (bx - ax), ay + t * (by - ay)];
      const distance = Math.hypot(x - px, y - py);
      const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      return distance < closest.distance ? { distance, cross } : closest;
    },
    { distance: Infinity, cross: 0 }
  );

  if (Math.sign(near.cross) !== ROAD_WALL.side || near.distance > TERRACE_REACH) {
    return undefined;
  }

  // and only as far as the water: past the brook the far bank is the hill's
  // again, and holding it down would carve a trough out of the meadow
  const water = nearestOn(ROAD_WALL.brook, x, y);
  const road = nearestOn(ROAD_WALL.middle, x, y);
  const beyond =
    Math.sign(water.heading[0] * (y - water.at[1]) - water.heading[1] * (x - water.at[0])) !==
    Math.sign(
      water.heading[0] * (road.at[1] - water.at[1]) - water.heading[1] * (road.at[0] - water.at[0])
    );
  return beyond ? undefined : ROAD_WALL.level(x, y) + TERRACE_OVER;
}

/**
 * Every way as it is laid: each run of its carriageway, how wide it is either
 * side, the height its surface holds, and the sections its band is drawn
 * between. The band, the kerbs the ground is held to and the strip it is cut
 * out of all come from here, so they end where the band does.
 */
export const WAY_RUNS: {
  points: Point[];
  half: number;
  level: (x: number, y: number) => number;
  main: boolean;
  sections: Section[];
}[] = ROADS.flatMap(({ main, width, points }, index) => {
  const level = profileOf(CORRIDORS[index] as Corridor);
  return clipToTerrain(points, 0)
    .flatMap(run => (main ? [run] : outside(run, DECK_OUTLINE)))
    .filter(run => run.length > 1)
    .map(run => {
      // a lane that stops at the deck is cut on the edge it stops at rather
      // than square to its own run
      const ends: Point[] = [run[0] as Point, run[run.length - 1] as Point];
      const near = ends
        .map(point => edgeNear(DECK_OUTLINE, point))
        .sort((a, b) => a.distance - b.distance)[0];
      const cut = main || near === undefined || near.distance > 1 ? undefined : near.line;
      // cut into the ground, a way needs no lift off it: the two share the
      // line they meet on, so there is nothing to lift clear of
      const sections = ribbonSections(run, width, level, 0, cut);
      return { points: run, half: width / 2, level, main, sections };
    });
});

/**
 * The two edges of every way, with the height its own surface holds. The seam
 * wants them all: the lane north of the mill stands as proud of the ground as
 * the road did, and what is not held by an edge of the terrain cannot be met
 * by it. The lane stops where the deck begins, the way it is drawn.
 */
export const WAY_KERBS: {
  points: Point[];
  level: (x: number, y: number) => number;
  main: boolean;
}[] = WAY_RUNS.filter(({ sections }) => sections.length > 1).flatMap(({ sections, main }) =>
  [sections.map(({ left }) => left), sections.map(({ right }) => right)].map(points => ({
    points,
    level: edgeLevel(points, sections),
    main,
  }))
);

/**
 * The sections the water is drawn between, rim to rim. The brook leaves the
 * modelled ground once at either end, so it is the one run that is left.
 */
const BROOK_SECTIONS: Section[] = clipToTerrain(BROOK_LINE, 0)
  .filter(run => run.length > 1)
  .map(run => ribbonSections(run, BROOK_WIDTH, waterLevel, WATER_FILL))
  .reduce<Section[]>((longest, run) => (run.length > longest.length ? run : longest), []);

/**
 * The two banks of the brook, once: the edges of the water itself. The walls of
 * the crossings are set out from them and so are the handles on the water:
 * worked out twice, from lines resampled a little differently, they came out a
 * third of a meter apart, and a wall stood beside the water it is meant to
 * stand in rather than on it. Set out apart from the water, they stopped over a
 * meter short of it at the rim.
 */
export const BROOK_BANKS: Point[][] = [
  BROOK_SECTIONS.map(({ left }) => left),
  BROOK_SECTIONS.map(({ right }) => right),
];

/**
 * The brook, as three lines the ground is held to: its two banks at the height
 * the water stands, and its own line at the bed under them. A road is held up
 * to, a brook is held down to - ground pulled to the water's surface all the way
 * across would leave the water lying on top of the valley rather than in it.
 */
export const WATER_EDGES: {
  points: Point[];
  level: (x: number, y: number) => number;
  bed: boolean;
}[] = (() => {
  const corridor = CORRIDORS[CORRIDORS.length - 1] as Corridor;
  const level = profileOf(corridor);
  const stations = resample(corridor.points, 2).filter(point => insideTerrain(point, RIM_MARGIN));
  if (stations.length < 2) {
    return [];
  }
  return [
    // the banks stand at the water's surface, which is what a bank is: the
    // ground rises to meet it from the bed rather than the brook floating over.
    // The surface is level across, so a bank takes it from the water's own
    // edge - read off the ground beside it, one stood 0.35m over the water
    ...BROOK_BANKS.map(bank => ({
      points: bank,
      level: edgeLevel(bank, BROOK_SECTIONS),
      bed: false,
    })),
    // and the bed holds the ground down, never up: where the valley already
    // lies deeper than the brook's own line, filling it in would be a dam
    {
      points: stations,
      level: (x: number, y: number) => Math.min(level(x, y), heightAt(x, y)),
      bed: true,
    },
  ];
})();

/**
 * The height each kind of edge lies at, anywhere along it, read the way the
 * walls and the carriageway themselves read it. A seam is pinned to these
 * rather than to numbers: between two handles a hundred meters apart the ground
 * rises and falls, and a line drawn from the one height to the other would hang
 * in the air over all of it.
 */
export const LEVEL_OF: Record<SeamEdge, (at: Point) => number> = (() => {
  const index = ROADS.findIndex(({ main }) => main);
  const roadLevel = profileOf(CORRIDORS[index] as Corridor);
  const brookLevel = profileOf(CORRIDORS[CORRIDORS.length - 1] as Corridor);
  // the kerbs, since what a seam is pinned to on a way is its edge
  const surfaces = WAY_KERBS;
  return {
    // the walls stand beside the main road and are topped out at it, whatever
    // else runs past them
    top: ([x, y]) => roadLevel(x, y) - UNDER_ROAD,
    foot: ([x, y]) => footAt(x, y, terraceAt(x, y) ?? brookLevel(x, y)),
    // a point on a way lies at the height of the edge it is on, and which one
    // that is, is read off the ground rather than assumed to be the main road
    road: at => {
      const near = surfaces.reduce(
        (best, way) => {
          const distance = nearestOn(way.points, at[0], at[1]).distance;
          return distance < best.distance ? { distance, level: way.level } : best;
        },
        { distance: Infinity, level: roadLevel }
      );
      return near.level(at[0], at[1]);
    },
    // and the water at the height of the bank it is on, which is the water's
    // own surface at its edge
    water: at =>
      WATER_EDGES.filter(({ bed }) => !bed)
        .map(({ points, level }) => ({ level, distance: nearestOn(points, at[0], at[1]).distance }))
        .reduce((best, bank) => (bank.distance < best.distance ? bank : best))
        .level(at[0], at[1]),
    // never above the ground it runs through: filling a channel in is a dam
    bed: ([x, y]) => Math.min(brookLevel(x, y), heightAt(x, y)),
    // a reference point is set at a height of its own, and between two the
    // ground as it is drawn is all there is to go by
    point: ([x, y]) => DRAWN_GROUND()(x, y) ?? heightAt(x, y),
  };
})();

/**
 * The heights along a run from one handle to the next: each edge's own rule
 * read at every point, eased from the one handle's to the other's by the way
 * walked, and each handle's lift off its rule eased out with it.
 */
export function eased(
  from: SeamHandle,
  to: SeamHandle,
  points: Point[]
): { at: Point; level: number }[] {
  const [lift, onward] = [
    from.level - LEVEL_OF[from.edge](from.at),
    to.level - LEVEL_OF[to.edge](to.at),
  ];
  const whole = runs(points) || 1;
  let walked = 0;
  return points.map((at, step) => {
    const before = points[step - 1];
    walked += before === undefined ? 0 : Math.hypot(at[0] - before[0], at[1] - before[1]);
    const share = walked / whole;
    return {
      at,
      level:
        (LEVEL_OF[from.edge](at) + lift) * (1 - share) + (LEVEL_OF[to.edge](at) + onward) * share,
    };
  });
}

export function createWays(palette: Palette): Group {
  const materials = {
    road: groundMaterial(palette.road, 'road'),
    lane: groundMaterial(palette.track, 'lane'),
  };
  const group = new Group();
  group.name = 'ways';
  // the main road is built last, which puts it on top of everything it crosses
  [...WAY_RUNS]
    .sort((a, b) => Number(a.main) - Number(b.main))
    .forEach(({ main, sections }) => {
      const layer: Layer = main ? 'road' : 'lane';
      const mesh = new Mesh(ribbon(sections), materials[layer]);
      mesh.renderOrder = LAYERS[layer];
      group.add(mesh);
    });
  return group;
}
