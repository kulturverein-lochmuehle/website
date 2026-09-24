import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
} from 'three';

import type { BuildingData } from '../../data/data.js';
import { BUILDINGS } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import { heightAt } from '../terrain/ground.js';
import { ASIDE_HOUSE } from './aside.building.js';
import { boundingRect } from './footprint.js';
import { MILL_HOUSE } from './mill.building.js';
import type { Profile, Row } from './profile.js';
import { DEFAULT_PROFILE } from './profile.js';
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
  side: 1 | -1
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  openings.forEach(({ at, y, width: w, height, arch = 0 }) => {
    const offset = positions.length / 3;
    const skin = side * (reach + SKIN.opening);
    const corners = outline(w, height, arch);

    corners.forEach(([along, up]) => {
      // on a long facade the opening runs along x, on a gable along z
      const [x, z] = facade === 'long' ? [at + along, skin] : [skin, at * -side + along];
      positions.push(x, y + up, z);
    });
    // a fan from the first corner, which any of these outlines takes
    Array.from({ length: corners.length - 2 }, (_, step) =>
      indices.push(offset, offset + step + 1, offset + step + 2)
    );
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Puts a row where the drawing puts it. The survey measures along a facade from
 * its right hand end as the street sees it, the model from the middle.
 */
function spread(rows: Row[], span: number): Opening[] {
  const place = (from: number) => span / 2 - from;
  return rows.flatMap(({ windows, size, y, doors = [], door = [1, 2], arch = 0 }) => [
    ...windows.map((from): Opening => ({
      at: place(from),
      y,
      width: size[0],
      height: size[1],
    })),
    ...doors.map((from): Opening => ({
      at: place(from),
      y: door[1] / 2,
      width: door[0],
      height: door[1],
      arch,
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
  profile: Profile
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
    const opening = { at: x, y: stands + doorHeight / 2, width: doorWidth, height: doorHeight };
    glazing.push(new Mesh(createOpenings([opening], 'long', inner + depth, 1)));
  }

  if (window !== undefined) {
    const [windowWidth, windowHeight] = window.size;
    // the end wall that looks over the yard, halfway along its depth. The helper
    // measures a gable out from the middle of the house, so that wall's own
    // place stands in for the reach and the opening runs the other way along it
    const opening = {
      at: -(inner + depth / 2),
      y: window.y,
      width: windowWidth,
      height: windowHeight,
    };
    glazing.push(new Mesh(createOpenings([opening], 'gable', x + span / 2, 1)));
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

  // everything is measured from the lowest corner the footprint stands on
  const ground = Math.min(...data.footprint.map(([x, y]) => heightAt(x, y)));

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

  const walls = new Mesh(new BoxGeometry(length, eaves + SUNK, width), wallMaterial);
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
      site.add(slab);
    });

    doors.forEach(at => {
      // the notch behind the steps, as deep as the three of them need
      const notch = new Mesh(new BoxGeometry(flight, plinth, terrace.depth - 3 * tread), stone);
      notch.position.set(at, plinth / 2 - 0.02, width / 2 + (terrace.depth - 3 * tread) / 2);
      site.add(notch);

      Array.from({ length: 4 }, (_, step) => {
        const stair = new Mesh(new BoxGeometry(flight, rise * (step + 1), tread), stone);
        // the bottom step stands out onto the yard, the three above it climb
        // back into the notch, one tread each
        stair.position.set(at, (rise * (step + 1)) / 2, front + tread / 2 - step * tread);
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
  const glass = new MeshBasicMaterial({ color: palette.window, side: DoubleSide });

  if (profile.crossGable !== undefined || profile.leanTo !== undefined) {
    // the additions are the building's own wall and roof, only their gable and
    // wedge are single triangles and have to be seen from both sides
    const stone = wallMaterial.clone();
    stone.side = DoubleSide;
    const parts = [createCrossGable(length, width, profile), createLeanTo(length, width, profile)];
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
        panel.material = glass;
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

  // what a facade carries decides whether it is drawn, not how dark the house
  // is: the workshop is the dark one and still has a gate and its windows. The
  // street side of the mill faces the road, which its local +z does too, and
  // the framed gable is the one at local -x - the other end may differ
  const facades: [Opening[], Facade, number, 1 | -1][] = [
    [spread(profile.front, length), 'long', width / 2, 1],
    [spread(profile.rear, length), 'long', width / 2, -1],
    [spread(profile.farGable ?? profile.gable, width), 'gable', length / 2, 1],
    [spread(profile.gable, width), 'gable', length / 2, -1],
  ];
  facades
    .filter(([openings]) => openings.length > 0)
    .forEach(([openings, facade, reach, side]) =>
      building.add(new Mesh(createOpenings(openings, facade, reach, side), glass))
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

  return site;
}

/** The three buildings of the Lochmühle, nothing else in the valley is one. */
export function createBuildings(palette: Palette): Group {
  const group = new Group();
  group.name = 'buildings';
  BUILDINGS.forEach(data => group.add(createBuilding(data, palette)));
  return group;
}
