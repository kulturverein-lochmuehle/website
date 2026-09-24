import type { BufferGeometry, Material, Object3D } from 'three';
import {
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  Vector3,
} from 'three';

import type { Point } from '../data/data.js';
import { lightWindows, ownLight, windowLamps } from '../models/buildings/buildings.js';
import { YARD_CENTER } from '../models/buildings/footprint.js';
import { CAMPFIRE, showDecorations } from '../models/decorations/decorations.js';
import { showSeasonal } from '../models/structures/streetlamps.js';
import { seasonGround } from '../models/terrain/terrain.drawn.js';
import { seasonTrees } from '../models/terrain/trees.js';
import { ROAD } from '../models/vehicles/cars.js';
import { HEADLAMP } from '../models/vehicles/headlights.js';
import { driveRoute, TRAFFIC } from '../models/vehicles/route.js';
import { DRIVERS } from '../models/vehicles/traffic.js';
import { DRIFT } from '../scene/atmosphere.js';
import type { Lamp } from '../scene/lamps.js';
import {
  castsShadows,
  lampGrid,
  lampLight,
  lampStrength,
  orange,
  ROUND_LAMPS,
  softShadows,
} from '../scene/lamps.js';
import type { Palette } from '../scene/palette.js';
import { direction, FILL } from '../scene/scene.js';
import { lightsDue, skyOf, sunDirection } from '../scene/sky.js';
import { snowless, snowOn, takesSnow } from '../scene/snow.js';
import { Triangles } from './bvh.js';
import type { Occluder } from './occlusion.js';
import { visibleFrom } from './occlusion.js';
import { SunShadow } from './shadow.js';
import type { ViewSpec } from './views.js';

/**
 * A view baked for the site, and what the component that shows it reads:
 *
 * - `KVLM`, then the length of the header in bytes, a little endian uint32,
 * - the header, JSON, padded with spaces to four bytes (`PrefabHeader`),
 * - then each group of triangles in turn: its vertices - positions as uint16
 *   x, y, z on a grid over all of them (`grid`), each written as the step
 *   from the vertex before, wrapping round; then colors as sRGB bytes r, g,
 *   b, the light already in them, and for a group laid on the lightmap the
 *   colours under the light, and for a group a fire lights a byte a vertex:
 *   the fire's share of its light, to flicker - and the triangles as indices into them, three a triangle, uint16 where
 *   the vertices allow and uint32 where not, each written as the step from
 *   the one before, wrapping round: they climb as the vertices are first
 *   used, and small steps compress well. Each block padded to four bytes.
 *
 * The whole of it gzipped, as written to the file: the site's host may not
 * compress what it does not know, and the browser unpacks it as it comes.
 *
 * One group is one draw call, all of them drawn unlit with one shader: the
 * eye never moves, and neither does the sun, so the light is baked.
 */
export interface PrefabHeader {
  version: 4;
  /**
   * The grid the positions are written on: its least corner and a step each
   * way, 65535 steps across what is kept - a centimetre or less over the
   * valley, and the same grid for every group, so what two share meets.
   */
  grid: { origin: [number, number, number]; step: [number, number, number] };
  /** Seen from where its camera stands only, or from anywhere. */
  kind: ViewSpec['kind'];
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    /** What a free view turns around: the point looked at, on the ground. */
    pivot: [number, number, number];
    /** Where a path view's eye is along its way, a step a meter. */
    path?: { position: [number, number, number]; target: [number, number, number] }[];
    /** Whether the way closes on itself: flown round and round, not there and back. */
    loop?: boolean;
    /** How wide it sees, across, in degrees. */
    fov: number;
    near: number;
    far: number;
  };
  groups: PrefabGroup[];
  /**
   * The season's sky, drawn behind the view: its colours overhead and at the
   * horizon, in sRGB, the sun's direction and colour, and the haze the
   * distance fades into - how far off, and how much at most (`hazeAt`).
   */
  sky: {
    zenith: [number, number, number];
    horizon: [number, number, number];
    sun: [number, number, number];
    sunColor: [number, number, number];
    hazeReach: number;
    hazeMost: number;
    /** How much of the sky the clouds cover, and their colours lit and underneath, in sRGB. */
    clouds: { cover: number; lit: [number, number, number]; shade: [number, number, number] };
  };
  /**
   * The light on the ground round the eyes, drawn on a grid seen from above,
   * where a corner's colour would smear it: its corner, the size of a cell,
   * how many cells across and deep, the most light it holds - three bytes a
   * cell, the roots of the warm white's and the orange's shares of that, and
   * how much of the sun reaches it - the lamps' two colours, linear, and the
   * sun's - and, where a fire burns, a fourth: the fires' light alone, the
   * orange's colour, for the site's scene to flicker. The faces laid on it
   * carry their light in their corners as it is in full shadow.
   */
  lightmap?: {
    origin: [number, number];
    cell: number;
    width: number;
    depth: number;
    /** Three bytes a cell - four where a fire burns, its light apart from the street lamps' orange - or the sun's alone where no lamp lights. */
    channels: 1 | 3 | 4;
    most: number;
    warm: [number, number, number];
    orange: [number, number, number];
    /** The share of the sun's light a shadow takes, linear, and the way towards the sun. */
    sun: [number, number, number];
    toward: [number, number, number];
  };
  /**
   * The cars that drive the road, for the site's scene to send along it: the
   * ways they take, one for each direction, a point every meter - east, height,
   * south - their pace in meters a second, and the seconds between one car
   * and the next, least and most. The cars are the groups that name a vehicle.
   */
  vehicles?: {
    routes: [number, number, number][][];
    /**
     * At night, what the cars' headlamps throw, for the site's scene to light
     * what is in front of them: where the lamps are on each car, and the cone.
     */
    lamps?: {
      cars: Record<string, { nose: number; apart: number }>;
      height: number;
      reach: number;
      angle: number;
      penumbra: number;
      dip: number;
      baked: number;
    };
    speed: number;
    every: [least: number, most: number];
    /** Each car's length and width, for the site's scene to lay its shadow under it. */
    sizes?: Record<string, { length: number; width: number }>;
    /**
     * In the snow, the tracks the cars leave, for the site's scene to lay as
     * they drive rather than baked: how the road falls to the right of each
     * route's points, a meter across, so a wheel's track lies on it; how much
     * of the snow's colour a fresh track keeps, by channel; a tyre's width;
     * and the seconds a track takes to be snowed half over.
     */
    marks?: {
      tilts: number[][];
      tint: [number, number, number];
      tyre: number;
      life: number;
    };
  };
  /**
   * What drifts through the air in the view's season, for the site's scene to
   * draw as the model's does: how many, their size in meters, how fast they
   * fall, sway, turn and are carried by the wind, and their colours in sRGB.
   */
  drift?: {
    count: number;
    size: number;
    fall: number;
    sway: number;
    spin: number;
    wind: number;
    colors: [number, number, number][];
  };
}

export interface PrefabGroup {
  doubleSided: boolean;
  /** Pulled towards the camera by so much, to lie over what it is painted on. */
  offset?: [factor: number, units: number];
  renderOrder: number;
  /** How many vertices it shares out. */
  vertices: number;
  /** How many indices, three a triangle. */
  indices: number;
  /**
   * Whether its faces take the lamps' light from the lightmap rather than
   * their corners: then an albedo for each corner follows its colours.
   */
  mapped?: boolean;
  /** Whether it is laid over what is under it without hiding anything by its depth: drawn in its turn, over it. */
  decal?: boolean;
  /** Whether a fire lights its corners: then a byte each follows, the fire's share of the light. */
  fire?: boolean;
  /** A fire's tongues, all of it: the middle of the fire's foot, and how high they reach - to sway and flicker on the site. */
  flame?: [x: number, y: number, z: number, height: number];
  /**
   * A car, written as it stands at the origin, nose to +x, its wheels on the
   * ground: the site's scene puts it on the road, and moves it - where its
   * axles are from its middle, behind and ahead, tell how it pitches.
   */
  vehicle?: {
    id: string;
    behind: number;
    ahead: number;
    steer?: [x: number, y: number, z: number];
  };
}

type Drawn = Omit<PrefabGroup, 'vertices' | 'indices'>;

/** A car being baked: its name and axles, whether its lamps shine, and whether it is the light they throw. */
interface Vehicle {
  id: string;
  behind: number;
  ahead: number;
  night: boolean;
  /** Where its front wheel turns about, if the part is one. */
  steer?: [number, number, number];
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * How far past the view's edge a car is sent from, in meters, how far it is
 * looked for - as far as the view sees, so it comes and goes where it is a
 * pixel or two in the haze, not where it can be seen to: sent from 160m, it
 * came and went half way along the road the winter's street view sees - and
 * the heights over the road a car is looked for at, either of them seen
 * counting: behind a hill or the mill the road is driven unseen, and a car
 * sent along it kept the next waiting half a minute.
 */
/** The tracks a car leaves in the snow: how fresh, how wide, and the seconds until half snowed over. */
const MARKS = { fresh: 0.95, tyre: 0.21, life: 180 };

const SENT = { before: 15, free: 140, angle: 25, least: 55, heights: [0.5, 1.3], every: 2 };

/**
 * The stretch of a route a view sees - from the first of its points in sight
 * to the last, and a way beyond each end - as the indices of its first and
 * last point. A view sees what is in front of any of its eyes and within its
 * reach, or - a free one - what is near its pivot; none at all where it sees
 * no point of the route.
 */
function seenStretch(
  route: [number, number, number][],
  eyes: { at: Vector3; forward: Vector3 }[],
  view: ViewSpec,
  pivot: [number, number, number],
  blocking: Triangles
): [number, number] | undefined {
  // a canvas may be tall as well as wide: a wide margin for the angle
  const widest = Math.max(
    ((view.fov / 2 + SENT.angle) * Math.PI) / 180,
    (SENT.least * Math.PI) / 180
  );
  const point = new Vector3();
  const seen = route.flatMap(([x, y, z], index) => {
    point.set(x, y, z);
    const inSight =
      eyes.length === 0
        ? point.distanceTo(new Vector3(...pivot)) < SENT.free
        : index % SENT.every === 0 &&
          eyes.some(({ at, forward }) => {
            const way = point.clone().sub(at);
            return (
              way.length() < view.far &&
              way.angleTo(forward) < widest &&
              SENT.heights.some(
                height => !blocking.between(at.x, at.y, at.z, x, y + height, z, 0.3)
              )
            );
          });
    return inSight ? [index] : [];
  });
  const [first, last] = [seen[0], seen[seen.length - 1]];
  return first === undefined || last === undefined
    ? undefined
    : [Math.max(first - SENT.before, 0), Math.min(last + SENT.before, route.length - 1)];
}

/** What a car on the road is seen through or past, by the name of its part: no hiding it. */
const SEE_THROUGH = [
  'trees',
  'railings',
  'roadside',
  'streetlamps',
  'strings',
  'decorations',
  'garden',
  'pavilion',
  'markings',
  'tracks',
  'cars',
];

/** The colours a car's lamps shine in at night. */
const GLOW: Record<string, string> = { head_light: '#fff2c0', tail_light: '#ff2a1a' };

/** How near the eye nothing is drawn, in meters. */
const NEAR = 0.1;

/** How far past the sides of the view a triangle is still kept, in degrees. */
const MARGIN = 6;

/** How far apart a path view's eye is placed along its way, in meters. */
const PATH_STEP = 1;

/** Over how many places either side the eye's height over the ground is eased. */
const HEIGHT_EASE = 3;

/** And every how many of those places what is kept is seen from. */
const PATH_SEEN = 3;

/** How finely it is seen from each: coarser than a still view, as there are many. */
const PATH_RESOLUTION = 512;

/** The nearest render order set on an object or on what it hangs from. */
function orderOf(object: Object3D): number {
  for (let at: Object3D | null = object; at !== null; at = at.parent) {
    if (at.renderOrder !== 0) {
      return at.renderOrder;
    }
  }
  return 0;
}

/** Whether an object and all it hangs from are shown. */
function shown(object: Object3D): boolean {
  for (let at: Object3D | null = object; at !== null; at = at.parent) {
    if (!at.visible) {
      return false;
    }
  }
  return true;
}

/** The ground's height under a point of the plan: the first surface a ray down meets. */
function surfaceAt(model: Object3D, [x, y]: [number, number]): number {
  const ray = new Raycaster(new Vector3(x, 1000, -y), new Vector3(0, -1, 0));
  const hit = ray
    .intersectObject(model, true)
    .find(({ object }) => object instanceof Mesh && !(object instanceof InstancedMesh));
  return hit?.point.y ?? 0;
}

/**
 * A point to a tenth of a millimeter: the engines the bake runs on - node, and
 * the browser that tests it - part in the last digit of a sine, and written
 * down whole, the header would part with them.
 */
const rounded = (point: number[]): [number, number, number] =>
  point.map(value => Math.round(value * 1e4) / 1e4) as [number, number, number];

/** An eye on the plan and where it looks, in scene space: its height over the ground, pitched. */
function placed(
  model: Object3D,
  view: ViewSpec,
  [eye, look]: [Point, Point],
  { height, pitch }: { height: number; pitch: number } = view
): { position: [number, number, number]; target: [number, number, number] } {
  const position = new Vector3(eye[0], surfaceAt(model, eye) + height, -eye[1]);
  // the compass direction it looks towards; turned round, it is the one it
  // looks from, which is how `direction` counts
  const bearing = (Math.atan2(look[0] - eye[0], look[1] - eye[1]) * 180) / Math.PI;
  const target = position.clone().sub(direction(bearing + 180, -pitch));
  return { position: rounded(position.toArray()), target: rounded(target.toArray()) };
}

/**
 * Where a path view's eye is at every step of its way: from where it starts
 * through each point of its path in turn on a smooth curve - a Catmull-Rom
 * spline, which passes through every point and has no corner at any - and
 * what it looks at, how high it is and how far it looks down on others
 * through theirs, so it turns, climbs and tilts as smoothly as it goes. A
 * step a meter or so, and the last point too - or, round a loop, on from
 * the last point back to where it started, and its neighbours round the
 * loop's either end are the other end's.
 */
function walked(model: Object3D, view: ViewSpec, step: number) {
  // eye, look, height and pitch, six numbers a stop
  const stops = [
    { eye: view.eye, look: view.look, height: view.height, pitch: view.pitch },
    ...(view.path ?? []).map(({ eye, look, height, pitch }) => ({
      eye,
      look,
      height: height ?? view.height,
      pitch: pitch ?? view.pitch,
    })),
  ].map(({ eye, look, height, pitch }) => [...eye, ...look, height, pitch]);
  const loop = view.loop === true;
  const count = stops.length;
  const at = (index: number) =>
    stops[
      loop ? ((index % count) + count) % count : Math.min(Math.max(index, 0), count - 1)
    ] as number[];
  const curve = (p0: number[], p1: number[], p2: number[], p3: number[], t: number) =>
    p1.map((b, axis) => {
      const [a, c, d] = [p0[axis], p2[axis], p3[axis]] as [number, number, number];
      return (
        0.5 *
        (2 * b +
          (c - a) * t +
          (2 * a - 5 * b + 4 * c - d) * t * t +
          (3 * b - a - 3 * c + d) * t * t * t)
      );
    });
  const legs = loop ? count : count - 1;
  const along = Array.from({ length: legs }, (_, leg) => leg).flatMap(leg => {
    const [before, from, to, after] = [at(leg - 1), at(leg), at(leg + 1), at(leg + 2)];
    const length = Math.hypot(
      (to[0] as number) - (from[0] as number),
      (to[1] as number) - (from[1] as number)
    );
    const steps = Math.max(1, Math.ceil(length / step));
    return Array.from({ length: steps }, (_, k) => curve(before, from, to, after, k / steps));
  });
  const track = [...along, ...(loop ? [] : [at(count - 1)])].map(
    ([ex, ey, lx, ly, height, pitch]) =>
      placed(
        model,
        view,
        [
          [ex as number, ey as number],
          [lx as number, ly as number],
        ],
        { height: height as number, pitch: pitch as number }
      )
  );
  // the eye kept at its height over the ground as it is on average around
  // it, not over every kerb and seam it passes: the ground's bumps would
  // make it bob - round a loop, averaged round its ends too
  const heights = track.map(({ position }) => position[1]);
  return track.map(({ position, target }, index) => {
    const near = Array.from(
      { length: HEIGHT_EASE * 2 + 1 },
      (_, k) => index - HEIGHT_EASE + k
    ).flatMap(k =>
      loop
        ? [heights[((k % heights.length) + heights.length) % heights.length] as number]
        : k < 0 || k >= heights.length
          ? []
          : [heights[k] as number]
    );
    const lift = near.reduce((sum, height) => sum + height, 0) / near.length - position[1];
    return {
      position: rounded([position[0], position[1] + lift, position[2]]),
      target: rounded([target[0], target[1] + lift, target[2]]),
    };
  });
}

/** Where the eye of a view starts and what it looks at, in scene space. */
export function viewCamera(model: Object3D, view: ViewSpec): PrefabHeader['camera'] {
  model.updateMatrixWorld(true);
  return {
    ...placed(model, view, [view.eye, view.look]),
    pivot: rounded([view.look[0], surfaceAt(model, view.look), -view.look[1]]),
    fov: view.fov,
    near: NEAR,
    far: view.far,
  };
}

/**
 * Whether a triangle's corners, seen from the eye, span some of the view's
 * width: as angles off straight ahead, the arc they span is the one left
 * once the widest gap between them is taken away, and two arcs of a circle
 * meet where either holds the other's start.
 */
function spans(seen: Vector3[], half: number): boolean {
  const angles = seen.map(({ x, z }) => Math.atan2(x, -z)).sort((a, b) => a - b);
  const [a, b, c] = angles as [number, number, number];
  const gaps = [b - a, c - b, a + Math.PI * 2 - c];
  const widest = gaps.indexOf(Math.max(...gaps));
  const start = angles[(widest + 1) % 3] as number;
  const length = Math.PI * 2 - (gaps[widest] as number);
  const holds = (angle: number) =>
    (((angle - start) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) <= length;
  return holds(-half) || Math.abs(start) <= half;
}

/**
 * Bakes a view of the model: every triangle the eye could see - within its
 * width and a margin, within its depth, facing it unless drawn on both sides,
 * and not wholly behind others - moved to where it stands, coloured and lit as the scene's own
 * lights light it, and merged with all the others drawn alike. With `snow`, snow
 * lies on what faces up, as much as the scene's winter lays.
 */
/** A colour as the canvas takes it, rounded like a point. */
const srgb = (color: Color): [number, number, number] => {
  const { r, g, b } = color.getRGB(new Color(), 'srgb');
  return rounded([r, g, b]);
};

/** How far a point is held off its face along the normal before its shadow is looked up, in meters. */
const SHADOW_OFF = 0.05;

/**
 * A face is split where its corners' light parts by more than this - a
 * shadow's edge runs across it - until its longest side is this short, at
 * most this many times over - an edge of a lamp's light down to `lamps`, its
 * pool being a few meters round. Only a face longer than `only` is split at all:
 * the ground and the roofs, where a shadow's edge shows; a leaf lump or a
 * railing takes the light at its corners. And only within `within` of an eye
 * - of the yard, for a free view: past that an edge is under a pixel anyway.
 * And a face with a lamp nearer than it is long is split down to `nearLamp`.
 */
const SPLIT = {
  nearLamp: 0.5,
  parts: 0.3,
  shortest: 1.5,
  lamps: 0.1,
  depth: 7,
  sunDepth: 3,
  only: 0,
  sunOnly: 3,
  within: 60,
};

/** A corner of a face as it is lit: its place, its colour, the way it faces, and how much sun reaches it. */
interface Corner3 {
  corner: Vector3;
  shade: Color;
  facing: Vector3;
  light: Light;
}

/** How much light reaches a corner: the share of the sun, and the lamps' warm white and orange. */
interface Light {
  sun: number;
  warm: number;
  orange: number;
  /** The fires', apart from the street lamps' orange: it flickers on the site. */
  fire: number;
}

/**
 * A face split into four where a shadow's edge crosses it - its corners' or
 * its middle's light parting - and each quarter again, so the edge is drawn
 * where it runs and not smeared across a face that may be meters wide.
 */
function split(
  face: [Corner3, Corner3, Corner3],
  lightAt: (point: Vector3, facing: Vector3) => Light,
  depth = 0,
  lampNear: (middle: Vector3, within: number) => boolean = () => false
): [Corner3, Corner3, Corner3][] {
  const [a, b, c] = face;
  const longest = Math.max(
    a.corner.distanceTo(b.corner),
    b.corner.distanceTo(c.corner),
    c.corner.distanceTo(a.corner)
  );
  if (depth >= SPLIT.depth || longest < SPLIT.lamps) {
    return [face];
  }
  const between = (one: Corner3, other: Corner3): Corner3 => {
    const corner = one.corner.clone().lerp(other.corner, 0.5);
    const facing = one.facing.clone().add(other.facing).normalize();
    return {
      corner,
      shade: one.shade.clone().lerp(other.shade, 0.5),
      facing,
      light: lightAt(corner, facing),
    };
  };
  const middle = a.corner.clone().add(b.corner).add(c.corner).divideScalar(3);
  // looked at on its sides' middles too: an edge running between the corners
  // and the middle is missed by those alone
  const [ab, bc, ca] = [between(a, b), between(b, c), between(c, a)];
  const lights = [
    a.light,
    b.light,
    c.light,
    ab.light,
    bc.light,
    ca.light,
    lightAt(middle, a.facing),
  ];
  // the sun's share, and each lamp colour's as much as a lamp can show
  const [sunParts, ...lampParts] = (['sun', 'warm', 'orange', 'fire'] as const).map(channel => {
    const values = lights.map(light => Math.min(light[channel], 1));
    return Math.max(...values) - Math.min(...values);
  }) as [number, number, number, number];
  // a sun's edge is split down to `shortest`, a lamp's - a pool of light a
  // few meters round - finer, to `lamps`
  // or where a lamp stands nearer than the face is long: its pool lies on
  // the face between the points looked at, and missed by them all - a wall
  // lantern's on the wall it hangs on
  const lamping =
    Math.max(...lampParts) > SPLIT.parts || (longest > SPLIT.nearLamp && lampNear(middle, longest));
  const sunning =
    sunParts > SPLIT.parts &&
    longest >= SPLIT.shortest &&
    depth < SPLIT.sunDepth &&
    (depth > 0 || longest > SPLIT.sunOnly);
  if (!lamping && !sunning) {
    return [face];
  }
  return (
    [
      [a, ab, ca],
      [ab, b, bc],
      [ca, bc, c],
      [ab, bc, ca],
    ] as [Corner3, Corner3, Corner3][]
  ).flatMap(piece => split(piece, lightAt, depth + 1, lampNear));
}

/**
 * The triangles within a reach of a point, nine numbers each: what may stand
 * between a lamp and what it lights. What lies right at the lamp - the bulb
 * itself, its flex - is left out, or it would shade everything.
 */
function trianglesNear(
  all: Float32Array,
  [x, y, z]: [number, number, number],
  reach: number
): Float32Array {
  // plain numbers, no arrays made a triangle: it runs over every triangle
  // drawn, for every lamp that casts shadows
  const kept: number[] = [];
  const away = (at: number) =>
    Math.hypot((all[at] as number) - x, (all[at + 1] as number) - y, (all[at + 2] as number) - z);
  for (let at = 0; at + 8 < all.length; at += 9) {
    const [d0, d1, d2] = [away(at), away(at + 3), away(at + 6)];
    if (Math.min(d0, d1, d2) > reach || Math.max(d0, d1, d2) < LAMP_CLEAR) {
      continue;
    }
    for (let k = 0; k < 9; k += 1) {
      kept.push(all[at + k] as number);
    }
  }
  return new Float32Array(kept);
}

/** Whether a lamp is a fire: its light flickers on the site, so the lightmap keeps it apart. */
const burns = ({ kind }: Lamp) => kind === 'fire';

/** The point light a shadow casting lamp is. */
const roundOf = ({ kind }: Lamp) =>
  kind === 'street'
    ? ROUND_LAMPS.street
    : kind === 'string'
      ? ROUND_LAMPS.string
      : ROUND_LAMPS.bulb;

/** What the lightmap is laid over: the ground and what is laid on it. */
const GROUND_PARTS = ['terrain', 'ways', 'markings', 'brook', 'deck', 'crossing-deck', 'tracks'];

/**
 * The lightmap: how fine its cells are, how far round the eyes it is drawn
 * - the lamps' light and the sun's shadows both, day and night; the sun's
 * off a map of its own drawn from what stands within `sunFrom` of it, and
 * one of the rest looked at `farLift` towards the sun -
 * how near upright a face must be to take it and how near the top of what is
 * there, and the most light it holds. A byte holds the root of its share of
 * that: a faint light takes as many of the 256 steps as a bright one, or its
 * edge would show in steps as it fades.
 * The way a cell faces is read off the ground's heights `slope` either side
 * of it: nearer, the grid they are read off steps, and the light with it,
 * in streaks along the grid. How near over the ground what stands on it must
 * reach for the ground there to count as hidden under it. And how much a cell
 * must differ from one round it - at least, and as a share of the brighter -
 * to be looked at again across it, as on a shadow's edge.
 */
const LIGHTMAP = {
  cell: 0.05,
  reach: 40,
  up: 0.55,
  top: 0.3,
  most: 6,
  slope: 0.1,
  covered: 0.3,
  margin: 2,
  sunFrom: 60,
  farLift: 2,
  inset: 0.15,
  edge: { least: 0.01, share: 0.06 },
};

/** Where in a cell it is looked at again on an edge, in cells off its middle: a turned grid. */
const EDGE_LOOKS: [number, number][] = [
  [-0.125, -0.375],
  [0.375, -0.125],
  [0.125, 0.375],
  [-0.375, 0.125],
];

/** Where on a bulb its shadows are looked for from: its middle and round it. */
const BULB_SAMPLES: [number, number, number][] = Array.from(
  { length: 32 },
  (_, k): [number, number, number] => {
    // evenly through the ball, not on its skin alone: a spiral out from its middle
    const up = 1 - (2 * (k + 0.5)) / 32;
    const round = Math.sqrt(1 - up * up);
    const turn = k * 2.39996;
    const out = Math.cbrt((k * 0.618034 + 0.5) % 1);
    return [Math.cos(turn) * round * out, up * out, Math.sin(turn) * round * out];
  }
);

/** How close to a lamp a triangle counts as the lamp itself, and how far short of a point a blocker counts. */
const LAMP_CLEAR = 0.3;

/** How far a point is held off its face before a lamp's shadow is looked for, in meters. */
const LAMP_OFF = 0.08;
const SHADOW_SHORT = 0.05;

/** Every triangle the model draws, nine numbers each in scene space: what casts the sun's shadows. */
export function worldTriangles(model: Object3D, skip: Object3D[] = []): Float32Array {
  const out: number[] = [];
  const corner = new Vector3();
  const take = (geometry: BufferGeometry, matrix: Matrix4) => {
    const position = geometry.getAttribute('position');
    if (position === undefined) {
      return;
    }
    const index = geometry.getIndex();
    const count = index === null ? position.count : index.count;
    for (let step = 0; step < count; step += 1) {
      corner
        .fromBufferAttribute(position, index === null ? step : index.getX(step))
        .applyMatrix4(matrix);
      out.push(corner.x, corner.y, corner.z);
    }
  };
  model.traverse(object => {
    if (!(object instanceof Mesh) || !shown(object)) {
      return;
    }
    let above: Object3D | null = object;
    while (above !== null) {
      if (skip.includes(above)) {
        return;
      }
      above = above.parent;
    }
    if (object instanceof InstancedMesh) {
      const instance = new Matrix4();
      Array.from({ length: object.count }, (_, step) => {
        object.getMatrixAt(step, instance);
        take(object.geometry, object.matrixWorld.clone().multiply(instance));
      });
      return;
    }
    take(object.geometry, object.matrixWorld);
  });
  return new Float32Array(out);
}

/** Whether a view's windows are lit: as it says, or as its hour has them. */
const litIn = (view: ViewSpec) => view.lights ?? lightsDue(view.season, view.hour);

/** Whether a view's street lamps are lit: as it says, or as its windows are. */
const lanternsIn = (view: ViewSpec) => view.lanterns ?? litIn(view);

/**
 * Sets the model up for a view before it is baked: the woods in the view's
 * season, the windows lit as its hour and its lights say - and hands back how
 * much snow lies, for the bake to lay.
 */
/**
 * A still view from where a camera looking down onto the model stands - its
 * compass direction, its height angle, and how wide the ground it sees is -
 * as a perspective eye far enough back to see that much: what the editor's
 * preview bakes, lit as the rest of the view says.
 */
export function viewFrom(
  model: Object3D,
  {
    center,
    azimuth,
    elevation,
    span,
    ...lit
  }: {
    center: [number, number];
    azimuth: number;
    elevation: number;
    span: number;
  } & Pick<ViewSpec, 'season' | 'hour' | 'moon' | 'lights' | 'lanterns' | 'decorations'>
): ViewSpec {
  const fov = 60;
  const distance = span / 2 / Math.tan(((fov / 2) * Math.PI) / 180);
  const [phi, theta] = [(azimuth * Math.PI) / 180, (Math.max(elevation, 2) * Math.PI) / 180];
  const eye: [number, number] = [
    center[0] + Math.sin(phi) * Math.cos(theta) * distance,
    center[1] + Math.cos(phi) * Math.cos(theta) * distance,
  ];
  const middle = surfaceAt(model, center);
  // as high over the ground under it as the angle puts it over what it looks at
  const height = Math.max(middle + Math.sin(theta) * distance - surfaceAt(model, eye), 1.7);
  return {
    title: 'Preview',
    kind: 'still',
    eye,
    height,
    look: center,
    pitch: -elevation,
    fov,
    far: Math.max(distance * 4, 400),
    ...lit,
  };
}

export function setUpView(model: Object3D, view: ViewSpec, palette: Palette): { snow: number } {
  const trees = model.getObjectByName('trees');
  if (trees !== undefined) {
    seasonTrees(trees, palette, view.season);
  }
  const terrain = model.getObjectByName('terrain');
  if (terrain !== undefined) {
    seasonGround(terrain, palette, view.season);
  }
  const sky = skyOf(palette, view.season, view.hour, view.moon);
  ['buildings', 'pavilion', 'streetlamps', 'strings'].forEach(name => {
    const lit = model.getObjectByName(name);
    if (lit !== undefined) {
      lightWindows(lit, palette, name === 'streetlamps' ? lanternsIn(view) : litIn(view), sky.day);
    }
  });
  showSeasonal(model, view.season);
  showDecorations(model, view.decorations ?? []);
  return { snow: view.season === 'winter' ? 1 : 0 };
}

/** How a view is baked: how much snow lies, and who is told how far it has got. */
export interface Baking {
  snow?: number;
  /** How far the bake has got, nought to one, and what it is on. */
  progress?: (share: number, stage: string) => void;
}

/**
 * What a view's eyes are to see: where each stands and the way it looks, every
 * triangle that might be in sight, and how finely each is tested - none for a
 * still view's own. Each eye stands on its own, and a triangle is kept where
 * any of them sees it, so the eyes can be shared out and what they saw put
 * together in any order.
 */
export interface Sight {
  eyes: { at: Vector3; forward: Vector3 }[];
  triangles: Occluder[];
  size: number | undefined;
}

/** Which of the triangles any of a sight's eyes sees, the eyes taken one after the other. */
export function seenBy({ eyes, triangles, size }: Sight): boolean[] {
  return eyes
    .map(({ at, forward }) => visibleFrom(at, forward, triangles, size))
    .reduce((all, seen) => all.map((kept, at) => kept || (seen[at] as boolean)));
}

/** Bakes a view here and now, its eyes seeing one after the other. */
export function bakeView(
  model: Object3D,
  view: ViewSpec,
  palette: Palette,
  baking: Baking = {}
): ArrayBuffer {
  const steps = bakeSteps(model, view, palette, baking);
  let step = steps.next();
  while (step.done !== true) {
    step = steps.next(seenBy(step.value));
  }
  return step.value;
}

/**
 * Bakes a view as `bakeView()` does, but hands what its eyes are to see to
 * `sees` - which may share the eyes out across threads - and waits for it.
 */
export async function bakeViewAsync(
  model: Object3D,
  view: ViewSpec,
  palette: Palette,
  { sees, ...baking }: Baking & { sees: (sight: Sight) => Promise<boolean[]> }
): Promise<ArrayBuffer> {
  const steps = bakeSteps(model, view, palette, baking);
  let step = steps.next();
  while (step.done !== true) {
    step = steps.next(await sees(step.value));
  }
  return step.value;
}

/** The bake itself, stopping where its eyes are to see, for whoever drives it to say what they saw. */
function* bakeSteps(
  model: Object3D,
  view: ViewSpec,
  palette: Palette,
  { snow = 0, progress }: Baking
): Generator<Sight, ArrayBuffer, boolean[]> {
  progress?.(0, 'shadows');
  // the snow's tracks are laid by the cars that drive the view, not baked
  const tracks = model.getObjectByName('tracks');
  const cars = model.getObjectByName('cars');
  const marked =
    tracks !== undefined &&
    shown(tracks) &&
    cars !== undefined &&
    shown(cars) &&
    ROAD !== undefined;
  if (marked) {
    tracks.visible = false;
  }
  const start = viewCamera(model, view);
  // a path view's eye every meter of its way, and every few of those as the
  // eyes what is kept is seen from
  const track = view.kind === 'path' ? walked(model, view, PATH_STEP) : undefined;
  const camera =
    track === undefined
      ? start
      : { ...start, path: track, ...(view.loop === true ? { loop: true } : {}) };
  const still = view.kind === 'still';
  const looking =
    view.kind === 'free'
      ? []
      : track === undefined
        ? [start]
        : track.filter((_, at) => at % PATH_SEEN === 0 || at === track.length - 1);
  const eyes = looking.map(({ position, target }) => {
    const eye = new PerspectiveCamera();
    eye.position.fromArray(position);
    eye.lookAt(new Vector3().fromArray(target));
    eye.updateMatrixWorld(true);
    return {
      at: eye.position.clone(),
      toEye: eye.matrixWorldInverse.clone(),
      forward: new Vector3().fromArray(target).sub(eye.position),
    };
  });
  const half = ((view.fov / 2 + MARGIN) * Math.PI) / 180;

  // the sun where the view's season has it, as the scene sets it
  const sky = skyOf(palette, view.season, view.hour, view.moon);
  const sun = sunDirection(sky);

  /**
   * The light a surface facing a way gets, as three.js lights a Lambert
   * material under the scene's lights: the sun as far as the surface faces
   * it, the ambient fill all round, and the sky's or the ground's bounce as
   * the surface faces up or down - all of it over pi, which is how its diffuse
   * reflection is counted.
   */
  const sunLight = sky.sun.color.clone().multiplyScalar(sky.sun.intensity);
  const ambientLight = palette.ambient
    .clone()
    .multiply(sky.fillTint)
    .multiplyScalar(FILL.ambient * sky.fill);
  const { strength, softness } = sky.shadow;
  // the lit windows' light, onto what faces them, the more the darker it is
  // everything the bake could draw, once: what casts the sun's and the lamps' shadows
  model.updateMatrixWorld(true);
  const drawn = worldTriangles(model);
  // a fire burns whenever it is laid; what is not put up is not among them
  // a fire burns whenever it is laid, and a room with a light of its own is
  // lit while that is up, the lights on or not
  const lamps = windowLamps(model).filter(lamp =>
    lamp.kind === 'fire' || ownLight(lamp.source)
      ? true
      : lamp.kind === 'street'
        ? lanternsIn(view)
        : litIn(view)
  );
  // what stands round a lamp that casts shadows: every triangle within its reach
  const blockers = new Map(
    lamps
      .filter(castsShadows)
      .map(lamp => [lamp, new Triangles(trianglesNear(drawn, lamp.at, roundOf(lamp).gone))])
  );
  // the bulb as a small ball: the share of points on it a point sees is how
  // much of its light reaches it, so a shadow's edge is soft
  const reaching = (lamp: Lamp, surface: Vector3, normal: Vector3) => {
    const near = blockers.get(lamp);
    if (near === undefined) {
      return 1;
    }
    // held off the face along its normal, as for the sun: ground piled a
    // hand's breadth over the terrain would otherwise shade the terrain under it
    const point = surface.clone().addScaledVector(normal, LAMP_OFF);
    const [x, y, z] = lamp.at;
    const size = roundOf(lamp).size / 2;
    const sees = ([dx, dy, dz]: [number, number, number]) =>
      !near.between(
        x + dx * size,
        y + dy * size,
        z + dz * size,
        point.x,
        point.y,
        point.z,
        SHADOW_SHORT
      );
    // only the bulb and the street lamps are seen bare and big: every other
    // light's shadow is one look from its middle
    if (!softShadows(lamp)) {
      return sees([0, 0, 0]) ? 1 : 0;
    }
    // eight spread through all of it first: seen alike, the point is wholly
    // in light or in shadow; where they part - on a shadow's edge - all of
    // them, so the edge fades evenly
    const first = BULB_SAMPLES.filter((_, k) => k % 4 === 0).map(sees);
    if (first.every(one => one === first[0])) {
      return first[0] === true ? 1 : 0;
    }
    return BULB_SAMPLES.filter(sees).length / BULB_SAMPLES.length;
  };
  const lampColor = palette.windowLit.clone().multiplyScalar(lampStrength(sky.day));
  const lanternColor = palette.lantern.clone().multiplyScalar(lampStrength(sky.day));
  const nearLamps = lampGrid(lamps);
  // whether a lamp that lights stands within a distance of a point
  const lampNear = (point: Vector3, within: number) =>
    nearLamps(point).some(
      ({ at: [x, y, z] }) => Math.hypot(x - point.x, y - point.y, z - point.z) < within
    );
  // what the lamps give a point facing a way: the warm white's, the street
  // lamps' orange, and the fires' - orange too, but apart, to flicker
  const lampsAt = (point: Vector3, normal: Vector3) => {
    const near = nearLamps(point);
    return near.length === 0
      ? { warm: 0, orange: 0, fire: 0 }
      : {
          warm: lampLight(
            near.filter(lamp => !orange(lamp)),
            point,
            normal,
            reaching
          ),
          orange: lampLight(
            near.filter(lamp => orange(lamp) && !burns(lamp)),
            point,
            normal,
            reaching
          ),
          fire: lampLight(near.filter(burns), point, normal, reaching),
        };
  };
  const lightOf = (normal: Vector3, light: Light) =>
    ambientLight
      .clone()
      .add(
        sunLight
          .clone()
          .multiplyScalar(Math.max(0, normal.dot(sun)) * (1 - strength * (1 - light.sun)))
      )
      .add(
        palette.ground
          .clone()
          .lerp(palette.sky, 0.5 * normal.y + 0.5)
          .multiply(sky.fillTint)
          .multiplyScalar(FILL.hemisphere * sky.fill)
      )
      .add(lampColor.clone().multiplyScalar(light.warm))
      .add(lanternColor.clone().multiplyScalar(light.orange + light.fire))
      .multiplyScalar(1 / Math.PI);
  // how much of a corner's light is a fire's, as the eye takes brightness
  const fireShare = (shade: Color, light: Light, total: Color) => {
    if (light.fire <= 0) {
      return 0;
    }
    const fired = shade
      .clone()
      .multiply(lanternColor)
      .multiplyScalar(light.fire / Math.PI);
    const bright = ({ r, g, b }: Color) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return Math.min(bright(fired) / Math.max(bright(total), 1e-6), 1);
  };

  // where a shadow's edge is drawn finely: round every eye, or the yard
  const splitNear =
    view.kind === 'free'
      ? [new Vector3(YARD_CENTER[0], 0, -YARD_CENTER[1])]
      : eyes.map(({ at: from }) => from);
  // the sun's shadows, from everything the bake could draw
  model.updateMatrixWorld(true);
  const shadow = new SunShadow(sun, drawn);
  progress?.(0.1, 'lighting');
  // held off the face a little along its normal, as the scene's map is; a
  // corner shared by faces alike is worked out once
  const known = new Map<string, Light>();
  const lightAt = (point: Vector3, facing: Vector3): Light => {
    const key = [point.x, point.y, point.z, facing.x, facing.y, facing.z]
      .map(value => Math.round(value * 1000))
      .join(',');
    const had = known.get(key);
    if (had !== undefined) {
      return had;
    }
    const light = {
      sun: shadow.lightAt(point.clone().addScaledVector(facing, SHADOW_OFF), softness, facing),
      ...lampsAt(point, facing),
    };
    known.set(key, light);
    return light;
  };
  // on a face the lightmap lights, the corners take the light as it is in
  // full shadow: the sun's share that a shadow takes, and the lamps', are
  // the map's, laid on by the pixel
  const sunAt = (): Light => ({ sun: 0, warm: 0, orange: 0, fire: 0 });

  // the lamps' light on the ground round the eyes, a cell at a time: what is
  // uppermost there read off a grid seen from above, lit as it faces
  const lightmap = (() => {
    const xs = splitNear.map(({ x }) => x);
    const zs = splitNear.map(({ z }) => z);
    // round the eyes: the cells are fine enough to draw a post's shadow, and many
    const [x0, z0] = [Math.min(...xs) - LIGHTMAP.reach, Math.min(...zs) - LIGHTMAP.reach];
    const [x1, z1] = [Math.max(...xs) + LIGHTMAP.reach, Math.max(...zs) + LIGHTMAP.reach];
    const up = new Vector3(0, 1, 0);
    // the ground only: what stands on it - a crown, a roof - is not what the
    // light falls on, and under it the ground still takes the map
    const parts = GROUND_PARTS.flatMap(name => model.getObjectByName(name) ?? []);
    const inBounds = (triangles: Float32Array, margin = 1, inside = true) => {
      const within: number[] = [];
      for (let at = 0; at + 8 < triangles.length; at += 9) {
        const near = [0, 3, 6].some(k => {
          const [x, z] = [triangles[at + k] as number, triangles[at + k + 2] as number];
          return x > x0 - margin && x < x1 + margin && z > z0 - margin && z < z1 + margin;
        });
        if (near === inside) {
          within.push(...triangles.subarray(at, at + 9));
        }
      }
      return new Float32Array(within);
    };
    const top = new SunShadow(
      up,
      inBounds(new Float32Array(parts.flatMap(part => Array.from(worldTriangles(part)))))
    );
    // and what stands on it, seen from below: where its lowest reaches down
    // into the ground - a plinth, a wall, a trunk - the ground under it is
    // hidden, and dark, and the map's filtering would smear that dark out
    // over the ground beside it, a step each cell along the edge
    const below = new SunShadow(new Vector3(0, -1, 0), inBounds(worldTriangles(model, parts)));
    const covered = (x: number, z: number, y: number) => {
      const lowest = below.nearestOver(new Vector3(x, 0, z));
      return lowest !== undefined && -lowest < y + LIGHTMAP.covered;
    };
    // the sun's shadows on it drawn as finely as its cells, from what stands
    // round it, and those of everything further off - the hills, the far
    // woods - from a map of their own, as coarse as the valley is wide
    const [near, far] = [
      new SunShadow(sun, inBounds(drawn, LIGHTMAP.sunFrom)),
      new SunShadow(sun, inBounds(drawn, LIGHTMAP.sunFrom, false)),
    ];
    // the scene's shadows are as soft as so many of its map's cells: the
    // same width here in meters
    const soft = (map: SunShadow) => (softness * shadow.cell) / map.cell;
    const topAt = (x: number, z: number) => top.nearestOver(new Vector3(x, 0, z));
    const smoothAt = (x: number, z: number) => top.smoothOver(new Vector3(x, 0, z));
    const { cell } = LIGHTMAP;
    const [width, depth] = [Math.ceil((x1 - x0) / cell), Math.ceil((z1 - z0) / cell)];
    // the lamps' as the root of their share of the most; the sun's as it is
    const byte = (value: number, channel: number) =>
      Math.round(
        (channel === 2
          ? Math.min(Math.max(value, 0), 1)
          : Math.sqrt(Math.min(Math.max(value / LIGHTMAP.most, 0), 1))) * 255
      );
    const point = new Vector3();
    const facing = new Vector3();
    const held = new Vector3();
    const lifted = new Vector3();
    // the light at a place - warm, orange, how much of the sun, and the fires'
    // apart from the orange - or none where nothing is under it
    type Lit = [number, number, number, number];
    const lightAt = (x: number, z: number): Lit | undefined => {
      const y = topAt(x, z);
      if (y === undefined || covered(x, z, y)) {
        return undefined;
      }
      point.set(x, y, z);
      // the way it faces, from the heights either side
      const step = LIGHTMAP.slope;
      const [east, west] = [smoothAt(x + step, z) ?? y, smoothAt(x - step, z) ?? y];
      const [south, north] = [smoothAt(x, z + step) ?? y, smoothAt(x, z - step) ?? y];
      facing.set(-(east - west) / (2 * step), 1, -(south - north) / (2 * step)).normalize();
      held.copy(point).addScaledVector(facing, SHADOW_OFF);
      // the far map is coarse, and holds the terrain's big faces that reach
      // under the map from round it: looked at from a little way towards the
      // sun, the ground does not shade itself there, and a hill still does
      const sunlit = Math.min(
        near.lightAt(held, soft(near), facing),
        far.lightAt(lifted.copy(held).addScaledVector(sun, LIGHTMAP.farLift), soft(far), facing)
      );
      const lamped = nearLamps(point);
      if (lamped.length === 0) {
        return [0, 0, sunlit, 0];
      }
      return [
        lampLight(
          lamped.filter(lamp => !orange(lamp)),
          point,
          facing,
          reaching
        ),
        lampLight(
          lamped.filter(lamp => orange(lamp) && !burns(lamp)),
          point,
          facing,
          reaching
        ),
        sunlit,
        lampLight(lamped.filter(burns), point, facing, reaching),
      ];
    };
    // the light in the cells asked for - those under what the eye was left
    // seeing, and a couple round them, for the filtering - and no others
    const fill = (needed: Uint8Array) => {
      const channels = 4;
      const light = new Float32Array(width * depth * channels);
      const open = new Uint8Array(width * depth);
      for (let row = 0; row < depth; row += 1) {
        for (let column = 0; column < width; column += 1) {
          if (needed[row * width + column] !== 1) {
            continue;
          }
          const lit = lightAt(x0 + (column + 0.5) * cell, z0 + (row + 0.5) * cell);
          if (lit !== undefined) {
            light.set(lit, (row * width + column) * channels);
            open[row * width + column] = 1;
          }
        }
        if (row % 32 === 0) {
          progress?.(0.86 + (0.07 * row) / depth, 'lightmap');
        }
      }
      // a cell read at its middle alone draws a shadow thinner than a cell - a
      // post's - as a row of cells meeting at their corners, and the filtering
      // makes beads of them: where a cell and one round it differ, it takes
      // the mean of four looks spread across it, on a turned grid
      const centres = light.slice();
      const { edge } = LIGHTMAP;
      const differs = (a: number, b: number) =>
        Math.abs(a - b) > edge.least && Math.abs(a - b) > edge.share * Math.max(a, b);
      for (let row = 0; row < depth; row += 1) {
        for (let column = 0; column < width; column += 1) {
          const at = row * width + column;
          if (open[at] !== 1) {
            continue;
          }
          let edged = false;
          for (let dy = -1; dy <= 1 && !edged; dy += 1) {
            for (let dx = -1; dx <= 1 && !edged; dx += 1) {
              const [c, r] = [column + dx, row + dy];
              if (c < 0 || r < 0 || c >= width || r >= depth || open[r * width + c] !== 1) {
                continue;
              }
              const other = r * width + c;
              for (let k = 0; k < channels && !edged; k += 1) {
                edged = differs(
                  centres[at * channels + k] as number,
                  centres[other * channels + k] as number
                );
              }
            }
          }
          if (!edged) {
            continue;
          }
          const [x, z] = [x0 + (column + 0.5) * cell, z0 + (row + 0.5) * cell];
          const looks = EDGE_LOOKS.map(([dx, dz]) => lightAt(x + dx * cell, z + dz * cell)).filter(
            (look): look is Lit => look !== undefined
          );
          if (looks.length > 0) {
            for (let k = 0; k < channels; k += 1) {
              light[at * channels + k] =
                looks.reduce((sum, look) => sum + (look[k] as number), 0) / looks.length;
            }
          }
        }
        if (row % 32 === 0) {
          progress?.(0.93 + (0.03 * row) / depth, 'lightmap');
        }
      }
      // a covered cell takes the light of the open ones round it, twice over,
      // so what is filtered in at the edge is the ground's own
      for (let pass = 0; pass < 2; pass += 1) {
        const was = open.slice();
        for (let row = 0; row < depth; row += 1) {
          for (let column = 0; column < width; column += 1) {
            const at = row * width + column;
            if (was[at] === 1 || needed[at] !== 1) {
              continue;
            }
            const sums = [0, 0, 0];
            let count = 0;
            for (let dy = -1; dy <= 1; dy += 1) {
              for (let dx = -1; dx <= 1; dx += 1) {
                const [c, r] = [column + dx, row + dy];
                const other = r * width + c;
                if (c >= 0 && r >= 0 && c < width && r < depth && was[other] === 1) {
                  sums.forEach((_, k) => {
                    sums[k] = (sums[k] as number) + (light[other * channels + k] as number);
                  });
                  count += 1;
                }
              }
            }
            if (count > 0) {
              sums.forEach((sum, k) => {
                light[at * channels + k] = sum / count;
              });
              open[at] = 1;
            }
          }
        }
      }
      // cut to the cells asked for, and to the sun's channel alone where no
      // lamp lights: what is left out is nought, and packs to nothing
      let [c0, c1, r0, r1] = [width, -1, depth, -1];
      for (let row = 0; row < depth; row += 1) {
        for (let column = 0; column < width; column += 1) {
          if (needed[row * width + column] === 1) {
            [c0, c1, r0, r1] = [
              Math.min(c0, column),
              Math.max(c1, column),
              Math.min(r0, row),
              Math.max(r1, row),
            ];
          }
        }
      }
      if (c1 < c0) {
        return undefined;
      }
      // the fires' light gets its own channel only where one burns
      const kept = lamps.length > 0 ? (lamps.some(burns) ? [0, 1, 2, 3] : [0, 1, 2]) : [2];
      const [wide, deep] = [c1 - c0 + 1, r1 - r0 + 1];
      const data = new Uint8Array(wide * deep * kept.length);
      for (let row = 0; row < deep; row += 1) {
        for (let column = 0; column < wide; column += 1) {
          const from = ((row + r0) * width + column + c0) * channels;
          kept.forEach((channel, k) => {
            data[(row * wide + column) * kept.length + k] = byte(
              light[from + channel] as number,
              channel
            );
          });
        }
      }
      return {
        header: {
          origin: rounded([x0 + c0 * cell, z0 + r0 * cell, 0]).slice(0, 2) as [number, number],
          cell,
          width: wide,
          depth: deep,
          channels: kept.length as 1 | 3 | 4,
          most: LIGHTMAP.most,
          warm: rounded(lampColor.toArray()),
          orange: rounded(lanternColor.toArray()),
          // the share of the sun's light a shadow takes, and towards it
          sun: rounded(sunLight.clone().multiplyScalar(strength).toArray()),
          toward: rounded(sun.toArray()),
        },
        data,
      };
    };
    return {
      grid: { x0, z0, cell, width, depth },
      fill,
      // whether a face takes it: facing up, and uppermost where it lies
      takes: (corner: Vector3) => {
        if (corner.x < x0 || corner.x > x1 || corner.z < z0 || corner.z > z1) {
          return false;
        }
        const y = topAt(corner.x, corner.z);
        return y !== undefined && Math.abs(y - corner.y) < LIGHTMAP.top;
      },
    };
  })();

  const groups = new Map<
    string,
    { group: Drawn; positions: number[]; colors: number[]; albedo: number[]; fire: number[] }
  >();
  const collectedFor = (group: Drawn) => {
    const key = JSON.stringify(group);
    const known = groups.get(key);
    if (known !== undefined) {
      return known;
    }
    const made = { group, positions: [], colors: [], albedo: [], fire: [] };
    groups.set(key, made);
    return made;
  };

  const add = (
    object: Mesh,
    geometry: BufferGeometry,
    material: Material,
    matrix: Matrix4,
    tint: Color | undefined,
    vehicle?: Vehicle
  ) => {
    const position = geometry.getAttribute('position') as
      BufferGeometry['attributes'][string] | undefined;
    // an empty mesh - the landfill, with nothing brushed on - has nothing to give
    if (position === undefined) {
      return;
    }
    const surface = material as Material & {
      color?: Color;
      flatShading?: boolean;
      vertexColors: boolean;
    };
    // a car's lamps shine at night, and are no more lit than they light
    const glow = vehicle?.night === true && object.name in GLOW;
    const lit = !(material instanceof MeshBasicMaterial) && !glow;
    // snow lies on a car's paint, roof and bonnet, as on any roof
    const snowy =
      snow > 0 &&
      takesSnow(material) &&
      (vehicle === undefined ? !snowless(object) : object.name === 'body');
    const flat = surface.flatShading === true;
    const double = material.side === DoubleSide;
    // a free view draws both sides of a two sided face as faces of their own,
    // each lit for its side, so that every face can be culled from behind
    // a fire's tongues are a group of their own, the fire's foot and height
    // with them, for the site to sway them as the editor does
    let flamed: Object3D | null = object;
    while (flamed !== null && flamed.name !== 'flame') {
      flamed = flamed.parent;
    }
    const foot = flamed?.getWorldPosition(new Vector3());
    const drawnAs: Drawn = {
      ...(foot === undefined
        ? {}
        : {
            flame: [...rounded(foot.toArray()), CAMPFIRE.flame.height] as [
              number,
              number,
              number,
              number,
            ],
          }),
      doubleSided: double && still && vehicle === undefined,
      ...(material.polygonOffset && vehicle === undefined
        ? { offset: [material.polygonOffsetFactor, material.polygonOffsetUnits] }
        : {}),
      ...(vehicle === undefined
        ? {}
        : {
            vehicle: {
              id: vehicle.id,
              behind: vehicle.behind,
              ahead: vehicle.ahead,
              ...(vehicle.steer === undefined ? {} : { steer: vehicle.steer }),
            },
          }),
      renderOrder: orderOf(object),
      ...(material.depthWrite ? {} : { decal: true }),
    };
    const collected = collectedFor(drawnAs);
    const mappedCollected = () => collectedFor({ ...drawnAs, mapped: true });
    const normal = geometry.getAttribute('normal');
    const color = geometry.getAttribute('color');
    const index = geometry.getIndex();
    const base = glow
      ? new Color(GLOW[object.name])
      : (surface.color ?? new Color(1, 1, 1)).clone();
    if (tint !== undefined) {
      base.multiply(tint);
    }
    const normalMatrix = new Matrix3().getNormalMatrix(matrix);
    // a mirroring matrix turns the winding round, as three.js takes it - and
    // is written the right way round, so the front is counter clockwise
    const mirrored = matrix.determinant() < 0;
    const count = index === null ? position.count : index.count;
    const at = (step: number) => (index === null ? step : index.getX(step));
    for (let first = 0; first + 2 < count; first += 3) {
      const corners = [0, 1, 2].map(k =>
        new Vector3().fromBufferAttribute(position, at(first + k)).applyMatrix4(matrix)
      );
      const [a, b, c] = corners as [Vector3, Vector3, Vector3];
      const face = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      if (mirrored) {
        face.negate();
      }
      // the sides of it any eye sees - within its width and depth - and a
      // face is never drawn from behind unless it is drawn on both sides; a
      // free view may see either side from anywhere
      const seenFrom = new Set(
        (vehicle === undefined ? eyes : []).flatMap(({ at: from, toEye }) => {
          const seen = corners.map(corner => corner.clone().applyMatrix4(toEye));
          return seen.every(corner => corner.length() > view.far) || !spans(seen, half)
            ? []
            : [face.dot(a.clone().sub(from)) >= 0];
        })
      );
      const sides =
        vehicle !== undefined
          ? double
            ? [false, true]
            : [false]
          : view.kind === 'free'
            ? double
              ? [false, true]
              : [false]
            : [...seenFrom].filter(back => double || !back);
      if (sides.length === 0) {
        continue;
      }
      // a face looking up at the sky, uppermost where it lies, takes the
      // lamps' light off the lightmap: its corners carry only the sun's.
      // Uppermost anywhere will do - a face running on under a wall or a
      // fill is seen only where it is uppermost, and there the map is its
      // own - and a corner is looked at a little into the face, or on the
      // edge of a fill it reads the ground below. Kept to its corners, such
      // a face smeared the rail's shadow across it in wedges
      const middle = corners
        .reduce((sum, corner) => sum.add(corner), new Vector3())
        .divideScalar(corners.length);
      const mapped =
        lit && lightmap !== undefined && vehicle !== undefined
          ? true
          : lit &&
            lightmap !== undefined &&
            face.y > LIGHTMAP.up &&
            [middle, ...corners.map(corner => corner.clone().lerp(middle, LIGHTMAP.inset))].some(
              point => lightmap.takes(point)
            );
      const lighting = mapped ? sunAt : lightAt;
      const target = mapped ? mappedCollected() : collected;
      // each corner as it is coloured before the light: its place, its
      // colour with the snow laid on, and the way it faces
      const prepared = [0, 1, 2].map(k => {
        const vertex = at(first + k);
        const shade = base.clone();
        if (surface.vertexColors && color !== undefined) {
          shade.multiply(new Color().fromBufferAttribute(color, vertex));
        }
        // shaded a face at a time, or smooth by its own normal
        const facing =
          flat || normal === undefined
            ? face.clone()
            : new Vector3()
                .fromBufferAttribute(normal, vertex)
                .applyMatrix3(normalMatrix)
                .normalize();
        // snow on what faces up, as the scene's shader lays it - before the
        // light, which lights the snow as it lights the rest
        if (lit && snowy) {
          shade.lerp(palette.snow, snowOn(material, facing.y) * snow);
        }
        const corner = corners[k] as Vector3;
        return {
          corner,
          shade,
          facing,
          light: lit ? lighting(corner, facing) : { sun: 1, warm: 0, orange: 0, fire: 0 },
        };
      }) as [Corner3, Corner3, Corner3];
      // split where a shadow's edge runs across it, until the pieces are small
      const longest = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
      const near = splitNear.some(from => from.distanceTo(a) < SPLIT.within + longest);
      const pieces =
        lit && vehicle === undefined && near && longest > SPLIT.only
          ? split(prepared, lighting, 0, lampNear)
          : [prepared];

      sides.forEach(back => {
        // the corners in the order that faces the side drawn
        const order = mirrored !== back ? [0, 2, 1] : [0, 1, 2];
        pieces.forEach(piece =>
          order.forEach(k => {
            const { corner, shade, facing, light: reached } = piece[k] as Corner3;
            target.positions.push(corner.x, corner.y, corner.z);
            if (mapped) {
              // what the lamps' light is laid on, as the canvas takes colours
              const albedo = shade.getRGB(new Color(), 'srgb');
              target.albedo.push(
                ...[albedo.r, albedo.g, albedo.b].map(value =>
                  Math.round(Math.min(Math.max(value, 0), 1) * 255)
                )
              );
            }
            // the back of a face drawn on both sides lit on that side, the
            // lamps worked out for it again: they light what faces them
            const behind = facing.clone().negate();
            const here =
              back && vehicle === undefined
                ? { sun: reached.sun, ...lampsAt(corner, behind) }
                : reached;
            const light = lit
              ? shade.clone().multiply(lightOf(back ? behind : facing, here))
              : shade;
            target.fire.push(lit ? Math.round(fireShare(shade, here, light) * 255) : 0);
            const srgb = light.getRGB(new Color(), 'srgb');
            target.colors.push(
              ...[srgb.r, srgb.g, srgb.b].map(value =>
                Math.round(Math.min(Math.max(value, 0), 1) * 255)
              )
            );
          })
        );
      });
    }
  };

  model.updateMatrixWorld(true);
  // lighting the triangles is most of the bake: counted so it can say how far
  let [lit, toLight] = [0, 0];
  model.traverse(object => {
    if (object instanceof Mesh && shown(object)) {
      toLight += object instanceof InstancedMesh ? object.count : 1;
    }
  });
  const lighting = () => {
    lit += 1;
    if (lit % 64 === 0) {
      progress?.(0.1 + (0.75 * lit) / Math.max(toLight, 1), 'lighting');
    }
  };
  model.traverse(object => {
    if (!(object instanceof Mesh) || !shown(object)) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const material = materials[0] as Material | undefined;
    if (material === undefined || !material.visible) {
      return;
    }
    if (object instanceof InstancedMesh) {
      const instance = new Matrix4();
      Array.from({ length: object.count }, (_, step) => {
        object.getMatrixAt(step, instance);
        const tint =
          object.instanceColor === null
            ? undefined
            : new Color().fromBufferAttribute(object.instanceColor, step);
        add(object, object.geometry, material, object.matrixWorld.clone().multiply(instance), tint);
        lighting();
      });
      return;
    }
    add(object, object.geometry, material, object.matrixWorld, undefined);
    lighting();
  });
  // the cars that drive the road, as they stand at the origin - where the road is among what is shown
  const road = ROAD;
  // the ways the cars take, each cut to the part the view sees: a car is sent
  // from where it comes into sight, not from the end of the road
  // what hides the road from the eye: what is solid - the ground, the houses,
  // the walls and decks - not what a car is seen through or past: railings,
  // posts, lamps, trunks and crowns, garden things. With those too the road
  // of the winter's street view was hidden from 53m on, where it is seen to
  // 174m
  const blocking = new Triangles(
    worldTriangles(
      model,
      SEE_THROUGH.flatMap(name => model.getObjectByName(name) ?? [])
    )
  );
  const routes =
    cars !== undefined && shown(cars) && road !== undefined
      ? ([1, -1] as const).flatMap(dir => {
          const whole = driveRoute(dir).map(
            ([x, y]) =>
              [
                Math.round(x * 100) / 100,
                Math.round(road.level(x, y) * 100) / 100,
                Math.round(-y * 100) / 100,
              ] as [number, number, number]
          );
          const stretch = seenStretch(whole, eyes, view, start.pivot, blocking);
          return stretch === undefined ? [] : [whole.slice(stretch[0], stretch[1] + 1)];
        })
      : [];
  // how the road falls to the right of the way at each point, a meter across
  const tilts = routes.map(route =>
    route.map(([x, , z], index) => {
      const [from, to] = [
        route[Math.max(index - 1, 0)] as [number, number, number],
        route[Math.min(index + 1, route.length - 1)] as [number, number, number],
      ];
      const reach = Math.hypot(to[0] - from[0], to[2] - from[2]) || 1;
      // to the right of the way, in the plan: the scene's (-dz, dx)
      const [rx, rz] = [-(to[2] - from[2]) / reach, (to[0] - from[0]) / reach];
      const level = (along: number) => road?.level(x + rx * along, -(z + rz * along)) ?? 0;
      return round3((level(1) - level(-1)) / 2);
    })
  );
  const driving = routes.length > 0;
  const night = lanternsIn(view);
  const lampsOf: Record<string, { nose: number; apart: number }> = {};
  const sizesOf: Record<string, { length: number; width: number }> = {};
  if (driving) {
    DRIVERS.forEach(({ make, spec, lamps }) => {
      const car = make(palette);
      lampsOf[car.name] = lamps;
      // the body a little wider than its wheels' track
      sizesOf[car.name] = { length: spec.length, width: round3(spec.track + 0.2) };
      car.updateMatrixWorld(true);
      const vehicle: Vehicle = {
        id: car.name,
        behind: spec.axles[0] - spec.length / 2,
        ahead: spec.axles[1] - spec.length / 2,
        night,
      };
      car.traverse(object => {
        if (object instanceof Mesh) {
          // a part of a front wheel turns about the wheel's middle
          const wheel = object.parent?.userData['steer'] === undefined ? undefined : object.parent;
          add(
            object,
            object.geometry,
            object.material as Material,
            object.matrixWorld,
            undefined,
            wheel === undefined
              ? vehicle
              : {
                  ...vehicle,
                  steer: wheel.position.toArray().map(round3) as [number, number, number],
                }
          );
        }
      });
    });
  }
  progress?.(0.85, 'what the eye sees');

  // what is wholly behind something else goes too, where the eye never moves
  const collected = [...groups.values()];
  const triangles = collected
    .filter(({ group }) => group.vehicle === undefined)
    .flatMap(({ group, positions }) =>
      Array.from({ length: positions.length / 9 }, (_, triangle) => ({
        corners: [0, 1, 2].map(k => new Vector3().fromArray(positions, triangle * 9 + k * 3)) as [
          Vector3,
          Vector3,
          Vector3,
        ],
        pulled: group.offset !== undefined,
      }))
    );
  const visible =
    eyes.length === 0
      ? triangles.map(() => true)
      : yield {
          eyes: eyes.map(({ at, forward }) => ({ at, forward })),
          triangles,
          size: still ? undefined : PATH_RESOLUTION,
        };
  let seenSoFar = 0;
  collected.forEach(entry => {
    // a car is wherever it drives: nothing hides it
    if (entry.group.vehicle !== undefined) {
      return;
    }
    const count = entry.positions.length / 9;
    const kept = Array.from({ length: count }, (_, triangle) => triangle).filter(
      triangle => visible[seenSoFar + triangle]
    );
    seenSoFar += count;
    entry.positions = kept.flatMap(triangle =>
      entry.positions.slice(triangle * 9, triangle * 9 + 9)
    );
    entry.colors = kept.flatMap(triangle => entry.colors.slice(triangle * 9, triangle * 9 + 9));
    entry.fire = kept.flatMap(triangle => entry.fire.slice(triangle * 3, triangle * 3 + 3));
    entry.albedo =
      entry.albedo.length === 0
        ? []
        : kept.flatMap(triangle => entry.albedo.slice(triangle * 9, triangle * 9 + 9));
  });

  // the lightmap only where it is looked at: the cells under what the eye
  // was left seeing that takes it, and two round them for the filtering
  const filled = (() => {
    if (lightmap === undefined) {
      return undefined;
    }
    const { x0, z0, cell, width, depth } = lightmap.grid;
    const needed = new Uint8Array(width * depth);
    const margin = LIGHTMAP.margin;
    collected
      .filter(({ group }) => group.mapped === true && group.vehicle === undefined)
      .forEach(({ positions }) => {
        for (let at = 0; at + 8 < positions.length; at += 9) {
          const columns = [0, 3, 6].map(k => ((positions[at + k] as number) - x0) / cell);
          const rows = [0, 3, 6].map(k => ((positions[at + k + 2] as number) - z0) / cell);
          const [ax, bx, cx] = columns as [number, number, number];
          const [ay, by, cy] = rows as [number, number, number];
          const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
          const [c0, c1] = [
            Math.max(Math.floor(Math.min(...columns)) - margin, 0),
            Math.min(Math.ceil(Math.max(...columns)) + margin, width - 1),
          ];
          const [r0, r1] = [
            Math.max(Math.floor(Math.min(...rows)) - margin, 0),
            Math.min(Math.ceil(Math.max(...rows)) + margin, depth - 1),
          ];
          for (let row = r0; row <= r1; row += 1) {
            for (let column = c0; column <= c1; column += 1) {
              // inside the triangle, grown by the margin: how far outside
              // each edge a cell's middle lies, in cells
              const [px, py] = [column + 0.5, row + 0.5];
              const inside = [
                [ax, ay, bx, by],
                [bx, by, cx, cy],
                [cx, cy, ax, ay],
              ].every(([ux, uy, vx, vy]) => {
                const [ex, ey] = [(vx as number) - (ux as number), (vy as number) - (uy as number)];
                const length = Math.hypot(ex, ey) || 1;
                const side =
                  (ex * (py - (uy as number)) - ey * (px - (ux as number))) * Math.sign(area);
                return side / length > -(margin + 0.71);
              });
              if (inside || Math.abs(area) < 1e-9) {
                needed[row * width + column] = 1;
              }
            }
          }
        }
      });
    return lightmap.fill(needed);
  })();

  // every vertex alike in where it is and what colour is shared
  const baked = collected
    .filter(({ positions }) => positions.length > 0)
    .map(({ group, positions, colors, albedo, fire }) => {
      const shared = new Map<string, number>();
      // a fire's share is written only for a group one lights at all
      const fired = fire.some(share => share > 0);
      const vertices = {
        positions: [] as number[],
        colors: [] as number[],
        albedo: [] as number[],
        fire: [] as number[],
      };
      const indices = Array.from({ length: positions.length / 3 }, (_, vertex) => {
        const at = vertex * 3;
        const position = positions.slice(at, at + 3);
        const color = colors.slice(at, at + 3);
        const under = albedo.slice(at, at + 3);
        const share = fired ? (fire[vertex] as number) : 0;
        const key = [...position.map(value => value.toFixed(4)), ...color, ...under, share].join(
          ','
        );
        const known = shared.get(key);
        if (known !== undefined) {
          return known;
        }
        const index = vertices.positions.length / 3;
        shared.set(key, index);
        vertices.positions.push(...position);
        vertices.colors.push(...color);
        vertices.albedo.push(...under);
        if (fired) {
          vertices.fire.push(share);
        }
        return index;
      });
      return { group: fired ? { ...group, fire: true } : group, ...vertices, indices };
    })
    // drawn in the order they are to be drawn: the ground first, what lies on it after
    .sort((one, other) => one.group.renderOrder - other.group.renderOrder);

  progress?.(0.97, 'writing');
  // the positions on a grid of 65535 steps across all that is kept: floats
  // do not pack, and were most of a view's file
  const grid = (() => {
    const [least, most] = [0, 1].map(end =>
      [0, 1, 2].map(axis =>
        baked.reduce(
          (found, { positions }) => {
            for (let at = axis; at < positions.length; at += 3) {
              const value = positions[at] as number;
              found = end === 0 ? Math.min(found, value) : Math.max(found, value);
            }
            return found;
          },
          end === 0 ? Infinity : -Infinity
        )
      )
    ) as [number[], number[]];
    const origin = least.map(value => (Number.isFinite(value) ? value : 0)) as [
      number,
      number,
      number,
    ];
    const step = origin.map((value, axis) =>
      Math.max(((most[axis] as number) - value) / 65535, 1e-6)
    ) as [number, number, number];
    return { origin, step };
  })();
  const onGrid = (positions: number[]) => {
    const steps = new Uint16Array(positions.length);
    for (let at = 0; at < positions.length; at += 1) {
      const axis = at % 3;
      const value = Math.round(
        ((positions[at] as number) - (grid.origin[axis] as number)) / (grid.step[axis] as number)
      );
      steps[at] = Math.min(Math.max(value, 0), 65535);
    }
    // each the step from the vertex before, which is near it
    for (let at = steps.length - 1; at >= 3; at -= 1) {
      steps[at] = ((steps[at] as number) - (steps[at - 3] as number)) & 0xffff;
    }
    return steps;
  };
  const header: PrefabHeader = {
    version: 4,
    grid,
    kind: view.kind,
    camera,
    groups: baked.map(({ group, positions, indices }) => ({
      ...group,
      vertices: positions.length / 3,
      indices: indices.length,
    })),
    sky: {
      zenith: srgb(sky.zenith),
      horizon: srgb(sky.horizon),
      sun: rounded(sun.toArray()),
      sunColor: srgb(sky.sun.color),
      hazeReach: sky.hazeReach,
      hazeMost: sky.hazeMost,
      clouds: {
        cover: sky.clouds.cover,
        lit: srgb(sky.clouds.lit),
        shade: srgb(sky.clouds.shade),
      },
    },
    ...(filled === undefined ? {} : { lightmap: filled.header }),
    ...(driving && road !== undefined
      ? {
          vehicles: {
            routes,
            speed: TRAFFIC.speed,
            ...(night ? { lamps: { cars: lampsOf, ...HEADLAMP } } : {}),
            every: [TRAFFIC.every.least, TRAFFIC.every.most] as [number, number],
            sizes: sizesOf,
            ...(marked
              ? {
                  marks: {
                    tilts,
                    // a fresh track's colour over the snow's, as createTracks() has it
                    tint: srgb(
                      palette.road.clone().lerp(palette.snow, 0.72 - 0.5 * MARKS.fresh)
                    ).map((value, channel) =>
                      round3(value / Math.max(srgb(palette.snow)[channel] ?? 1, 1e-3))
                    ) as [number, number, number],
                    tyre: MARKS.tyre,
                    life: MARKS.life,
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(view.season === 'autumn' || view.season === 'winter'
      ? {
          drift: {
            ...DRIFT[view.season],
            colors: (view.season === 'winter'
              ? [palette.snow]
              : [palette.autumnGold, palette.autumnOrange, palette.autumnRust]
            ).map(srgb),
          },
        }
      : {}),
  };

  const padded = (length: number) => Math.ceil(length / 4) * 4;
  const wide = (vertices: number) => vertices > 0xffff;
  let json = JSON.stringify(header);
  json += ' '.repeat(padded(json.length) - json.length);
  const text = new TextEncoder().encode(json);
  const size =
    8 +
    text.byteLength +
    baked.reduce(
      (sum, { positions, albedo, fire, indices }) =>
        sum +
        padded(positions.length * 2) +
        padded(positions.length) +
        padded(albedo.length) +
        padded(fire.length) +
        padded(indices.length * (wide(positions.length / 3) ? 4 : 2)),
      0
    ) +
    padded(filled?.data.length ?? 0);
  const buffer = new ArrayBuffer(size);
  const bytes = new Uint8Array(buffer);
  bytes.set(new TextEncoder().encode('KVLM'), 0);
  new DataView(buffer).setUint32(4, text.byteLength, true);
  bytes.set(text, 8);
  let offset = 8 + text.byteLength;
  baked.forEach(({ positions, colors, albedo, fire, indices }) => {
    new Uint16Array(buffer, offset, positions.length).set(onGrid(positions));
    offset += padded(positions.length * 2);
    new Uint8Array(buffer, offset, colors.length).set(colors);
    offset += padded(colors.length);
    new Uint8Array(buffer, offset, albedo.length).set(albedo);
    offset += padded(albedo.length);
    new Uint8Array(buffer, offset, fire.length).set(fire);
    offset += padded(fire.length);
    const Indices = wide(positions.length / 3) ? Uint32Array : Uint16Array;
    // typed arrays wrap what does not fit, which is what makes a step back fit
    new Indices(buffer, offset, indices.length).set(
      indices.map((index, step) => index - (indices[step - 1] ?? 0))
    );
    offset += padded(indices.length * Indices.BYTES_PER_ELEMENT);
  });
  if (filled !== undefined) {
    new Uint8Array(buffer, offset, filled.data.length).set(filled.data);
  }
  if (marked) {
    tracks.visible = true;
  }
  return buffer;
}
