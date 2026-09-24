import type { Object3D } from 'three';
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
} from 'three';

import type { ViewSpec } from '../../bake/views.js';
import { VIEWS } from '../../bake/views.js';
import type { Point } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import { distanceToPath, nearestOn, random, within } from '../../utils/geometry.utils.js';
import { distanceToBuildings } from '../buildings/footprint.js';
import { SITTINGS } from '../buildings/sitting.js';
import { placeOutline, PLACES } from '../places/places.js';
import { LANDFILL_GROUND } from '../seam/fills.js';
import { pickByKey } from '../seam/seam.js';
import { PAVILION, PAVILION_AT } from '../structures/pavilion.js';
import { heightAt, WAY_RUNS } from '../terrain/ground.js';
import type { Keepout } from './area.js';
import { createChristmas } from './christmas.js';
import { createSeating } from './seating.js';

/**
 * What is put up for an event, rather than being there all year: each piece
 * tagged, and shown only where its tag is asked for - by a view (`decorations`
 * in its spec) or by the editor's switches. Not by the season: the strings of
 * lights hang for a summer's festival as much as for the Advent calendar,
 * and a campfire burns whenever there is one. A piece is tagged on the object
 * that shows it (`decoration`); what stands in its place while it is not up
 * - a door shut, where it is open for an event - is tagged `decorationOff`.
 */
export const DECORATIONS = {
  'lichterkette-gelaender': 'Lichterketten an den Geländern',
  'feuer-werkstatt': 'Lagerfeuer vor der Werkstatt',
  'feuer-selbis': 'Lagerfeuer vor dem kleinen Haus',
  'feuer-terrasse': 'Lagerfeuer auf der Terrasse',
  'feuer-hexenhaus': 'Lagerfeuer vor dem Hexenhaus',
  'bar-werkstatt': 'Bar vor der Werkstatt',
  'grill-werkstatt': 'Grill vor der Werkstatt',
  'licht-werkstatt': 'Licht im Werkstatt-Saal',
  'licht-vereinsraum': 'Licht im Vereinsraum, die Tür offen',
  'buehne-werkstatt': 'Bühne im Werkstatt-Saal',
  'baenke-werkstatt-vorplatz': 'Bierzeltgarnituren vor der Werkstatt',
  'baenke-muehle-vorplatz': 'Bierzeltgarnituren vor der Mühle',
  'baenke-terrasse-pavillon': 'Bierzeltgarnituren auf der Terrasse am Pavillon',
  'weihnacht-hexenhaus': 'Weihnachten am Hexenhaus',
} as const;

export type Decoration = keyof typeof DECORATIONS;

export const DECORATION_KEYS = Object.keys(DECORATIONS) as Decoration[];

/** Shows what is put up of the decorations asked for, and what stands in for the rest. */
export function showDecorations(root: Object3D, up: readonly string[]): void {
  root.traverse(object => {
    const on = object.userData['decoration'] as string | undefined;
    const off = object.userData['decorationOff'] as string | undefined;
    if (on !== undefined) {
      object.visible = up.includes(on);
    } else if (off !== undefined) {
      object.visible = !up.includes(off);
    }
  });
}

/**
 * A campfire as it is laid: a ring of stones round it, a few logs leant
 * together over it, and the flame they burn in - a light of its own, orange,
 * low down, casting soft shadows, and burning whenever the fire is laid.
 */
export const CAMPFIRE = {
  ring: { radius: 0.55, stones: 11, stone: 0.1 },
  /** How many logs, how long and thick, and how steeply leant - each its own within these. */
  logs: { count: 6, length: [0.45, 0.85], radius: [0.035, 0.06], lean: [0.7, 1.15] },
  /** The flame's tongues: how many, how wide and how high at most. */
  flame: { tongues: 4, radius: 0.13, height: 0.6 },
  /** Where its light is, over the ground. */
  light: 0.3,
} as const;

/** The places a campfire is laid at, as the places name them. */
const FIRES = ['feuer-werkstatt', 'feuer-selbis', 'feuer-terrasse', 'feuer-hexenhaus'] as const;

/** A campfire at a point of the plan, standing on whatever is there: the ground, or what is piled on it. */
function campfire(palette: Palette, [x, y]: [number, number]): Group {
  const group = new Group();
  const ground = LANDFILL_GROUND()(x, y) ?? heightAt(x, y);
  group.position.set(x, ground, -y);
  const { ring, logs, flame } = CAMPFIRE;

  // the stones round it, each turned and sized a little its own way
  const stones = new InstancedMesh(
    new DodecahedronGeometry(ring.stone, 0),
    new MeshLambertMaterial({ color: palette.granite, flatShading: true }),
    ring.stones
  );
  const matrix = new Matrix4();
  Array.from({ length: ring.stones }, (_, k) => {
    const turn = (k / ring.stones) * Math.PI * 2;
    const size = 0.8 + ((k * 0.618) % 1) * 0.5;
    matrix.compose(
      new Vector3(Math.cos(turn) * ring.radius, ring.stone * 0.4, Math.sin(turn) * ring.radius),
      new Quaternion().setFromAxisAngle(new Vector3(0.3, 1, 0.2).normalize(), k * 1.7),
      new Vector3(size, size * 0.7, size)
    );
    stones.setMatrixAt(k, matrix);
  });

  // the logs leant together over the middle, as they were thrown on: no two
  // alike, round unevenly, one fallen outwards across the stones
  const next = random(Math.round(x * 1000 + y * 7));
  const between = ([low, high]: readonly [number, number]) => low + (high - low) * next();
  const wood = new MeshLambertMaterial({ color: palette.trunk, flatShading: true });
  let turn = next() * Math.PI * 2;
  Array.from({ length: logs.count }, (_, k) => {
    turn += ((Math.PI * 2) / logs.count) * (0.55 + next() * 0.9);
    const length = between(logs.length);
    const radius = between(logs.radius);
    const fallen = k === logs.count - 1;
    const lean = fallen ? Math.PI / 2 - 0.12 : between(logs.lean);
    const log = new Mesh(new CylinderGeometry(radius * 0.85, radius, length, 5), wood);
    const out = Math.sin(lean) * (length / 2) + (fallen ? 0.25 : next() * 0.06);
    log.position.set(
      Math.cos(turn) * out,
      Math.cos(lean) * (length / 2) + radius * 0.5,
      Math.sin(turn) * out
    );
    // leant in towards the middle, turned round itself a little too
    log.rotation.set(0, -turn + (next() - 0.5) * 0.5, 0);
    log.rotateZ(lean);
    log.rotateY(next() * Math.PI);
    group.add(log);
  });

  // the flame, a few tongues of it, bright, and more orange than a lantern:
  // each its own height and sway, which the editor moves frame by frame
  const hot = palette.lantern.clone().lerp(palette.autumnGold, 0.3);
  const fire = new Group();
  Array.from({ length: flame.tongues }, (_, k) => {
    const high = flame.height * (k === 0 ? 1 : 0.45 + next() * 0.4);
    const tongue = new Mesh(
      new ConeGeometry(flame.radius * (k === 0 ? 1 : 0.6 + next() * 0.3), high, 6),
      new MeshBasicMaterial({ color: hot.clone().lerp(palette.autumnOrange, k === 0 ? 0 : 0.4) })
    );
    tongue.geometry.translate(0, high / 2, 0);
    const aside = k === 0 ? 0 : 0.06 + next() * 0.06;
    const way = next() * Math.PI * 2;
    tongue.position.set(Math.cos(way) * aside, 0.02, Math.sin(way) * aside);
    tongue.userData['flame'] = { phase: next() * 10, lean: aside * 1.5 };
    tongue.userData['lamp'] = true;
    fire.add(tongue);
  });
  // its light, off the tallest tongue's middle
  const middle = fire.children[0] as Mesh;
  middle.geometry.userData['glows'] = [[0, CAMPFIRE.light, 0, 0, 0, 0, 0, 6]];
  fire.name = 'flame';
  group.add(stones, fire);
  return group;
}

/**
 * The grill: a trough on four legs at a grill's height, a grate over it and
 * a plate between the legs half way down, to stiffen them and to put things
 * on - brushed stainless steel, long side along the wall behind it. Its Rost
 * bars along the short side, and under it the Glut, coals glowing.
 */
export const GRILL = {
  width: 1.5,
  depth: 0.5,
  height: 0.85,
  trough: 0.2,
  leg: 0.04,
  /** How high the plate between its legs stands - half way down - and how thick it is. */
  shelf: 0.4,
  plate: 0.012,
  /** How far apart the Rost's bars are, how far under it the Glut lies - down near the trough's floor - and how far in from the trough's sides it keeps. */
  rost: 0.02,
  coals: 0.16,
  pad: 0.08,
  /** How bright the Glut's light is against a campfire's - far less - and how high over the coals it sits: down in the trough, whose sides keep it in. */
  glow: 0.12,
  lift: 0.04,
} as const;

/**
 * The bar: a table under a white cloth hanging down its sides, and behind it
 * against the wall, with room to serve between, a fridge for the bottles
 * with a glass door and a light inside, and a smaller white one beside it.
 */
export const BAR = {
  table: { width: 2, depth: 0.8, height: 0.76, drape: 0.35, leg: 0.04 },
  /** How far out of the wall the table's middle stands. */
  out: 1.8,
  bottles: { width: 0.6, depth: 0.65, height: 1.9 },
  fridge: { width: 0.55, depth: 0.6, height: 1.6 },
  /** How far the fridges stand off the wall, and apart. */
  gap: 0.05,
  /** How deep the bottles' fridge is open behind its glass, and how wide its frame. */
  recess: 0.1,
  frame: 0.04,
} as const;

/** The workshop's front wall on the plan: a point on it, along it, and out of it towards the road. */
function workshopFront(): { at: Point; along: Point; out: Point } | undefined {
  const workshop = SITTINGS().find(({ name }) => name === 'werkstatt');
  const [from, to] = [workshop?.corners[3], workshop?.corners[2]];
  if (from === undefined || to === undefined) {
    return undefined;
  }
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  const along: Point = [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
  // out of the house: the side the road is on, away from its middle
  const inside = workshop?.corners.reduce(([x, y], [cx, cy]) => [x + cx, y + cy], [0, 0]) ?? [0, 0];
  const middle: Point = [
    inside[0] / (workshop?.corners.length ?? 1),
    inside[1] / (workshop?.corners.length ?? 1),
  ];
  let out: Point = [along[1], -along[0]];
  if ((middle[0] - from[0]) * out[0] + (middle[1] - from[1]) * out[1] > 0) {
    out = [-out[0], -out[1]];
  }
  return { at: from, along, out };
}

/** A point of the plan carried square onto the workshop's front wall. */
function onWall({ at, along }: { at: Point; along: Point }, [x, y]: Point): Point {
  const t = (x - at[0]) * along[0] + (y - at[1]) * along[1];
  return [at[0] + along[0] * t, at[1] + along[1] * t];
}

/**
 * A group stood on the plan: its own +x along the workshop's front wall, +z
 * out of it, and its feet on the ground there.
 */
function standing(at: Point, out: Point): Group {
  const group = new Group();
  group.position.set(at[0], LANDFILL_GROUND()(at[0], at[1]) ?? heightAt(at[0], at[1]), -at[1]);
  group.rotation.y = Math.atan2(out[0], -out[1]);
  return group;
}

/** A box standing on the ground, its foot at a height, in a group's own frame. */
function block(
  [width, height, depth]: [number, number, number],
  [x, y, z]: [number, number, number],
  material: MeshLambertMaterial | MeshBasicMaterial
): Mesh {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y + height / 2, z);
  return mesh;
}

function grill(palette: Palette, at: Point, out: Point): Group {
  const group = standing(at, out);
  const { width, depth, height, trough, leg, shelf, plate } = GRILL;
  // brushed steel: a pale grey, lighter than the granite, cooler than the walls
  const steel = palette.granite.clone().lerp(palette.snow, 0.45).lerp(palette.sky, 0.08);
  const iron = new MeshLambertMaterial({ color: steel, flatShading: true });
  const grate = new MeshLambertMaterial({
    color: steel.clone().multiplyScalar(0.6),
    flatShading: true,
  });
  group.add(
    // the trough open at the top: its floor and four thin sides
    block([width, 0.01, depth], [0, height - trough, 0], iron),
    block([width, trough, 0.01], [0, height - trough, depth / 2 - 0.005], iron),
    block([width, trough, 0.01], [0, height - trough, -depth / 2 + 0.005], iron),
    block([0.01, trough, depth], [width / 2 - 0.005, height - trough, 0], iron),
    block([0.01, trough, depth], [-width / 2 + 0.005, height - trough, 0], iron),

    block([width - leg, plate, depth - leg], [0, shelf, 0], iron),
    ...[-1, 1].flatMap(sx =>
      [-1, 1].map(sz =>
        block(
          [leg, height - trough, leg],
          [sx * (width / 2 - leg), 0, sz * (depth / 2 - leg)],
          iron
        )
      )
    )
  );
  // the Rost: thin bars along the short side, side by side over the trough
  const bars = Math.floor((width - 0.06) / GRILL.rost);
  const rost = new InstancedMesh(new BoxGeometry(0.007, 0.007, depth - 0.03), grate, bars);
  const matrix = new Matrix4();
  Array.from({ length: bars }, (_, k) => {
    matrix.makeTranslation(-(bars - 1) * GRILL.rost * 0.5 + k * GRILL.rost, height - 0.004, 0);
    rost.setMatrixAt(k, matrix);
  });
  // and the Glut under it: a bed of coals glowing, some of them gone dark
  const glut = new Mesh(
    new BoxGeometry(width - 2 * GRILL.pad, 0.02, depth - 2 * GRILL.pad),
    new MeshBasicMaterial({ color: palette.lantern.clone().lerp(palette.autumnOrange, 0.5) })
  );
  glut.position.set(0, height - GRILL.coals, 0);
  const next = random(Math.round(at[0] * 1000 + at[1]));
  const lumps = 60;
  const coals = new InstancedMesh(
    new DodecahedronGeometry(0.022, 0),
    new MeshBasicMaterial({ color: 0xffffff }),
    lumps
  );
  const [ember, ash] = [palette.lantern.clone().lerp(palette.autumnGold, 0.2), palette.ground];
  Array.from({ length: lumps }, (_, k) => {
    matrix.makeTranslation(
      (next() - 0.5) * (width - 2 * GRILL.pad - 0.04),
      height - GRILL.coals + 0.01,
      (next() - 0.5) * (depth - 2 * GRILL.pad - 0.04)
    );
    coals.setMatrixAt(k, matrix);
    coals.setColorAt(
      k,
      next() < 0.35 ? ash : ember.clone().lerp(palette.autumnOrange, next() * 0.6)
    );
  });
  // its light, down on the coals: the trough holds it in, and only a little
  // gets out above, through the Rost
  glut.geometry.userData['glows'] = [[0, GRILL.lift, 0, GRILL.glow, 0, 0, 0, 6]];
  glut.userData['lamp'] = true;
  coals.userData['lamp'] = true;
  group.add(rost, glut, coals);
  return group;
}

function bar(palette: Palette, wall: Point, out: Point): Group {
  const group = standing(wall, out);
  const { table, bottles, fridge, gap } = BAR;
  const cloth = new MeshLambertMaterial({ color: palette.snow, flatShading: true });
  const legs = new MeshLambertMaterial({ color: palette.ground, flatShading: true });
  // the table, its cloth over the top and hanging down every side
  group.add(
    block(
      [table.width + 0.04, table.drape, table.depth + 0.04],
      [0, table.height - table.drape, BAR.out],
      cloth
    ),
    ...[-1, 1].flatMap(sx =>
      [-1, 1].map(sz =>
        block(
          [table.leg, table.height - table.drape, table.leg],
          [
            sx * (table.width / 2 - table.leg * 2),
            0,
            BAR.out + sz * (table.depth / 2 - table.leg * 2),
          ],
          legs
        )
      )
    )
  );
  // the fridge for the bottles against the wall, its glass door lit from
  // inside and rows of bottles behind it
  // its body open at the front behind the glass, the bottles standing inside
  const black = new MeshLambertMaterial({ color: palette.ground, flatShading: true });
  const bx = -(bottles.width / 2 + gap / 2);
  const { recess, frame } = BAR;
  const back = bottles.depth - recess;
  group.add(
    block([bottles.width, bottles.height, back], [bx, 0, gap + back / 2], black),
    block(
      [frame, bottles.height, recess],
      [bx - bottles.width / 2 + frame / 2, 0, gap + back + recess / 2],
      black
    ),
    block(
      [frame, bottles.height, recess],
      [bx + bottles.width / 2 - frame / 2, 0, gap + back + recess / 2],
      black
    ),
    block([bottles.width, 0.15, recess], [bx, 0, gap + back + recess / 2], black),
    block([bottles.width, 0.1, recess], [bx, bottles.height - 0.1, gap + back + recess / 2], black)
  );
  const light = new Mesh(
    new PlaneGeometry(bottles.width - 0.1, bottles.height - 0.25),
    new MeshBasicMaterial({ color: palette.snow.clone().lerp(palette.sky, 0.25) })
  );
  // the light at the back of the recess, the bottles before it inside
  const front = gap + back + 0.002;
  light.position.set(bx, (bottles.height - 0.25) / 2 + 0.15, front);
  // the light inside goes out through the glass as a window's does
  light.geometry.userData['glows'] = [
    [0, 0, 0, bottles.width - 0.1, bottles.height - 0.25, 0, 1, 0],
  ];
  group.add(light);
  const shelves = 5;
  const perShelf = 4;
  const glass = new InstancedMesh(
    new CylinderGeometry(0.03, 0.035, 0.24, 6),
    new MeshLambertMaterial({ color: palette.autumnRust }),
    shelves * perShelf
  );
  const matrix = new Matrix4();
  Array.from({ length: shelves * perShelf }, (_, k) => {
    const [row, column] = [Math.floor(k / perShelf), k % perShelf];
    matrix.makeTranslation(
      bx + (column - (perShelf - 1) / 2) * 0.12,
      0.3 + row * 0.3 + 0.12,
      front + recess / 2
    );
    glass.setMatrixAt(k, matrix);
  });
  group.add(glass);
  // and the smaller white one beside it, on the ground
  const white = new MeshLambertMaterial({ color: palette.wall, flatShading: true });
  group.add(
    block(
      [fridge.width, fridge.height, fridge.depth],
      [fridge.width / 2 + gap / 2, 0, gap + fridge.depth / 2],
      white
    )
  );
  return group;
}

/**
 * The stands before the workshop: the grill at its place, and the bar - its
 * fridges against the wall where the bar's place is along it, its table out
 * before them with room to serve between.
 */
function stands(palette: Palette): Group[] {
  const front = workshopFront();
  const [barAt, grillAt] = [
    placeOutline('bar-werkstatt')?.[0],
    placeOutline('grill-werkstatt')?.[0],
  ];
  if (front === undefined) {
    return [];
  }
  const { out } = front;
  return [
    ...(barAt === undefined
      ? []
      : [Object.assign(bar(palette, onWall(front, barAt), out), { name: 'bar-werkstatt' })]),
    ...(grillAt === undefined
      ? []
      : [Object.assign(grill(palette, grillAt, out), { name: 'grill-werkstatt' })]),
  ].map(stand => {
    stand.userData['decoration'] = stand.name;
    stand.visible = false;
    return stand;
  });
}

/**
 * The stage in the workshop's hall: a low platform of boards, filling its
 * place's outline and standing on the floor there, which is the Vereinsraum's.
 */
export const STAGE = { height: 0.4 } as const;

/** The stage, tagged: shown only where it is asked for. */
function stage(palette: Palette): Mesh[] {
  const outline = placeOutline('werkstatt-buehne');
  if (outline === undefined) {
    return [];
  }
  const geometry = new ExtrudeGeometry(new Shape(outline.map(([x, y]) => new Vector2(x, y))), {
    depth: STAGE.height,
    bevelEnabled: false,
  });
  // the plan's y is the scene's -z, and the extrusion goes up
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, PLACES['werkstatt-buehne'].level ?? 0, 0);
  const boards = new Mesh(
    geometry,
    new MeshLambertMaterial({
      color: palette.autumnRust.clone().lerp(palette.boarding, 0.4),
      flatShading: true,
    })
  );
  boards.name = 'buehne-werkstatt';
  boards.userData['decoration'] = 'buehne-werkstatt';
  boards.visible = false;
  return [boards];
}

/** How far the porch's steps and the room before them reach out of the lean-to's front wall. */
const PORCH = 2;

/** How far from the fire's middle its stones reach, in meters. */
const FIRE_REACH = CAMPFIRE.ring.radius + CAMPFIRE.ring.stone;

/** How far a point lies outside a polygon, nought inside it. */
const outsideBy = (polygon: Point[], at: Point): number =>
  within(at, polygon) ? 0 : distanceToPath([...polygon, polygon[0] as Point], at);

/** A rectangle on the plan, from a corner along a way and out of it. */
const rectangle = (
  at: Point,
  along: Point,
  out: Point,
  [u0, u1]: Point,
  [v0, v1]: Point
): Point[] =>
  [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ].map(([u, v]) => [
    at[0] + along[0] * (u as number) + out[0] * (v as number),
    at[1] + along[1] * (u as number) + out[1] * (v as number),
  ]);

/** How far nothing is put out from where a still view's eye stands: nearer, it filled the picture. */
export const EYE_CLEAR = 2.5;

/**
 * What the benches keep off, each as the distance to its edge:
 * the houses' walls, the porch before the lean-to's door, the fires, the bar
 * with the room to serve behind its table, the grill, the pavilion's posts, and
 * the ways, which are laid as they are and not as the ground is - and where a
 * still view's eye stands.
 */
export function keepout(): Keepout {
  const workshop = SITTINGS().find(({ name }) => name === 'werkstatt')?.corners ?? [];
  const front = workshopFront();
  // the steps up to the lean-to's door stand out of its front wall
  const [outerGable, outerInner] = ['house:werkstatt:0', 'house:werkstatt:1'].map(
    key => pickByKey(key)?.at
  );
  const porch =
    front === undefined || outerGable === undefined || outerInner === undefined
      ? []
      : [
          outerGable,
          outerInner,
          [outerInner[0] + front.out[0] * PORCH, outerInner[1] + front.out[1] * PORCH] as Point,
          [outerGable[0] + front.out[0] * PORCH, outerGable[1] + front.out[1] * PORCH] as Point,
        ];
  const fires = FIRES.flatMap(place => placeOutline(place)?.slice(0, 1) ?? []);
  const bar = placeOutline('bar-werkstatt')?.[0];
  const grill = placeOutline('grill-werkstatt')?.[0];
  const pavilion = PAVILION_AT();
  const posts = PAVILION.side / 2 / Math.sin(Math.PI / 8);
  const shapes: Point[][] =
    front === undefined
      ? []
      : [
          ...(bar === undefined
            ? []
            : [
                rectangle(
                  onWall(front, bar),
                  front.along,
                  front.out,
                  [-(BAR.table.width / 2 + BAR.table.leg), BAR.table.width / 2 + BAR.table.leg],
                  [0, BAR.out + BAR.table.depth / 2 + 0.05]
                ),
              ]),
          ...(grill === undefined
            ? []
            : [
                rectangle(
                  grill,
                  front.along,
                  front.out,
                  [-GRILL.width / 2, GRILL.width / 2],
                  [-GRILL.depth / 2, GRILL.depth / 2]
                ),
              ]),
        ];
  const eyes = Object.values<ViewSpec>(VIEWS)
    .filter(({ kind }) => kind === 'still')
    .map(({ eye }) => eye);
  return at =>
    Math.min(
      distanceToBuildings(at),
      ...eyes.map(eye => Math.max(Math.hypot(at[0] - eye[0], at[1] - eye[1]) - EYE_CLEAR, 0)),
      ...WAY_RUNS.map(({ points, half }) =>
        Math.max(nearestOn(points, at[0], at[1]).distance - half, 0)
      ),
      outsideBy(workshop, at),
      outsideBy(porch, at),
      ...fires.map(fire => Math.max(Math.hypot(at[0] - fire[0], at[1] - fire[1]) - FIRE_REACH, 0)),
      ...shapes.map(shape => outsideBy(shape, at)),
      pavilion === undefined
        ? Infinity
        : Math.max(
            Math.hypot(at[0] - pavilion.middle[0], at[1] - pavilion.middle[1]) -
              posts -
              PAVILION.post,
            0
          )
    );
}

/** Every decoration, each tagged: shown only where it is asked for. */
export function createDecorations(palette: Palette): Group {
  const group = createCampfires(palette);
  group.add(...stands(palette));
  group.add(...stage(palette), ...createSeating(palette, keepout()), ...createChristmas(palette));
  return group;
}

/** The campfires laid at their places, each tagged by its place: shown only where it is asked for. */
export function createCampfires(palette: Palette): Group {
  const group = new Group();
  group.name = 'decorations';
  FIRES.forEach(place => {
    const at = placeOutline(place)?.[0];
    if (at === undefined) {
      return;
    }
    const fire = campfire(palette, at);
    fire.name = place;
    fire.userData['decoration'] = place;
    fire.visible = false;
    group.add(fire);
  });
  return group;
}
