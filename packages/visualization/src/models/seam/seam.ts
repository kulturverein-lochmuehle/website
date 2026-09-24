import type { Point } from '../../data/data.js';
import { POINTS } from '../../data/points.js';
import {
  boxed,
  crossings,
  extended,
  nearestOn,
  once,
  resample,
  runs,
} from '../../utils/geometry.utils.js';
import {
  CROSSING,
  CROSSING_MARKS,
  CULVERT,
  DECK_BANKS,
  DECK_MARKS,
  MILL_MARKS,
  MILL_ROAD_DECK,
} from '../structures/crossings.js';
import type { SeamEdge, SeamHandle, SeamLine } from '../structures/measures.js';
import {
  DECK_OUTLINE,
  KEPT,
  lineLevel,
  ON_ROUTE,
  PICK_SAME,
  PICK_SPACING,
  ROUTE_DETOUR,
  SEAM_ALONG,
  SEAM_DOUBLE,
  SEAM_FOUND,
  SEAM_PASSES,
  SEAM_SNAP,
  SEAM_STEP,
  SEAM_TO_WALL,
  SEAMS,
  TO_NETWORK,
  WALL_STEP,
} from '../structures/measures.js';
import { STAIRS_MARKS } from '../structures/stairs.js';
import {
  CORRIDORS,
  eased,
  footAt,
  heightAt,
  LEVEL_OF,
  terraceAt,
  WATER_EDGES,
  WAY_KERBS,
} from '../terrain/ground.js';
import { DRAWN_GROUND } from '../terrain/terrain.drawn.js';
import type { Corridor } from '../terrain/terrain.field.js';
import { FLOOR_ON, insideTerrain, profileOf, RIM_MARGIN, ROADS } from '../terrain/terrain.field.js';

/**
 * The seam the ground is cut along: the network of every line it is held to, the handles it is picked out between, the traced seams and what the ground keeps.
 */
/**
 * How far each point of a wall stands over the rule the wall is topped out by:
 * the lift of the marks it runs through, eased from one to the next by the way
 * walked, the way a seam traced along the wall eases it. Drawn at the rule, a
 * wall stood 0.37m under the corner the lane comes up to, and under the ground
 * held to it.
 */
export function liftsAlong(line: Point[]): number[] {
  const marks = [...DECK_MARKS, ...CULVERT.marks, ...CROSSING_MARKS, ...MILL_MARKS];
  const walked = line.reduce<number[]>((sums, point, step) => {
    const before = line[step - 1];
    const last = sums[sums.length - 1] ?? 0;
    return [
      ...sums,
      before === undefined ? 0 : last + Math.hypot(point[0] - before[0], point[1] - before[1]),
    ];
  }, []);
  const known = line.flatMap((point, step) =>
    marks.some(mark => mark[0] === point[0] && mark[1] === point[1])
      ? [{ at: walked[step] as number, lift: MARK_TOP(point) - LEVEL_OF.top(point) }]
      : []
  );
  return walked.map(at => {
    const after = known.findIndex(mark => mark.at >= at);
    const [one, other] = [known[after - 1], known[after]];
    if (one === undefined || other === undefined) {
      return (other ?? one)?.lift ?? 0;
    }
    const share = other.at > one.at ? (at - one.at) / (other.at - one.at) : 0;
    return one.lift + (other.lift - one.lift) * share;
  });
}

/** Every wall there is: the mill's, and the second crossing's. */
export const WALL_RUNS: Point[][] = [...CULVERT.runs, ...CROSSING.walls];

/**
 * The outlines of the plates, as rings of their own: what a bridge spans is not
 * ground, and a hole can only be cut where a line encloses it. The second
 * crossing's plate only: the mill's deck lies over ground its seams already say
 * what to do with, and cut away under the whole of it, the ground went from
 * under the bridge outside the ring it was kept inside - a meter's gap beside it.
 */
export const PLATES: Point[][] = [CROSSING.plate].filter(ring => ring.length > 2);

/** Every line the model itself says the ground is to be held to. */
const MODEL_LINES = once((): SeamLine[] => [...ROUTED_LINES(), ...PLATE_LINES()]);

/**
 * The lines a trace is routed along between handles: the ways, the water and
 * the walls. Not the plates' outlines - they came after most of the seams were
 * traced, and a leg routed through the network that found one ran along it
 * rather than the way it was traced: the ground kept under the mill's crossing
 * came out 3.1m shorter round.
 */
const ROUTED_LINES = once((): SeamLine[] => {
  const index = ROADS.findIndex(({ main }) => main);
  const level = profileOf(CORRIDORS[index] as Corridor);
  return [
    ...[...WAY_KERBS, ...WATER_EDGES].map(edge => ({
      points: edge.points,
      wall: false,
      level: edge.level,
    })),
    ...WALL_RUNS.map(run => ({
      points: resample(run, 1).filter(point => insideTerrain(point, RIM_MARGIN)),
      wall: true,
      level,
    })),
  ].filter(({ points }) => points.length > 1);
});

/** And the plates' outlines, which the ground is cut away inside. */
const PLATE_LINES = once((): SeamLine[] => {
  const index = ROADS.findIndex(({ main }) => main);
  const level = profileOf(CORRIDORS[index] as Corridor);
  return PLATES.map(ring => ({
    points: resample([...ring, ring[0] as Point], 1).filter(point =>
      insideTerrain(point, RIM_MARGIN)
    ),
    wall: true,
    level,
  })).filter(({ points }) => points.length > 1);
});

/**
 * Worked out when first asked for rather than on load: cutting every line at
 * every other is the one slow thing in the model, and a terrain baked from it
 * does not need it again - only the bench does. This is the network the bench
 * routes a trace through; the ground is cut to `CUT`, which has the traced
 * seams in it as well.
 */
const SEAM = once(() => planarise(ROUTED_LINES()));

/** The same lines with the traced seams cut in, which is what the ground holds. */
const CUT = once(() =>
  planarise([
    // the traced seams first: a point set down later is taken together with
    // one already there, and the corner of a seam that came second was moved
    // 3.4cm onto the kerb's end instead of the kerb onto the corner
    ...TRACED().flatMap((ring, order) =>
      ring === undefined
        ? []
        : [
            {
              points: ring.points,
              wall: false,
              level: lineLevel(ring.points, ring.levels),
              traced: ring.keep ? 1 : 2 + order,
            },
          ]
    ),
    ...MODEL_LINES(),
  ])
);

/**
 * Lines cut into a network a triangulation can hold: every crossing made a
 * point of both lines, and the lines split there. The first line to set a point
 * down gives it its height, except that where a wall meets anything else the
 * wall has the say - and where a traced seam meets anything, the seam: it is
 * what was agreed, and a wall's foot under a corner traced at its top would
 * pull that corner two meters down.
 */
function planarise(lines: SeamLine[]) {
  // the points, with the ones that land on each other taken as one
  const points: Point[] = [];
  const found = new Map<string, number[]>();
  const heights: number[] = [];
  const walls: boolean[] = [];
  // who set each point's height: the field's lines, a wall, a traced seam
  const ranks: number[] = [];
  const place = (
    point: Point,
    wall: boolean,
    held: (x: number, y: number) => number,
    traced = 0
  ) => {
    const rank = traced > 0 ? 1 + traced : wall ? 1 : 0;
    const cell = (x: number, y: number) =>
      `${Math.floor(x / SEAM_SNAP)}:${Math.floor(y / SEAM_SNAP)}`;
    // the cells around it as well as its own: two points a hair apart can sit
    // either side of a line of the grid, and rounding alone leaves them apart
    const already = [-1, 0, 1]
      .flatMap(dx =>
        [-1, 0, 1].map(dy => cell(point[0] + dx * SEAM_SNAP, point[1] + dy * SEAM_SNAP))
      )
      .flatMap(key => found.get(key) ?? [])
      .find(at => {
        const [x, y] = points[at] as Point;
        return Math.hypot(x - point[0], y - point[1]) <= SEAM_SNAP;
      });
    if (already !== undefined) {
      // where a wall meets the road, the wall has the say, and a traced seam
      // over both of them
      if (rank > (ranks[already] as number)) {
        heights[already] =
          traced > 0
            ? held(point[0], point[1])
            : footAt(
                point[0],
                point[1],
                terraceAt(point[0], point[1]) ?? heightAt(point[0], point[1])
              );
        ranks[already] = rank;
      }
      walls[already] = (walls[already] as boolean) || wall;
      return already;
    }
    const made = points.length;
    points.push(point);
    walls.push(wall);
    ranks.push(rank);
    const road = held(point[0], point[1]);
    const foot = footAt(
      point[0],
      point[1],
      terraceAt(point[0], point[1]) ?? heightAt(point[0], point[1])
    );
    heights.push(wall && traced === 0 ? road + (foot - road) * SEAM_TO_WALL : road);
    const key = cell(point[0], point[1]);
    found.set(key, [...(found.get(key) ?? []), made]);
    return made;
  };

  interface Piece {
    from: number;
    to: number;
    wall: boolean;
    traced: number;
    held: (x: number, y: number) => number;
  }

  /** Every piece of every line, its ends taken as points of the network. */
  let pieces: Piece[] = lines.flatMap(({ points: run, wall, level: held, traced = 0 }) =>
    run.slice(1).map((to, step) => ({
      from: place(run[step] as Point, wall, held, traced),
      to: place(to, wall, held, traced),
      wall,
      traced,
      held,
    }))
  );

  /**
   * Cutting the lines at their crossings is not done in one pass: a point set
   * down on a crossing is taken together with whatever already lies within a
   * few centimeters of it, which moves the line it was cut into - and a line
   * that moves can come to cross something it did not cross before. So the cut
   * is made again until nothing crosses anything any more.
   */
  Array.from({ length: SEAM_PASSES }, () => 0).every(() => {
    const cuts = pieces.map(() => [] as number[]);
    const boxes = pieces.map(({ from, to }) => {
      const [[ax, ay], [bx, by]] = [points[from] as Point, points[to] as Point];
      return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)] as const;
    });

    /**
     * Where a point lies on the middle of a piece it is not an end of, as a
     * share of the way along it. Two lines that only touch are as much a fault
     * as two that cross: a point five millimeters off a kerb it is not a point
     * of lets the kerb run past it, and the triangulation folds over it.
     */
    const onto = (at: number, piece: Piece) => {
      if (at === piece.from || at === piece.to) {
        return undefined;
      }
      const [px, py] = points[at] as Point;
      const [[ax, ay], [bx, by]] = [points[piece.from] as Point, points[piece.to] as Point];
      const length = (bx - ax) ** 2 + (by - ay) ** 2;
      const share = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (length || 1);
      const [nx, ny] = [ax + (bx - ax) * share, ay + (by - ay) * share];
      const clear = (end: Point) => Math.hypot(nx - end[0], ny - end[1]) > SEAM_SNAP;
      return share > 0 &&
        share < 1 &&
        Math.hypot(px - nx, py - ny) <= SEAM_SNAP &&
        clear([ax, ay]) &&
        clear([bx, by])
        ? share
        : undefined;
    };

    pieces.forEach((one, first) => {
      const [ax, ay] = points[one.from] as Point;
      const [bx, by] = [(points[one.to] as Point)[0] - ax, (points[one.to] as Point)[1] - ay];
      const box = boxes[first] as readonly number[];
      pieces.slice(first + 1).forEach((other, second) => {
        const step = first + 1 + second;
        const [minX, minY, maxX, maxY] = boxes[step] as readonly number[];
        if (
          (minX as number) > (box[2] as number) + SEAM_SNAP ||
          (maxX as number) < (box[0] as number) - SEAM_SNAP ||
          (minY as number) > (box[3] as number) + SEAM_SNAP ||
          (maxY as number) < (box[1] as number) - SEAM_SNAP
        ) {
          return;
        }
        [other.from, other.to].forEach(end => {
          const share = onto(end, one);
          if (share !== undefined) {
            (cuts[first] as number[]).push(share);
          }
        });
        [one.from, one.to].forEach(end => {
          const share = onto(end, other);
          if (share !== undefined) {
            (cuts[step] as number[]).push(share);
          }
        });

        // two pieces that already meet at a point of the network cross nowhere
        // else, and a crossing anywhere else is cut wherever it falls - close to
        // an end, the cut is taken together with that end
        const ends = [one.from, one.to];
        if (ends.includes(other.from) || ends.includes(other.to)) {
          return;
        }
        const [cx, cy] = points[other.from] as Point;
        const [dx, dy] = [(points[other.to] as Point)[0] - cx, (points[other.to] as Point)[1] - cy];
        const denominator = bx * dy - by * dx;
        if (Math.abs(denominator) < 1e-12) {
          return;
        }
        const t = ((cx - ax) * dy - (cy - ay) * dx) / denominator;
        const u = ((cx - ax) * by - (cy - ay) * bx) / denominator;
        if (t <= 0 || t >= 1 || u <= 0 || u >= 1) {
          return;
        }
        (cuts[first] as number[]).push(t);
        (cuts[step] as number[]).push(u);
      });
    });

    // a cut that lands on an end of its own piece changes nothing, and a pass
    // that changes nothing is the last
    let changed = false;
    pieces = pieces.flatMap((piece, step) => {
      const [from, to] = [points[piece.from] as Point, points[piece.to] as Point];
      const along = [0, ...[...new Set(cuts[step])].sort((one, other) => one - other), 1];
      const made = along.map(t =>
        place(
          [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as Point,
          piece.wall,
          piece.held,
          piece.traced
        )
      );
      const split = made.slice(1).flatMap((at, sub) => {
        const before = made[sub] as number;
        return at === before ? [] : [{ ...piece, from: before, to: at }];
      });
      changed = changed || split.length !== 1;
      return split;
    });
    return changed;
  });

  /**
   * What the passes cannot part: two pieces lying along each other a hand's
   * width apart, where a wall's tip and the wing carried past it come out drawn
   * twice. Splitting them only makes shorter pieces that still lie along each
   * other, and asking where they cross is asking a question the arithmetic
   * cannot answer - two lines that nearly share a direction cross nowhere in
   * particular. So they are found by how close they lie instead, and the
   * shorter of the two goes.
   */
  const aside = (point: Point, from: Point, to: Point) => {
    const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
    const length = dx * dx + dy * dy || 1;
    const share = Math.min(
      Math.max(((point[0] - from[0]) * dx + (point[1] - from[1]) * dy) / length, 0),
      1
    );
    return Math.hypot(from[0] + dx * share - point[0], from[1] + dy * share - point[1]);
  };

  const span = (piece: Piece) => {
    const [from, to] = [points[piece.from] as Point, points[piece.to] as Point];
    return { from, to, length: Math.hypot(to[0] - from[0], to[1] - from[1]) };
  };

  const doubled = new Set<number>();
  pieces.forEach((one, first) => {
    if (doubled.has(first)) {
      return;
    }
    const here = span(one);
    pieces.slice(first + 1).forEach((other, second) => {
      const step = first + 1 + second;
      if (doubled.has(step)) {
        return;
      }
      const there = span(other);
      const shorter = here.length < there.length;
      const [small, big] = shorter ? [here, there] : [there, here];
      // and only along it: a piece a few centimeters long has both its ends
      // that close to any line it merely crosses, and taking it away breaks
      // the line it is a piece of
      const [sx, sy] = [small.to[0] - small.from[0], small.to[1] - small.from[1]];
      const [bx, by] = [big.to[0] - big.from[0], big.to[1] - big.from[1]];
      const along = Math.abs(sx * by - sy * bx) <= Math.sin(SEAM_ALONG) * small.length * big.length;
      // and beside it, not beyond it: measured to the nearest point of the
      // other, a short piece carrying a line on past its end lies right
      // against that end, and is no double of anything
      const beside = (end: Point) => {
        const share =
          ((end[0] - big.from[0]) * bx + (end[1] - big.from[1]) * by) / (big.length ** 2 || 1);
        return share >= -1e-6 && share <= 1 + 1e-6 && aside(end, big.from, big.to) < SEAM_DOUBLE;
      };
      if (along && beside(small.from) && beside(small.to)) {
        doubled.add(shorter ? first : step);
      }
    });
  });

  const edges = pieces.flatMap((piece, step) =>
    piece.from === piece.to || doubled.has(step) ? [] : [[piece.from, piece.to] as [number, number]]
  );

  return { points, edges, heights, walls };
}

/** Every line a wall of the two crossings is drawn along, plates included. */
const WALL_LINES = [...WALL_RUNS, CROSSING.plate, MILL_ROAD_DECK].filter(run => run.length > 1);

/**
 * The handles a seam is picked out between: the points the two crossings are
 * set out from, each once on the top edge of its wall and once at the foot,
 * and on the road the ends of the carriageway and everywhere a wall crosses it.
 * What runs between two handles is an edge something is already drawn along, so
 * naming the points is enough. Debug only.
 */
/**
 * The height a mark is topped out at: the rule the rest of them follow, and the
 * two lifts that take some of them off it. The deck reads these as much as the
 * handles do, so they are worked out here rather than inside either.
 */
const MARK_TOP = (() => {
  const { top } = LEVEL_OF;

  /**
   * The deck's two corners either side of the lane are raised together until
   * the line between them meets the lane's own surface where it crosses it.
   * They stand where the plate has to take the lane on, and the rule the rest
   * of the marks follow tops them out at the main road instead, which leaves
   * the lane running into the side of the plate rather than onto it.
   */
  const laneLift = (() => {
    const [one, other] = [DECK_OUTLINE[1], DECK_OUTLINE[2]];
    if (one === undefined || other === undefined) {
      return { at: [one, other], by: 0 };
    }
    // carried on a hand's width: the lane's kerb ends on the deck's edge, and a
    // crossing at the very end of a line is one the arithmetic may not find
    const met = WAY_KERBS.filter(({ main }) => !main).flatMap(({ points }) =>
      crossings([one, other], extended(points, 0.05)).map(({ at, along }) => ({ at, along }))
    );
    const found = met[0];
    if (found === undefined) {
      return { at: [one, other], by: 0 };
    }
    // the crossing's count runs along the two corners, so it is the share of
    // the way from the one to the other
    const share = Math.min(Math.max(found.along, 0), 1);
    const line = top(one) * (1 - share) + top(other) * share;
    return { at: [one, other], by: LEVEL_OF.road(found.at) - line };
  })();

  /**
   * And the corner between them is set halfway between the two it joins: the
   * one the lane comes up to, and the tie where the near bank meets the plate.
   */
  const middleLift = (() => {
    const nose = DECK_OUTLINE[0];
    const corner = DECK_OUTLINE[1];
    const tie = DECK_BANKS.near[DECK_BANKS.near.length - 1];
    if (nose === undefined || corner === undefined || tie === undefined) {
      return { at: nose, by: 0 };
    }
    return { at: nose, by: (top(corner) + laneLift.by + top(tie)) / 2 - top(nose) };
  })();

  const same = (one: Point | undefined, other: Point) =>
    one !== undefined && one[0] === other[0] && one[1] === other[1];

  const lifted = (at: Point) =>
    laneLift.at.some(corner => same(corner, at))
      ? laneLift.by
      : same(middleLift.at, at)
        ? middleLift.by
        : 0;

  return (at: Point) => top(at) + lifted(at);
})();

export const SEAM_PICKS: SeamHandle[] = (() => {
  const { foot } = LEVEL_OF;

  const walls = [
    ...(
      [
        ['deck', DECK_MARKS],
        ['culvert', CULVERT.marks],
        ['crossing', CROSSING_MARKS],
        ['mill', MILL_MARKS],
      ] as const
    ).flatMap(([source, marks]) =>
      marks.flatMap((at, mark): SeamHandle[] => [
        { key: `${source}:${mark}:top`, at, level: MARK_TOP(at), edge: 'top' },
        {
          key: `${source}:${mark}:foot`,
          at,
          level: foot(at) + (MARK_TOP(at) - LEVEL_OF.top(at)),
          edge: 'foot',
        },
      ])
    ),
    // and the stairs' and their wall's, each at its own top, and at its foot on
    // the ground as it is drawn there - not the brook's, which the walls in the
    // water are founded on, 1.2m further down, nor the height field's, which
    // beside a road is not what the ground is drawn to: it is cleared for 4m
    // and spanned from the kerb, up to 1.25m over the field
    ...STAIRS_MARKS.flatMap(({ name, at, top, foot }): SeamHandle[] =>
      foot === null
        ? []
        : [
            { key: `stairs:${name}:top`, at, level: top, edge: 'top' },
            {
              key: `stairs:${name}:foot`,
              at,
              level: foot ?? DRAWN_GROUND()(at[0], at[1]) ?? heightAt(at[0], at[1]),
              edge: 'foot',
            },
          ]
    ),
  ];
  // one worked out where two lines cross is known by where it is, to the
  // centimeter
  const placed = ([x, y]: Point, edge: SeamEdge) => `${edge}:${x.toFixed(2)},${y.toFixed(2)}`;

  // and on the ways themselves: where one ends, where a wall runs across it,
  // and where two of them meet - a seam that leaves a wall has to come back to
  // a surface there, and the lane north of the mill is one as much as the road
  const kerbs = WAY_KERBS.map(({ points }) => points);
  const banks = WATER_EDGES.filter(({ bed }) => !bed).map(({ points }) => points);
  const beds = WATER_EDGES.filter(({ bed }) => bed).map(({ points }) => points);
  const ends = kerbs.flatMap(kerb => [kerb[0] as Point, kerb[kerb.length - 1] as Point]);
  // a wall that runs along the kerb rather than over it crosses it at every
  // wobble of the two lines, and none of those is a place a seam turns off
  const across = (kerb: Point[], line: Point[], at: Point) => {
    const [one, other] = [nearestOn(kerb, at[0], at[1]), nearestOn(line, at[0], at[1])];
    const turn = (heading: [number, number]) => Math.atan2(heading[1], heading[0]);
    const angle = Math.abs(turn(one.heading) - turn(other.heading)) % Math.PI;
    return Math.min(angle, Math.PI - angle) > Math.PI / 9;
  };
  const met = kerbs.flatMap((kerb, step) =>
    [...WALL_LINES, ...kerbs.slice(step + 1)].flatMap(line =>
      crossings(kerb, line)
        .map(({ at }) => at)
        .filter(at => across(kerb, line, at))
    )
  );

  // and the same along the water: where a bank ends, and where it runs under a
  // road or past a wall
  const along = (lines: Point[][]) => [
    ...lines.flatMap(line => [line[0] as Point, line[line.length - 1] as Point]),
    ...lines.flatMap(line =>
      [...WALL_LINES, ...kerbs].flatMap(other =>
        crossings(line, other)
          .map(({ at }) => at)
          .filter(at => across(line, other, at))
      )
    ),
  ];
  const water = [
    ...along(banks).map((at): SeamHandle => ({
      key: placed(at, 'water'),
      at,
      level: LEVEL_OF.water(at),
      edge: 'water',
    })),
    // and on the bed, which is where the ground is held down to
    ...along(beds).map((at): SeamHandle => ({
      key: placed(at, 'bed'),
      at,
      level: LEVEL_OF.bed(at),
      edge: 'bed',
    })),
  ];
  const surface = [...ends, ...met].map((at): SeamHandle => ({
    key: placed(at, 'road'),
    at,
    level: LEVEL_OF.road(at),
    edge: 'road',
  }));

  const taken: SeamHandle[] = [];
  const near = (handle: SeamHandle) =>
    taken.some(
      other =>
        other.edge === handle.edge &&
        // and only where they stand at one height: the wall's corner is a tread
        // from the stairs' edge, 2.3m over it, and taken for it, it was gone
        Math.abs(other.level - handle.level) < PICK_SAME &&
        Math.hypot(other.at[0] - handle.at[0], other.at[1] - handle.at[1]) < PICK_SPACING
    );
  // a wall's point is its top and its foot together, and the top decides: two
  // feet a tread apart on the ground are at one height whatever stands on them
  const pairs = Array.from({ length: walls.length / 2 }, (_, pair) => [
    walls[pair * 2] as SeamHandle,
    walls[pair * 2 + 1] as SeamHandle,
  ]).filter(pair => {
    const close = near(pair[0] as SeamHandle);
    if (!close) {
      taken.push(...pair);
    }
    return !close;
  });
  // the points a thing lies on the ground at, one height only
  const lying = STAIRS_MARKS.flatMap(({ name, at, top, foot }): SeamHandle[] =>
    foot !== null
      ? []
      : [
          {
            key: `stairs:${name}:lying`,
            at,
            level: top,
            edge: 'top',
            lying: true,
          },
        ]
  );
  // and the reference points set on the bench, last, so that setting one
  // never renumbers another handle - each at the height it was set to
  const points = POINTS.map(([x, y, level], point): SeamHandle => ({
    key: `point:${point}`,
    at: [x, y],
    level,
    edge: 'point',
    lying: true,
  }));
  return [
    ...pairs.flat(),
    ...[...lying, ...surface, ...water].filter(handle => {
      const close = near(handle);
      if (!close) {
        taken.push(handle);
      }
      return !close;
    }),
    ...points,
  ];
})();

/** Each handle by its name. */
const PICK_BY_KEY = new Map(SEAM_PICKS.map(handle => [handle.key, handle]));

/** The handle a name names, if there is one. */
export const pickByKey = (key: string): SeamHandle | undefined => PICK_BY_KEY.get(key);

/**
 * Every line a seam can be traced along from one handle to the next: the walls,
 * the kerbs and the water's lines - not the outlines of the decks and plates.
 * Those came after most of the seams were traced, and a leg that found one ran
 * along it instead of the way it was traced: the ground kept under the mill's
 * crossing came out 3.3m shorter round, and the four triangles taking the
 * second crossing's walls into the ground enclosed nothing.
 */
const SEAM_ROUTES: Point[][] = [
  ...WALL_RUNS.filter(run => run.length > 1),
  ...[...WAY_KERBS, ...WATER_EDGES].map(({ points }) => points),
];

/** Which points of the seam network each of its points is joined to. */
const SEAM_GRAPH = once(() => {
  const { points, edges } = SEAM();
  const joined: number[][] = points.map(() => []);
  edges.forEach(([from, to]) => {
    (joined[from] as number[]).push(to);
    (joined[to] as number[]).push(from);
  });
  return joined;
});

/** The point of the network nearest somewhere, as long as it is near at all. */
function joined(at: Point): number | undefined {
  const closest = SEAM().points.reduce(
    (best, [x, y], index) => {
      const distance = Math.hypot(x - at[0], y - at[1]);
      return distance < best.distance ? { distance, index } : best;
    },
    { distance: Infinity, index: -1 }
  );
  return closest.distance > TO_NETWORK ? undefined : closest.index;
}

/**
 * The shortest way through the seam network from one place to another. Two
 * handles that share no line of their own are still joined by lines: a wall
 * meets the road, the road runs on to the next wall, and the way between them
 * is that chain rather than a straight cut across the ground.
 */
function through(from: Point, to: Point): Point[] | undefined {
  const [start, goal] = [joined(from), joined(to)];
  const { points } = SEAM();
  const graph = SEAM_GRAPH();
  if (start === undefined || goal === undefined || start === goal) {
    return undefined;
  }

  const cost = points.map(() => Infinity);
  const came: number[] = points.map(() => -1);
  const left = new Set<number>(points.map((_, index) => index));
  cost[start] = 0;

  while (left.size > 0) {
    const at = [...left].reduce((best, index) =>
      (cost[index] as number) < (cost[best] as number) ? index : best
    );
    if (at === goal || (cost[at] as number) === Infinity) {
      break;
    }
    left.delete(at);
    (graph[at] ?? []).forEach(next => {
      const [ax, ay] = points[at] as Point;
      const [bx, by] = points[next] as Point;
      const step = (cost[at] as number) + Math.hypot(bx - ax, by - ay);
      if (step < (cost[next] as number)) {
        cost[next] = step;
        came[next] = at;
      }
    });
  }

  if ((cost[goal] as number) === Infinity) {
    return undefined;
  }
  const back: Point[] = [];
  for (let at = goal; at !== -1; at = came[at] as number) {
    back.push(points[at] as Point);
  }
  return back.reverse();
}

/**
 * The stretch from one handle to the next: along whatever line the two of them
 * both sit on, which is the whole point of picking handles rather than points,
 * else through the network of lines that joins them, and straight across if
 * there is no way at all or only one far round. The height eases from the one
 * to the other along the way.
 */
function tracked(from: SeamHandle, to: SeamHandle): { at: Point; level: number }[] {
  const along = SEAM_ROUTES.flatMap(line => {
    const [one, other] = [
      nearestOn(line, from.at[0], from.at[1]),
      nearestOn(line, to.at[0], to.at[1]),
    ];
    if (one.distance > ON_ROUTE || other.distance > ON_ROUTE) {
      return [];
    }
    const forth = one.along <= other.along;
    const [first, last] = forth ? [one, other] : [other, one];
    const middle = line.filter((_, step) => step > first.along && step < last.along);
    const points = [from.at, ...(forth ? middle : [...middle].reverse()), to.at];
    return [{ points, length: runs(points) }];
  });

  const shared = along.sort((one, other) => one.length - other.length)[0]?.points;
  const across = Math.hypot(to.at[0] - from.at[0], to.at[1] - from.at[1]);
  const chained = (() => {
    const way = shared === undefined ? through(from.at, to.at) : undefined;
    return way === undefined || runs([from.at, ...way, to.at]) > across * ROUTE_DETOUR
      ? undefined
      : way;
  })();
  // stepped the way a wall is, whichever way it was found: two points read the
  // edge's height at the ends alone, and a wall line is drawn between its
  // corners - a foot traced along one from end to end ran 0.19m under the
  // wall's own foot in between
  const points = resample(
    shared ?? (chained === undefined ? [from.at, to.at] : [from.at, ...chained, to.at]),
    WALL_STEP
  );
  // the height comes off the edges themselves at every step of the way, and
  // what eases from the one handle to the other is which of them is read. A
  // handle lifted off its edge's rule - the corners the lane comes up to stand
  // 0.37m over it - carries its lift along, easing out towards the next, or
  // the leg leaves the handle at the rule's height rather than its own
  return eased(from, to, points);
}

/** A path of handles as it runs on the ground, ready to be drawn. */
export function pathOf(path: number[], closed: boolean): number[] {
  const handles = path.flatMap(index => {
    const handle = SEAM_PICKS[index];
    return handle === undefined ? [] : [handle];
  });
  return handles
    .flatMap((handle, step) => {
      const next = handles[step + 1] ?? (closed ? handles[0] : undefined);
      return next === undefined ? [] : tracked(handle, next);
    })
    .flatMap(({ at, level }) => [at[0], level + 0.06, -at[1]]);
}

/** Each traced seam as it runs on the ground, or nothing where a handle is gone. */
export const TRACED = once(() =>
  [...SEAMS.map(seam => ({ seam, keep: false })), ...KEPT.map(seam => ({ seam, keep: true }))].map(
    ({ seam, keep }) => {
      const handles = seam.map(([x, y, edge]) =>
        SEAM_PICKS.find(
          handle =>
            (edge === undefined || handle.edge === edge) &&
            Math.hypot(handle.at[0] - x, handle.at[1] - y) <= SEAM_FOUND
        )
      );
      if (handles.some(handle => handle === undefined)) {
        return undefined;
      }
      // started on a handle that is no end of a step, so every step has the
      // way it came along before it
      const listed = handles as SeamHandle[];
      const alone = (step: number) =>
        [step - 1, step + 1].every(other => {
          const next = listed[(other + listed.length) % listed.length] as SeamHandle;
          const here = listed[step] as SeamHandle;
          return Math.hypot(next.at[0] - here.at[0], next.at[1] - here.at[1]) > 1e-6;
        });
      const start = Math.max(
        0,
        listed.findIndex((_, step) => alone(step))
      );
      const found = [...listed.slice(start), ...listed.slice(0, start)];
      // each leg ends where the next begins, so the joints are taken once
      const legs = found.flatMap((handle, step) =>
        tracked(handle, found[(step + 1) % found.length] as SeamHandle)
      );
      const same = (one: Point, other: Point) =>
        Math.hypot(one[0] - other[0], one[1] - other[1]) <= 1e-6;

      /**
       * A leg from a wall's foot to its top at the same place is a step the
       * ground cannot take: it holds one height at a point. So the step is laid a
       * hand's width wide and into the wall beside it: the corner keeps the top,
       * which the ground beyond it meets, and the foot is set along whichever leg
       * runs on the wall - the one the seam came along, else the one it goes on
       * by - so the face the ground makes lies in the wall's own. Set beside the
       * wall, it left a sliver of sky under the corner; with the foot on the
       * corner, the ground past the end of the road wall dipped 1.6m under the
       * kerb it runs on from.
       */
      const onWall = (one: Point, other: Point) =>
        WALL_RUNS.some(
          line =>
            nearestOn(line, (one[0] + other[0]) / 2, (one[1] + other[1]) / 2).distance <= ON_ROUTE
        );
      const aside = (from: Point, towards: Point): Point => {
        const [dx, dy] = [towards[0] - from[0], towards[1] - from[1]];
        const length = Math.hypot(dx, dy);
        const by = Math.min(SEAM_STEP, length / 2) / length;
        return [from[0] + dx * by, from[1] + dy * by];
      };
      const path = legs.reduce<{ at: Point; level: number }[]>((kept, point, step) => {
        const before = kept[kept.length - 1];
        if (before === undefined || !same(before.at, point.at)) {
          return [...kept, point];
        }
        if (Math.abs(before.level - point.level) < 1e-3) {
          return kept;
        }
        const [top, foot] = [
          Math.max(before.level, point.level),
          Math.min(before.level, point.level),
        ];
        const corner = { at: point.at, level: top };
        const came = [...kept].reverse().find(({ at }) => !same(at, point.at));
        const onwards = legs.slice(step + 1).find(({ at }) => !same(at, point.at));
        const along =
          came !== undefined && onWall(came.at, point.at)
            ? 'came'
            : onwards !== undefined && onWall(point.at, onwards.at)
              ? 'onwards'
              : came === undefined
                ? 'onwards'
                : 'came';
        if (along === 'onwards' && onwards !== undefined) {
          return [...kept.slice(0, -1), corner, { at: aside(point.at, onwards.at), level: foot }];
        }
        return came === undefined
          ? kept
          : [...kept.slice(0, -1), { at: aside(point.at, came.at), level: foot }, corner];
      }, []);
      return {
        points: path.map(({ at }) => at),
        levels: path.map(({ level }) => level),
        keep,
      };
    }
  )
);

/** The kept ground, ring by ring. */
export const KEEPS = once(() =>
  TRACED().flatMap(ring => (ring === undefined || !ring.keep ? [] : [boxed(ring.points)]))
);

/**
 * The network the ground is actually held to: the cut, without whatever lies
 * inside kept ground. Held there, the ground would follow the walls and the ties
 * that cross it rather than the height field it is kept for.
 */
export const HELD = once(() => {
  const { points, edges, heights } = CUT();
  const kept = (point: Point) => KEEPS().every(({ holds }) => !holds(point));
  const renumbered = points.map(point => kept(point));
  let next = 0;
  const index = renumbered.map(keep => (keep ? next++ : -1));

  /**
   * And the ground never lower than a surface it meets there: on a way's edge
   * no lower than the band, on a bank no lower than the water. A wall's top is
   * set under the road and its foot can stand in the water, and whichever seam
   * or wall held a point there had the ground follow it down - which leaves a
   * slit under the band's edge, or a wedge under the water's, with nothing in
   * it: 2cm along the kerb from 39, 9cm and 12cm under the water at the
   * second crossing's corners on the bank. Not on kept ground, though: that is
   * the ground under a bridge, and a kerb over it is no surface it meets -
   * lifted to one, it rose 1.5m to the road over the mill's crossing. And on a
   * bank the water decides alone: where a kerb crosses one, the road is going
   * over the water, and lifted to it the bank climbed from the water to the
   * road within a hand's width beside the wall's end.
   */
  const banks = WATER_EDGES.filter(({ bed }) => !bed);
  const onBank = ([x, y]: Point) =>
    banks.some(({ points: line }) => nearestOn(line, x, y).distance <= FLOOR_ON);
  const underBridge = ([x, y]: Point) =>
    KEEPS().some(
      ({ ring, holds }) =>
        holds([x, y]) || nearestOn([...ring, ring[0] as Point], x, y).distance <= FLOOR_ON
    );
  // under a bridge only the water is a floor: the kerb over it is not
  const floorOf = ([x, y]: Point, height: number) =>
    onBank([x, y]) || !underBridge([x, y])
      ? (onBank([x, y]) ? banks : WAY_KERBS).reduce(
          (low, { points: line, level }) =>
            nearestOn(line, x, y).distance <= FLOOR_ON ? Math.max(low, level(x, y)) : low,
          height
        )
      : height;

  return {
    points: points.filter((_, step) => renumbered[step]),
    heights: heights
      .map((height, step) => floorOf(points[step] as Point, height))
      .filter((_, step) => renumbered[step]),
    edges: edges.flatMap(([from, to]) => {
      const [a, b] = [points[from] as Point, points[to] as Point];
      const middle: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return renumbered[from] && renumbered[to] && kept(middle)
        ? [[index[from] as number, index[to] as number] as [number, number]]
        : [];
    }),
  };
});

/**
 * The seam as it stands - its points, their heights and the edges between
 * them - for drawing it to look at and argue with before anything is built
 * to it.
 */
export function seamNetwork(): { points: Point[]; heights: number[]; edges: [number, number][] } {
  return HELD();
}

/** The traced seams as rings on the plan, `undefined` for one that was not found. */
export function tracedSeams(): (Point[] | undefined)[] {
  return TRACED().map(ring => ring?.points);
}
