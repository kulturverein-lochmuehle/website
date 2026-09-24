import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshLambertMaterial,
  Vector3,
} from 'three';

import type { Point } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import { strut } from '../../utils/mesh.utils.js';
import type { PlaceKey } from '../places/places.js';
import { placeOutline } from '../places/places.js';
import type { Keepout } from './area.js';
import { depthIn, inFrame, longestEdge, surfaceAt } from './area.js';

/**
 * The beer-tent sets ("Bierzeltgarnitur") put out for an event: a table and
 * two benches along it, boards of pale spruce on folding frames of steel tube
 * - at either end of each board a pair of legs splayed out towards the
 * ground, a tube across them a hand over it, a brace from the frame up to the
 * board's underside towards its middle, and a batten across under the board
 * the frame folds on - set out in rows over an area - along its longest edge, each set
 * `margin` off the edges and `clear` off a fire, the bar, a wall. A set stands
 * on whatever is under each foot, so its legs are as long as that needs and
 * its boards level; one the ground falls away under by more than `slope` is
 * left out. Where more would fit than `most`, the sets are thinned evenly.
 */
export const SEATING = {
  table: { length: 2.2, width: 0.5, height: 0.76, board: 0.04 },
  /** The benches' seats, and how far their middles stand from the table's. */
  bench: { length: 2.2, width: 0.25, height: 0.47, board: 0.035, apart: 0.44 },
  /**
   * The frames' tube, how far in from the boards' ends they stand, and how far
   * apart a pair of legs is under the board and on the ground - the table's,
   * then a bench's: splayed, never crossed. And how high the tube across them
   * is, how far in along the board its brace reaches, and the batten under it.
   */
  leg: {
    tube: 0.025,
    inset: 0.28,
    table: [0.4, 0.46],
    bench: [0.16, 0.22],
    across: 0.1,
    brace: 0.4,
    batten: [0.05, 0.03],
  },
  margin: 0.6,
  clear: 0.8,
  /** How far along a row the sets' middles are apart, and how far across from row to row. */
  pitch: [2.7, 2.3],
  slope: 0.2,
  most: 10,
} as const;

/** The areas sets are put out in, by the tag that shows them. */
export const SEATED = {
  'baenke-werkstatt-vorplatz': 'werkstatt-vorplatz',
  'baenke-muehle-vorplatz': 'muehle-vorplatz',
  'baenke-terrasse-pavillon': 'terrasse-pavillon',
} as const satisfies Record<string, PlaceKey>;

/** One set as it stands: its middle, which way the table runs, where its feet are, and how high it stands - the highest of the ground under its feet. */
export interface Garnitur {
  at: Point;
  along: Point;
  feet: Point[];
  base: number;
}

/** A board of a set: how far across from the table's middle it lies, how wide and how high its top is, and its frames' spread. */
interface Board {
  middle: number;
  width: number;
  height: number;
  thick: number;
  spread: readonly [number, number];
}

/** The table's board and the two benches'. */
const BOARDS: Board[] = [
  {
    middle: 0,
    width: SEATING.table.width,
    height: SEATING.table.height,
    thick: SEATING.table.board,
    spread: SEATING.leg.table,
  },
  ...[-1, 1].map(side => ({
    middle: side * SEATING.bench.apart,
    width: SEATING.bench.width,
    height: SEATING.bench.height,
    thick: SEATING.bench.board,
    spread: SEATING.leg.bench,
  })),
];

/** The legs of a set, each from its top, a plan point and a height over the set's base, down to its foot on the plan: splayed out, as a frame unfolds. */
function legsOf(
  at: Point,
  along: Point
): { top: Point; up: number; foot: Point; board: Board; end: number }[] {
  const { table, leg } = SEATING;
  const reach = table.length / 2 - leg.inset;
  const at2 = (u: number, v: number) => inFrame(at, along, [u, v]);
  return [-1, 1].flatMap(end =>
    BOARDS.flatMap(board =>
      [-1, 1].map(cross => ({
        top: at2(end * reach, board.middle + cross * (board.spread[0] / 2)),
        up: board.height - board.thick - leg.batten[1],
        foot: at2(end * reach, board.middle + cross * (board.spread[1] / 2)),
        board,
        end,
      }))
    )
  );
}

/** The sets put out in an area, row by row along its longest edge. */
export function garnituren(place: PlaceKey, keepout: Keepout): Garnitur[] {
  const outline = placeOutline(place);
  if (outline === undefined) {
    return [];
  }
  const { table, bench, margin, clear, pitch, slope, most } = SEATING;
  const along = longestEdge(outline);
  const across: Point = [-along[1], along[0]];
  const us = outline.map(([x, y]) => x * along[0] + y * along[1]);
  const vs = outline.map(([x, y]) => x * across[0] + y * across[1]);
  const half: Point = [table.length / 2, bench.apart + bench.width / 2];
  const columns = Math.floor(
    (Math.max(...us) - Math.min(...us) - 2 * (margin + half[0])) / pitch[0]
  );
  const rows = Math.floor((Math.max(...vs) - Math.min(...vs) - 2 * (margin + half[1])) / pitch[1]);
  const origin: Point = [Math.min(...us) + margin + half[0], Math.min(...vs) + margin + half[1]];
  // the footprint, tried at its corners, its edges' middles and its centre
  const tried: Point[] = [-1, 0, 1].flatMap(u =>
    [-1, 0, 1].map((v): Point => [u * half[0], v * half[1]])
  );
  const found = Array.from({ length: Math.max(rows + 1, 0) }, (_, row) =>
    Array.from({ length: Math.max(columns + 1, 0) }, (_, column): Garnitur | undefined => {
      const [u, v] = [origin[0] + column * pitch[0], origin[1] + row * pitch[1]];
      const at: Point = [u * along[0] + v * across[0], u * along[1] + v * across[1]];
      const free = tried.every(offset => {
        const point = inFrame(at, along, offset);
        return depthIn(outline, point) >= margin && keepout(point) >= clear;
      });
      if (!free) {
        return undefined;
      }
      const feet = legsOf(at, along).map(({ foot }) => foot);
      const grounds = feet.map(([x, y]) => surfaceAt(x, y));
      const base = Math.max(...grounds);
      return base - Math.min(...grounds) > slope ? undefined : { at, along, feet, base };
    })
  )
    .flat()
    .filter((one): one is Garnitur => one !== undefined);
  const every = Math.max(Math.ceil(found.length / most), 1);
  return found.filter((_, index) => index % every === 0).slice(0, most);
}

/** A mesh of boxes put into a list of triangles. */
const meshOf = (positions: number[], material: MeshLambertMaterial): Mesh => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return new Mesh(geometry, material);
};

/** The sets of one area, as one group of two meshes: the boards and the legs. */
function setsOf(palette: Palette, sets: Garnitur[]): Group {
  const { table, leg } = SEATING;
  const group = new Group();
  // spruce, pale and a little yellow; the frames painted a mid grey
  const wood = new MeshLambertMaterial({
    color: palette.autumnGold.clone().lerp(palette.snow, 0.3),
    flatShading: true,
    side: DoubleSide,
  });
  const steel = new MeshLambertMaterial({
    color: palette.granite.clone().lerp(palette.sky, 0.05),
    flatShading: true,
    side: DoubleSide,
  });
  const boards: number[] = [];
  const legs: number[] = [];
  const world = ([x, y]: Point, height: number) => new Vector3(x, height, -y);
  const reach = table.length / 2 - leg.inset;
  sets.forEach(({ at, along, base }) => {
    const at2 = (u: number, v: number) => inFrame(at, along, [u, v]);
    BOARDS.forEach(({ middle, width, height, thick }) => {
      // the board, its top at its height
      strut(
        boards,
        world(at2(-table.length / 2, middle), base + height - thick / 2),
        world(at2(table.length / 2, middle), base + height - thick / 2),
        width,
        undefined,
        0,
        thick
      );
      // and under it at either end the batten its frame folds on
      [-1, 1].forEach(end =>
        strut(
          boards,
          world(
            at2(end * reach, middle - width / 2 + 0.01),
            base + height - thick - leg.batten[1] / 2
          ),
          world(
            at2(end * reach, middle + width / 2 - 0.01),
            base + height - thick - leg.batten[1] / 2
          ),
          leg.batten[0],
          undefined,
          0,
          leg.batten[1]
        )
      );
    });
    // each leg from under its batten down to whatever is under its foot
    const frames = legsOf(at, along);
    frames.forEach(({ top, up, foot }) =>
      strut(
        legs,
        world(top, base + up),
        world(foot, surfaceAt(foot[0], foot[1])),
        leg.tube,
        undefined,
        0,
        leg.tube
      )
    );
    // a pair's tube across a hand over the ground, and the brace from its
    // middle up to the board's underside, further in towards its middle
    BOARDS.forEach(board =>
      [-1, 1].forEach(end => {
        const pair = frames.filter(one => one.board === board && one.end === end);
        const [a, b] = pair.map(({ top, up, foot }) => {
          const ground = surfaceAt(foot[0], foot[1]);
          const share = leg.across / Math.max(base + up - ground, leg.across);
          return world(
            [foot[0] + (top[0] - foot[0]) * share, foot[1] + (top[1] - foot[1]) * share],
            ground + leg.across
          );
        });
        if (a === undefined || b === undefined) {
          return;
        }
        strut(legs, a, b, leg.tube, undefined, 0, leg.tube);
        const low = a
          .clone()
          .lerp(b, 0.5)
          .lerp(
            world(
              at2(end * reach, board.middle),
              base + board.height - board.thick - leg.batten[1]
            ),
            0.45
          );
        strut(
          legs,
          low,
          world(at2(end * (reach - leg.brace), board.middle), base + board.height - board.thick),
          leg.tube * 0.8,
          undefined,
          0,
          leg.tube * 0.8
        );
      })
    );
  });
  group.add(meshOf(boards, wood), meshOf(legs, steel));
  return group;
}

/** Every area's sets, each tagged: shown only where it is asked for. */
export function createSeating(palette: Palette, keepout: Keepout): Group[] {
  return (Object.keys(SEATED) as (keyof typeof SEATED)[]).map(tag => {
    const group = setsOf(palette, garnituren(SEATED[tag], keepout));
    group.name = tag;
    group.userData['decoration'] = tag;
    group.visible = false;
    return group;
  });
}
