import type { Color } from 'three';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshLambertMaterial,
  Vector3,
} from 'three';

import type { Point } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import { nearestOn, once } from '../../utils/geometry.utils.js';
import { mitred, strut } from '../../utils/mesh.utils.js';
import { FILL_LINES, FILLS } from '../seam/fills.js';
import { pickByKey } from '../seam/seam.js';
import { heightAt, WAY_KERBS } from '../terrain/ground.js';
import { CROSSING, MILL_ROAD_DECK, MILL_SIDE_DECK } from './crossings.js';
import { DECK_TOP } from './decks.js';
import type { SeamHandle } from './measures.js';
import { BANK_WALL_OVER, RAIL, STAIRS } from './measures.js';
import { STAIRS_PLAN } from './stairs.js';

/**
 * The steel pipe railings on the walls and along the stairs.
 */
/**
 * The railings on the walls, from the photographs: round steel pipe, a post
 * at most every guard rail section (`RAIL`), a top and a middle rail - each
 * run given as the pairs of handles on the face and the back of the wall it
 * stands on, by their names, and set on the wall's middle between them, on
 * its coping - so it follows the walls wherever they are set - and how far
 * short of its first pair it starts, towards the next.
 */
const RAILINGS: { short?: number; pairs: [face: string, back: string][] }[] = [
  // round the U and on along the upper wall and its bend: beside the stairs'
  // top - a tread short of it, where the sections counted end and the wall
  // runs on bare to the top step - the U's corner, its end, where the upper
  // wall starts, its far end, the bend's kink and its end
  {
    short: STAIRS_PLAN?.tread ?? 0,
    pairs: [
      ['stairs:top-north:top', 'stairs:u-top-back:top'],
      ['stairs:u-corner:top', 'stairs:u-corner-back:top'],
      ['stairs:u-end:top', 'stairs:u-inside:top'],
      ['stairs:upper-start:top', 'stairs:u-back-end-inside:top'],
      ['stairs:upper-end:top', 'stairs:upper-end-back:top'],
      ['stairs:bend-1:top', 'stairs:bend-1-back:top'],
      ['stairs:bend-end:top', 'stairs:bend-end-back:top'],
    ],
  },
];

/**
 * The railings' measures: how high the top rail runs over the coping -
 * measured off the photographs against the banner's 3.40m by 1.73m - and over
 * the treads along the stairs - against the steps' known rise - how high the
 * middle one, how thick the pipe is, and how far each is turned about its length -
 * on an edge, it reads rounder - how far in from the stairs' edge it stands
 * along them, and how round the stairs' top rail bends down into their lowest
 * post.
 */
const RAILING = {
  top: 0.95,
  stairs: 0.9,
  middle: 0.5,
  pipe: 0.04,
  roll: Math.PI / 4,
  inset: 0.06,
  bend: 0.15,
} as const;

/**
 * The names the dumps and the railings give that no handle has: a dump with
 * one in its ring is not drawn at all, a railing leaves the pair out.
 */
/**
 * The railings on the bridges and decks, from the photographs: timber, laid
 * like a ladder - posts, a flat hand rail over them, a beam low down and slats
 * between the two. Each follows the edge of the deck it stands on, the way
 * that edge is set out - along the road where it follows the road, straight
 * where it runs straight - through the handles given on it, from the first to
 * the last, `LADDER.within` in from the edge.
 */
const LADDERS: { through: string[] }[] = [
  // the southern crossing's south western side, from the wall's turning up
  // the road over the water to the wing past it
  { through: ['crossing:13:top', 'crossing:7:top', 'crossing:11:top', 'crossing:3:top'] },
  // and its north eastern side, from the wing up the road to the wall's
  // turning down it
  { through: ['crossing:1:top', 'crossing:5:top', 'crossing:9:top', 'crossing:15:top'] },
  // the mill's deck, along the road's edge from its corner by the lane down
  // the valley
  { through: ['deck:4:top', 'deck:16:top', 'deck:17:top', 'deck:3:top'] },
  // and its other half, along the road wall's face from its end to the
  // verge, and round the lane's side by the plate's nose to its corner
  { through: ['deck:6:top', 'deck:8:top', 'deck:0:top', 'deck:1:top'] },
];

/**
 * The band the railings stand on: along the deck's edge from end to end,
 * raised over the deck by so much, and as wide as the strip between the edge
 * and the kerb where the edge follows the road - a kerb nearer than `near` -
 * or `width` where it does not, in meters.
 */
const LEDGE = { rise: 0.15, width: 0.3, near: 0.7 } as const;

/** The edges the railings stand along: the decks' and the southern crossing's plate's. */
const DECK_EDGES = once(() =>
  [MILL_ROAD_DECK, MILL_SIDE_DECK, CROSSING.plate].filter(ring => ring.length > 2)
);

/**
 * The way along a deck's edge from one of its corners to another, whichever
 * way round it is shorter - the edge closes, and the way may pass its start.
 */
function aroundEdge(from: Point, to: Point): Point[] | undefined {
  const near = (ring: Point[], at: Point) =>
    ring.findIndex(point => Math.hypot(point[0] - at[0], point[1] - at[1]) < 0.01);
  const ring = DECK_EDGES().find(edge => near(edge, from) >= 0 && near(edge, to) >= 0);
  if (ring === undefined) {
    return undefined;
  }
  const [start, end] = [near(ring, from), near(ring, to)];
  const walk = (step: number) => {
    const way: Point[] = [];
    for (let at = start; at !== end; at = (at + step + ring.length) % ring.length) {
      way.push(ring[at] as Point);
    }
    return [...way, ring[end] as Point];
  };
  const length = (way: Point[]) =>
    way.slice(1).reduce((sum, [x, y], step) => {
      const [px, py] = way[step] as Point;
      return sum + Math.hypot(x - px, y - py);
    }, 0);
  const [onwards, back] = [walk(1), walk(-1)];
  return length(onwards) <= length(back) ? onwards : back;
}

/**
 * A line moved to one side by a distance a piece - each piece its own - each
 * corner where the two moved pieces meet: a line kept that far from each.
 */
function offsetPieces(points: Point[], distances: number[]): Point[] {
  const normal = (from: Point, to: Point): Point => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    return [-(to[1] - from[1]) / length, (to[0] - from[0]) / length];
  };
  const moved = points.slice(1).map((to, step) => {
    const from = points[step] as Point;
    const [nx, ny] = normal(from, to);
    const by = distances[step] ?? 0;
    return [
      [from[0] + nx * by, from[1] + ny * by],
      [to[0] + nx * by, to[1] + ny * by],
    ] as [Point, Point];
  });
  const meet = ([a, b]: [Point, Point], [c, d]: [Point, Point]): Point => {
    const [r, t] = [
      [b[0] - a[0], b[1] - a[1]],
      [d[0] - c[0], d[1] - c[1]],
    ] as [Point, Point];
    const cross = r[0] * t[1] - r[1] * t[0];
    // pieces running on straight meet where either ends
    if (Math.abs(cross) < 1e-9) {
      return b;
    }
    const share = ((c[0] - a[0]) * t[1] - (c[1] - a[1]) * t[0]) / cross;
    return [a[0] + r[0] * share, a[1] + r[1] * share];
  };
  return points.map((_, step) => {
    const [before, after] = [moved[step - 1], moved[step]];
    return before === undefined
      ? (after as [Point, Point])[0]
      : after === undefined
        ? before[1]
        : meet(before, after);
  });
}

/**
 * A line moved a distance to one side, each corner mitred so that every piece
 * stays that far from its own: sharp corners stay sharp, and at the ends the
 * end pieces are moved square to themselves.
 */
function insetLine(points: Point[], distance: number): Point[] {
  const normal = (from: Point, to: Point): Point => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    return [-(to[1] - from[1]) / length, (to[0] - from[0]) / length];
  };
  return points.map((point, step) => {
    const [before, after] = [points[step - 1], points[step + 1]];
    const normals = [
      before === undefined ? undefined : normal(before, point),
      after === undefined ? undefined : normal(point, after),
    ].filter((one): one is Point => one !== undefined);
    const sum: Point = [
      normals.reduce((total, [x]) => total + x, 0),
      normals.reduce((total, [, y]) => total + y, 0),
    ];
    const length = Math.hypot(sum[0], sum[1]) || 1;
    const middle: Point = [sum[0] / length, sum[1] / length];
    const first = normals[0] ?? middle;
    const slant = Math.max(0.2, middle[0] * first[0] + middle[1] * first[1]);
    return [point[0] + (middle[0] * distance) / slant, point[1] + (middle[1] * distance) / slant];
  });
}

/**
 * The bridge railings' measures, in meters: posts square and how far apart at
 * most; the hand rail flat, its width and thickness and the height of its top
 * over the deck; the beam on edge, its thickness and height and how high its
 * foot is; the slats between them, across and along, and how far apart; and
 * how finely the curve they follow is laid.
 */
const LADDER = {
  post: 0.07,
  every: 1.8,
  rail: { width: 0.12, thickness: 0.03, top: 1 },
  beam: { width: 0.06, height: 0.03, foot: 0.1 },
  slat: { across: 0.03, along: 0.02, every: 0.11 },
  piece: 0.25,
  /** How far the posts reach down into the band they stand on, so none stands off it. */
  sunk: 0.05,
  /** How far the course turns before it is a corner, with a post in it, in radians. */
  corner: (15 * Math.PI) / 180,
  /** How near a right angle a corner is to have its post square in it, in radians. */
  squared: (20 * Math.PI) / 180,
  /** How near a corner a handle's post is taken into it, in meters. */
  snap: 0.5,
  /** How far in from the deck's edge the railing's middle runs. */
  within: BANK_WALL_OVER / 2,
  /** How far in from the deck's end each end post's outer face stands. */
  inset: 0.05,
} as const;

export function unknownHandles(): string[] {
  return [
    ...FILLS.flatMap(({ ring }) => ring),
    ...RAILINGS.flatMap(({ pairs }) => pairs.flat()),
    ...LADDERS.flatMap(({ through }) => through),
  ].filter(key => pickByKey(key) === undefined);
}

/**
 * A line on the plan walked by its length: where a distance along it lies,
 * which way it runs there, and how long it is.
 */
function walkedLine(points: Point[]) {
  const sums = points.reduce<number[]>(
    (walked, point, step) => [
      ...walked,
      step === 0
        ? 0
        : (walked[step - 1] as number) +
          Math.hypot(
            point[0] - (points[step - 1] as Point)[0],
            point[1] - (points[step - 1] as Point)[1]
          ),
    ],
    []
  );
  const length = sums[sums.length - 1] ?? 0;
  // past either end it runs on straight, the way its end piece points
  const at = (by: number): Point => {
    const found = sums.findIndex(sum => sum > by);
    const step =
      found === -1 ? points.length - 2 : Math.max(0, Math.min(found - 1, points.length - 2));
    const [from, to] = [points[step] as Point, points[step + 1] as Point];
    const span = (sums[step + 1] as number) - (sums[step] as number) || 1;
    const share = (by - (sums[step] as number)) / span;
    return [from[0] + (to[0] - from[0]) * share, from[1] + (to[1] - from[1]) * share];
  };
  return { at, length, sums };
}

/**
 * A flat board along a line of points, as wide across as given and as deep
 * up and down: one piece from end to end, each joint mitred - its section set
 * on the line halving the angle there, and widened so the board keeps its
 * width - so no gap opens and nothing stands out where it bends.
 */
function band(positions: number[], points: Vector3[], width: number, depth: number): void {
  const flat = (from: Vector3, to: Vector3) =>
    new Vector3(to.x - from.x, 0, to.z - from.z).normalize();
  // up crossed with the way, as `strut` takes its side, so the faces wind outwards
  const across = (way: Vector3) => new Vector3(way.z, 0, -way.x);
  const sections = points.map((point, step) => {
    const [before, after] = [points[step - 1], points[step + 1]];
    const ways = [
      before === undefined ? undefined : flat(before, point),
      after === undefined ? undefined : flat(point, after),
    ].filter((way): way is Vector3 => way !== undefined);
    const way = ways.reduce((sum, one) => sum.add(one), new Vector3()).normalize();
    // widened by as much as the mitre slants across the board
    const slant = Math.max(0.2, across(way).dot(across(ways[0] ?? way)));
    const side = across(way).multiplyScalar(width / 2 / slant);
    const up = new Vector3(0, depth / 2, 0);
    return [
      point.clone().add(side).add(up),
      point.clone().add(side).sub(up),
      point.clone().sub(side).sub(up),
      point.clone().sub(side).add(up),
    ];
  });
  const quad = (p: Vector3, q: Vector3, r: Vector3, t: Vector3) =>
    [p, q, r, p, r, t].forEach(v => positions.push(v.x, v.y, v.z));
  sections.slice(1).forEach((to, step) => {
    const from = sections[step] as Vector3[];
    [0, 1, 2, 3].forEach(k => {
      const l = (k + 1) % 4;
      quad(from[k] as Vector3, to[k] as Vector3, to[l] as Vector3, from[l] as Vector3);
    });
  });
  const [start, end] = [sections[0] as Vector3[], sections[sections.length - 1] as Vector3[]];
  quad(start[0] as Vector3, start[1] as Vector3, start[2] as Vector3, start[3] as Vector3);
  quad(end[3] as Vector3, end[2] as Vector3, end[1] as Vector3, end[0] as Vector3);
}

/**
 * The band a railing stands on: over the strip from the deck's edge in to
 * its inner line, `LEDGE.rise` over the deck all along, its faces down to the
 * deck on either side and across either end.
 */
function ledge(
  positions: number[],
  edge: Point[],
  inward: number,
  deck: (x: number, y: number) => number | undefined
): (x: number, y: number) => number {
  // how wide each piece is: to the kerb, where the edge runs along the road
  const widths = edge.slice(1).map((to, step) => {
    const from = edge[step] as Point;
    const [x, y] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const kerb = Math.min(...WAY_KERBS.map(({ points }) => nearestOn(points, x, y).distance));
    return kerb < LEDGE.near ? kerb : LEDGE.width;
  });
  const inner = offsetPieces(
    edge,
    widths.map(width => width * inward)
  );
  // the deck's top a hair in from a point, where its edge might just miss it
  const floor = (point: Point, toward: Point) => {
    const [dx, dy] = [toward[0] - point[0], toward[1] - point[1]];
    const length = Math.hypot(dx, dy) || 1;
    return (
      deck(point[0] + (dx / length) * 0.02, point[1] + (dy / length) * 0.02) ??
      deck(toward[0], toward[1])
    );
  };
  // the deck's top at either side of the band at each of its corners - one
  // missed, the other stands for it, both missed, the corner before
  const levels = edge.map((outer, step) => {
    const into = inner[step] as Point;
    return [floor(outer, into), floor(into, outer)] as const;
  });
  let last = levels.flatMap(([low, high]) => [low, high]).find(level => level !== undefined) ?? 0;
  const corners = edge.map((outer, step) => {
    const into = inner[step] as Point;
    const [seen, other] = levels[step] ?? [undefined, undefined];
    const low = seen ?? other ?? last;
    const high = other ?? seen ?? last;
    last = Math.max(low, high);
    const base = last;
    return {
      outer: [
        new Vector3(outer[0], low, -outer[1]),
        new Vector3(outer[0], base + LEDGE.rise, -outer[1]),
      ] as [Vector3, Vector3],
      inner: [
        new Vector3(into[0], high, -into[1]),
        new Vector3(into[0], base + LEDGE.rise, -into[1]),
      ] as [Vector3, Vector3],
    };
  });
  // a face wound so that it faces the way asked
  const face = (a: Vector3, b: Vector3, c: Vector3, d: Vector3, toward: Vector3) => {
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    const [p, q, r, t] = normal.dot(toward) >= 0 ? [a, b, c, d] : [a, d, c, b];
    [p, q, r, p, r, t].forEach(v => positions.push(v.x, v.y, v.z));
  };
  const up = new Vector3(0, 1, 0);
  corners.slice(1).forEach((to, step) => {
    const from = corners[step] as (typeof corners)[number];
    const out = from.outer[0].clone().sub(from.inner[0]).setY(0).normalize();
    face(from.outer[1], to.outer[1], to.inner[1], from.inner[1], up);
    face(from.outer[0], to.outer[0], to.outer[1], from.outer[1], out);
    face(from.inner[0], to.inner[0], to.inner[1], from.inner[1], out.clone().negate());
  });
  // the ends, each facing the way its own last piece runs out
  const [start, second] = [corners[0], corners[1]];
  const [end, before] = [corners[corners.length - 1], corners[corners.length - 2]];
  if (start !== undefined && second !== undefined && end !== undefined && before !== undefined) {
    const back = start.outer[0].clone().sub(second.outer[0]).setY(0).normalize();
    const on = end.outer[0].clone().sub(before.outer[0]).setY(0).normalize();
    face(start.outer[0], start.inner[0], start.inner[1], start.outer[1], back);
    face(end.outer[0], end.inner[0], end.inner[1], end.outer[1], on);
  }
  // the band's top under a point of the plan: as high as it is where that
  // point lies along the edge - it runs level across
  return (x, y) => {
    const { along } = nearestOn(edge, x, y);
    const step = Math.min(Math.floor(along), edge.length - 2);
    const [from, to] = [corners[step], corners[step + 1]];
    if (from === undefined || to === undefined) {
      return corners[0]?.outer[1].y ?? 0;
    }
    const share = Math.min(Math.max(along - step, 0), 1);
    return from.outer[1].y + (to.outer[1].y - from.outer[1].y) * share;
  };
}

/**
 * The bridges' railings, drawn in weathered timber: along each its posts at
 * every handle it passes and at most `LADDER.every` apart between, the hand
 * rail over them from end to end, and between each two posts the beam and
 * its slats - all of it laid along the road's curve, a short piece at a time,
 * on the deck's top wherever it stands.
 */
function createLadders(palette: Palette): Mesh[] {
  const boards: number[] = [];
  const bands: number[] = [];
  const deck = DECK_TOP();
  LADDERS.forEach(({ through }) => {
    const handles = through.flatMap(key => {
      const handle = pickByKey(key);
      return handle === undefined ? [] : [handle];
    });
    const first = handles[0];
    if (first === undefined || handles.length < 2) {
      return;
    }
    // the deck's edge from handle to handle, as it is set out, and that
    // moved in onto the deck - whichever side of it the deck is
    const edge = handles.slice(1).reduce<Point[] | undefined>(
      (way, handle, step) => {
        const piece = aroundEdge((handles[step] as SeamHandle).at, handle.at);
        return way === undefined || piece === undefined ? undefined : [...way, ...piece.slice(1)];
      },
      [first.at]
    );
    if (edge === undefined || edge.length < 2) {
      return;
    }
    const [one, other] = [insetLine(edge, LADDER.within), insetLine(edge, -LADDER.within)];
    const middle = (line: Point[]) => {
      const [a, b] = [line[0] as Point, line[1] as Point];
      return deck((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    };
    const inward = middle(one) !== undefined ? 1 : -1;
    const line = inward === 1 ? one : other;
    const ledgeTop = ledge(bands, edge, inward, deck);
    const stops = handles.map(({ at }) => nearestOn(line, at[0], at[1]).at as Point);
    const course = walkedLine(line);
    // the handles' places along it, where the posts are counted from
    // where the deck is under it from end to end: a course moved in square to
    // its last piece runs off the deck past a corner sharper than a right
    // angle, and is taken back to where the deck ends
    const onDeck = (by: number) => {
      const [x, y] = course.at(by);
      return deck(x, y) !== undefined;
    };
    const edgeOf = (inside: number, outside: number) => {
      let [a, b] = [inside, outside];
      for (let step = 0; step < 20; step++) {
        const half = (a + b) / 2;
        [a, b] = onDeck(half) ? [half, b] : [a, half];
      }
      return a;
    };
    const [from, until] = [
      onDeck(0) ? 0 : edgeOf(Math.min(0.5, course.length), 0),
      onDeck(course.length)
        ? course.length
        : edgeOf(Math.max(course.length - 0.5, 0), course.length),
    ];
    const stations = stops.map(stop => {
      const { along } = nearestOn(line, stop[0], stop[1]);
      const step = Math.min(Math.floor(along), line.length - 2);
      const [a, b] = [line[step] as Point, line[step + 1] as Point];
      return (course.sums[step] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]) * (along - step);
    });
    const places = stations.map(station => Math.min(Math.max(station, from), until));
    // past the deck's ends - where the rail runs on over the end posts - at
    // the height it has where it ends
    const over = (by: number, height: number) => {
      const [x, y] = course.at(by);
      const [lx, ly] = course.at(Math.min(Math.max(by, 0), course.length));
      return new Vector3(x, ledgeTop(lx, ly) + height, -y);
    };
    const facing = (by: number) => {
      const [a, b] = [course.at(by - 0.05), course.at(by + 0.05)];
      return new Vector3(b[0] - a[0], 0, -(b[1] - a[1])).normalize();
    };
    // the course's corners: where it turns by more than a bend does, as
    // distances along it
    const corners = line.flatMap((point, step) => {
      const [before, after] = [line[step - 1], line[step + 1]];
      if (before === undefined || after === undefined) {
        return [];
      }
      const turn = Math.abs(
        Math.atan2(
          (point[0] - before[0]) * (after[1] - point[1]) -
            (point[1] - before[1]) * (after[0] - point[0]),
          (point[0] - before[0]) * (after[0] - point[0]) +
            (point[1] - before[1]) * (after[1] - point[1])
        )
      );
      return turn > LADDER.corner ? [course.sums[step] as number] : [];
    });
    // and those square enough that a post stands square in them, its faces
    // along the rails rather than an edge into the corner: facing the way the
    // course comes in, as distances along it
    const square = new Map(
      line.flatMap((point, step): [number, Vector3][] => {
        const [before, after] = [line[step - 1], line[step + 1]];
        if (before === undefined || after === undefined) {
          return [];
        }
        const turn = Math.abs(
          Math.atan2(
            (point[0] - before[0]) * (after[1] - point[1]) -
              (point[1] - before[1]) * (after[0] - point[0]),
            (point[0] - before[0]) * (after[0] - point[0]) +
              (point[1] - before[1]) * (after[1] - point[1])
          )
        );
        return Math.abs(turn - Math.PI / 2) < LADDER.squared
          ? [
              [
                course.sums[step] as number,
                new Vector3(point[0] - before[0], 0, -(point[1] - before[1])).normalize(),
              ],
            ]
          : [];
      })
    );
    // a board along the course from one distance to another in one piece:
    // through every point the course is laid out by, so it kinks sharp at
    // each corner and follows each curve, and a short piece at a time along
    // the straights, so it keeps to the deck's rise
    const along = (from: number, to: number, height: number, width: number, depth: number) => {
      const pieces = Math.max(1, Math.ceil((to - from) / LADDER.piece));
      const stations = [
        ...Array.from({ length: pieces + 1 }, (_, piece) => from + ((to - from) * piece) / pieces),
        ...course.sums.filter(sum => sum > from + 1e-3 && sum < to - 1e-3),
      ].sort((a, b) => a - b);
      band(
        boards,
        stations
          .filter((station, step) => step === 0 || station - (stations[step - 1] as number) > 1e-3)
          .map(station => over(station, height)),
        width,
        depth
      );
    };
    // the posts: the end ones set in alike from the deck's ends, one in every
    // corner and at every handle between, and evenly between those as many
    // as the spacing asks
    const end = LADDER.inset + LADDER.post / 2;
    // a handle in a corner has its post there: dropped onto the course it
    // lands beside the corner, not in it
    const cornered = (place: number) => {
      const nearest = [...corners].sort((a, b) => Math.abs(a - place) - Math.abs(b - place))[0];
      return nearest !== undefined && Math.abs(nearest - place) < LADDER.snap ? nearest : place;
    };
    const ends = places.map((place, step) =>
      step === 0 ? place + end : step === places.length - 1 ? place - end : cornered(place)
    );
    const [head, tail] = [ends[0] as number, ends[ends.length - 1] as number];
    const marks = [...ends, ...corners.filter(corner => corner > head && corner < tail)]
      .sort((a, b) => a - b)
      // one post a place
      .filter((mark, step, all) => step === 0 || mark - (all[step - 1] as number) > LADDER.post);
    const posts = marks.flatMap((mark, step) => {
      const next = marks[step + 1];
      if (next === undefined) {
        return [mark];
      }
      const sections = Math.max(1, Math.ceil((next - mark) / LADDER.every));
      return Array.from({ length: sections }, (_, k) => mark + ((next - mark) * k) / sections);
    });
    const [start, last] = [posts[0] as number, posts[posts.length - 1] as number];
    const under = LADDER.rail.top - LADDER.rail.thickness;
    // the hand rail flush with the end posts' outer faces
    along(
      start - LADDER.post / 2,
      last + LADDER.post / 2,
      LADDER.rail.top - LADDER.rail.thickness / 2,
      LADDER.rail.width,
      LADDER.rail.thickness
    );
    posts.forEach(post =>
      strut(
        boards,
        over(post, -LADDER.sunk),
        over(post, under),
        LADDER.post,
        square.get(post) ?? facing(post)
      )
    );
    posts.slice(1).forEach((to, section) => {
      const from = (posts[section] as number) + LADDER.post / 2;
      const until = to - LADDER.post / 2;
      along(
        from,
        until,
        LADDER.beam.foot + LADDER.beam.height / 2,
        LADDER.beam.width,
        LADDER.beam.height
      );
      // as many slats as fit the gap at their spacing, spread evenly in it
      const slats = Math.max(0, Math.round((until - from) / LADDER.slat.every) - 1);
      Array.from({ length: slats }, (_, slat) => {
        const at = from + ((until - from) * (slat + 1)) / (slats + 1);
        strut(
          boards,
          over(at, LADDER.beam.foot + LADDER.beam.height),
          over(at, under),
          LADDER.slat.across,
          facing(at),
          0,
          LADDER.slat.along
        );
      });
    });
  });
  const drawn = (positions: number[], color: Color) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return new Mesh(geometry, new MeshLambertMaterial({ color, flatShading: true }));
  };
  // the boards in weathered timber, the band in the decks' own concrete
  return [drawn(boards, palette.boarding), drawn(bands, palette.wallAccent)];
}

export function createRailings(palette: Palette): Group {
  const group = new Group();
  group.name = 'railings';
  // the coping's height at a point: of the wall line nearest it
  const copingAt = (x: number, y: number) =>
    FILL_LINES().reduce(
      (best, { points, levels }) => {
        const { distance, along } = nearestOn(points, x, y);
        const step = Math.min(Math.floor(along), levels.length - 2);
        const [here, next] = [levels[step] as number, levels[step + 1] as number];
        const level = here + (next - here) * (along - step);
        return distance < best.distance ? { distance, level } : best;
      },
      { distance: Infinity, level: heightAt(x, y) }
    ).level;
  const pipes: number[] = [];
  RAILINGS.forEach(({ short = 0, pairs }) => {
    const [start, ...rest] = pairs.flatMap(([face, back]): Point[] => {
      const [one, other] = [pickByKey(face)?.at, pickByKey(back)?.at];
      return one === undefined || other === undefined
        ? []
        : [[(one[0] + other[0]) / 2, (one[1] + other[1]) / 2]];
    });
    if (start === undefined) {
      return;
    }
    const towards = rest[0] ?? start;
    const length = Math.hypot(towards[0] - start[0], towards[1] - start[1]) || 1;
    const middle: Point[] = [
      [
        start[0] + ((towards[0] - start[0]) * short) / length,
        start[1] + ((towards[1] - start[1]) * short) / length,
      ],
      ...rest,
    ];
    // a post at every corner, and between them the sections counted on site:
    // each stretch rounded to the nearest half section - on the wall's middle
    // it runs a little short of its face - the whole ones even and a half
    // one, if any, at the east end
    const posts = middle.flatMap((point, step) => {
      const next = middle[step + 1];
      if (next === undefined) {
        return [point];
      }
      const length = Math.hypot(next[0] - point[0], next[1] - point[1]);
      const westward = next[0] < point[0];
      const sections = Math.max(0.5, Math.round((length / RAIL) * 2) / 2);
      const full = Math.floor(sections);
      // counted from whichever end is west, and read back the way the run goes
      const from = Array.from({ length: full + 1 }, (_, piece) => piece / sections);
      const along = from.map(share => (westward ? 1 - share : share));
      const shares = [...new Set([0, ...along.filter(share => share > 1e-3 && share < 1 - 1e-3)])];
      return shares
        .sort((a, b) => a - b)
        .map((share): Point => [
          point[0] + (next[0] - point[0]) * share,
          point[1] + (next[1] - point[1]) * share,
        ]);
    });
    railing(posts.map(([x, y]) => new Vector3(x, copingAt(x, y), -y)));
  });
  // and the stairs' open side, from the photographs: a post on the bottom
  // step, half its tread in, on the landing a quarter tread in from its start
  // and right before the next step's riser, and on the top step, half its
  // tread in - each on its tread, a hair in from the stairs' edge
  const plan = STAIRS_PLAN;
  if (plan !== undefined) {
    const { at, half, north, steps } = plan;
    const [first, second, landing, last] = [
      steps[0],
      steps[1],
      steps[STAIRS.landingAt - 1],
      steps[steps.length - 1],
    ];
    if (
      first !== undefined &&
      second !== undefined &&
      landing !== undefined &&
      last !== undefined
    ) {
      // half a common tread: the bottom one is shallower
      const inset = (second.to - second.from) / 2;
      const side = -Math.sign(north) * (half - RAILING.inset);
      railing(
        (
          [
            [first.from + (first.to - first.from) / 2, first.top],
            [landing.from + inset / 2, landing.top],
            [landing.to - RAILING.pipe, landing.top],
            [last.from + (last.to - last.from) / 2, last.top],
          ] as const
        ).map(([by, top]) => {
          const [x, y] = at(by, side);
          return new Vector3(x, top, -y);
        }),
        // lower along the stairs than on the walls, as the photographs have
        // it against the steps' rise, and bent down into the lowest post
        RAILING.stairs,
        true
      );
    }
  }
  // a run of it: its posts, each from its foot, and the rails along them
  function railing(feet: Vector3[], top: number = RAILING.top, bent = false): void {
    const tops = feet.map(foot => foot.clone().setY(foot.y + top));
    const [lowest, next] = [feet[0], tops[1]];
    // the lowest post and the top rail one pipe, bent round from standing up
    // to running along: a quarter's worth of circle or less, tangent to both
    const bend = (() => {
      if (!bent || lowest === undefined || next === undefined) {
        return undefined;
      }
      const corner = tops[0] as Vector3;
      const up = new Vector3(0, 1, 0);
      const way = next.clone().sub(corner).normalize();
      const turn = Math.acos(Math.min(1, Math.max(-1, up.dot(way))));
      const toward = way.clone().addScaledVector(up, -up.dot(way)).normalize();
      const start = corner.clone().addScaledVector(up, -RAILING.bend * Math.tan(turn / 2));
      const middle = start.clone().addScaledVector(toward, RAILING.bend);
      const arc = Array.from({ length: 9 }, (_, step) => {
        const angle = (turn * step) / 8;
        return middle
          .clone()
          .addScaledVector(toward, -RAILING.bend * Math.cos(angle))
          .addScaledVector(up, RAILING.bend * Math.sin(angle));
      });
      return [lowest.clone().setY(lowest.y - 0.02), ...arc];
    })();
    (bend === undefined ? feet : feet.slice(1)).forEach(foot => {
      // up to the top rail's middle, where it ends inside it rather than
      // standing out of it
      strut(
        pipes,
        foot.clone().setY(foot.y - 0.02),
        foot.clone().setY(foot.y + top),
        RAILING.pipe,
        undefined,
        RAILING.roll
      );
    });
    // and the rails along them, mitred where they meet
    mitred(
      pipes,
      feet.map(foot => foot.clone().setY(foot.y + RAILING.middle)),
      RAILING.pipe,
      RAILING.roll
    );
    mitred(pipes, [...(bend ?? tops.slice(0, 1)), ...tops.slice(1)], RAILING.pipe, RAILING.roll);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pipes, 3));
  geometry.computeVertexNormals();
  // the grey green of the photographs' steel
  const steel = palette.foliage.clone().lerp(palette.wall, 0.55);
  group.add(new Mesh(geometry, new MeshLambertMaterial({ color: steel, flatShading: true })));
  group.add(...createLadders(palette));
  return group;
}
