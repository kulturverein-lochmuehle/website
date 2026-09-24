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
import { nearestOn, once, pointKey, resample } from '../../utils/geometry.utils.js';
import { liftsAlong, SEAM_PICKS, WALL_RUNS } from '../seam/seam.js';
import { CORRIDORS, eased, footAt, LEVEL_OF, terraceAt, WAY_KERBS } from '../terrain/ground.js';
import { slab } from '../terrain/surfaces.js';
import type { Corridor } from '../terrain/terrain.field.js';
import { FLOOR_ON, profileOf, ROADS } from '../terrain/terrain.field.js';
import { CROSSING, MILL_ROAD_DECK, MILL_SIDE_DECK } from './crossings.js';
import { UNDER_DECK, UNDER_ROAD, WALL_STEP } from './measures.js';

export function createCulvert(palette: Palette): Group {
  const group = new Group();
  group.name = 'culvert';

  const index = ROADS.findIndex(({ main }) => main);
  const road = CORRIDORS[index] as Corridor;
  const brook = CORRIDORS[CORRIDORS.length - 1] as Corridor;
  const roadLevel = profileOf(road);
  const brookLevel = profileOf(brook);

  const material = new MeshLambertMaterial({
    color: palette.wallAccent,
    flatShading: true,
    side: DoubleSide,
  });

  // the wall reads its two heights off lines that bend as the road does, so it
  // is drawn in short steps: over a run of several meters a straight top edge
  // cuts through the carriageway it is meant to sit under
  const runs = WALL_RUNS.map(line => resample(line, WALL_STEP));

  // all of it is one structure: the same wall, drawn as one mesh
  const positions: number[] = [];
  const indices: number[] = [];
  runs.forEach(line => {
    const offset = positions.length / 3;
    const lifts = liftsAlong(line);
    line.forEach(([x, y], step) => {
      const lift = lifts[step] as number;
      positions.push(x, footAt(x, y, terraceAt(x, y) ?? brookLevel(x, y)) + lift, -y);
      // and never through a deck lying over it
      const deck = DECK_TOP()(x, y);
      const top = roadLevel(x, y) - UNDER_ROAD + lift;
      positions.push(x, deck === undefined ? top : Math.min(top, deck - UNDER_DECK), -y);
    });
    Array.from({ length: line.length - 1 }, (_, step) => {
      const [a, b] = [offset + step * 2, offset + step * 2 + 1];
      indices.push(a, b, b + 2, a, b + 2, a + 2);
    });
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const walls = new Mesh(geometry, material);
  walls.name = 'crossing-walls';
  group.add(walls);

  const over = CROSSING.plate;
  if (over.length > 2) {
    const laid = new BufferGeometry();
    laid.setAttribute('position', new Float32BufferAttribute(DECKS().plate, 3));
    laid.computeVertexNormals();
    const deck = new Mesh(laid, material);
    deck.name = 'crossing-deck';
    group.add(deck);
  }

  return group;
}

/**
 * The height the side half's edge holds all round: traced from handle to
 * handle the way a seam is, lifts and all, so that where a seam runs along it
 * - the mill's, over the lane's end - the ground and the deck hold one height.
 * Worked out on first use: the handles and the trace come later than the ring.
 */
const MILL_SIDE_LEVEL = once(() => {
  const ring = MILL_SIDE_DECK;
  const corners = ring.flatMap((point, step) => {
    const handle = SEAM_PICKS.find(
      ({ at, edge }) =>
        (edge === 'top' || edge === 'road') && Math.hypot(at[0] - point[0], at[1] - point[1]) < 1e-6
    );
    return handle === undefined ? [] : [{ handle, step }];
  });
  // leg by leg, on the ring's own points stepped every meter: read off the
  // nearest point of the whole trace instead, a point on the joint just past
  // 69 took the lift of the leg back to 5 - a ridge 1cm high along the joint
  const known = new Map<string, { at: Point; level: number }>();
  corners.forEach(({ handle, step }, leg) => {
    const next = corners[(leg + 1) % corners.length];
    if (next === undefined) {
      return;
    }
    const stretch =
      next.step > step
        ? ring.slice(step, next.step + 1)
        : [...ring.slice(step), ...ring.slice(0, next.step + 1)];
    eased(handle, next.handle, resample(stretch, WALL_STEP)).forEach(point =>
      known.set(pointKey(point.at), point)
    );
  });
  return known;
});

/**
 * The surfaces of the decks and plates, worked out once: the scene draws them,
 * and the walls under them read them so as to stay under their tops.
 */
const DECKS = once(() => {
  const index = ROADS.findIndex(({ main }) => main);
  const roadLevel = profileOf(CORRIDORS[index] as Corridor);
  /**
   * Where a deck's edge lies on a kerb it is no lower than the road's edge,
   * the way the ground there is not: 2cm under it by the road's rule, the
   * ground's edge left the kerb 2cm over the deck's and met it only at the
   * next corner, a thin wedge of sky along the deck's edge. Inside the kerb it
   * stays under the road.
   */
  const kerbed =
    (top: (point: Point) => number) =>
    (point: Point): number =>
      WAY_KERBS.reduce(
        (height, { points, level }) =>
          nearestOn(points, point[0], point[1]).distance <= FLOOR_ON
            ? Math.max(height, level(point[0], point[1]))
            : height,
        top(point)
      );
  const plate =
    CROSSING.plate.length > 2
      ? slab(
          CROSSING.plate,
          kerbed(point => roadLevel(point[0], point[1]) - UNDER_ROAD)
        )
      : [];
  if (MILL_ROAD_DECK.length < 3) {
    return { mill: [] as number[], plate };
  }
  // cut up finely, the way the southern plate is: under the road each point
  // of it at the road's own level, so it follows the road over every bend
  const road = slab(
    MILL_ROAD_DECK,
    kerbed(point => roadLevel(point[0], point[1]) - UNDER_ROAD)
  );

  // and beside it at the heights its edge is traced to, eased across between
  // them over what the road would give there
  const known = MILL_SIDE_LEVEL();
  const edge = (x: number, y: number) =>
    known.get(pointKey([x, y]))?.level ??
    // between the stepped points, where none should be asked for
    LEVEL_OF.top([x, y]);
  const closed = [...MILL_SIDE_DECK, MILL_SIDE_DECK[0] as Point];
  const rim = [...known.values()].map(({ at: point, level }) => ({
    point,
    off: level - LEVEL_OF.top(point),
  }));
  const side = slab(
    // stepped the way the seams along it are, so its edge has the ground's own
    // points: every 1.5m, straight between, it stood up to 7mm off the ground's
    resample(closed, WALL_STEP).slice(0, -1),
    kerbed(point => {
      if (nearestOn(closed, point[0], point[1]).distance < 1e-3) {
        return edge(point[0], point[1]);
      }
      const [sum, weight] = rim.reduce(
        ([total, weights], { point: at, off }) => {
          const w = 1 / ((at[0] - point[0]) ** 2 + (at[1] - point[1]) ** 2);
          return [total + off * w, weights + w];
        },
        [0, 0]
      );
      return LEVEL_OF.top(point) + sum / weight;
    })
  );

  return { mill: [...road, ...side], plate };
});

/**
 * The top of whichever deck or plate lies over a point, if one does. A wall
 * topped out by the road's rule stood up to 5.9cm through the mill's side half,
 * whose top is eased between its edges rather than read off the road.
 */
const DECK_TOP = once(() => {
  const { mill, plate } = DECKS();
  const faces = [...mill, ...plate];
  const cell = 2;
  const grid = new Map<string, number[]>();
  for (let face = 0; face < faces.length / 9; face++) {
    const xs = [0, 1, 2].map(k => faces[face * 9 + k * 3] as number);
    const ys = [0, 1, 2].map(k => -(faces[face * 9 + k * 3 + 2] as number));
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
  return (x: number, y: number): number | undefined =>
    (grid.get(`${Math.floor(x / cell)}:${Math.floor(y / cell)}`) ?? []).reduce<number | undefined>(
      (top, face) => {
        const [ax, ah, az, bx, bh, bz, cx, ch, cz] = faces.slice(
          face * 9,
          face * 9 + 9
        ) as number[];
        const [ay, by, cy] = [-(az as number), -(bz as number), -(cz as number)];
        const d =
          (by - cy) * ((ax as number) - (cx as number)) +
          ((cx as number) - (bx as number)) * (ay - cy);
        if (Math.abs(d) < 1e-12) {
          return top;
        }
        const l1 =
          ((by - cy) * (x - (cx as number)) + ((cx as number) - (bx as number)) * (y - cy)) / d;
        const l2 =
          ((cy - ay) * (x - (cx as number)) + ((ax as number) - (cx as number)) * (y - cy)) / d;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) {
          return top;
        }
        const height = l1 * (ah as number) + l2 * (bh as number) + l3 * (ch as number);
        return top === undefined ? height : Math.max(top, height);
      },
      undefined
    );
});

/**
 * The deck at the mill, in two: the road runs over one half and the other lies
 * beside it, meeting on a seam. The half under the road is set out on its own
 * ring (`MILL_ROAD_DECK`) and cut the way the southern plate is; the half beside
 * it is still to be set out. The deck read off the map before stood 4cm under
 * the ground's edge where a seam ran along it: its edges ran straight between
 * its corners, their heights with them, and its two halves stepped 4mm to 7mm
 * where they met.
 */
export function createDeck(palette: Palette): Group {
  const group = new Group();
  group.name = 'deck';
  if (DECKS().mill.length === 0) {
    return group;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(DECKS().mill, 3));
  geometry.computeVertexNormals();
  group.add(
    new Mesh(
      geometry,
      new MeshLambertMaterial({ color: palette.wallAccent, flatShading: true, side: DoubleSide })
    )
  );
  return group;
}
