import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshLambertMaterial,
} from 'three';

import type { Point } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import { crossings, nearestOn, once, resample, runs } from '../../utils/geometry.utils.js';
import { heightAt, WAY_KERBS, WAY_RUNS } from '../terrain/ground.js';
import { DRAWN_GROUND } from '../terrain/terrain.drawn.js';
import { DECK_MARKS, kerbOut, onRoadSide, outFromRoad } from './crossings.js';
import type { WallRun } from './measures.js';
import { alongKerb, follow, PILLAR_STAIRS, RETAINING_WALL, STAIRS } from './measures.js';

/**
 * The stairs up from the road, the walls beside them as counted on site, and the pillar stairs - planned once, drawn and handled from the plan.
 */
/**
 * A block from its top down into the ground under it, on four corners - a top
 * for all, or one each - or, given a depth, only that far under its top.
 */
function block(
  positions: number[],
  corners: Point[],
  {
    top: given,
    under,
    depth,
    bottom,
  }: { top: number | number[]; under: number; depth?: number; bottom?: number }
): void {
  const tops = corners.map((_, corner) =>
    typeof given === 'number' ? given : ((given[corner] ?? given[0]) as number)
  );
  // each corner down to the ground as it is drawn under it - beside a road
  // that is not the height field - and never short of the level given
  const drawn = DRAWN_GROUND();
  const [ba, bb, bc, bd] = tops.map((top, corner) => {
    const [x, y] = corners[corner] as Point;
    return depth !== undefined
      ? top - depth
      : bottom !== undefined
        ? bottom
        : Math.min(under, drawn(x, y) ?? heightAt(x, y)) - STAIRS.footing;
  }) as [number, number, number, number];
  const [a, b, c, d] = corners as [Point, Point, Point, Point];
  const face = (one: Point, other: Point, third: Point, height: [number, number, number]) =>
    positions.push(
      one[0],
      height[0],
      -one[1],
      other[0],
      height[1],
      -other[1],
      third[0],
      height[2],
      -third[1]
    );
  const [ta, tb, tc, td] = tops as [number, number, number, number];
  // the top, and the four sides down to the footing
  face(a, b, c, [ta, tb, tc]);
  face(a, c, d, [ta, tc, td]);
  (
    [
      [a, b, ta, tb, ba, bb],
      [b, c, tb, tc, bb, bc],
      [c, d, tc, td, bc, bd],
      [d, a, td, ta, bd, ba],
    ] as [Point, Point, number, number, number, number][]
  ).forEach(([one, other, high, next, low, under]) => {
    face(one, other, other, [high, next, under]);
    face(one, other, one, [high, under, low]);
  });
  // one that does not reach the ground shows its underside
  if (depth !== undefined) {
    face(a, c, b, [ba, bc, bb]);
    face(a, d, c, [ba, bd, bc]);
  }
}

/** Where the stairs start and which way they climb, with the road's level there. */
const STAIRS_AT = (() => {
  const nose = DECK_MARKS[0];
  const far = nose === undefined ? undefined : onRoadSide(nose);
  const near = WAY_KERBS.filter(({ main }) => main)
    .map(({ points }) => points)
    .find(kerb => kerb !== far);
  const way = WAY_KERBS.find(({ points }) => points === near);
  if (nose === undefined || far === undefined || near === undefined || way === undefined) {
    return undefined;
  }
  // a meter south of the nose on the far kerb, and straight across the road
  // from there onto the near one, which is where the stairs' north edge is
  const opposite = alongKerb(far, nearestOn(far, nose[0], nose[1]).at, STAIRS.south, false);
  const { heading } = nearestOn(WAY_RUNS.find(({ main }) => main)?.points ?? [], ...opposite);
  const length = Math.hypot(heading[0], heading[1]) || 1;
  const [nx, ny] = [(-heading[1] / length) * 20, (heading[0] / length) * 20];
  const edge = crossings(
    [
      [opposite[0] - nx, opposite[1] - ny],
      [opposite[0] + nx, opposite[1] + ny],
    ],
    near
  )
    .map(({ at }) => at)
    .sort(
      (one, other) =>
        Math.hypot(one[0] - opposite[0], one[1] - opposite[1]) -
        Math.hypot(other[0] - opposite[0], other[1] - opposite[1])
    )[0];
  if (edge === undefined) {
    return undefined;
  }
  const start = alongKerb(near, edge, STAIRS.width / 2, false);
  const out = outFromRoad(start, 1);
  return {
    start,
    kerb: near,
    along: [out[0] - start[0], out[1] - start[1]] as Point,
    level: way.level(start[0], start[1]),
  };
})();

/**
 * The stairs and the walls beside them as one plan, which both the drawing and
 * the handles read: the steps, each from and to how far off the kerb it runs
 * and at what top, and the walls, each as a run of its face.
 */
export const STAIRS_PLAN = (() => {
  if (STAIRS_AT === undefined) {
    return undefined;
  }
  const { start, kerb, along, level } = STAIRS_AT;
  const across: Point = [-along[1], along[0]];
  const half = STAIRS.width / 2;
  const at = (by: number, side: number): Point => [
    start[0] + along[0] * by + across[0] * side,
    start[1] + along[1] * by + across[1] * side,
  ];
  // the wall beside them runs from the bottom step's tread off the kerb to
  // their top step: the sections counted, and on one tread more, where the top
  // step is set in. The bottom step as deep as the rest were before it was -
  // the walls stand where they did - and the rest the longer for it: so many
  // treads and the landing make the counted length, one tread more the wall's
  const front = (RETAINING_WALL.beside - STAIRS.landing) / (STAIRS.steps - 2);
  const tread = (RETAINING_WALL.beside - STAIRS.landing) / (STAIRS.steps - 3);
  let walked = 0;
  const steps = Array.from({ length: STAIRS.steps }, (_, step) => {
    const deep = step === 0 ? front : step === STAIRS.landingAt - 1 ? STAIRS.landing : tread;
    const [from, to] = [walked, walked + deep];
    walked = to;
    return { from, to, top: level + STAIRS.riser * (step + 1) };
  });
  const top = level + STAIRS.riser * STAIRS.steps;
  const north = at(0, half)[1] > at(0, -half)[1] ? half : -half;
  const side = Math.sign(north);
  const thick = RETAINING_WALL.thickness;
  const road = WAY_KERBS.find(({ points }) => points === kerb);
  const onRoad = (point: Point) => road?.level(point[0], point[1]) ?? level;
  const unit = (from: Point, to: Point): Point => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
  };
  const moved = (point: Point, [dx, dy]: Point, by: number): Point => [
    point[0] + dx * by,
    point[1] + dy * by,
  ];

  // the U: its corner at the road, a tread off the kerb on the stairs' north side
  const verge = kerbOut(kerb, front);
  const corner = at(front, north);
  const besideTop = at(walked, north);
  const end = alongKerb(verge, corner, RETAINING_WALL.along, true);
  const inward = unit(end, corner);
  const awayAt = (point: Point) => unit(point, outFromRoad(point, 1));
  const backEnd = moved(end, awayAt(end), RETAINING_WALL.back);
  // and the lower wall on along the road from the U's end
  const kink = alongKerb(verge, end, RETAINING_WALL.falling, true);
  const lowEnd = alongKerb(verge, kink, RETAINING_WALL.lower, true);
  // the upper wall straight north from there, angled so it stands as far back
  // from the lower wall's end as the U's end stands from its own start
  const northward = unit(backEnd, moved(lowEnd, awayAt(lowEnd), RETAINING_WALL.back));
  // its face its thickness in from the U's back, so the back leg runs into it
  // and the corner at the back closes
  const upperStart = moved(backEnd, awayAt(backEnd), -thick);
  const upperEnd = moved(upperStart, northward, RETAINING_WALL.upper);
  // which side of it its back is on, away from the road
  const turn = (direction: Point, by: number): Point => [
    direction[0] * Math.cos(by) - direction[1] * Math.sin(by),
    direction[0] * Math.sin(by) + direction[1] * Math.cos(by),
  ];
  const away = Math.sign(
    turn(northward, Math.PI / 2)[0] * awayAt(upperEnd)[0] +
      turn(northward, Math.PI / 2)[1] * awayAt(upperEnd)[1]
  );
  const backward = (direction: Point) => turn(direction, (away * Math.PI) / 2);
  // then on into the slope from its far end, each piece turned 45° further
  // away from the road, the back on the inside of the bend
  const bend = RETAINING_WALL.bend.reduce<{ from: Point; to: Point; direction: Point }[]>(
    (pieces, length, piece) => {
      const from = pieces[pieces.length - 1]?.to ?? upperEnd;
      const direction = turn(northward, (away * (piece + 1) * Math.PI) / 4);
      return [...pieces, { from, to: moved(from, direction, length), direction }];
    },
    []
  );
  // the back where two pieces meet: out along the middle of the two, as far as
  // keeps both a wall's thickness from the face
  const mitred = (point: Point, one: Point, other: Point): Point => {
    const middle = unit(
      [0, 0],
      [backward(one)[0] + backward(other)[0], backward(one)[1] + backward(other)[1]]
    );
    const cosine = middle[0] * backward(one)[0] + middle[1] * backward(one)[1];
    return moved(point, middle, thick / cosine);
  };
  const upperTop = top + onRoad(upperEnd) - onRoad(upperStart);
  // the stub on from the bend's end, the pillar stairs' top step: level with
  // the wall, but only a riser deep - the ground comes up to it
  const last = bend[bend.length - 1] ?? { to: upperEnd, direction: northward };
  const stubTop = upperTop;
  const stubEnd = moved(last.to, last.direction, PILLAR_STAIRS.length);
  const lower = [end, ...follow(verge, end, lowEnd), lowEnd];
  const kinkShare = RETAINING_WALL.falling / (RETAINING_WALL.falling + RETAINING_WALL.lower);

  const walls: WallRun[] = [
    // beside the stairs, its thickness outside them
    {
      face: [corner, besideTop],
      backOf: point => moved(point, across, thick * side),
      top: () => top,
    },
    // along the road, its thickness away from it
    {
      face: [corner, ...follow(verge, corner, end), end],
      backOf: point => outFromRoad(point, thick),
      top: () => top,
    },
    // back into the slope, its thickness on the inside of the U
    {
      face: [end, backEnd],
      backOf: point => moved(point, inward, thick),
      top: () => top,
    },
    // the upper wall, the terrace behind it, going down with the road from
    // the height it has over it where it starts
    {
      face: [upperStart, upperEnd],
      backOf: point => moved(point, backward(northward), thick),
      top: (_, point) => top + onRoad(point) - onRoad(upperStart),
    },
    // and its bend into the slope, at the height it ends at
    ...bend.map(({ from, to, direction }): WallRun => ({
      face: [from, to],
      backOf: point => moved(point, backward(direction), thick),
      top: () => upperTop,
    })),
    // and the stub on from there, a riser deep
    {
      face: [last.to, stubEnd],
      backOf: point => moved(point, backward(last.direction), thick),
      top: () => stubTop,
      depth: PILLAR_STAIRS.riser,
    },
    // the lower wall, falling to 70cm over the road and running on at that
    {
      face: lower,
      backOf: point => outFromRoad(point, thick),
      top: (share, point) =>
        share >= kinkShare
          ? onRoad(point) + RETAINING_WALL.low
          : top + (onRoad(kink) + RETAINING_WALL.low - top) * (share / kinkShare),
    },
  ];

  return {
    at,
    half,
    north,
    side,
    thick,
    level,
    steps,
    walked,
    tread,
    top,
    corner,
    besideTop,
    end,
    backEnd,
    upperStart,
    upperEnd,
    upperTop,
    northward,
    bend,
    last,
    stubTop,
    stubEnd,
    turn,
    backward,
    mitred,
    kink,
    lowEnd,
    walls,
    inward,
    across,
    onRoad,
    awayAt,
    moved,
  };
})();

/**
 * The pillar stairs laid out: where each step starts, which way it runs, and
 * its top where it starts. They leave the stub square to its face and turn by
 * the same angle step by step until the last runs with the road. Eleven risers
 * do not make it down to the ground, so every step leans the same, just enough
 * for the last to lie on it at its foot - read off the ground as it is drawn.
 */
export const PILLAR_PLAN = once(() => {
  const plan = STAIRS_PLAN;
  const kerb = STAIRS_AT?.kerb;
  if (plan === undefined || kerb === undefined) {
    return undefined;
  }
  const { last, stubTop, stubEnd, backward, turn, moved } = plan;
  const { steps, riser, length, overlap, pillar } = PILLAR_STAIRS;
  const count = steps - 1;
  const start: Point = [(last.to[0] + stubEnd[0]) / 2, (last.to[1] + stubEnd[1]) / 2];
  const out = turn(backward(last.direction), Math.PI);
  // the road's line where they would come out running straight on
  const reach = moved(start, out, count * (length - overlap));
  const { heading } = nearestOn(kerb, reach[0], reach[1]);
  const sense = Math.sign(heading[0] * out[0] + heading[1] * out[1]) || 1;
  const [from, to] = [
    Math.atan2(out[1], out[0]),
    Math.atan2(heading[1] * sense, heading[0] * sense),
  ];
  const swing = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  const laid = Array.from({ length: count }).reduce<{ at: Point; direction: Point }[]>(
    (runs, _, step) => {
      const previous = runs[runs.length - 1];
      const at = previous ? moved(previous.at, previous.direction, length - overlap) : start;
      const angle = from + (count > 1 ? (swing * step) / (count - 1) : 0);
      return [...runs, { at, direction: [Math.cos(angle), Math.sin(angle)] as Point }];
    },
    []
  );
  const foot = laid[laid.length - 1];
  const end = foot === undefined ? start : moved(foot.at, foot.direction, length);
  const ground = DRAWN_GROUND()(end[0], end[1]) ?? heightAt(end[0], end[1]);
  // the first top a riser under the stub's, every one after a riser and its
  // own fall under the one before, the last one's foot on the ground
  const first = stubTop - riser;
  const fall = Math.max(0, (first - (count - 1) * riser - pillar - ground) / (count * length));
  return {
    runs: laid.map(({ at, direction }, step) => ({
      at,
      direction,
      top: first - step * (riser + length * fall),
    })),
    fall,
    ground,
    end,
    swing,
  };
});

/**
 * The pillar stairs' corners for handles: the outer pillars' outer edges, at
 * their top only - the bottom step's foot lies on the ground, the ground comes
 * up to the others' undersides between.
 */
export function pillarCorners(): { name: string; at: Point; top: number; foot: null }[] {
  const plan = PILLAR_PLAN();
  if (plan === undefined) {
    return [];
  }
  const { length, pillar, pillars, gap } = PILLAR_STAIRS;
  const reach = ((pillars - 1) / 2) * (pillar + gap) + pillar / 2;
  const corners = (name: string, at: Point, direction: Point, by: number, top: number) =>
    [-reach, reach].map(side => ({
      name: `${name}-${side < 0 ? 'left' : 'right'}`,
      at: [
        at[0] + direction[0] * by - direction[1] * side,
        at[1] + direction[1] * by + direction[0] * side,
      ] as Point,
      top,
      foot: null,
    }));
  const foot = plan.runs[plan.runs.length - 1];
  return [
    ...plan.runs
      .slice(1)
      .flatMap(({ at, direction, top }, run) =>
        corners(`pillar-${run + 2}`, at, direction, 0, top)
      ),
    ...(foot === undefined
      ? []
      : corners(
          'pillar-foot',
          foot.at,
          foot.direction,
          length,
          foot.top - length * plan.fall - pillar
        )),
  ];
}

/**
 * The stairs' and the walls' own points, with the height each is topped out at
 * - the tread's, the coping's - so that a seam can be traced to them.
 */
export const STAIRS_MARKS: { name: string; at: Point; top: number; foot?: number | null }[] =
  (() => {
    const plan = STAIRS_PLAN;
    if (plan === undefined) {
      return [];
    }
    const { at, half, north, side, thick, steps, walked, top, corner, end } = plan;
    const {
      backEnd,
      upperTop,
      northward,
      bend,
      backward,
      mitred,
      last: bendEnd,
      stubTop,
      stubEnd,
    } = plan;
    const { upperStart, kink, lowEnd, inward, across, onRoad, moved } = plan;
    const [first, landing, last] = [steps[0], steps[STAIRS.landingAt - 1], steps[steps.length - 1]];
    if (first === undefined || landing === undefined || last === undefined) {
      return [];
    }
    const low = (point: Point) => onRoad(point) + RETAINING_WALL.low;
    const stubFoot = stubTop - PILLAR_STAIRS.riser;
    // which of the stairs' edges a side across them is
    const edge = (across: number) => (across === north ? 'north' : 'south');
    return [
      // the stairs: at the road - standing on it, whatever the ground at the
      // kerb reads - the landing's four corners, at the top
      ...[-half, half].map(across => ({
        name: `road-${edge(across)}`,
        at: at(0, across),
        top: first.top,
        foot: plan.level,
      })),
      ...(
        [
          ['landing-from', landing.from, landing.top],
          ['landing-to', landing.to, landing.top],
          ['top', walked, last.top],
        ] as const
      ).flatMap(([name, by, level]) =>
        [-half, half].map(across => ({
          name: `${name}-${edge(across)}`,
          at: at(by, across),
          top: level,
        }))
      ),
      // the U: its face at the road and at its end along the road, its back where
      // the two legs by the road meet and at the top of the one beside the stairs
      { name: 'u-corner', at: corner, top },
      { name: 'u-end', at: end, top },
      { name: 'u-corner-back', at: moved(outFromRoad(corner, thick), across, thick * side), top },
      { name: 'u-top-back', at: moved(at(walked, north), across, thick * side), top },
      // its end in the slope, outside and inside - where the upper wall starts
      { name: 'u-back-end', at: backEnd, top },
      { name: 'u-back-end-inside', at: moved(backEnd, inward, thick), top },
      // the U's inside where the leg along the road meets the one into the slope
      { name: 'u-inside', at: moved(outFromRoad(end, thick), inward, thick), top },
      // the upper wall's face where it starts, off the back leg's own face
      { name: 'upper-start', at: upperStart, top },
      // the lower wall's back where it starts, against the back leg
      { name: 'lower-start-back', at: outFromRoad(end, thick), top },
      // the upper wall's far end, and each kink of its bend on from there, face
      // and back, and the bend's own end
      ...bend.flatMap(({ from, direction }, piece) => {
        const before = bend[piece - 1]?.direction ?? northward;
        const name = piece === 0 ? 'upper-end' : `bend-${piece}`;
        return [
          { name, at: from, top: upperTop },
          { name: `${name}-back`, at: mitred(from, before, direction), top: upperTop },
        ];
      }),
      // where the stub starts on from it, the ground up to its underside
      ...bend.slice(-1).flatMap(({ to, direction }) => [
        { name: 'bend-end', at: to, top: upperTop, foot: stubFoot },
        {
          name: 'bend-end-back',
          at: moved(to, backward(direction), thick),
          top: upperTop,
          foot: stubFoot,
        },
      ]),
      // the stub, the pillar stairs' top step: its end, face and back
      { name: 'stub-end', at: stubEnd, top: stubTop, foot: stubFoot },
      {
        name: 'stub-end-back',
        at: moved(stubEnd, backward(bendEnd.direction), thick),
        top: stubTop,
        foot: stubFoot,
      },
      // and the lower wall: where it has fallen to 70cm, and its far end,
      // face and back
      { name: 'lower-kink', at: kink, top: low(kink) },
      { name: 'lower-kink-back', at: outFromRoad(kink, thick), top: low(kink) },
      { name: 'lower-end', at: lowEnd, top: low(lowEnd) },
      { name: 'lower-end-back', at: outFromRoad(lowEnd, thick), top: low(lowEnd) },
      // and the pillar stairs: the outer pillars' top corners, of every step but
      // the one against the stub, and the last one's foot - each a pillar deep
      ...pillarCorners(),
    ];
  })();

export function createStairs(palette: Palette): Group {
  const group = new Group();
  group.name = 'stairs';
  const plan = STAIRS_PLAN;
  if (plan === undefined) {
    return group;
  }
  const { at, half, level, steps, walls } = plan;

  // each step a block from its own top down to the road they stand on: the
  // ground rises from it behind them, and at the kerb it reads the bank
  const positions: number[] = [];
  steps.forEach(({ from, to, top: tread }) =>
    block(positions, [at(from, -half), at(to, -half), at(to, half), at(from, half)], {
      top: tread,
      under: level,
      bottom: level - STAIRS.footing,
    })
  );

  // and each wall in half meters along its face, its coping read at both ends
  // of each piece, so a wall that falls or follows the road runs on the slant
  // rather than in steps
  walls.forEach(({ face, backOf, top, depth }) => {
    const pieces = resample(face, 0.5);
    const whole = runs(pieces) || 1;
    let walked = 0;
    pieces.forEach((point, step) => {
      const next = pieces[step + 1];
      if (next === undefined) {
        return;
      }
      const length = Math.hypot(next[0] - point[0], next[1] - point[1]);
      const [here, there] = [top(walked / whole, point), top((walked + length) / whole, next)];
      walked += length;
      block(positions, [point, next, backOf(next), backOf(point)], {
        top: [here, there, there, here],
        under: level,
        ...(depth === undefined ? {} : { depth }),
      });
    });
  });

  // and the pillar stairs on down from the bend's end
  pillarStairs(positions);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  group.add(
    new Mesh(
      geometry,
      new MeshLambertMaterial({ color: palette.wallAccent, flatShading: true, side: DoubleSide })
    )
  );
  return group;
}

/** The pillar stairs drawn: three pillars a step, each leaning with the step. */
function pillarStairs(positions: number[]): void {
  const plan = PILLAR_PLAN();
  if (plan === undefined) {
    return;
  }
  const { length, pillar, pillars, gap } = PILLAR_STAIRS;
  const offsets = Array.from(
    { length: pillars },
    (_, one) => (one - (pillars - 1) / 2) * (pillar + gap)
  );
  plan.runs.forEach(({ at, direction, top }) => {
    const across: Point = [-direction[1], direction[0]];
    const low = top - length * plan.fall;
    const side = (by: number): Point => [at[0] + across[0] * by, at[1] + across[1] * by];
    const on = ([x, y]: Point): Point => [x + direction[0] * length, y + direction[1] * length];
    offsets.forEach(offset => {
      const [left, right] = [side(offset - pillar / 2), side(offset + pillar / 2)];
      block(positions, [left, on(left), on(right), right], {
        top: [top, low, low, top],
        under: top,
        depth: pillar,
      });
    });
  });
}
