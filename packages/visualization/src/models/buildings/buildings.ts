import type { Color, Material, Object3D } from 'three';
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Path,
  Shape,
  SphereGeometry,
  Vector3,
} from 'three';

import type { BuildingData } from '../../data/data.js';
import { BUILDINGS } from '../../data/data.js';
import type { Lamp } from '../../scene/lamps.js';
import type { Palette } from '../../scene/palette.js';
import { heightAt } from '../terrain/ground.js';
import { ASIDE_HOUSE } from './aside.building.js';
import { boundingRect } from './footprint.js';
import { MILL_HOUSE } from './mill.building.js';
import type { Profile, Row } from './profile.js';
import { DEFAULT_PROFILE, leanToEnds } from './profile.js';
import { levelOf } from './sitting.js';
import { WORKSHOP_HOUSE } from './workshop.building.js';

/** The houses of the site, each with the numbers it is drawn from. */
const HOUSES = [MILL_HOUSE, ASIDE_HOUSE, WORKSHOP_HOUSE];

const PROFILES: Record<number, Profile> = Object.fromEntries(
  HOUSES.map(({ id, profile }) => [id, profile])
);

/**
 * How far things stand off the wall they are drawn on. The frame stands proud
 * of it, the glass sits back behind the frame - a window is set into a panel,
 * not laid over the timbers.
 */
const SKIN = { frame: 0.05, opening: 0.015 };

type Facade = 'long' | 'gable';

/** A point in the scene, the way the roof's faces are written out. */
type Corner = [x: number, y: number, z: number];

interface Opening {
  /** Along the facade, from its middle. */
  at: number;
  /** Height of the opening's own middle above the ground. */
  y: number;
  width: number;
  height: number;
  /** Radius the head is rounded off with, where the drawing shows an arch. */
  arch?: number;
  /** A door: never lit, whatever the hour - the light is behind the windows. */
  door?: boolean;
}

/** How many of the windows have a light on behind them after dark. */
const LIT_SHARE = 0.6;

/** A number between nought and one that stays with a place. */
const hashed = (a: number, b: number, c: number) => {
  const value = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return value - Math.floor(value);
};

/**
 * Colours every window under a root: the glass by day, and after dark a warm
 * light behind the windows whose `lit` says so - the doors and the others dark.
 */
/**
 * Whether an object is lit by a light of its own - a decoration named
 * `licht-...`, the workshop's hall, the Vereinsraum - rather than by the
 * lights: lit while that is up.
 */
export function ownLight(object: Object3D | undefined): boolean {
  for (let at: Object3D | null = object ?? null; at !== null; at = at.parent) {
    const tag = at.userData['decoration'] as string | undefined;
    if (tag?.startsWith('licht-') === true) {
      return true;
    }
  }
  return false;
}

/** How much of its day's shade unlit glass, and a dark room behind it, keeps at night. */
const NIGHT_GLASS = 0.05;

export function lightWindows(root: Object3D, palette: Palette, lights: boolean, day = 1): void {
  // glass with no light behind it reflects the sky: as dark as the night is,
  // and at night nearly black - a quarter of its day's shade still read as
  // lit from within
  const dark = palette.window.clone().multiplyScalar(NIGHT_GLASS + (1 - NIGHT_GLASS) * day);
  root.traverse(object => {
    const { geometry } = object as Mesh;
    // a room lit by a decoration of its own is lit while that is up, the
    // lights on or not - as the street lamps are switched on their own
    const on = ownLight(object) || lights;
    const bulbs = object.userData['bulbs'] as { day: Color; lit: Color } | undefined;
    if (bulbs !== undefined) {
      ((object as Mesh).material as MeshBasicMaterial).color.copy(on ? bulbs.lit : bulbs.day);
      return;
    }
    // a room seen through an opening: its own shade by day, lit after dark
    const room = geometry?.userData['room'] as { day: Color; lit: Color } | undefined;
    if (room !== undefined) {
      const shade = on
        ? room.lit
        : room.day.clone().multiplyScalar(NIGHT_GLASS + (1 - NIGHT_GLASS) * day);
      const count = geometry.getAttribute('position').count;
      geometry.setAttribute(
        'color',
        new Float32BufferAttribute(Array.from({ length: count }, () => shade.toArray()).flat(), 3)
      );
      return;
    }
    const lit = geometry?.getAttribute('lit');
    if (lit === undefined) {
      return;
    }
    const colors = Array.from({ length: lit.count }, (_, vertex) =>
      (on && lit.getX(vertex) > 0 ? palette.windowLit : dark).toArray()
    ).flat();
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  });
}

/**
 * A lit opening, in the building's own space: its middle, how wide and how
 * high it is, and the way out of its wall, level.
 */
type Glow = [
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  nx: number,
  nz: number,
  /** One for the open gate, which throws its cone, two for a bare bulb; nought for a window. */
  gate: number,
];

/**
 * Every opening with a light behind it, as the lamp it is after dark: its
 * middle in scene space, which way is out of its wall, and its size.
 */
/** Whether an object is shown, up to a root: none of it hidden on the way. */
function shownIn(object: Object3D, root: Object3D): boolean {
  for (let at: Object3D | null = object; at !== null && at !== root.parent; at = at.parent) {
    if (!at.visible) {
      return false;
    }
  }
  return true;
}

export function windowLamps(root: Object3D, hidden = false): Lamp[] {
  root.updateMatrixWorld(true);
  const lamps: Lamp[] = [];
  const point = new Vector3();
  root.traverse(object => {
    // a decoration not put up lights nothing - unless asked for all, to be
    // told which are up each time they light (`source`)
    if (!hidden && !shownIn(object, root)) {
      return;
    }
    const glowing = ((object as Mesh).geometry?.userData['glows'] as Glow[] | undefined) ?? [];
    glowing.forEach(([x, y, z, width, height, nx, nz, gate]) => {
      point.set(x, y, z).applyMatrix4(object.matrixWorld);
      // the wall's own way out, turned as the building is
      const out = new Vector3(nx, 0, nz).transformDirection(object.matrixWorld).setY(0).normalize();
      // a window's light a hand's breadth out, off the glass; the gate's at it
      if (gate === 0) {
        point.addScaledVector(out, 0.1);
      }
      lamps.push({
        at: [point.x, point.y, point.z],
        out: [out.x, out.y, out.z],
        width,
        height,
        kind:
          gate > 5.75
            ? 'fire'
            : gate > 4.75
              ? 'string'
              : gate > 3.75
                ? 'wall'
                : gate > 2.75
                  ? 'street'
                  : gate > 1.5
                    ? 'bulb'
                    : gate > 0.5
                      ? 'gate'
                      : 'window',
        // a street lamp marked so casts shadows, as a bulb does
        ...(gate > 3.25 && gate < 3.75 ? { shadow: true } : {}),
        source: object,
      });
    });
  });
  return lamps;
}

/**
 * A lantern beside a door: how far off the door's side, how high its bulb
 * hangs, how far out of the wall, and how big its bulb and the dark round
 * head over it are.
 */
const LANTERN = { beside: 0.35, high: 1.95, out: 0.2, bulb: 0.08, head: 0.11 } as const;

/**
 * The lanterns on the wall beside the doors a profile names, one a door, on
 * the side it says: a round bulb under a dark round head with a rim, on a
 * short arm out of the wall - the bulb dull by day and lit after dark, shining out of it.
 */
function createDoorLanterns(
  length: number,
  width: number,
  profile: Profile,
  palette: Palette
): Mesh[] {
  const lanterns = profile.doorLanterns;
  if (lanterns === undefined) {
    return [];
  }
  const rows = lanterns.facade === 'front' ? profile.front : profile.rear;
  const side = lanterns.facade === 'front' ? 1 : -1;
  const dark = new MeshLambertMaterial({ color: palette.trunk, flatShading: true });
  return spread(rows.slice(0, 1), length)
    .filter(({ door }) => door === true)
    .flatMap(({ at, width: doorWidth }) => {
      const x = at + lanterns.side * (doorWidth / 2 + LANTERN.beside);
      const z = side * (width / 2 + LANTERN.out);
      const arm = new Mesh(new CylinderGeometry(0.015, 0.015, LANTERN.out, 4), dark);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(x, LANTERN.high + LANTERN.bulb + 0.04, side * (width / 2 + LANTERN.out / 2));
      const head = new Mesh(
        new SphereGeometry(LANTERN.head, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
        dark
      );
      head.position.set(x, LANTERN.high + LANTERN.bulb * 0.4, z);
      // the rim round the head's foot, which throws the light down
      const rim = new Mesh(
        new CylinderGeometry(LANTERN.head + 0.035, LANTERN.head + 0.035, 0.015, 12),
        dark
      );
      rim.position.set(x, LANTERN.high + LANTERN.bulb * 0.4, z);
      const geometry = new SphereGeometry(LANTERN.bulb, 10, 6);
      geometry.userData['room'] = {
        day: palette.window.clone(),
        // a lamp seen bare, brighter than a window lit from within
        lit: palette.windowLit.clone().lerp(palette.snow, 0.65),
      };
      geometry.userData['glows'] = [[x, LANTERN.high, z + side * 0.05, 0, 0, 0, side, 4]];
      geometry.translate(x, LANTERN.high, z);
      const bulb = new Mesh(
        geometry,
        new MeshBasicMaterial({ color: 0xffffff, vertexColors: true })
      );
      [arm, head, rim, bulb].forEach(part => (part.userData['lamp'] = true));
      return [arm, head, rim, bulb];
    });
}

/**
 * Openings or a room lit by a decoration: the one lit, shown while it is put
 * up, and beside it the same dark - its glass unlit, its room at night as
 * dark as the night - shown while it is not, and lighting nothing. Without a
 * decoration it is lit as it always was.
 */
function litOrDark(
  geometry: BufferGeometry,
  light: string | undefined,
  material: Material
): Mesh[] {
  const lit = new Mesh(geometry, material);
  if (light === undefined) {
    return [lit];
  }
  const dark = geometry.clone();
  dark.userData = { ...geometry.userData, glows: [] };
  const lamps = dark.getAttribute('lit');
  if (lamps !== undefined) {
    dark.setAttribute('lit', new Float32BufferAttribute(new Float32Array(lamps.count), 1));
  }
  const room = geometry.userData['room'] as { day: Color; lit: Color } | undefined;
  if (room !== undefined) {
    dark.userData['room'] = {
      day: room.day,
      lit: room.day.clone().multiplyScalar(NIGHT_GLASS),
    };
  }
  lit.userData['decoration'] = light;
  lit.visible = false;
  const unlit = new Mesh(dark, material);
  unlit.userData['decorationOff'] = light;
  return [lit, unlit];
}

/** A room seen through an open gate or door: dim by day, lit after dark. */
const ROOM_SHADES = (palette: Palette) => ({
  day: palette.wallAccent.clone().multiplyScalar(0.07),
  lit: palette.windowLit.clone().multiplyScalar(0.75),
});

/** How thick the wall round an open gate is, in meters. */
const GATE_WALL = 0.5;

/** How thick the partition is that parts the hall from the stage and the rooms behind the lean-to. */
const PARTITION = 0.2;

/**
 * The stretch of the house the hall fills, along it: between the walls, and
 * where the house has a lean-to, up to the partition that stands across at
 * its inner end - beyond it are the stage and the Vereinsraum.
 */
function hallSpan(length: number, leanTo: Profile['leanTo']): [from: number, to: number] {
  const [from, to] = [-length / 2 + GATE_WALL, length / 2 - GATE_WALL];
  if (leanTo === undefined) {
    return [from, to];
  }
  const { flush, inner } = leanToEnds(length, leanTo);
  return flush < 0
    ? [Math.max(from, inner + PARTITION / 2), to]
    : [from, Math.min(to, inner - PARTITION / 2)];
}

/** The gate the room is seen through: the front row's door, measured like the openings. */
function gateOf(profile: Profile, length: number): Opening | undefined {
  return spread(profile.front, length).find(opening => opening.door === true);
}

/** A box without its +z face - the front, which is drawn with its gate cut through. */
function withoutFront(box: BoxGeometry): BufferGeometry {
  const index = box.getIndex();
  const front = box.groups[4];
  if (index === null || front === undefined) {
    return box;
  }
  const kept = Array.from(index.array).filter(
    (_, at) => at < front.start || at >= front.start + front.count
  );
  box.setIndex(kept);
  box.clearGroups();
  return box;
}

/**
 * The front wall with the gate cut through it, as thick as a wall is, and the
 * room behind: its floor the decks' concrete, its walls and ceiling a shade of
 * their own - dim by day, and after dark lit, the light going out through the
 * gate (`glows`, which a lamp is made of) onto the yard.
 */
function createGateRoom(
  length: number,
  width: number,
  profile: Profile,
  gate: Opening,
  wall: MeshLambertMaterial,
  palette: Palette
): Mesh[] {
  const { eaves } = profile;
  const face = new Shape()
    .moveTo(-length / 2, -SUNK)
    .lineTo(length / 2, -SUNK)
    .lineTo(length / 2, eaves)
    .lineTo(-length / 2, eaves)
    .lineTo(-length / 2, -SUNK);
  const hole = new Path();
  outline(gate.width, gate.height, gate.arch ?? 0)
    .map(([along, up]): [number, number] => [gate.at + along, gate.y + up])
    .forEach(([x, y], index) => (index === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y)));
  face.holes.push(hole);
  const front = new Mesh(
    new ExtrudeGeometry(face, { depth: GATE_WALL, bevelEnabled: false }),
    wall
  );
  front.position.z = width / 2 - GATE_WALL;

  // the room: a box drawn from inside, its faces wound inwards
  const [start, end] = hallSpan(length, profile.leanTo);
  const [inLength, inWidth] = [end - start, width - GATE_WALL * 2];
  const box = new BoxGeometry(inLength, eaves, inWidth).toNonIndexed();
  const corners = box.getAttribute('position');
  const flipped = Array.from({ length: corners.count / 3 }, (_, triangle) =>
    [0, 2, 1].flatMap(k => [
      corners.getX(triangle * 3 + k) + (start + end) / 2,
      corners.getY(triangle * 3 + k) + eaves / 2,
      corners.getZ(triangle * 3 + k),
    ])
  ).flat();
  const room = new BufferGeometry();
  room.setAttribute('position', new Float32BufferAttribute(flipped, 3));
  room.computeVertexNormals();
  room.userData['room'] = ROOM_SHADES(palette);
  // the light it throws out through the gate, from the gate's middle
  // from a lamp deep in the room, so the gate's shape falls far out
  room.userData['glows'] = [[gate.at, gate.y, width / 2, gate.width, gate.height, 0, 1, 1]];
  const [x0, x1, z0, z1] = [start, end, -inWidth / 2, width / 2 - 0.01];
  const floor = new BufferGeometry();
  floor.setAttribute(
    'position',
    new Float32BufferAttribute(
      [x0, 0.01, z1, x1, 0.01, z1, x1, 0.01, z0, x0, 0.01, z1, x1, 0.01, z0, x0, 0.01, z0],
      3
    )
  );
  floor.computeVertexNormals();
  floor.userData['room'] = {
    day: palette.wallAccent.clone().multiplyScalar(0.14),
    lit: palette.wallAccent.clone().lerp(palette.windowLit, 0.5),
  };
  const shaded = new MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  return [
    front,
    ...litOrDark(room, profile.light, shaded),
    ...litOrDark(floor, profile.light, shaded),
  ];
}

/** How many segments one rounded shoulder of an opening is drawn with. */
const ARCH_SEGMENTS = 4;

/**
 * The outline of an opening, measured from its own middle and run round it
 * counter clockwise: a rectangle, or one with its head rounded off - the gate
 * of the workshop is arched and a square hole would not read as a gate.
 */
function outline(width: number, height: number, arch: number): [along: number, up: number][] {
  const [w, h] = [width / 2, height / 2];
  if (arch <= 0) {
    return [
      [-w, -h],
      [w, -h],
      [w, h],
      [-w, h],
    ];
  }

  const radius = Math.min(arch, w, height);
  const shoulder = (end: 1 | -1) =>
    Array.from({ length: ARCH_SEGMENTS + 1 }, (_, step): [number, number] => {
      const angle = (Math.PI / 2) * (step / ARCH_SEGMENTS);
      return [end * (w - radius + radius * Math.cos(angle)), h - radius + radius * Math.sin(angle)];
    });

  // up one jamb, round its shoulder, across the head and down the other side
  return [[-w, -h], [w, -h], ...shoulder(1), ...shoulder(-1).reverse()];
}

/**
 * Lays flat quads onto one side of the house. Each facade carries what the
 * drawing of that facade shows - the street side is not the rear side, and the
 * survey counted both.
 */
function createOpenings(
  openings: Opening[],
  facade: Facade,
  reach: number,
  side: 1 | -1,
  all = false
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const lit: number[] = [];
  const glows: Glow[] = [];

  openings.forEach(({ at, y, width: w, height, arch = 0, door = false }) => {
    const offset = positions.length / 3;
    const skin = side * (reach + SKIN.opening);
    const corners = outline(w, height, arch);

    // whether a light is on behind it after dark, the same for as long as it is there
    const on = all || (!door && hashed(at, y, skin) < LIT_SHARE) ? 1 : 0;
    if (on > 0) {
      const [x, z] = facade === 'long' ? [at, skin] : [skin, at * -side];
      const [nx, nz] = facade === 'long' ? [0, side] : [side, 0];
      glows.push([x, y, z, w, height, nx, nz, 0]);
    }
    corners.forEach(([along, up]) => {
      // on a long facade the opening runs along x, on a gable along z
      const [x, z] = facade === 'long' ? [at + along, skin] : [skin, at * -side + along];
      positions.push(x, y + up, z);
      lit.push(on);
    });
    // a fan from the first corner, which any of these outlines takes
    Array.from({ length: corners.length - 2 }, (_, step) =>
      indices.push(offset, offset + step + 1, offset + step + 2)
    );
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('lit', new Float32BufferAttribute(lit, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData['glows'] = glows;
  return geometry;
}

/**
 * Puts a row where the drawing puts it. The survey measures along a facade from
 * its right hand end as the street sees it, the model from the middle.
 */
function spread(rows: Row[], span: number): Opening[] {
  const place = (from: number) => span / 2 - from;
  return rows.flatMap(({ windows, size, y, doors = [], door = [1, 2], arch = 0, sill = 0 }) => [
    ...windows.map((from): Opening => ({
      at: place(from),
      y,
      width: size[0],
      height: size[1],
    })),
    ...doors.map((from): Opening => ({
      at: place(from),
      y: sill + door[1] / 2,
      width: door[0],
      height: door[1],
      arch,
      door: true,
    })),
  ]);
}

/**
 * The gable wall, a triangle above the box. It belongs to the wall and not to
 * the roof: on the house it is plastered and framed like every other wall, and
 * only the two slopes above it are tiled.
 */
function createGables(length: number, width: number, ridge: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  [1, -1].forEach(side => {
    const offset = positions.length / 3;
    const x = (side * length) / 2;
    positions.push(x, 0, -width / 2, x, 0, width / 2, x, ridge, 0);
    indices.push(offset, offset + 1, offset + 2);
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The two slopes, carried past the walls on every side. The ridge stays at its
 * height - what hangs over is the plane of the roof, so the eaves end up below
 * the top of the wall, exactly as far as the pitch takes them. Each slope is a
 * slab and not a plane: the tiling has a thickness, and it shows wherever the
 * roof ends in the air, at the eaves and over the gables.
 */
function createRoof(
  length: number,
  width: number,
  ridge: number,
  overhang = ROOF_OVERHANG
): BufferGeometry {
  const [halfLength, halfWidth] = [length / 2 + overhang, width / 2 + overhang];
  const drop = (ridge / (width / 2)) * overhang;
  const positions: number[] = [];
  const indices: number[] = [];

  /** A face of the slab, its corners given the way an outside eye sees them. */
  const quad = (corners: Corner[], flip: boolean) => {
    const offset = positions.length / 3;
    (flip ? [...corners].reverse() : corners).forEach(([x, y, z]) => positions.push(x, y, z));
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  };

  [1, -1].forEach(side => {
    // the underside lies a tile's thickness below the slope, measured square to
    // it - dropping it straight down would leave the eaves too thin
    const reach = Math.hypot(halfWidth, ridge + drop);
    const [sinkY, sinkZ] = [
      (-ROOF_THICKNESS * halfWidth) / reach,
      (-side * ROOF_THICKNESS * (ridge + drop)) / reach,
    ];
    const top: Corner[] = [
      [-halfLength, -drop, side * halfWidth],
      [halfLength, -drop, side * halfWidth],
      [halfLength, ridge, 0],
      [-halfLength, ridge, 0],
    ];
    const [t1, t2, t3, t4] = top as [Corner, Corner, Corner, Corner];
    const [b1, b2, b3, b4] = top.map(([x, y, z]): Corner => [x, y + sinkY, z + sinkZ]) as [
      Corner,
      Corner,
      Corner,
      Corner,
    ];
    const flip = side < 0;

    quad([t1, t2, t3, t4], flip);
    quad([b4, b3, b2, b1], flip);
    // the eaves, the ridge and the two ends, where the slab is cut off
    quad([t1, b1, b2, t2], flip);
    quad([t4, t3, b3, b4], flip);
    quad([t1, t4, b4, b1], flip);
    quad([t2, b2, b3, t3], flip);
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** How far a roof is carried past the walls on every side. */
const ROOF_OVERHANG = 0.25;

/** How thick the tiling reads where a roof ends in the air. */
const ROOF_THICKNESS = 0.12;

/**
 * How far every wall runs below the floor it stands on. The ground is levelled
 * around a building but never flat, and a wall that stopped at the floor would
 * show a gap on the downhill side.
 */
const SUNK = 1.2;

/**
 * The shed dormer: a wooden band standing out of the roof with its own windows,
 * on both slopes, capped by a shallow roof that runs back into the slope.
 */
function createDormer(
  length: number,
  width: number,
  profile: Profile
): { boards: Mesh[]; roofs: Mesh[] } {
  const { eaves, ridge } = profile;
  // the band reaches as far as the windows in it do, and a little further
  const span = dormerSpan(length, profile);
  const height = 1.4;
  const depth = 0.5;
  const front = dormerFace(width);
  const base = eaves + ridge * (1 - front / (width / 2));
  const slope = ridge / (width / 2);
  // the boarding's outer top corner is what the cap rests on, and the line from
  // there into the main roof - which it meets high up, not halfway - is the one
  // the cap and the cheeks both follow. Its pitch falls out of that line, a
  // little flatter than the roof it dies into
  const face = front + depth / 2;
  const top = base + height;
  const meet = (width / 2) * (1 - DORMER_DIES_AT);
  const pitch = Math.atan2(eaves + ridge * DORMER_DIES_AT - top, face - meet);
  const rake = Math.tan(pitch);
  // and it hangs over the boarding, the way the main roof hangs over the walls
  const eave = 0.25;

  const boards: Mesh[] = [];
  const roofs: Mesh[] = [];

  // the roof falls away under the half meter deep boarding, so its underside is
  // carried down past the slope at the face - cut level with the band's middle
  // it would hang in the air there, which is what the ends give away
  const sink = (depth / 2) * slope + 0.05;

  // both slopes carry one, the same band mirrored across the ridge
  ([1, -1] as const).forEach(side => {
    const band = new Mesh(new BoxGeometry(span, height + sink, depth));
    band.position.set(0, base + (height - sink) / 2, side * front);
    boards.push(band);

    // the cheek that closes each end: the triangle between band, cap and roof,
    // drawn down the middle of the band, where its top edge is a touch higher
    // than the boarding's face corner - the cap has been climbing since then
    ([-1, 1] as const).forEach(end => {
      const positions = [
        0,
        0,
        0,
        0,
        height + (depth / 2) * rake,
        0,
        0,
        height + (face - meet) * rake,
        -(front - meet),
      ];
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setIndex([0, 1, 2]);
      geometry.computeVertexNormals();
      const cheek = new Mesh(geometry);
      cheek.position.set((end * span) / 2, base, side * front);
      cheek.scale.z = side;
      boards.push(cheek);
    });

    // the cap is laid on that line by its top face: an eave in front of the
    // boarding, and on past the roof it meets - being flatter it goes under the
    // slope there and dies into it rather than standing on it
    const thickness = 0.07;
    const [cos, sin] = [Math.cos(pitch), Math.sin(pitch)];
    const climb = (face - meet) / cos;
    const reach = climb + eave + 0.4;
    const shift = (climb + 0.4 - eave) / 2;
    const cap = new Mesh(new BoxGeometry(span + DORMER_EAVE * 2, thickness, reach));
    cap.position.set(
      0,
      top + shift * sin - (thickness / 2) * cos,
      side * (face - shift * cos - (thickness / 2) * sin)
    );
    cap.rotation.x = side * pitch;
    roofs.push(cap);
  });

  return { boards, roofs };
}

/**
 * Where the dormer's face stands, measured from the middle of the house. The
 * elevation puts it just above the eaves, not halfway up the roof.
 */
const dormerFace = (width: number) => width * 0.46;

/** How far the band runs, as the share of the roof the profile gives it. */
const dormerSpan = (length: number, profile: Profile) => length * (profile.dormer?.share ?? 0.7);

/** How far a chimney's head stands out of the roof it comes through. */
const CHIMNEY_PROUD = 1.5;

/** How far up the main roof the dormer's cap dies into it, from eaves to ridge. */
const DORMER_DIES_AT = 0.8;

/** What the cap stands out at the ends of the band: half the main roof's. */
const DORMER_EAVE = 0.125;

/** How far a doorstep runs down into the ground below the floor. */
const DOORSTEP_DOWN = 0.5;

/** How thick the members of a knee wall are, square to the wall and along it. */
const KNEE_BEAM = 0.12;

/**
 * The knee wall's frame, laid a frame's skin proud of its wall: sill, rail and
 * plate from the first post to the last, the posts standing between sill and
 * plate, and in each end panel a brace from under the plate at the end post
 * down onto the rail at the next one, cut level at both ends.
 */
function createKneeWall(length: number, width: number, profile: Profile): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const knee = profile.kneeWall;
  if (knee === undefined) {
    return new BufferGeometry();
  }

  const side = knee.facade === 'front' ? 1 : -1;
  const z = side * (width / 2 + SKIN.frame);
  const half = KNEE_BEAM / 2;
  const shape = (corners: [along: number, up: number][]) => {
    const offset = positions.length / 3;
    corners.forEach(([along, up]) => positions.push(along, up, z));
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  };
  const box = (from: number, to: number, bottom: number, top: number) =>
    shape([
      [from, bottom],
      [to, bottom],
      [to, top],
      [from, top],
    ]);

  const posts = knee.posts.map(from => length / 2 - from).sort((a, b) => a - b);
  const [first, last] = [posts[0] as number, posts[posts.length - 1] as number];
  [knee.sill, knee.rail, knee.plate].forEach(at =>
    box(first - half, last + half, at - half, at + half)
  );
  posts.forEach(at => box(at - half, at + half, knee.sill + half, knee.plate - half));

  // a level cut through a leaning member is wider than it is thick, by its
  // length over its rise; the brace's edges then meet the posts' faces
  const [top, foot] = [knee.plate - half, knee.rail + half];
  (
    [
      [first, posts[1] as number],
      [last, posts[posts.length - 2] as number],
    ] as const
  ).forEach(([end, next]) => {
    const toward = Math.sign(next - end);
    const [from, to] = [end + toward * half, next - toward * half];
    const cut = (KNEE_BEAM * Math.hypot(to - from, top - foot)) / (2 * (top - foot));
    const [head, heel] = [from + toward * cut, to - toward * cut];
    shape([
      [heel - cut, foot],
      [heel + cut, foot],
      [head + cut, top],
      [head - cut, top],
    ]);
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The roof windows, flat quads lying a frame's skin above the top of the tiles
 * so they stand proud of the slope the way their frames do.
 */
function createSkylights(length: number, width: number, profile: Profile): BufferGeometry {
  const { eaves, ridge, skylights } = profile;
  const positions: number[] = [];
  const indices: number[] = [];
  const lit: number[] = [];
  const glows: Glow[] = [];
  if (skylights === undefined) {
    return new BufferGeometry();
  }

  // the slope as createRoof lays it: from the edge of the overhang, below the
  // eaves by what the pitch drops over it, up to the ridge
  const halfWidth = width / 2 + ROOF_OVERHANG;
  const drop = (ridge / (width / 2)) * ROOF_OVERHANG;
  const reach = Math.hypot(halfWidth, ridge + drop);
  const [run, rise] = [halfWidth / reach, (ridge + drop) / reach];
  const [across, along] = skylights.size;

  (
    [
      [skylights.front ?? [], 1],
      [skylights.rear ?? [], -1],
    ] as const
  ).forEach(([windows, side]) =>
    windows.forEach(from => {
      const offset = positions.length / 3;
      const x = length / 2 - from;
      const on = hashed(x, side, eaves) < LIT_SHARE ? 1 : 0;
      lit.push(on, on, on, on);
      // a roof window lights the sky, not the ground: it throws no light out
      (
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ] as const
      ).forEach(([sx, sy]) => {
        const up = skylights.up + (sy * along) / 2;
        positions.push(
          x + (sx * across) / 2,
          eaves - drop + up * rise + run * SKIN.frame,
          side * (halfWidth - up * run + rise * SKIN.frame)
        );
      });
      indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    })
  );

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('lit', new Float32BufferAttribute(lit, 1));
  geometry.userData['glows'] = glows;
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Windows of the dormer band, on the face of it rather than on the wall. */
function dormerOpenings(length: number, width: number, profile: Profile): Opening[] {
  const { eaves, ridge, dormer } = profile;
  if (dormer === undefined) {
    return [];
  }
  const base = eaves + ridge * (1 - dormerFace(width) / (width / 2));
  const [windowWidth, windowHeight] = dormer.size;
  const span = dormerSpan(length, profile);
  const step = (span - 1) / dormer.windows;

  // evenly along the band, which is itself centred on the roof
  return Array.from({ length: dormer.windows }, (_, index) => ({
    at: -span / 2 + 0.5 + step / 2 + index * step,
    y: base + 0.75,
    width: windowWidth,
    height: windowHeight,
  }));
}

/** What the cross gable's own roof stands out at its face and its verges. */
const CROSS_GABLE_EAVE = 0.12;

/**
 * The walk-in dormer: a gabled roof set across the main one, standing on a box
 * that comes through the rear slope. Both ridges run at the same height, so the
 * two roofs meet in a valley rather than one dying into the other - and the
 * narrower the dormer is drawn, the steeper it has to stand to get there.
 */
function createCrossGable(
  length: number,
  width: number,
  profile: Profile
): { walls: Mesh[]; roofs: Mesh[]; glazing: Mesh[] } {
  const { eaves, ridge, crossGable } = profile;
  if (crossGable === undefined) {
    return { walls: [], roofs: [], glazing: [] };
  }

  const { at, width: span, rise } = crossGable;
  const x = length / 2 - at;
  const eavesY = eaves + rise;
  // its ridge is the house's ridge, which leaves the pitch to the span: a
  // narrow gable carried that high stands far steeper than the roof around it
  const crest = ridge - rise;
  // it runs from the ridge out to the eaves line and stops there - carried any
  // further it would come back out of the slope on the other side
  const face = width / 2;

  // the box, carried well down into the roof so no edge of it shows on the slope
  const height = rise + 1.6;
  const box = new Mesh(new BoxGeometry(span, height, face));
  box.position.set(x, eavesY - height / 2, -face / 2);

  // its gable, the triangle the small roof sits on at the face
  const positions = [-span / 2, 0, 0, span / 2, 0, 0, 0, crest, 0];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  const gable = new Mesh(geometry);
  gable.position.set(x, eavesY, -face);

  // the roof, built the way the main one is and turned across it. It hangs over
  // the face and stops dead on the ridge, where its own ridge runs into the
  // house's and the two slopes fall away into a valley either side
  const roof = new Mesh(createRoof(face - CROSS_GABLE_EAVE, span, crest, CROSS_GABLE_EAVE));
  roof.rotation.y = Math.PI / 2;
  roof.position.set(x, eavesY, -(face + CROSS_GABLE_EAVE) / 2);

  return { walls: [box, gable], roofs: [roof], glazing: [] };
}

/** How steeply a lean-to falls away from the wall it hangs on. */
const LEAN_TO_PITCH = 0.3;

/** What its roof stands out past the walls, at the front and at the ends. */
const LEAN_TO_EAVE = 0.25;

/**
 * How far it is carried back up under the main roof from the kink. The flatter
 * slab climbs slower than the one it is buried in, so any length hides.
 */
const LEAN_TO_UNDER = 0.35;

/**
 * The lean-to: a piece of building stepping out of the front wall under a
 * single slope, kinked off the main roof just under its eaves. The walls stop
 * at the low outer edge and a wedge closes each end, so the roof lies on the
 * box rather than cutting through it, and carries on past it over the porch.
 */
function createLeanTo(
  length: number,
  width: number,
  profile: Profile,
  palette: Palette
): { walls: Mesh[]; roofs: Mesh[]; glazing: Mesh[] } {
  const { leanTo } = profile;
  if (leanTo === undefined) {
    return { walls: [], roofs: [], glazing: [] };
  }

  const { eaves, ridge } = profile;
  const { at, width: span, depth, door, window, porch } = leanTo;
  const x = length / 2 - at;
  const inner = width / 2;
  // the slope carries on past the walls over the porch, if there is one
  const reach = porch?.reach ?? 0;

  // it takes the main roof over where that one ends: the two share the edge and
  // the lean-to simply carries it on at a pitch of its own
  const kink = inner + ROOF_OVERHANG;
  const top = eaves - (ridge / (width / 2)) * ROOF_OVERHANG;
  const outer = top - (depth - ROOF_OVERHANG) * LEAN_TO_PITCH;

  const height = outer + SUNK;
  const box = new Mesh(new BoxGeometry(span, height, depth));
  box.position.set(x, outer - height / 2, inner + depth / 2);

  // the wedge over the walls at either end, between the low edge and the kink
  const walls: Mesh[] = [box];
  ([-1, 1] as const).forEach(end => {
    const positions = [0, 0, 0, 0, top - outer, 0, 0, 0, inner + depth - kink];
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setIndex([0, 1, 2]);
    geometry.computeVertexNormals();
    const wedge = new Mesh(geometry);
    wedge.position.set(x + (end * span) / 2, outer, kink);
    walls.push(wedge);
  });

  if (porch !== undefined) {
    const { rise, steps, width: stand } = porch;
    // the steps are cut into the porch rather than standing out of it: the
    // landing keeps the door its full width and the flight takes the rest,
    // turning the corner on its way down to the yard
    const tread = 0.3;
    const cut = (steps - 1) * tread;
    const [near, far] = [inner + depth, inner + depth + reach];
    const [left, right] = [x - stand / 2, x + stand / 2];

    const landing = new Mesh(new BoxGeometry(stand, rise, reach - cut));
    landing.position.set(x, rise / 2, near + (reach - cut) / 2);
    walls.push(landing);

    // every step below it lies one tread further out, along the front and round
    // the corner, and the lowest of them is the outermost
    Array.from({ length: steps - 1 }, (_, index) => {
      const step = index + 1;
      const height = (rise * step) / steps;
      const edge = far - (step - 1) * tread;
      const side = right + cut - (step - 1) * tread;
      const front = new Mesh(new BoxGeometry(side - left, height, tread));
      front.position.set((left + side) / 2, height / 2, edge - tread / 2);
      const turn = new Mesh(new BoxGeometry(tread, height, edge - tread - near));
      turn.position.set(side - tread / 2, height / 2, (near + edge - tread) / 2);
      walls.push(front, turn);
    });
  }

  // the slab, laid by its top face on the line from that edge out to the far
  // one, and hanging over the far one the way the main roof hangs over its wall.
  // It is carried a good way back up under the main roof as well: the two slabs
  // are cut square to their own pitches, so butted together they would leave a
  // wedge open between them, and the only way to close it is to hide that end
  const pitch = Math.atan(LEAN_TO_PITCH);
  const [cos, sin] = [Math.cos(pitch), Math.sin(pitch)];
  const far = inner + depth + reach - kink;
  const thickness = 0.07;
  const shift = (LEAN_TO_EAVE - LEAN_TO_UNDER) / 2;
  const slab = new Mesh(
    new BoxGeometry(span + LEAN_TO_EAVE * 2, thickness, far / cos + LEAN_TO_EAVE + LEAN_TO_UNDER)
  );
  slab.position.set(
    x,
    top - (far * LEAN_TO_PITCH) / 2 - shift * sin - (thickness / 2) * cos,
    kink + far / 2 + shift * cos + (thickness / 2) * sin
  );
  slab.rotation.x = pitch;

  // the door of the extension, centred on it and standing on the porch rather
  // than on the yard, which is what the steps are there for
  const glazing: Mesh[] = [];
  if (door !== undefined) {
    const [doorWidth, doorHeight] = door;
    const stands = porch?.rise ?? 0;
    const opening = {
      at: x,
      y: stands + doorHeight / 2,
      width: doorWidth,
      height: doorHeight,
      door: true,
    };
    // shut, but for an evening in the Vereinsraum: then it stands open, the
    // room behind lit and its light going out onto the yard, as the gate's
    const shut = new Mesh(createOpenings([opening], 'long', inner + depth, 1));
    shut.userData['decorationOff'] = 'licht-vereinsraum';
    const into = createOpenings([opening], 'long', inner + depth, 1);
    into.deleteAttribute('lit');
    into.userData['room'] = ROOM_SHADES(palette);
    into.userData['glows'] = [[x, opening.y, inner + depth, doorWidth, doorHeight, 0, 1, 1]];
    const open = new Mesh(into, new MeshBasicMaterial({ color: 0xffffff, vertexColors: true }));
    open.userData['decoration'] = 'licht-vereinsraum';
    open.userData['ownMaterial'] = true;
    open.visible = false;
    glazing.push(shut, open);
  }

  if (window !== undefined) {
    const [windowWidth, windowHeight] = window.size;
    // the end wall that looks over the yard, halfway along its depth. The helper
    // measures a gable out from the middle of the house, so that wall's own
    // place stands in for the reach and the opening runs the other way along it
    // its height over the floor, which stands on the porch as the door does
    const opening = {
      at: -(inner + depth / 2),
      y: (porch?.rise ?? 0) + window.y,
      width: windowWidth,
      height: windowHeight,
    };
    // dark, but for an evening in the Vereinsraum: then lit, and its light out
    const dark = createOpenings([opening], 'gable', x + span / 2, 1);
    dark.setAttribute(
      'lit',
      new Float32BufferAttribute(new Float32Array(dark.getAttribute('position').count), 1)
    );
    dark.userData['glows'] = [];
    const shut = new Mesh(dark);
    shut.userData['decorationOff'] = 'licht-vereinsraum';
    const lit = new Mesh(createOpenings([opening], 'gable', x + span / 2, 1, true));
    lit.userData['decoration'] = 'licht-vereinsraum';
    lit.visible = false;
    glazing.push(shut, lit);
  }

  return { walls, roofs: [slab], glazing };
}

/**
 * The frame of the half timbered upper storey and of the gable, as the survey
 * elevations draw it: a sill, a rail at mid height and a plate, posts at every
 * bay, and in the gable those posts carried up to the rafters with two rails
 * across them. A grid, not the braced frame I first guessed at - the drawings
 * have braces only where a corner needs one.
 */
function createTimbering(length: number, width: number, profile: Profile): BufferGeometry {
  const { eaves, storey, ridge } = profile;
  const beam = 0.14;
  const positions: number[] = [];
  const indices: number[] = [];

  /** A beam in the plane of a facade: `along` and `up` are its middle there. */
  const timber = (
    facade: Facade,
    side: 1 | -1,
    along: number,
    up: number,
    spanning: number,
    rising: number,
    tilt = 0
  ) => {
    const offset = positions.length / 3;
    const [cos, sin] = [Math.cos(tilt), Math.sin(tilt)];
    const depth = facade === 'long' ? width / 2 + SKIN.frame : length / 2 + SKIN.frame;

    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].forEach(([sx, sy]) => {
      const [dx, dy] = [((sx as number) * spanning) / 2, ((sy as number) * rising) / 2];
      const [px, py] = [dx * cos - dy * sin, dx * sin + dy * cos];
      // the two long walls face opposite ways but share their ends: only the
      // gables are mirrored, which is what makes their left their own
      const [x, z] =
        facade === 'long' ? [along + px, side * depth] : [side * depth, (along + px) * -side];
      positions.push(x, up + py, z);
    });
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  };

  /**
   * A post that lands on a corner of the house, grown by the skin its frame
   * stands proud of the wall: it then reaches the plane of the other face's
   * frame, and the two read as the single post the corner really carries.
   */
  const standing = (at: number, edge: number): [along: number, thick: number] => {
    const thick = beam + SKIN.frame;
    if (at + beam / 2 >= edge) {
      return [edge + SKIN.frame - thick / 2, thick];
    }
    if (at - beam / 2 <= -edge) {
      return [thick / 2 - edge - SKIN.frame, thick];
    }
    return [at, beam];
  };

  /** Four corners in the plane of a facade, for a member that is not a box. */
  const shape = (facade: Facade, side: 1 | -1, corners: [number, number][]) => {
    const offset = positions.length / 3;
    const depth = facade === 'long' ? width / 2 + SKIN.frame : length / 2 + SKIN.frame;
    corners.forEach(([along, up]) => {
      const [x, z] = facade === 'long' ? [along, side * depth] : [side * depth, along * -side];
      positions.push(x, up, z);
    });
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  };

  /**
   * A brace between two points, cut level at both ends so it lands on the beam
   * below and under the beam above - the beams carry it, the posts only stand
   * beside it. Drawn as a parallelogram: a rotated rectangle would meet them
   * corner first and stand out past them.
   */
  const strut = (
    facade: Facade,
    side: 1 | -1,
    [fromAlong, fromUp]: [number, number],
    [toAlong, toUp]: [number, number],
    thickness: number
  ) => {
    const offset = positions.length / 3;
    const depth = facade === 'long' ? width / 2 + SKIN.frame : length / 2 + SKIN.frame;
    // a level cut through a leaning member is wider than the member is thick,
    // in the ratio of its length to its rise - measuring that against the run
    // instead makes a steep brace come out twice as fat as it is
    const run = Math.hypot(toAlong - fromAlong, toUp - fromUp);
    const half = (thickness * run) / (2 * Math.max(Math.abs(toUp - fromUp), 0.01));

    (
      [
        [fromAlong - half, fromUp],
        [fromAlong + half, fromUp],
        [toAlong + half, toUp],
        [toAlong - half, toUp],
      ] as [number, number][]
    ).forEach(([along, up]) => {
      const [x, z] = facade === 'long' ? [along, side * depth] : [side * depth, along * -side];
      positions.push(x, up, z);
    });
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  };

  // the gable's lines come first: the long walls run on them, so they are read
  // off the gable's row once and used by both
  const gableRow = profile.gable.find(({ y }) => y > storey && y < eaves);
  const gableSize = gableRow?.size ?? [0.7, 0.95];
  const throughBeam = (gableRow?.y ?? 4.05) - gableSize[1] / 2 - beam / 2;
  const gablePlate = eaves - 0.26;
  // the rail above the beam under the windows, as far above it as the two posts
  // in the middle of the gable stand apart
  const crossing = throughBeam + gableSize[0];

  /**
   * The framed stretch of the long walls: a sill and a plate, a post at each
   * measured position, a rail across every pier between the windows, and a
   * brace where the frame meets the corner of the house.
   */
  const framed = profile.timbered;
  if (framed !== undefined) {
    const place = (from: number) => length / 2 - from;
    const posts = framed.posts.map(place).sort((a, b) => a - b);
    const [start, finish] = [posts[0] as number, posts[posts.length - 1] as number];
    const upper = profile.front.find(({ y }) => y > storey);
    const windows = (upper?.windows ?? []).map(place);
    // the sill lies on top of the gable's, its underside on that beam's back -
    // the gable's is the one on the stonework, this one rides over it
    const sill = storey + beam * 1.5;
    // every frame lies a skin proud of its wall, so at the corner of the house
    // the long members have to reach past the wall's own end to meet the
    // gable's frame - short of that, a sliver of plain wall shows between them
    const edge = length / 2;
    const [from, to] = [-edge - SKIN.frame, finish + beam / 2];
    // the beam under the upper windows is one member across the whole stretch,
    // as the photographs show - only the one above it is panelled. It is hung
    // from the windows, so it stays snug under them wherever they move
    const through = upper === undefined ? undefined : upper.y - upper.size[1] / 2 - beam / 2;

    ([1, -1] as const).forEach(side => {
      // the beam the stonework carries, its back against the underside of the
      // gable's sill, with the frame's own sill stacked above it
      timber('long', side, (from + to) / 2, storey - beam / 2, to - from, beam);
      timber('long', side, (from + to) / 2, sill, to - from, beam);
      timber('long', side, (from + to) / 2, framed.to, to - from, beam);
      if (through !== undefined) {
        timber('long', side, (from + to) / 2, through, to - from, beam);
      }

      posts.forEach(at => {
        const [stand, thick] = standing(at, edge);
        timber('long', side, stand, (sill + framed.to) / 2, thick, framed.to - sill);
      });

      // in the course between the two low beams the ceiling joists show their
      // heads: one flush against each end of the frame - the one at the corner
      // is the end of the gable's own sill - and ten evenly spread between them
      const joist = beam + SKIN.frame;
      const [first, last] = [from + joist / 2, to - joist / 2];
      const gap = (last - first) / 11;
      Array.from({ length: 12 }, (_, index) => first + index * gap).forEach(at => {
        timber('long', side, at, storey + beam / 2, joist, beam);
      });

      // a rail crosses a panel only where no window stands in it
      posts.slice(0, -1).forEach((at, index) => {
        const next = posts[index + 1] as number;
        if (windows.some(window => window > at && window < next)) {
          return;
        }
        timber('long', side, (at + next) / 2, crossing, next - at, beam);
      });

      // the brace in the corner: head against the end post under the plate,
      // foot against the next post above the sill
      const next = (posts[1] as number) ?? start + 1;
      strut(
        'long',
        side,
        [start + beam * 1.6, framed.to],
        [next - beam * 1.6, sill + beam / 2],
        beam
      );
    });
  }

  /**
   * The gable's frame, read off the photograph: a sill on the stonework, a beam
   * the storey's windows stand on, a plate under the eaves, posts on a bay of
   * about a meter with a pair around every window, and a long brace leaning in
   * from each end. The triangle above it carries no braces at all - what looks
   * like one there is the rafter.
   */
  /** A post stands clear of the window it flanks, never over it. */
  const jambsOf = (row: Row | undefined) =>
    (row?.windows ?? []).flatMap(from => {
      const at = width / 2 - from;
      const reach = (row?.size[0] ?? 0.7) / 2 + beam / 2 + 0.03;
      return [at - reach, at + reach];
    });

  // the pair around the middle, a window's width apart
  const middlePair = [-1, 1].map(end => (end * (gableSize[0] + beam)) / 2);
  const gablePosts = [
    ...(profile.gablePosts?.storey ?? []).map(from => width / 2 - from),
    ...jambsOf(gableRow),
    ...middlePair,
  ];

  const sillTop = storey + beam;
  const plateBottom = gablePlate - beam * 0.7;
  /** How far a member has to run to meet the long walls' frame at both corners. */
  const corners = width + SKIN.frame * 2;
  const ordered = [...gablePosts].sort((a, b) => a - b);

  // only the east gable is framed all the way down - it stands at the framed
  // end of the long walls. The west end is the stone half, where the wheel
  // used to be, and carries a frame in its attic alone
  ([-1] as const).forEach(side => {
    // the two beams that run right through the storey, under the plate that
    // both gables carry
    timber('gable', side, 0, storey + beam / 2, corners, beam);
    timber('gable', side, 0, throughBeam, corners, beam);

    // the posts stand on the sill and carry the plate, with nothing in between
    ordered.forEach(at => {
      const [stand, thick] = standing(at, width / 2);
      timber('gable', side, stand, (sillTop + plateBottom) / 2, thick, plateBottom - sillTop);
    });

    // a rail right across the storey, as far above the beam under the windows
    // as the two posts in the middle stand apart - the windows cut it, so it
    // is drawn panel by panel and left out where one stands
    const storeyWindows = (gableRow?.windows ?? []).map(from => width / 2 - from);
    ordered.slice(0, -1).forEach((at, index) => {
      const next = ordered[index + 1] as number;
      if (storeyWindows.some(window => window > at && window < next)) {
        return;
      }
      timber('gable', side, (at + next) / 2, crossing, next - at, beam);
    });

    // a short rail over each window, closing the little panel between its head
    // and the plate - as wide as the window it sits over
    (gableRow?.windows ?? []).forEach(from => {
      const at = width / 2 - from;
      const head = (gableRow?.y ?? 4.05) + gableSize[1] / 2;
      timber('gable', side, at, head + beam, gableSize[0] + beam + 0.06, beam);
    });

    // a brace in each corner: its head against the corner post under the
    // plate, its foot against the next post along, above the sill
    ([0, ordered.length - 1] as const).forEach(index => {
      const corner = ordered[index] as number;
      const next = ordered[index === 0 ? 1 : ordered.length - 2] as number;
      if (next === undefined) {
        return;
      }
      const inward = corner < next ? beam / 2 : -beam / 2;
      strut('gable', side, [corner + inward, plateBottom], [next - inward, sillTop], beam);
    });
  });

  const atticRow = profile.gable.find(({ y }) => y > eaves);
  const atticSize = atticRow?.size ?? [0.8, 1.16];
  const atticPosts = [
    ...(profile.gablePosts?.attic ?? []).map(from => width / 2 - from),
    ...jambsOf(atticRow),
  ];

  // the attic's windows are snug between their rails: one touches their sills,
  // the next their heads, and two more carry on up towards the apex
  const atticMiddle = atticRow?.y ?? 6.48;
  const atticHead = atticMiddle + atticSize[1] / 2 + beam / 2;
  // the two above the windows are as far apart as the lower of them is from
  // the one on the heads, so the three of them step evenly up the gable
  const atticStep = 1.06;
  const atticRails = [
    atticMiddle - atticSize[1] / 2 - beam / 2,
    atticHead,
    atticHead + atticStep,
    atticHead + atticStep * 2,
  ];

  ([1, -1] as const).forEach(side => {
    // the plate under the triangle belongs to both gables, framed or not: it is
    // what the rafters and the attic's posts stand on
    timber('gable', side, 0, gablePlate, corners, beam * 1.4);

    // where the rafter is at a given height, and how high it is at a given
    // point: everything in the triangle is cut against that line
    const rafterAt = (height: number) => (width / 2) * (1 - (height - eaves) / ridge);
    const rafterOver = (at: number) => eaves + ridge * (1 - Math.abs(at) / (width / 2));

    atticPosts.forEach(at => {
      const [inner, outer] =
        at < 0 ? [at + beam / 2, at - beam / 2] : [at - beam / 2, at + beam / 2];
      if (rafterOver(outer) - gablePlate < 0.4) {
        return;
      }
      // the head of the post is cut to the slope, so it meets the rafter
      shape('gable', side, [
        [outer, gablePlate],
        [inner, gablePlate],
        [inner, rafterOver(inner) - 0.04],
        [outer, rafterOver(outer) - 0.04],
      ]);
    });

    atticRails.forEach(height => {
      const [low, high] = [height - beam / 2, height + beam / 2];
      if (rafterAt(high) < 0.5) {
        return;
      }
      // and the ends of the rails are cut to it as well, on both sides
      shape('gable', side, [
        [-rafterAt(low) + 0.04, low],
        [rafterAt(low) - 0.04, low],
        [rafterAt(high) - 0.04, high],
        [-rafterAt(high) + 0.04, high],
      ]);
    });
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createBuilding(data: BuildingData, palette: Palette): Group {
  const { center, length, width, angle } = boundingRect(data.footprint);
  const profile = PROFILES[data.id] ?? DEFAULT_PROFILE;
  const { eaves, ridge, dark = false, darkRoof = dark, chimneys = [] } = profile;

  // everything is measured from where it sits: the lowest the ground comes to
  // along its walls, and sunk into it everywhere else
  const ground = levelOf(data.id) ?? Math.min(...data.footprint.map(([x, y]) => heightAt(x, y)));

  const wallMaterial = new MeshLambertMaterial({
    color: dark ? palette.wallAccent : palette.wall,
    flatShading: true,
  });
  const roofMaterial = new MeshLambertMaterial({
    color: darkRoof ? palette.roof : palette.roofAccent,
    flatShading: true,
    // the eaves hang over the walls, so the underside of the roof is on show
    side: DoubleSide,
  });

  const gate = profile.gateRoom === true ? gateOf(profile, length) : undefined;
  const walls = new Mesh(
    gate === undefined
      ? new BoxGeometry(length, eaves + SUNK, width)
      : withoutFront(new BoxGeometry(length, eaves + SUNK, width)),
    wallMaterial
  );
  walls.position.y = (eaves + SUNK) / 2 - SUNK;

  // the gable is wall, not roof - the same colour, carried up to the ridge
  const gables = new Mesh(createGables(length, width, ridge), wallMaterial.clone());
  (gables.material as MeshLambertMaterial).side = DoubleSide;
  gables.position.y = eaves;

  const roof = new Mesh(createRoof(length, width, ridge), roofMaterial);
  roof.position.y = eaves;

  const site = new Group();
  site.name = data.name ?? `building-${data.id}`;
  site.position.set(center[0], ground, -center[1]);
  // the grid's y points north and the scene's z points south, which mirrors the
  // plane: a turn that is counter clockwise on the map is clockwise around the
  // scene's y axis, and the two signs cancel
  site.rotation.y = angle;

  // the mill stands on a plinth, and its floor is a good half meter above the
  // yard - everything the house is made of is measured from that floor
  const plinth = profile.plinth ?? 0;
  const building = new Group();
  building.position.y = plinth;
  site.add(building);
  building.add(walls, gables, roof);
  // three.js takes an empty add for a missing object: only when there are some
  const lanterns = createDoorLanterns(length, width, profile, palette);
  if (lanterns.length > 0) {
    building.add(...lanterns);
  }
  if (gate !== undefined) {
    building.add(...createGateRoom(length, width, profile, gate, wallMaterial, palette));
  }

  if (plinth > 0) {
    const base = new Mesh(new BoxGeometry(length + 0.1, plinth + SUNK, width + 0.1), wallMaterial);
    base.position.y = plinth - (plinth + SUNK) / 2;
    site.add(base);
  }

  const terrace = profile.terrace;
  if (terrace !== undefined) {
    const stone = new MeshLambertMaterial({ color: palette.wallAccent, flatShading: true });
    const rise = plinth / 4;
    const tread = 0.32;
    const flight = 1.5;
    const front = width / 2 + terrace.depth;

    // the stairs are cut into the terrace: three steps stand in the notch and
    // only the bottom one steps out of it, onto the yard
    const doors = spread(profile.front, length)
      .filter(({ height }) => height > 1.6)
      .slice(0, terrace.stairs)
      .map(({ at }) => at)
      .sort((a, b) => a - b);

    // the slab runs the full length, in the pieces the notches leave of it
    const edges = [
      -length / 2,
      ...doors.flatMap(at => [at - flight / 2, at + flight / 2]),
      length / 2,
    ];
    Array.from({ length: edges.length / 2 }, (_, piece) => {
      const [from, to] = [edges[piece * 2] as number, edges[piece * 2 + 1] as number];
      if (to - from < 0.05) {
        return;
      }
      const slab = new Mesh(new BoxGeometry(to - from, plinth, terrace.depth), stone);
      slab.position.set((from + to) / 2, plinth / 2 - 0.02, width / 2 + terrace.depth / 2);
      slab.name = 'terrace';
      site.add(slab);
    });

    doors.forEach(at => {
      // the notch behind the steps, as deep as the three of them need
      const notch = new Mesh(new BoxGeometry(flight, plinth, terrace.depth - 3 * tread), stone);
      notch.position.set(at, plinth / 2 - 0.02, width / 2 + (terrace.depth - 3 * tread) / 2);
      notch.name = 'terrace';
      site.add(notch);

      Array.from({ length: 4 }, (_, step) => {
        const stair = new Mesh(new BoxGeometry(flight, rise * (step + 1), tread), stone);
        // the bottom step stands out onto the yard, the three above it climb
        // back into the notch, one tread each
        stair.position.set(at, (rise * (step + 1)) / 2, front + tread / 2 - step * tread);
        stair.name = 'terrace';
        site.add(stair);
      });
    });
  }

  if (profile.dormer !== undefined) {
    // the dormer's front is boarded, but the little roof over it is tiled like
    // the one it sits in
    const boarding = new MeshLambertMaterial({
      color: palette.boarding,
      flatShading: true,
      side: DoubleSide,
    });
    const { boards, roofs } = createDormer(length, width, profile);
    boards.forEach(board => {
      board.material = boarding;
      building.add(board);
    });
    roofs.forEach(cap => {
      cap.material = roofMaterial;
      building.add(cap);
    });
  }

  // the quads of the far side wind the other way round, and a window is a hole
  // in a wall - it has no back to hide
  // white: every window's colour is its own, the glass or the light behind it
  const glass = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide, vertexColors: true });

  if (profile.crossGable !== undefined || profile.leanTo !== undefined) {
    // the additions are the building's own wall and roof, only their gable and
    // wedge are single triangles and have to be seen from both sides
    const stone = wallMaterial.clone();
    stone.side = DoubleSide;
    const parts = [
      createCrossGable(length, width, profile),
      createLeanTo(length, width, profile, palette),
    ];
    parts.forEach(({ walls: pieces, roofs, glazing: panels }) => {
      pieces.forEach(piece => {
        piece.material = stone;
        building.add(piece);
      });
      roofs.forEach(cap => {
        cap.material = roofMaterial;
        building.add(cap);
      });
      // a door belongs to the building it stands in, dark or not: the workshop
      // carries no windows, and this is the one opening it does have
      panels.forEach(panel => {
        if (panel.userData['ownMaterial'] !== true) {
          panel.material = glass;
        }
        building.add(panel);
      });
    });
  }

  if (profile.timbered !== undefined) {
    const frame = new Mesh(
      createTimbering(length, width, profile),
      new MeshLambertMaterial({ color: palette.roof, side: DoubleSide })
    );
    building.add(frame);
  }

  if (profile.kneeWall !== undefined) {
    building.add(
      new Mesh(
        createKneeWall(length, width, profile),
        new MeshLambertMaterial({ color: palette.roof, side: DoubleSide })
      )
    );
  }

  if (profile.doorstep !== undefined) {
    const { facade, at, width: across, depth } = profile.doorstep;
    const side = facade === 'front' ? 1 : -1;
    const step = new Mesh(
      new BoxGeometry(across, DOORSTEP_DOWN, depth),
      new MeshLambertMaterial({ color: palette.stack, flatShading: true })
    );
    step.position.set(length / 2 - at, -DOORSTEP_DOWN / 2, side * (width / 2 + depth / 2));
    building.add(step);
  }

  // what a facade carries decides whether it is drawn, not how dark the house
  // is: the workshop is the dark one and still has a gate and its windows. The
  // street side of the mill faces the road, which its local +z does too, and
  // the framed gable is the one at local -x - the other end may differ
  const facades: [Opening[], Facade, number, 1 | -1][] = [
    [
      spread(profile.front, length).filter(
        opening => gate === undefined || !(opening.door === true && opening.at === gate.at)
      ),
      'long',
      width / 2,
      1,
    ],
    [spread(profile.rear, length), 'long', width / 2, -1],
    [spread(profile.farGable ?? profile.gable, width), 'gable', length / 2, 1],
    [spread(profile.gable, width), 'gable', length / 2, -1],
  ];
  facades
    .filter(([openings]) => openings.length > 0)
    .forEach(([openings, facade, reach, side]) =>
      building.add(
        ...litOrDark(
          createOpenings(openings, facade, reach, side, profile.allLit),
          profile.light,
          glass
        )
      )
    );

  if (profile.dormer !== undefined) {
    // the dormer's windows stand on the face of the band, not on the roof
    const face = dormerFace(width) + 0.26;
    const openings = dormerOpenings(length, width, profile);
    building.add(
      new Mesh(createOpenings(openings, 'long', face, 1), glass),
      new Mesh(createOpenings(openings, 'long', face, -1), glass)
    );
  }

  if (profile.skylights !== undefined) {
    building.add(new Mesh(createSkylights(length, width, profile), glass));
  }

  // the stacks are brickwork, a grey of their own against the tiles whatever
  // colour those are. They stand down the street slope rather than astride the
  // ridge, and their heads come out level with it - the rest is inside the roof
  const stackMaterial = new MeshLambertMaterial({ color: palette.stack, flatShading: true });
  const stackHeight = ridge + 1.2;
  chimneys.forEach(({ at, down, proud = CHIMNEY_PROUD }) => {
    const chimney = new Mesh(new BoxGeometry(0.8, stackHeight, 0.8), stackMaterial);
    // the head stands off the tiles it comes through, which for the one nearest
    // the ridge is level with it
    const head = eaves + ridge * (1 - down) + proud;
    chimney.position.set(length / 2 - at, head - stackHeight / 2, (width / 2) * down);
    building.add(chimney);
  });

  // by day, until the hour says otherwise
  lightWindows(site, palette, false);
  return site;
}

/** The three buildings of the Lochmühle, nothing else in the valley is one. */
export function createBuildings(palette: Palette): Group {
  const group = new Group();
  group.name = 'buildings';
  BUILDINGS.forEach(data => group.add(createBuilding(data, palette)));
  return group;
}
