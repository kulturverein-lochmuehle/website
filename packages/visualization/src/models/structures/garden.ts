import type { Material } from 'three';
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshLambertMaterial,
  Object3D,
} from 'three';

import type { Point } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import { contains, nearestOn, random } from '../../utils/geometry.utils.js';
import { surfaceAt } from '../decorations/area.js';
import { pickByKey } from '../seam/seam.js';
import { BROOK_LINE, WAY_RUNS } from '../terrain/ground.js';

/**
 * The garden on the lawn between the small house's lane and the brook, as
 * the photograph from the lane between the houses has it: the millstone with
 * its pots, the sandbox by the lane, and by the brook a table with a bench
 * either side and the swinging seat. Each stands at a point of the bench, to
 * be moved there; the sandbox is turned square to the lane, what stands by
 * the brook along it, the seat's back to the water. The shrubs - the big one by the road, the
 * hedge, the hydrangeas - are the woods' own (`GARDEN_SHRUBS`), and grow,
 * turn and go bare with them.
 */
export const GARDEN = {
  sandbox: { at: 'point:46', size: [3, 2.4], rim: 0.12, high: 0.32, sand: 0.22 },
  /** The millstone: how wide, how thick, how high its top stands over the highest ground under it, and the socket it lies on, so much narrower across. */
  millstone: { at: 'point:47', radius: 1.25, high: 0.3, over: 0.4, socket: 1, pots: 7 },
  /** The table, its benches either side of it, how far their middles are off its own. */
  table: { at: 'point:48', length: 2, width: 0.8, high: 0.75, apart: 0.8 },
  swing: { at: 'point:49', wide: 2.1, high: 2.1, seat: [1.6, 0.55, 0.5] },
  bench: { length: 1.6, seat: 0.45 },
  /**
   * The dry stone wall from the millstone along the brook: its foot's points,
   * east to west, and how high it stands - to the upper plateau's level, a
   * little over - and how thick.
   */
  wall: {
    foot: ['point:80', 'point:81', 'point:82', 'point:83', 'point:84', 'point:85', 'point:110'],
    top: 0,
    over: 0,
    /** How far its foot goes into the lawn: between the points it is held at the lawn sags up to 0.3m under a straight line. */
    bury: 0.4,
    thick: 0.45,
  },
  /**
   * The wall from the dry wall's end out across the lower lawn: where it
   * starts, the point it heads for (290 on the bench), how far it runs at the
   * plateau's height, and how far it reaches in all - its top running down
   * to the lawn between the two.
   */
  endWall: { from: 'point:110', toward: 'point:71', full: 3, reach: 4.88 },
} as const;

/**
 * The flower beds west of the millstone: where each lies along the lane, how
 * long and wide across, how many clumps it holds and how high they grow, and the share of
 * them in flower from spring to the end of summer.
 */
export const GARDEN_BEDS = {
  beds: [{ at: 'point:143', size: [2.2, 1.1] }],
  /**
   * And the bed along the dry wall: its top's line it follows (305 to 307 on
   * the bench), from how far along it, how far in off it towards the lane,
   * and how wide; its clumps a meter apart.
   */
  strip: { along: ['point:86', 'point:87', 'point:88'], from: 1.2, out: 0.6, wide: 0.9 },
  clumps: 14,
  height: [0.25, 0.7],
  flowering: 0.6,
} as const;

/** Where the garden's shrubs grow and how tall: one big one by the road, the hedge along the brook from one point to the other, the hydrangeas. */
export const GARDEN_SHRUBS = {
  big: { at: 'point:50', height: 4.2 },
  hedge: { along: ['point:51', 'point:52', 'point:65'], height: [1.6, 2.4], every: 1.7 },
  /**
   * Shrubs on the bank between the stairs' lower wall and the road's railing
   * over it: the ring of the dump they grow on - a strip under 2m wide - how
   * many, how far in off its edges they keep, and how tall.
   */
  bank: {
    within: [
      'stairs:upper-start:top',
      'stairs:lower-start-back:top',
      'stairs:lower-kink-back:top',
      'stairs:lower-end-back:top',
      'stairs:lower-end:foot',
      'stairs:upper-end:foot',
      'stairs:upper-end:top',
    ],
    count: 12,
    clear: 0.4,
    height: [0.8, 1.4],
  },
  hydrangeas: { at: ['point:53', 'point:54'], height: 1.1 },
  /** On the ramp down towards the mill. */
  ramp: { at: ['point:77', 'point:78', 'point:79'], height: [1.4, 2.6] },
} as const;

const placeOf = (key: string): Point | undefined => pickByKey(key)?.at;

/** The lane's way at a point, as an angle on the plan: what stands along it is turned square to it. */
function laneTurn([x, y]: Point): number {
  const lane = WAY_RUNS.filter(({ main }) => !main)
    .map(({ points }) => nearestOn(points, x, y))
    .sort((a, b) => a.distance - b.distance)[0];
  return lane === undefined ? 0 : Math.atan2(lane.heading[1], lane.heading[0]);
}

/**
 * The brook's way at a point, as an angle on the plan, turned so that what
 * stands there has its back - the plan's left of the way - to the water.
 */
function brookTurn([x, y]: Point): number {
  const { heading, at } = nearestOn(BROOK_LINE, x, y);
  const turn = Math.atan2(heading[1], heading[0]);
  // the left of the way, and whether the water lies that side
  const [lx, ly] = [-Math.sin(turn), Math.cos(turn)];
  return lx * (at[0] - x) + ly * (at[1] - y) > 0 ? turn : turn + Math.PI;
}

/** A box of a size, its foot at a height in a frame turned on the plan: u along, v across, as the plan's x and y. */
function box(
  material: Material,
  [length, high, width]: [number, number, number],
  [u, foot, v]: [number, number, number]
): Mesh {
  const mesh = new Mesh(new BoxGeometry(length, high, width), material);
  // the scene mirrors the plan's y into -z
  mesh.position.set(u, foot + high / 2, -v);
  return mesh;
}

/**
 * A wall as the other walls are drawn: a plain band along its feet, from
 * `bury` under each foot up to that foot's top, `thick` deep towards the plan's
 * left of its way - the ground it holds up.
 */
function wallBand(
  feet: { at: Point; level: number; top: number }[],
  thick: number,
  bury: number
): BufferGeometry {
  const band: number[] = [];
  // each run's way across the wall, and at a foot between two the mitre of
  // theirs, so the back face meets itself round a corner however sharp
  const normal = (a: Point, b: Point): Point => {
    const long = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / long, (b[0] - a[0]) / long];
  };
  const runs = feet
    .slice(1)
    .map((foot, k) => normal((feet[k] as (typeof feet)[number]).at, foot.at));
  const across = feet.map((_, k): Point => {
    const [one, other] = [runs[k - 1] ?? runs[k], runs[k] ?? runs[k - 1]];
    if (one === undefined || other === undefined) {
      return [0, 0];
    }
    const meet = 1 + one[0] * other[0] + one[1] * other[1];
    return [(one[0] + other[0]) / meet, (one[1] + other[1]) / meet];
  });
  const corner = (k: number, side: 0 | 1, up: boolean) => {
    const { at, level, top } = feet[k] as (typeof feet)[number];
    const [ox, oy] = across[k] as Point;
    const [x, y] = [at[0] + ox * thick * side, at[1] + oy * thick * side];
    return [x, up ? top : level - bury, -y];
  };
  const quad = (a: number[], b: number[], c: number[], d: number[]) =>
    band.push(...a, ...b, ...c, ...a, ...c, ...d);
  feet.slice(1).forEach((_, at) => {
    const k = at + 1;
    // the face before it, the one behind, and the top
    quad(corner(at, 0, false), corner(k, 0, false), corner(k, 0, true), corner(at, 0, true));
    quad(corner(k, 1, false), corner(at, 1, false), corner(at, 1, true), corner(k, 1, true));
    quad(corner(at, 0, true), corner(k, 0, true), corner(k, 1, true), corner(at, 1, true));
  });
  // and its two ends
  if (feet.length > 1) {
    [0, feet.length - 1].forEach(k =>
      quad(corner(k, 1, false), corner(k, 0, false), corner(k, 0, true), corner(k, 1, true))
    );
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(band, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Stood at a point of the plan, turned, on whatever is under it - or at a height of its own. */
function stood(object: Object3D, [x, y]: Point, turn: number, foot = surfaceAt(x, y)): Object3D {
  object.position.set(x, foot, -y);
  object.rotation.y = turn;
  return object;
}

/** The ground under a box's four corners, turned on the plan: the highest and the lowest. */
function cornersOf([x, y]: Point, turn: number, [long, deep]: readonly [number, number]) {
  const [c, s] = [Math.cos(turn), Math.sin(turn)];
  const grounds = [-1, 1].flatMap(u =>
    [-1, 1].map(v => {
      const [du, dv] = [(u * long) / 2, (v * deep) / 2];
      return surfaceAt(x + du * c - dv * s, y + du * s + dv * c);
    })
  );
  return { high: Math.max(...grounds), low: Math.min(...grounds) };
}

/** The garden on the lawn before the small house, all of it - nothing put up, there the year round. */
export function createGarden(palette: Palette): Group {
  const group = new Group();
  group.name = 'garden';
  const next = random(1909);
  const lambert = (color: MeshLambertMaterial['color']) =>
    new MeshLambertMaterial({ color, flatShading: true });
  // wood gone grey out of doors, a darker board for what is newer
  const weathered = lambert(palette.boarding.clone().lerp(palette.granite, 0.55));
  const darker = lambert(palette.boarding.clone().lerp(palette.granite, 0.3));
  const sand = lambert(palette.autumnGold.clone().lerp(palette.snow, 0.45));
  const stone = lambert(palette.granite.clone().lerp(palette.snow, 0.25));
  const clay = lambert(palette.autumnRust.clone().lerp(palette.roof, 0.3));
  const steel = lambert(palette.granite.clone().lerp(palette.sky, 0.1));
  // the toys' and the seesaw's paint, bright as they are bought
  const red = lambert(palette.autumnOrange.clone().lerp(palette.roofAccent, 0.2));
  const blue = lambert(palette.skyDeep.clone().lerp(palette.sky, 0.35));
  const yellow = lambert(palette.flowerYellow);

  // the sandbox: four boards round a bed of sand, a few toys on it
  const sandbox = placeOf(GARDEN.sandbox.at);
  if (sandbox !== undefined) {
    const { size, rim, high: rimHigh, sand: filled } = GARDEN.sandbox;
    const [long, deep] = size;
    const turn = laneTurn(sandbox);
    // level on the slope: its top as high over the highest corner as it
    // stands, its boards down into the ground at the lowest
    const { high: top, low } = cornersOf(sandbox, turn, size);
    const down = top - low + 0.1;
    const high = rimHigh + down;
    const it = new Group();
    it.add(
      box(weathered, [long, high, rim], [0, -down, deep / 2 - rim / 2]),
      box(weathered, [long, high, rim], [0, -down, -deep / 2 + rim / 2]),
      box(weathered, [rim, high, deep - 2 * rim], [long / 2 - rim / 2, -down, 0]),
      box(weathered, [rim, high, deep - 2 * rim], [-long / 2 + rim / 2, -down, 0]),
      box(sand, [long - 2 * rim, filled + down, deep - 2 * rim], [0, -down, 0]),
      // a toy digger, a bucket, a crate
      box(yellow, [0.35, 0.18, 0.2], [-0.6, filled - 0.1, 0.3]),
      box(red, [0.25, 0.22, 0.25], [0.5, filled - 0.1, -0.4]),
      box(blue, [0.3, 0.15, 0.22], [0.9, filled - 0.1, 0.5])
    );
    group.add(stood(it, sandbox, turn, top));
  }

  // the old millstone laid flat, its eye full of earth and pots round its top
  const millstone = placeOf(GARDEN.millstone.at);
  if (millstone !== undefined) {
    const { radius, high, over, socket, pots } = GARDEN.millstone;
    const it = new Group();
    // the ground under it, at its middle and highest round its rim
    const under = Array.from({ length: 12 }, (_, k) => {
      const angle = (k / 12) * Math.PI * 2;
      return surfaceAt(
        millstone[0] + Math.cos(angle) * radius,
        millstone[1] + Math.sin(angle) * radius
      );
    });
    const middle = surfaceAt(...millstone);
    const lift = Math.max(...under, middle) + over - middle;
    const lowest = Math.min(...under, middle) - middle;
    const disc = new Mesh(new CylinderGeometry(radius, radius * 1.02, high, 20), stone);
    disc.position.y = lift - high / 2;
    // a round socket under it, a meter narrower across, down into the ground
    const base = new Mesh(
      new CylinderGeometry(
        radius - socket / 2,
        radius - socket / 2,
        lift - high - lowest + 0.1,
        16
      ),
      stone
    );
    base.position.y = (lift - high + lowest - 0.1) / 2;
    it.add(disc, base);
    const crown = lift;
    Array.from({ length: pots }, (_, k) => {
      const angle = (k / pots) * Math.PI * 2 + next() * 0.4;
      const size = 0.08 + next() * 0.07;
      const pot = new Mesh(new CylinderGeometry(size, size * 0.75, size * 1.4, 8), clay);
      const out = radius * (0.5 + next() * 0.38);
      pot.position.set(Math.cos(angle) * out, crown - 0.02 + size * 0.7, Math.sin(angle) * out);
      // what grows in it, a low clump wider than the pot, a few of them in flower
      const leaves = new Mesh(
        new DodecahedronGeometry(size * 1.5, 0),
        lambert(
          next() < 0.3
            ? palette.flowerViolet.clone().lerp(palette.roof, 0.4)
            : palette.foliage.clone().lerp(palette.grassSpring, next() * 0.5)
        )
      );
      leaves.scale.set(1, 0.6, 1);
      leaves.position.set(pot.position.x, pot.position.y + size * 1.2, pot.position.z);
      it.add(pot, leaves);
    });
    group.add(stood(it, millstone, 0));
  }

  // the swinging seat: an A on either side, a beam over, the seat on chains
  const swing = placeOf(GARDEN.swing.at);
  if (swing !== undefined) {
    const { wide, high, seat } = GARDEN.swing;
    const it = new Group();
    [-1, 1].forEach(end =>
      [-1, 1].forEach(lean => {
        const leg = box(weathered, [0.09, high * 1.04, 0.09], [0, 0, 0]);
        leg.position.set(end * (wide / 2), high / 2, lean * 0.35);
        // leant in at the top, an A seen from the end
        leg.rotation.x = -lean * 0.33;
        it.add(leg);
      })
    );
    it.add(box(weathered, [wide + 0.2, 0.1, 0.1], [0, high - 0.05, 0]));
    const [long, deep, at] = seat;
    it.add(
      box(darker, [long, 0.06, deep], [0, at, 0]),
      box(darker, [long, 0.45, 0.06], [0, at + 0.06, deep / 2]),
      ...[-1, 1].map(end =>
        box(steel, [0.02, high - at - 0.1, 0.02], [end * (long / 2 - 0.05), at + 0.06, 0])
      )
    );
    group.add(stood(it, swing, brookTurn(swing)));
  }

  // the table by the brook, a bench either side of it, their backs away from it
  const table = placeOf(GARDEN.table.at);
  if (table !== undefined) {
    const { length, width, high, apart } = GARDEN.table;
    const turn = brookTurn(table);
    const it = new Group();
    it.add(
      box(weathered, [length, 0.05, width], [0, high - 0.05, 0]),
      ...[-1, 1].map(end =>
        box(darker, [0.08, high - 0.05, width - 0.15], [end * (length / 2 - 0.2), 0, 0])
      )
    );
    group.add(stood(it, table, turn));
    const [c, s] = [Math.cos(turn), Math.sin(turn)];
    [-1, 1].forEach(side => {
      // the plan's left of the table's way is its back; the bench there faces it
      const at: Point = [table[0] - s * side * apart, table[1] + c * side * apart];
      const { length: long, seat } = GARDEN.bench;
      const bench = new Group();
      bench.add(
        box(darker, [long, 0.05, 0.42], [0, seat - 0.05, 0]),
        box(darker, [long, 0.35, 0.05], [0, seat + 0.1, 0.22]),
        ...[-1, 1].map(end =>
          box(darker, [0.08, seat - 0.05, 0.42], [end * (long / 2 - 0.15), 0, 0])
        )
      );
      group.add(stood(bench, at, side > 0 ? turn : turn + Math.PI));
    });
  }

  // the dry stone wall, drawn as the other walls are: a plain band from
  // under its foot up to the plateau over it, its faces and its top
  const feet = GARDEN.wall.foot.flatMap(key => {
    const handle = pickByKey(key);
    return handle === undefined ? [] : [{ ...handle, top: GARDEN.wall.top + GARDEN.wall.over }];
  });
  // and the wall from the dry wall's end out across the lower lawn: at the
  // plateau's height for its first meters, then its top running down to the
  // lawn
  const from = pickByKey(GARDEN.endWall.from);
  const toward = pickByKey(GARDEN.endWall.toward)?.at;
  const across = (() => {
    if (from === undefined || toward === undefined) {
      return [];
    }
    const way = Math.atan2(toward[1] - from.at[1], toward[0] - from.at[0]);
    const along = (by: number): Point => [
      from.at[0] + Math.cos(way) * by,
      from.at[1] + Math.sin(way) * by,
    ];
    const { full, reach } = GARDEN.endWall;
    const top = GARDEN.wall.top;
    return [
      { at: from.at, level: from.level, top },
      { at: along(full), level: from.level, top },
      { at: along(reach), level: from.level, top: from.level },
    ];
  })();
  // one band round the corner, so the two meet without a gap
  const wall = new Mesh(
    wallBand([...feet, ...across.slice(1)], GARDEN.wall.thick, GARDEN.wall.bury),
    new MeshLambertMaterial({ color: palette.wallAccent, flatShading: true, side: DoubleSide })
  );
  wall.name = 'garden:wall';
  group.add(wall);

  // the flower beds: low clumps of leaves from spring to autumn, bare in
  // winter, and their flowers over them through spring and summer
  const flowerColors = [
    palette.flowerYellow,
    palette.flowerViolet,
    palette.roof.clone().lerp(palette.snow, 0.25),
    palette.snow,
  ];
  const leaves = new Group();
  leaves.userData['seasons'] = ['spring', 'summer', 'autumn'];
  const flowers = new Group();
  flowers.userData['seasons'] = ['spring', 'summer'];
  const {
    clumps,
    height: [low, high],
    flowering,
  } = GARDEN_BEDS;
  // a clump of leaves at a point, on whatever is under it, maybe in flower
  const plant = ([x, y]: Point) => {
    const ground = surfaceAt(x, y);
    const tall = low + next() * (high - low);
    const clump = new Mesh(
      new DodecahedronGeometry(0.22 + next() * 0.12, 0),
      lambert(palette.foliage.clone().lerp(palette.grassSpring, next() * 0.4))
    );
    clump.scale.set(1, tall / 0.5, 1);
    clump.position.set(x, ground + tall * 0.4, -y);
    leaves.add(clump);
    if (next() < flowering) {
      Array.from({ length: 3 }, () => {
        const head = new Mesh(
          new DodecahedronGeometry(0.06 + next() * 0.04, 0),
          lambert(flowerColors[Math.floor(next() * flowerColors.length)] ?? palette.snow)
        );
        head.position.set(
          x + (next() - 0.5) * 0.35,
          ground + tall * (0.75 + next() * 0.3),
          -(y + (next() - 0.5) * 0.35)
        );
        flowers.add(head);
      });
    }
  };
  GARDEN_BEDS.beds.forEach(({ at: key, size: [long, wide] }) => {
    const at = placeOf(key);
    if (at === undefined) {
      return;
    }
    const turn = laneTurn(at);
    const [c, s] = [Math.cos(turn), Math.sin(turn)];
    Array.from({ length: clumps }, () => {
      // somewhere in the bed's oval
      const [r, a] = [Math.sqrt(next()), next() * Math.PI * 2];
      const [u, v] = [(Math.cos(a) * r * long) / 2, (Math.sin(a) * r * wide) / 2];
      plant([at[0] + u * c - v * s, at[1] + u * s + v * c]);
    });
  });
  // and the bed along the wall: two rows staggered along its top's line, in
  // off it, a clump a meter along each
  const { along, from: begin, out, wide } = GARDEN_BEDS.strip;
  const line = along.flatMap(key => {
    const at = placeOf(key);
    return at === undefined ? [] : [at];
  });
  line.slice(1).forEach((b, k) => {
    const a = line[k] as Point;
    const long = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [ux, uy] = [(b[0] - a[0]) / long, (b[1] - a[1]) / long];
    // the plan's left of the wall's way, the plateau's side
    const [nx, ny] = [-uy, ux];
    const start = k === 0 ? begin : 0;
    Array.from({ length: Math.max(Math.floor((long - start) / 0.5), 0) }, (_, step) => {
      const by = start + step * 0.5 + next() * 0.2;
      const off = out + (step % 2 === 0 ? 0.25 : 0.65) * wide - wide * 0.45 + (next() - 0.5) * 0.15;
      plant([a[0] + ux * by + nx * off, a[1] + uy * by + ny * off]);
    });
  });
  group.add(leaves, flowers);

  // the hydrangeas in flower: white heads, a few pale pink, summer to autumn
  GARDEN_SHRUBS.hydrangeas.at.forEach(key => {
    const at = placeOf(key);
    if (at === undefined) {
      return;
    }
    const heads = new Group();
    heads.userData['seasons'] = ['summer', 'autumn'];
    const { height } = GARDEN_SHRUBS.hydrangeas;
    Array.from({ length: 9 }, () => {
      const angle = next() * Math.PI * 2;
      const out = next() * height * 0.5;
      const head = new Mesh(
        new DodecahedronGeometry(0.13 + next() * 0.06, 0),
        lambert(next() < 0.7 ? palette.snow : palette.snow.clone().lerp(palette.flowerViolet, 0.25))
      );
      head.position.set(
        Math.cos(angle) * out,
        height * (0.55 + next() * 0.4),
        Math.sin(angle) * out
      );
      heads.add(head);
    });
    group.add(stood(heads, at, 0));
  });
  return group;
}

/** The garden's shrubs as the woods take them: where each stands and how tall. */
export function gardenShrubs(): { point: Point; height: number }[] {
  const big = placeOf(GARDEN_SHRUBS.big.at);
  const {
    along,
    height: [low, tall],
    every,
  } = GARDEN_SHRUBS.hedge;
  const next = random(1910);
  // a shrub every so far along each stretch, the corners once
  const line = along.flatMap(key => {
    const at = placeOf(key);
    return at === undefined ? [] : [at];
  });
  const hedge = line.slice(1).flatMap((b, k) => {
    const a = line[k] as Point;
    const steps = Math.max(Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / every), 1);
    return Array.from({ length: steps + (k === line.length - 2 ? 1 : 0) }, (_, step) => {
      const t = step / steps;
      return {
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as Point,
        height: low + next() * (tall - low),
      };
    });
  });
  // and scattered over the bank, each far enough in off its edges and from
  // the others, looked for in the same places every time
  const ring = GARDEN_SHRUBS.bank.within.flatMap(key => {
    const at = placeOf(key);
    return at === undefined ? [] : [at];
  });
  const { count, clear, height: bankHeight } = GARDEN_SHRUBS.bank;
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  const bank = Array.from({ length: 400 }, (): Point => [
    Math.min(...xs) + next() * (Math.max(...xs) - Math.min(...xs)),
    Math.min(...ys) + next() * (Math.max(...ys) - Math.min(...ys)),
  ])
    .filter(
      at =>
        ring.length > 2 &&
        contains(ring, at) &&
        nearestOn([...ring, ring[0] as Point], at[0], at[1]).distance > clear
    )
    .reduce<Point[]>(
      (kept, at) =>
        kept.length < count && kept.every(([x, y]) => Math.hypot(x - at[0], y - at[1]) > 1)
          ? [...kept, at]
          : kept,
      []
    )
    .map(point => ({
      point,
      height: bankHeight[0] + next() * (bankHeight[1] - bankHeight[0]),
    }));
  const hydrangeas = GARDEN_SHRUBS.hydrangeas.at.flatMap(key => {
    const at = placeOf(key);
    return at === undefined ? [] : [{ point: at, height: GARDEN_SHRUBS.hydrangeas.height }];
  });
  const ramp = GARDEN_SHRUBS.ramp.at.flatMap(key => {
    const at = placeOf(key);
    const [short, tall] = GARDEN_SHRUBS.ramp.height;
    return at === undefined ? [] : [{ point: at, height: short + next() * (tall - short) }];
  });
  return [
    ...ramp,
    ...(big === undefined ? [] : [{ point: big, height: GARDEN_SHRUBS.big.height }]),
    ...hedge,
    ...bank,
    ...hydrangeas,
  ];
}
