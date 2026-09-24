import cdt2d from 'cdt2d';
import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshLambertMaterial,
  Vector3,
} from 'three';

import type { Point } from '../../data/data.js';
import { POINTS } from '../../data/points.js';
import { GROUND } from '../../data/terrain.baked.js';
import { nearestOn, once, resample, runs, smoothstep, within } from '../../utils/geometry.utils.js';
import type { SeamHandle } from '../structures/measures.js';
import { PILLAR_STAIRS, SEAM_FOUND, SEAM_STEP } from '../structures/measures.js';
import { PILLAR_PLAN, pillarCorners, STAIRS_PLAN } from '../structures/stairs.js';
import { heightAt } from '../terrain/ground.js';
import { DRAWN_GROUND, unpacked } from '../terrain/terrain.drawn.js';
import { pickByKey } from './seam.js';

/**
 * Ground piled onto the frozen terrain: dumps laid out inside their rings, and the landfill ground a brush piles onto.
 */
/**
 * Dumps: ground piled onto the terrain where the survey has none, the way a
 * site is landfilled - each a ring of handles traced on the bench. The
 * terrain as baked is left as it is; a dump only ever adds to it.
 */
export const FILLS: {
  /** The handles it is bounded by, by their names, round it. */
  ring: string[];
  bulge?: number;
  /** Whether the pillar stairs lying in it are bedded in: held a hair under every step. */
  bedded?: boolean;
  /**
   * How far in from where its edge lies on the ground it eases out onto it, in
   * meters: held to the ground along that edge alone, it meets it in a crease.
   */
  feather?: number;
  /**
   * How far past its outer edges it runs on out onto the terrain, in meters -
   * the edges no other dump shares and no wall or step bounds. Held there as
   * a line, a dump meets the terrain in a seam however it is eased; run on
   * out, it comes down onto it, and only the handles along those edges are
   * held.
   */
  apron?: number;
}[] = [
  // between the upper wall and the lower one, up to their tops, and down to
  // the ground past their ends
  {
    ring: [
      'stairs:upper-start:top',
      'stairs:lower-start-back:top',
      'stairs:lower-kink-back:top',
      'stairs:lower-end-back:top',
      'stairs:lower-end:foot',
      'stairs:upper-end:foot',
      'stairs:upper-end:top',
    ],
  },
  // the terrace deck behind the stairs' walls: along their backs from the
  // stub round the U to the stairs' top, and back across where the ground
  // comes up to their tops, then the six points on the far edge the other
  // way round
  {
    ring: [
      'stairs:stub-end-back:top',
      'stairs:bend-end-back:top',
      'stairs:bend-1-back:top',
      'stairs:upper-end-back:top',
      'stairs:u-back-end:top',
      'stairs:u-back-end-inside:top',
      'stairs:u-inside:top',
      'stairs:u-corner-back:top',
      'stairs:u-top-back:top',
      'stairs:top-north:top',
      'stairs:top-south:top',
      'point:0',
      'point:1',
      'point:2',
      'point:3',
      'point:4',
      'point:5',
    ],
  },
  // round the bend and the pillar stairs, on the ground they trace: on from
  // the dump between the walls at its foot, up the bend's face half way, up
  // to the stub's underside, along where the slope comes up to the steps'
  // undersides and a little over, down to their foot, back along the ground
  // by the road to the lower wall's end - sharing that dump's edge there.
  // The steps inside it are bedded in, each held under all along and across,
  // and the ground beside them at the top corners of their outer pillars
  // where each comes out of the slope. It runs on into the terrace deck
  // along its edge from the stub, and eases out onto the ground where it
  // meets it
  {
    bedded: true,
    feather: 2,
    ring: [
      'stairs:upper-end:foot',
      'point:6',
      'point:7',
      'point:8',
      'point:9',
      'stairs:stub-end-back:top',
      'point:5',
      'point:10',
      'point:11',
      'point:12',
      'point:13',
      'point:14',
      'point:15',
      'stairs:pillar-foot-left:lying',
      'stairs:pillar-foot-right:lying',
      'point:16',
      'point:17',
      'point:18',
      'stairs:lower-end:foot',
    ],
  },
  // the terrace deck on south, past the stairs' top: from their top across
  // the shoulder picked at its height down to the slope and back to the
  // deck's far corner - sharing its edge from the stairs' top, so the two
  // run on into each other
  {
    ring: [
      'stairs:top-south:top',
      'point:26',
      'point:27',
      'point:28',
      'point:29',
      'point:25',
      'point:24',
      'point:23',
      'point:0',
    ],
  },
  // and the fill below it: down the stairs' side from their top to the road,
  // along the road - the third point there lifted - and back up along the
  // shoulder of the deck's extension, which it shares. Along the road it runs on out 2m onto the terrain
  {
    feather: 2,
    apron: 2,
    ring: [
      'stairs:top-south:top',
      'stairs:landing-to-south:top',
      'stairs:landing-from-south:top',
      'stairs:road-south:foot',
      'point:19',
      'point:20',
      'point:21',
      'point:22',
      'point:25',
      'point:29',
      'point:28',
      'point:27',
      'point:26',
    ],
  },
];

/** How finely a dump is laid out, in meters: its edge, and the grid inside. */
const FILL_EDGE = 0.25;
const FILL_GRID = 0.5;

/**
 * How high a dump may stand at a point of the plan beside the stairs from the
 * road, on their open side: no higher than the tread beside it, less
 * `STAIRS_CLEAR` - the steps stand out of the ground along their side - and
 * as high as it likes anywhere else, the terrace behind the wall on their
 * other side too.
 */
const BESIDE_STAIRS = once(() => {
  const plan = STAIRS_PLAN;
  if (plan === undefined) {
    return () => Infinity;
  }
  const { at, half, steps, north } = plan;
  const start = at(0, 0);
  const [along, across] = [at(1, 0), at(0, 1)].map(([x, y]): Point => [
    x - start[0],
    y - start[1],
  ]) as [Point, Point];
  return (x: number, y: number): number => {
    const [dx, dy] = [x - start[0], y - start[1]];
    const by = dx * along[0] + dy * along[1];
    const off = dx * across[0] + dy * across[1];
    // the open side only: on the other the wall stands beside them, and the
    // terrace behind it is no business of theirs
    const side = Math.sign(off) === Math.sign(north) ? -Infinity : Math.abs(off);
    const step = steps.find(({ from, to }) => by >= from && by < to);
    return step !== undefined && side >= half - 0.02 && side <= half + STAIRS_BESIDE
      ? step.top - STAIRS_CLEAR
      : Infinity;
  };
});

/** How far out from the stairs' sides a dump is kept under their treads, and by how much, in meters. */
const STAIRS_BESIDE = 0.3;
const STAIRS_CLEAR = 0.1;

/** How finely a dump's edge is laid where it runs on the ground, in meters. */
const FILL_ON_EDGE = 0.1;

/** How near the ground a reference point may stand and still be taken as on it, in meters. */
const FILL_ON_GROUND = 0.02;

/**
 * How far past a dump's edge the terrain is looked at, and how much it may
 * rise there, for the dump to ease out onto the ground along it, in meters.
 */
const FILL_LOOK = 0.75;
const FILL_RISING = 0.1;

/** How far in from where a dump lies on the terrain its shading eases over into its own, in meters. */
const FILL_SHADE = 0.75;

/**
 * The terrain's shading direction at each of its vertices, as three.js works
 * them out - but from the faces that show only: a face a dump lies over, a
 * hair or more above it, is left out. Where a dump's edge lies on the terrain
 * the ground under the dump often falls away steeply just inside it, and
 * counted, those hidden faces tilted the edge's shading into a dark band.
 */
export const GROUND_NORMALS = once(() => {
  const positions = new Float32Array(unpacked(GROUND.positions));
  const count = positions.length / 3;
  const indices =
    count > 0xffff
      ? new Uint32Array(unpacked(GROUND.indices))
      : new Uint16Array(unpacked(GROUND.indices));
  const covered = FILL_OVER();
  const [all, shown] = [new Float32Array(count * 3), new Float32Array(count * 3)];
  const [a, b, c, ab, cb] = [0, 1, 2, 3, 4].map(() => new Vector3()) as [
    Vector3,
    Vector3,
    Vector3,
    Vector3,
    Vector3,
  ];
  for (let face = 0; face < indices.length / 3; face++) {
    const [ia, ib, ic] = [0, 1, 2].map(k => indices[face * 3 + k] as number) as [
      number,
      number,
      number,
    ];
    a.fromArray(positions, ia * 3);
    b.fromArray(positions, ib * 3);
    c.fromArray(positions, ic * 3);
    cb.subVectors(c, b).cross(ab.subVectors(a, b));
    const [x, height, z] = [(a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3];
    const hidden = (covered(x, -z) ?? -Infinity) > height + FILL_COVERS;
    [ia, ib, ic].forEach(index => {
      [all, ...(hidden ? [] : [shown])].forEach(sum => {
        sum[index * 3] = (sum[index * 3] as number) + cb.x;
        sum[index * 3 + 1] = (sum[index * 3 + 1] as number) + cb.y;
        sum[index * 3 + 2] = (sum[index * 3 + 2] as number) + cb.z;
      });
    });
  }
  // a vertex no shown face reaches is hidden itself, and keeps them all
  const normals = new Float32Array(count * 3);
  for (let vertex = 0; vertex < count; vertex++) {
    const from = shown[vertex * 3 + 1] !== 0 || shown[vertex * 3] !== 0 ? shown : all;
    a.fromArray(from, vertex * 3).normalize();
    normals.set([a.x, a.y, a.z], vertex * 3);
  }
  return normals;
});

/** How far over a face of the terrain a dump has to stand to hide it, in meters. */
const FILL_COVERS = 0.01;

/** The dumps' own height at a point of the plan, if one is there - read off a grid, for the many a look up asks. */
const FILL_OVER = once(() => {
  type Corner = [x: number, y: number, height: number];
  const faces = FILLED().flatMap(({ points, heights, triangles }) =>
    triangles.map(
      corners =>
        corners.map((corner): Corner => {
          const [x, y] = points[corner] as Point;
          return [x, y, heights[corner] as number];
        }) as [Corner, Corner, Corner]
    )
  );
  const grid = new Map<string, [Corner, Corner, Corner][]>();
  faces.forEach(face => {
    const xs = face.map(([x]) => x);
    const ys = face.map(([, y]) => y);
    for (let x = Math.floor(Math.min(...xs)); x <= Math.floor(Math.max(...xs)); x++) {
      for (let y = Math.floor(Math.min(...ys)); y <= Math.floor(Math.max(...ys)); y++) {
        const key = `${x}:${y}`;
        grid.set(key, [...(grid.get(key) ?? []), face]);
      }
    }
  });
  return (x: number, y: number): number | undefined =>
    (grid.get(`${Math.floor(x)}:${Math.floor(y)}`) ?? []).reduce<number | undefined>(
      (found, [[ax, ay, ah], [bx, by, bh], [cx, cy, ch]]) => {
        const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
        if (Math.abs(d) < 1e-12) {
          return found;
        }
        const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
        const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) {
          return found;
        }
        const height = l1 * ah + l2 * bh + l3 * ch;
        return found === undefined ? height : Math.max(found, height);
      },
      undefined
    );
});

/**
 * The terrain's own shading direction at a point of the plan: its vertices'
 * (`GROUND_NORMALS`), read off the face the point lies in.
 */
const TERRAIN_NORMAL = once(() => {
  const positions = new Float32Array(unpacked(GROUND.positions));
  const count = positions.length / 3;
  const indices =
    count > 0xffff
      ? new Uint32Array(unpacked(GROUND.indices))
      : new Uint16Array(unpacked(GROUND.indices));
  const normals = new BufferAttribute(GROUND_NORMALS(), 3);
  const cell = 4;
  const grid = new Map<string, number[]>();
  const corner = (face: number, k: number) => indices[face * 3 + k] as number;
  const plan = (index: number): Point => [
    positions[index * 3] as number,
    -(positions[index * 3 + 2] as number),
  ];
  for (let face = 0; face < indices.length / 3; face++) {
    const corners = [0, 1, 2].map(k => plan(corner(face, k)));
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
  return (x: number, y: number): Vector3 | undefined => {
    for (const face of grid.get(`${Math.floor(x / cell)}:${Math.floor(y / cell)}`) ?? []) {
      const [a, b, c] = [0, 1, 2].map(k => corner(face, k)) as [number, number, number];
      const [[ax, ay], [bx, by], [cx, cy]] = [plan(a), plan(b), plan(c)];
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(d) < 1e-12) {
        continue;
      }
      const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
      const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) {
        continue;
      }
      const at = (index: number) =>
        new Vector3(normals.getX(index), normals.getY(index), normals.getZ(index));
      return at(a)
        .multiplyScalar(l1)
        .add(at(b).multiplyScalar(l2))
        .add(at(c).multiplyScalar(l3))
        .normalize();
    }
    return undefined;
  };
});

/** How near two dumps' points may lie, and at how near a height, to be one vertex, in meters. */
const FILL_SAME = 0.001;

/** How often a dump's inside is relaxed towards the smoothest surface its edge allows. */
const FILL_RELAX = 400;

/** Every face and back of the stairs' walls, at the height of their coping along it. */
export const FILL_LINES = once(() =>
  (STAIRS_PLAN?.walls ?? []).flatMap(({ face, backOf, top }) => {
    const points = resample(face, FILL_EDGE);
    const whole = runs(points) || 1;
    let walked = 0;
    const levels = points.map((point, step) => {
      const before = points[step - 1];
      walked += before === undefined ? 0 : Math.hypot(point[0] - before[0], point[1] - before[1]);
      return top(walked / whole, point);
    });
    return [
      { points, levels },
      { points: points.map(backOf), levels },
    ];
  })
);

/**
 * A dump's edge from one of its handles to the next, the last left out: along
 * a wall's coping where both are on it, on the ground as drawn where both are
 * at a foot, and straight across otherwise.
 */
function fillEdge(from: SeamHandle, to: SeamHandle): { at: Point; level: number }[] {
  const ground = DRAWN_GROUND();
  const on = (handle: SeamHandle, points: Point[]) =>
    nearestOn(points, handle.at[0], handle.at[1]).distance <= SEAM_FOUND;
  const wall =
    from.edge === 'top' && to.edge === 'top'
      ? FILL_LINES().find(({ points }) => on(from, points) && on(to, points))
      : undefined;
  if (wall !== undefined) {
    const [start, end] = [from.at, to.at].map(at => nearestOn(wall.points, at[0], at[1]).along) as [
      number,
      number,
    ];
    const between = wall.points
      .map((at, step) => ({ at, level: wall.levels[step] as number, step }))
      .filter(({ step }) => step > Math.min(start, end) && step < Math.max(start, end))
      .map(({ at, level }) => ({ at, level }));
    return [{ at: from.at, level: from.level }, ...(start < end ? between : between.reverse())];
  }
  const length = Math.hypot(to.at[0] - from.at[0], to.at[1] - from.at[1]);
  // two feet are on the ground, and so are two reference points set on it
  const lying = (handle: SeamHandle) =>
    handle.edge === 'point' &&
    Math.abs(handle.level - (ground(handle.at[0], handle.at[1]) ?? Infinity)) < FILL_ON_GROUND;
  const onGround = (from.edge === 'foot' && to.edge === 'foot') || (lying(from) && lying(to));
  // along the ground finer: a crease of the terrain crossing the edge between
  // two of its points pokes through the dump there
  const count = Math.max(1, Math.ceil(length / (onGround ? FILL_ON_EDGE : FILL_EDGE)));
  return Array.from({ length: count }, (_, step) => {
    const share = step / count;
    const at: Point = [
      from.at[0] + (to.at[0] - from.at[0]) * share,
      from.at[1] + (to.at[1] - from.at[1]) * share,
    ];
    const level =
      step > 0 && onGround
        ? (ground(at[0], at[1]) ?? heightAt(at[0], at[1]))
        : from.level + (to.level - from.level) * share;
    return { at, level: Math.min(level, BESIDE_STAIRS()(...at)) };
  });
}

/**
 * Each dump laid out: its edge held at the heights it runs along, a grid inside
 * relaxed until every point stands at the mean of its neighbours - the
 * smoothest surface the edge allows - and nowhere under the ground it is piled
 * on.
 */
const FILLED_ALONE = once(() =>
  FILLS.flatMap(({ ring, bulge = 0, bedded = false, feather = 0, apron = 0 }) => {
    const handles = ring.map(number => pickByKey(number));
    if (handles.some(handle => handle === undefined)) {
      return [];
    }
    // a top and a foot on one point are a step up a wall: the top keeps the
    // corner, the foot goes a hair along its other leg, as the seam has it
    const found = (handles as SeamHandle[]).map((handle, step, all) => {
      const [before, after] = [
        all[(step - 1 + all.length) % all.length],
        all[(step + 1) % all.length],
      ] as [SeamHandle, SeamHandle];
      const same = (other: SeamHandle) =>
        Math.hypot(other.at[0] - handle.at[0], other.at[1] - handle.at[1]) < 0.01;
      if (handle.edge !== 'foot' || !(same(before) || same(after))) {
        return handle;
      }
      const leg = same(before) ? after : before;
      const length = Math.hypot(leg.at[0] - handle.at[0], leg.at[1] - handle.at[1]) || 1;
      const by = Math.min(SEAM_STEP, length / 2) / length;
      return {
        ...handle,
        at: [
          handle.at[0] + (leg.at[0] - handle.at[0]) * by,
          handle.at[1] + (leg.at[1] - handle.at[1]) * by,
        ] as Point,
      };
    });
    // which of its edges are outer: no other dump shares them, and neither end
    // is a wall's or a step's top
    const others = FILLS.filter(other => other.ring !== ring).map(other =>
      other.ring.flatMap(number => {
        const handle = pickByKey(number);
        return handle === undefined ? [] : [handle.at];
      })
    );
    const at = ([x, y]: Point, [ox, oy]: Point) => Math.hypot(x - ox, y - oy) <= SEAM_FOUND;
    const shares = (one: SeamHandle, other: SeamHandle) =>
      others.some(line =>
        line.some((point, step) => {
          const next = line[(step + 1) % line.length] as Point;
          return (
            (at(one.at, point) && at(other.at, next)) || (at(one.at, next) && at(other.at, point))
          );
        })
      );
    const outer = (handles as SeamHandle[]).map((handle, step, all) => {
      const next = all[(step + 1) % all.length] as SeamHandle;
      return apron > 0 && handle.edge !== 'top' && next.edge !== 'top' && !shares(handle, next);
    });
    const ringed = found
      .flatMap((handle, step) =>
        fillEdge(handle, found[(step + 1) % found.length] as SeamHandle).map((point, piece) => ({
          ...point,
          run: step,
          handle: piece === 0,
        }))
      )
      // a wall's top and foot on one point are a step, not a stretch of edge
      .filter(
        ({ at: point }, step, all) =>
          step === 0 ||
          Math.hypot(
            point[0] - (all[step - 1] as { at: Point }).at[0],
            point[1] - (all[step - 1] as { at: Point }).at[1]
          ) > 0.01
      );
    // run on out past the outer edges: each of their points moved out by the
    // apron, as far as there is ground to move it onto, at the ground's height;
    // where an outer stretch meets one that is not, both are kept, and the
    // handles along it are kept where they were
    const laidOutline = ringed.map(({ at: point }) => point);
    const winding = Math.sign(
      laidOutline.reduce((sum, [x, y], step) => {
        const [nx, ny] = laidOutline[(step + 1) % laidOutline.length] as Point;
        return sum + (x * ny - nx * y);
      }, 0)
    );
    const kept: [number, number, number][] = [];
    const moved = (
      step: number,
      along: 'both' | 'before' | 'after' = 'both'
    ): { at: Point; level: number } | undefined => {
      const point = ringed[step] as { at: Point };
      // the way the edge runs there - where an outer stretch meets one that is
      // not, the way the outer one runs alone: the two can turn back on each
      // other, and the middle of them points anywhere
      const [before, after] = [
        along === 'after'
          ? point
          : (ringed[(step - 1 + ringed.length) % ringed.length] as { at: Point }),
        along === 'before' ? point : (ringed[(step + 1) % ringed.length] as { at: Point }),
      ];
      const [dx, dy] = [after.at[0] - before.at[0], after.at[1] - before.at[1]];
      const length = Math.hypot(dx, dy) || 1;
      // outside is to the right going round counter clockwise, to the left
      // going round the other way - told by the ring's own winding, which a
      // step out to either side is not where it runs thin
      const [nx, ny] = [(winding * dy) / length, (-winding * dx) / length];
      const ground = DRAWN_GROUND();
      const reach = [1, 0.75, 0.5, 0.25]
        .map(share => apron * share)
        .find(by => ground(point.at[0] + nx * by, point.at[1] + ny * by) !== undefined);
      if (reach === undefined) {
        return undefined;
      }
      const out: Point = [point.at[0] + nx * reach, point.at[1] + ny * reach];
      return { at: out, level: ground(out[0], out[1]) as number };
    };
    const edged = ringed.flatMap((point, step) => {
      const before = outer[(point.run - 1 + outer.length) % outer.length] as boolean;
      const here = outer[point.run] as boolean;
      const bounds = point.handle ? before || here : here;
      if (!bounds) {
        return [point];
      }
      const out = moved(
        step,
        !point.handle || before === here ? 'both' : here ? 'after' : 'before'
      );
      const outward = out === undefined ? [] : [out];
      // where an outer stretch starts or ends, the edge comes out to it and back
      if (point.handle && before !== here) {
        return here ? [point, ...outward] : [...outward, point];
      }
      if (point.handle) {
        kept.push([point.at[0], point.at[1], point.level]);
      }
      return outward;
    });
    // and where the edge runs on the ground between two points further apart
    // than it is laid there - moved out, round a corner - laid on it between
    const groundAt = DRAWN_GROUND();
    const lies = ({ at: [x, y], level }: { at: Point; level: number }) =>
      Math.abs(level - (groundAt(x, y) ?? Infinity)) < FILL_ON_GROUND;
    const edge = edged.flatMap((point, step) => {
      const next = edged[(step + 1) % edged.length] as { at: Point; level: number };
      const length = Math.hypot(next.at[0] - point.at[0], next.at[1] - point.at[1]);
      if (!lies(point) || !lies(next) || length <= FILL_ON_EDGE * 1.5) {
        return [point];
      }
      const pieces = Math.ceil(length / FILL_ON_EDGE);
      return Array.from({ length: pieces }, (_, piece) => {
        if (piece === 0) {
          return point;
        }
        const at: Point = [
          point.at[0] + ((next.at[0] - point.at[0]) * piece) / pieces,
          point.at[1] + ((next.at[1] - point.at[1]) * piece) / pieces,
        ];
        return { at, level: groundAt(at[0], at[1]) ?? point.level };
      });
    });
    const outline = edge.map(({ at: point }) => point);
    const xs = outline.map(([x]) => x);
    const ys = outline.map(([, y]) => y);
    const inside = Array.from(
      { length: Math.ceil((Math.max(...xs) - Math.min(...xs)) / FILL_GRID) + 1 },
      (_, column) =>
        Array.from(
          { length: Math.ceil((Math.max(...ys) - Math.min(...ys)) / FILL_GRID) + 1 },
          (_, row): Point => [
            Math.min(...xs) + column * FILL_GRID,
            Math.min(...ys) + row * FILL_GRID,
          ]
        )
    )
      .flat()
      .filter(
        point =>
          within(point, outline) &&
          nearestOn([...outline, outline[0] as Point], point[0], point[1]).distance >
            FILL_EDGE * 0.8
      );
    // the reference points inside the ring, each held at its own height, and
    // the grid kept clear of them so no sliver is laid between the two
    const fixed = [
      ...kept,
      ...POINTS,
      ...(bedded
        ? [
            ...PILLAR_BED(),
            ...pillarCorners().map(({ at: [x, y], top }): [number, number, number] => [x, y, top]),
          ]
        : []),
    ]
      .filter(
        ([x, y]) =>
          within([x, y], outline) &&
          nearestOn([...outline, outline[0] as Point], x, y).distance > FILL_EDGE * 0.5
      )
      // once each: a handle held along an outer edge may be a reference point
      // as well, and a triangulation cannot hold one point twice
      .filter(
        ([x, y], step, all) =>
          all.findIndex(([ox, oy]) => Math.hypot(ox - x, oy - y) < FILL_SAME * 10) === step
      );
    // and the terrain's own vertices inside the ring: held at the grid's points
    // alone, the dump runs under the terrain's ridges between them, and the
    // terrain pokes through its larger faces
    const clearOf = (point: Point, others: Point[], by: number) =>
      others.every(([ox, oy]) => Math.hypot(ox - point[0], oy - point[1]) > by);
    const [west, east, south, north] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ];
    const under = GROUND_VERTICES().filter(
      point =>
        point[0] >= west &&
        point[0] <= east &&
        point[1] >= south &&
        point[1] <= north &&
        within(point, outline) &&
        nearestOn([...outline, outline[0] as Point], point[0], point[1]).distance >
          FILL_ON_EDGE * 0.5 &&
        clearOf(
          point,
          fixed.map(([x, y]): Point => [x, y]),
          FILL_GRID * 0.3
        )
    );
    // filed on a grid of meters, so a grid point only looks at its own
    const underAt = new Map<string, Point[]>();
    under.forEach(point => {
      const key = `${Math.floor(point[0])}:${Math.floor(point[1])}`;
      underAt.set(key, [...(underAt.get(key) ?? []), point]);
    });
    const underNear = ([x, y]: Point) =>
      [-1, 0, 1].some(dx =>
        [-1, 0, 1].some(
          dy =>
            !clearOf(
              [x, y],
              underAt.get(`${Math.floor(x) + dx}:${Math.floor(y) + dy}`) ?? [],
              FILL_GRID * 0.3
            )
        )
      );
    const free = [
      ...inside.filter(
        point =>
          clearOf(
            point,
            fixed.map(([x, y]): Point => [x, y]),
            FILL_GRID * 0.5
          ) && !underNear(point)
      ),
      ...under,
    ];
    const held = outline.length + fixed.length;
    const points = [...outline, ...fixed.map(([x, y]): Point => [x, y]), ...free];
    const laid = cdt2d(
      points.map(([x, y]) => [x, y] as [number, number]),
      outline.map((_, step): [number, number] => [step, (step + 1) % outline.length]),
      { delaunay: true, interior: true, exterior: false }
    );
    // every point's neighbours, and the edge held while the inside relaxes
    const neighbours = points.map(() => new Set<number>());
    laid.forEach(corners =>
      corners.forEach((one, step) =>
        neighbours[one]
          ?.add(corners[(step + 1) % 3] as number)
          .add(corners[(step + 2) % 3] as number)
      )
    );
    const mean = edge.reduce((sum, { level }) => sum + level, 0) / edge.length;
    const levels = [
      ...edge.map(({ level }) => level),
      ...fixed.map(([, , level]) => level),
      ...free.map(() => mean),
    ];
    Array.from({ length: FILL_RELAX }).forEach(() =>
      free.forEach((_, step) => {
        const point = held + step;
        const around = [...(neighbours[point] ?? [])];
        levels[point] =
          around.reduce((sum, other) => sum + (levels[other] as number), 0) / (around.length || 1);
      })
    );
    // and bloated, if asked: a dome over it, nothing along its edge or at a
    // reference point and the bulge at its highest - relaxed the same way,
    // but with every point lifted a little over its neighbours' mean
    const dome = points.map(() => 0);
    if (bulge > 0) {
      Array.from({ length: FILL_RELAX }).forEach(() =>
        free.forEach((_, step) => {
          const point = held + step;
          const around = [...(neighbours[point] ?? [])];
          dome[point] =
            around.reduce((sum, other) => sum + (dome[other] as number), 0) / (around.length || 1) +
            FILL_GRID ** 2;
        })
      );
    }
    const highest = Math.max(...dome) || 1;
    const ground = DRAWN_GROUND();
    // where the edge lies on the ground, the stretches of it the inside eases
    // out onto
    const onGround = ({ at, level }: { at: Point; level: number }) =>
      Math.abs(level - (ground(at[0], at[1]) ?? Infinity)) < FILL_ON_GROUND;
    // - only where the terrain beyond it falls away or stays level: where it
    // rises, as up a slope, easing onto the ground inside dug a trough
    const beyond = ([ax, ay]: Point, [bx, by]: Point) => {
      const [mx, my] = [(ax + bx) / 2, (ay + by) / 2];
      const length = Math.hypot(bx - ax, by - ay) || 1;
      const [nx, ny] = [(-(by - ay) / length) * FILL_LOOK, ((bx - ax) / length) * FILL_LOOK];
      const out: Point = within([mx + nx, my + ny], outline)
        ? [mx - nx, my - ny]
        : [mx + nx, my + ny];
      return (ground(out[0], out[1]) ?? -Infinity) - (ground(mx, my) ?? Infinity);
    };
    const lying = edge.flatMap((one, step) => {
      const other = edge[(step + 1) % edge.length] as { at: Point; level: number };
      return onGround(one) && onGround(other) && beyond(one.at, other.at) < FILL_RISING
        ? [[one.at, other.at]]
        : [];
    });
    const eased = (x: number, y: number, height: number) => {
      if (feather <= 0 || lying.length === 0) {
        return height;
      }
      const off = Math.min(...lying.map(line => nearestOn(line, x, y).distance));
      const under = ground(x, y) ?? height;
      // flat onto the ground at the edge, and in by the feather as laid
      const share = smoothstep(0, feather, off);
      return under + (height - under) * share;
    };
    const heights = points.map(([x, y], step) =>
      Math.max(
        Math.min(
          BESIDE_STAIRS()(x, y),
          step >= held
            ? eased(x, y, (levels[step] as number) + (bulge * (dome[step] as number)) / highest)
            : (levels[step] as number)
        ),
        ground(x, y) ?? -Infinity
      )
    );
    return [{ points, heights, triangles: laid, edges: outline.length, held }];
  })
);

/**
 * The terrain as baked, in the plan: every vertex, and points along every
 * edge a quarter meter apart - its creases, which a dump has to follow as
 * much as its corners. The skirt's left out.
 */
const GROUND_VERTICES = once((): Point[] => {
  const positions = new Float32Array(unpacked(GROUND.positions));
  const count = positions.length / 3;
  const indices =
    count > 0xffff
      ? new Uint32Array(unpacked(GROUND.indices))
      : new Uint16Array(unpacked(GROUND.indices));
  const heights = Array.from({ length: count }, (_, at) => positions[at * 3 + 1] as number);
  const floor = Math.min(...heights);
  const at = (index: number): Point => [
    positions[index * 3] as number,
    -(positions[index * 3 + 2] as number),
  ];
  const edges = new Set<string>();
  const along: Point[] = [];
  for (let face = 0; face < indices.length / 3; face++) {
    [0, 1, 2].forEach(k => {
      const [a, b] = [indices[face * 3 + k] as number, indices[face * 3 + ((k + 1) % 3)] as number];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (edges.has(key) || heights[a] === floor || heights[b] === floor) {
        return;
      }
      edges.add(key);
      const [from, to] = [at(a), at(b)];
      const pieces = Math.floor(Math.hypot(to[0] - from[0], to[1] - from[1]) / FILL_EDGE);
      Array.from({ length: Math.max(0, pieces - 1) }, (_, piece) => {
        const share = (piece + 1) / pieces;
        along.push([from[0] + (to[0] - from[0]) * share, from[1] + (to[1] - from[1]) * share]);
      });
    });
  }
  return [...heights.flatMap((height, index) => (height > floor ? [at(index)] : [])), ...along];
});

/**
 * The ground the pillar stairs lie on, for a dump to bed them in: under every
 * step from its upper end to just before the next one down starts,
 * five along each step and five across it, `PILLAR_BEDDED` over its
 * underside - sunk in, so no gap shows under it. Their undersides saw down the slope - each step falls gently
 * along itself and a pillar's depth onto the next - and held along the middle
 * alone, the ground sagged away from the outer pillars.
 */
const PILLAR_BED = once((): [x: number, y: number, level: number][] => {
  const plan = PILLAR_PLAN();
  if (plan === undefined) {
    return [];
  }
  const { length, overlap, pillar, pillars, gap } = PILLAR_STAIRS;
  const reach = ((pillars - 1) / 2) * (pillar + gap) + pillar / 2;
  // five along and five across, the outer ones a hair in from the edges
  const along = Array.from({ length: 5 }, (_, at) => 0.03 + ((length - overlap - 0.06) * at) / 4);
  const across = Array.from(
    { length: 5 },
    (_, at) => -reach + 0.03 + ((2 * reach - 0.06) * at) / 4
  );
  return plan.runs.flatMap(({ at, direction, top }) => {
    const side: Point = [-direction[1], direction[0]];
    return along.flatMap(by =>
      across.map((off): [number, number, number] => [
        at[0] + direction[0] * by + side[0] * off,
        at[1] + direction[1] * by + side[1] * off,
        top - by * plan.fall - pillar + PILLAR_BEDDED,
      ])
    );
  });
});

/**
 * How far a pillar is sunk into the ground it is bedded in, in meters: the
 * ground stands that far over its underside - a hair, so no gap shows under
 * it, and it lies on the ground rather than in it.
 */
const PILLAR_BEDDED = 0.005;

/** How far either side of an edge two dumps share the brow along it is rounded, in meters. */
const FILL_BLEND = 1.5;

/**
 * The dumps as laid, run on into each other where two meet: along an edge
 * they share, each was relaxed on its own, and a deck running into a bank made
 * a crease there. So every point near that edge is relaxed together across
 * both - the edge itself stays straight between its handles, as laid.
 */
const FILLED = once(() => {
  const dumps = FILLED_ALONE();
  const keyOf = ([x, y]: Point) => `${Math.round(x / FILL_SAME)}:${Math.round(y / FILL_SAME)}`;
  // where on the plan each point of every dump is, and which are shared
  const owners = new Map<string, { dump: number; point: number }[]>();
  dumps.forEach(({ points }, dump) =>
    points.forEach((at, point) => {
      const key = keyOf(at);
      owners.set(key, [...(owners.get(key) ?? []), { dump, point }]);
    })
  );
  const handles = new Set(
    FILLS.flatMap(({ ring }) =>
      ring.flatMap(number => {
        const handle = pickByKey(number);
        return handle === undefined ? [] : [keyOf(handle.at)];
      })
    )
  );
  const shared = [...owners].filter(
    ([key, all]) => new Set(all.map(({ dump }) => dump)).size > 1 && !handles.has(key)
  );
  if (shared.length === 0) {
    return dumps;
  }
  // only the later of two dumps runs on into the earlier: that one was laid
  // and looked at first, and relaxed along with the later it changed where no
  // one had asked it to
  const sharedAt = dumps.map((_, dump) =>
    shared
      .filter(([, all]) => {
        const by = all.map(({ dump: one }) => one);
        return by.includes(dump) && Math.min(...by) !== dump;
      })
      .map(([key]) => key.split(':').map(value => Number(value) * FILL_SAME) as Point)
  );
  const near = (dump: number, [x, y]: Point) =>
    (sharedAt[dump] ?? []).some(([sx, sy]) => Math.hypot(sx - x, sy - y) < FILL_BLEND);
  // the points to relax: those near a shared edge off any edge - the edge
  // itself stays as laid, straight between its handles: let go of, it sagged
  // between them, and every handle stood in a notch
  const free = new Set<string>([
    ...dumps.flatMap(({ points, held }, dump) =>
      // and never a height held: a reference point, a step's bed
      points.flatMap((at, point) => (point >= held && near(dump, at) ? [keyOf(at)] : []))
    ),
  ]);
  // every point's neighbours, across the dumps it belongs to
  const neighbours = new Map<string, Set<string>>();
  dumps.forEach(({ points, triangles }) =>
    triangles.forEach(corners =>
      corners.forEach((one, k) => {
        const key = keyOf(points[one] as Point);
        const around = neighbours.get(key) ?? new Set<string>();
        [corners[(k + 1) % 3], corners[(k + 2) % 3]].forEach(other =>
          around.add(keyOf(points[other as number] as Point))
        );
        neighbours.set(key, around);
      })
    )
  );
  const level = new Map<string, number>();
  dumps.forEach(({ points, heights }) =>
    points.forEach((at, point) => level.set(keyOf(at), heights[point] as number))
  );
  Array.from({ length: FILL_RELAX }).forEach(() =>
    free.forEach(key => {
      const around = [...(neighbours.get(key) ?? [])];
      level.set(
        key,
        around.reduce((sum, other) => sum + (level.get(other) as number), 0) / (around.length || 1)
      );
    })
  );
  const ground = DRAWN_GROUND();
  return dumps.map(({ points, heights, ...rest }) => ({
    ...rest,
    points,
    heights: points.map((at, point) =>
      free.has(keyOf(at))
        ? Math.max(level.get(keyOf(at)) as number, ground(at[0], at[1]) ?? -Infinity)
        : (heights[point] as number)
    ),
  }));
});

/** The dumps' own height at a point of the plan, if one is there. */
const FILL_AT = once(() => {
  type Corner = [x: number, y: number, height: number];
  const faces = FILLED().flatMap(({ points, heights, triangles }) =>
    triangles.map(
      corners =>
        corners.map((corner): Corner => {
          const [x, y] = points[corner] as Point;
          return [x, y, heights[corner] as number];
        }) as [Corner, Corner, Corner]
    )
  );
  return (x: number, y: number): number | undefined =>
    faces.reduce<number | undefined>((found, [[ax, ay, ah], [bx, by, bh], [cx, cy, ch]]) => {
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(d) < 1e-12) {
        return found;
      }
      const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
      const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) {
        return found;
      }
      const height = l1 * ah + l2 * bh + l3 * ch;
      return found === undefined ? height : Math.max(found, height);
    }, undefined);
});

/**
 * The ground a brush piles onto: the terrain as baked, and the dumps on it -
 * whichever is higher at a point of the plan.
 */
export const LANDFILL_GROUND = once(() => {
  const [ground, fill] = [DRAWN_GROUND(), FILL_AT()];
  return (x: number, y: number): number | undefined => {
    const [under, over] = [ground(x, y), fill(x, y)];
    return under === undefined ? over : over === undefined ? under : Math.max(under, over);
  };
});

/** The dumps drawn, over the terrain and tinted like it. */
export function createFills(tint: (x: number, y: number, height: number) => number[]): Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  // one vertex where two dumps share a point at one height - along the edge
  // two of them meet on - so the shading is worked out across it, not twice
  const shared = new Map<string, number>();
  // and where each lies on the terrain along its edge, which is where it takes
  // the terrain's shading on
  const lying: Point[] = [];
  const drawn = DRAWN_GROUND();
  FILLED().forEach(({ points, heights, triangles, edges }) => {
    points.slice(0, edges).forEach(([x, y], step) => {
      if (Math.abs((heights[step] as number) - (drawn(x, y) ?? Infinity)) < FILL_ON_GROUND) {
        lying.push([x, y]);
      }
    });
    const vertexOf = points.map(([x, y], step) => {
      const height = heights[step] as number;
      const key = [x, y, height].map(value => Math.round(value / FILL_SAME)).join(':');
      const known = shared.get(key);
      if (known !== undefined) {
        return known;
      }
      shared.set(key, positions.length / 3);
      positions.push(x, height, -y);
      colors.push(...tint(x, y, height));
      return positions.length / 3 - 1;
    });
    triangles.forEach(([a, b, c]) => {
      const [pa, pb, pc] = [a, b, c].map(corner => points[corner] as Point) as [
        Point,
        Point,
        Point,
      ];
      // counter clockwise on the plan comes out facing up, as with the terrain
      const turn = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1]);
      indices.push(...(turn > 0 ? [a, b, c] : [a, c, b]).map(corner => vertexOf[corner] as number));
    });
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // where a dump lies on the terrain, its shading runs on into the terrain's:
  // each drawn on its own, the light broke along the edge where the two meet
  // at one height. Turned to the terrain's own at the edge, and eased over
  // into the dump's own a little way in
  const normals = geometry.getAttribute('normal');
  const terrain = TERRAIN_NORMAL();
  const lyingAt = new Map<string, Point[]>();
  lying.forEach(point => {
    const key = `${Math.floor(point[0])}:${Math.floor(point[1])}`;
    lyingAt.set(key, [...(lyingAt.get(key) ?? []), point]);
  });
  // the nearest point of an edge lying on the terrain, and how far off it is:
  // its shading is the terrain's there, where the terrain shows - the terrain
  // under the dump is hidden, and turned to that, the dump darkened again
  const toEdge = (x: number, y: number) =>
    [-1, 0, 1]
      .flatMap(dx =>
        [-1, 0, 1].flatMap(dy => lyingAt.get(`${Math.floor(x) + dx}:${Math.floor(y) + dy}`) ?? [])
      )
      .reduce<{ off: number; at: Point | undefined }>(
        (nearest, point) => {
          const off = Math.hypot(point[0] - x, point[1] - y);
          return off < nearest.off ? { off, at: point } : nearest;
        },
        { off: Infinity, at: undefined }
      );
  for (let vertex = 0; vertex < normals.count; vertex++) {
    const [x, y] = [positions[vertex * 3] as number, -(positions[vertex * 3 + 2] as number)];
    const { off, at } = toEdge(x, y);
    const under = off < FILL_SHADE && at !== undefined ? terrain(...at) : undefined;
    if (under === undefined) {
      continue;
    }
    const share = 1 - smoothstep(0, FILL_SHADE, off);
    const own = new Vector3(normals.getX(vertex), normals.getY(vertex), normals.getZ(vertex));
    own.lerp(under, share).normalize();
    normals.setXYZ(vertex, own.x, own.y, own.z);
  }
  // drawn over the terrain where the two meet at one height
  const mesh = new Mesh(
    geometry,
    new MeshLambertMaterial({
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  mesh.name = 'fill';
  return mesh;
}
