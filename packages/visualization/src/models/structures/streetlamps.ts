import type { Object3D } from 'three';
import {
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

import type { Point } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import { pickByKey } from '../seam/seam.js';
import { heightAt } from '../terrain/ground.js';
import { ROADS } from '../terrain/terrain.field.js';
import { hutRoofEdges } from './hut.js';

/**
 * The street lamps along the road, as the photographs of winter nights show
 * them: a tall thin mast at the road's edge, a short arm at its top reaching
 * out over the road and a small head, lighting the road in a warm pool - one
 * at the mill's east corner, one past its west end, and on up the valley at
 * wider spacing; down the road to the south there are none.
 */
export const STREET_LAMPS = {
  /**
   * Where the first stands: at the corner of the mill it is set by, on the
   * house's side of the road. The others stand along the road, as meters from
   * its northern end, and on up the valley every `every` meters from the last.
   */
  first: 'mill:1:top',
  along: [315, 210],
  every: 42,
  /** How tall the mast is, how far the arm reaches over the road, and how far off its edge it stands. */
  height: 7,
  arm: 1.1,
  off: 0.5,
  /** Which of them cast shadows: the ones round the yard. */
  shadowed: 2,
} as const;

/** The nearest point on the road's middle to a point. */
function nearestOnRoad([x, y]: Point): Point {
  const points = ROAD?.points ?? [];
  return points.slice(1).reduce<{ at: Point; distance: number }>(
    (best, b, index) => {
      const a = points[index] as Point;
      const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
      const t = Math.min(
        Math.max(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0),
        1
      );
      const at: Point = [a[0] + dx * t, a[1] + dy * t];
      const distance = Math.hypot(at[0] - x, at[1] - y);
      return distance < best.distance ? { at, distance } : best;
    },
    { at: [x, y], distance: Infinity }
  ).at;
}

/** The road the lamps stand along, the main one. */
const ROAD = ROADS.find(({ width }) => width > 4) ?? ROADS[0];

/** A point along the road by its distance from the northern end, and which way it runs there. */
function along(distance: number): { at: Point; way: Point } | undefined {
  const points = ROAD?.points ?? [];
  let walked = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [a, b] = [points[index - 1] as Point, points[index] as Point];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (walked + length >= distance) {
      const t = (distance - walked) / (length || 1);
      return {
        at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        way: [(b[0] - a[0]) / (length || 1), (b[1] - a[1]) / (length || 1)],
      };
    }
    walked += length;
  }
  return undefined;
}

/** Where every lamp stands along the road, as meters from its northern end, the first apart. */
export const STREET_LAMP_PLACES = (() => {
  const [second, third] = STREET_LAMPS.along;
  const places: number[] = [second];
  for (let distance = third; distance > 0; distance -= STREET_LAMPS.every) {
    places.push(distance);
  }
  return places;
})();

/** The lamps along the road: a mast, an arm and a head each, the head a light of its own. */
export function createStreetLamps(palette: Palette): Group {
  const group = new Group();
  group.name = 'streetlamps';
  const half = (ROAD?.width ?? 5) / 2;
  const steel = new MeshLambertMaterial({ color: palette.trunk, flatShading: true });
  const glass = new MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  const first = pickByKey(STREET_LAMPS.first)?.at;
  const standing = [
    ...(first === undefined ? [] : [{ x: first[0], y: first[1], toward: nearestOnRoad(first) }]),
    ...STREET_LAMP_PLACES.flatMap(distance => {
      const placed = along(distance);
      if (placed === undefined) {
        return [];
      }
      const { at, way } = placed;
      // on the side away from the houses, the left going down the valley
      const side: Point = [-way[1], way[0]];
      const off = half + STREET_LAMPS.off;
      return [{ x: at[0] + side[0] * off, y: at[1] + side[1] * off, toward: at }];
    }),
  ];
  standing.forEach(({ x, y, toward }, index) => {
    // the arm reaches out towards the road's middle
    const length = Math.hypot(toward[0] - x, toward[1] - y) || 1;
    const side: Point = [(x - toward[0]) / length, (y - toward[1]) / length];
    const foot = heightAt(x, y);
    const { height, arm } = STREET_LAMPS;
    const mast = new Mesh(new CylinderGeometry(0.05, 0.08, height, 6), steel);
    mast.position.set(x, foot + height / 2, -y);
    const [hx, hy] = [x - side[0] * arm, y - side[1] * arm];
    const bar = new Mesh(new CylinderGeometry(0.03, 0.03, arm, 4), steel);
    bar.position.set((x + hx) / 2, foot + height - 0.05, -(y + hy) / 2);
    bar.lookAt(new Vector3(hx, foot + height - 0.05, -hy));
    bar.rotateX(Math.PI / 2);
    const head = new Mesh(
      new SphereGeometry(0.16, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      glass
    );
    head.position.set(hx, foot + height - 0.1, -hy);
    head.geometry.userData['room'] = {
      day: palette.window.clone(),
      lit: palette.lantern.clone().lerp(palette.snow, 0.4),
    };
    // a light, in the head's own place; the ones on the photographs cast shadows
    head.geometry.userData['glows'] = [
      [0, -0.1, 0, 0, 0, 0, 0, index < STREET_LAMPS.shadowed ? 3.5 : 3],
    ];
    head.userData['lamp'] = true;
    group.add(mast, bar, head);
  });
  return group;
}

/**
 * The strings of lights put up for an event's evening:
 * along the hand rails, from post to post, sagging a little under the rail
 * between them, a bulb every half meter.
 */
export const LIGHT_STRINGS = {
  under: 0.04,
  sag: 0.12,
  every: 0.5,
} as const;

/**
 * The strings of lights along the hand rails, and along the A-hut's roof at
 * Christmas: a bulb each an instance, lit after dark, out by day.
 */
export function createLightStrings(palette: Palette, handrails: Vector3[][]): Group {
  const group = new Group();
  group.name = 'strings';
  group.add(
    strand(palette, handrails, 'lichterkette-gelaender'),
    strand(palette, hutRoofEdges(), 'weihnacht-hexenhaus')
  );
  return group;
}

/** One string of lights along lines, put up for an event: a bulb each an instance, tagged. */
function strand(palette: Palette, lines: Vector3[][], decoration: string): InstancedMesh {
  const bulbs = lines.flatMap(tops =>
    tops.slice(1).flatMap((to, index) => {
      const from = tops[index] as Vector3;
      const length = from.distanceTo(to);
      const count = Math.max(Math.round(length / LIGHT_STRINGS.every), 1);
      return Array.from({ length: count }, (_, step) => {
        const t = (step + 1) / count;
        const sag = 4 * t * (1 - t) * LIGHT_STRINGS.sag * Math.min(length / 1.8, 1.5);
        return from
          .clone()
          .lerp(to, t)
          .setY(from.y + (to.y - from.y) * t - LIGHT_STRINGS.under - sag);
      });
    })
  );
  const lamps = new InstancedMesh(
    new SphereGeometry(0.03, 6, 4),
    new MeshBasicMaterial({ color: 0xffffff }),
    bulbs.length
  );
  const matrix = new Matrix4();
  bulbs.forEach((at, index) => lamps.setMatrixAt(index, matrix.makeTranslation(at.x, at.y, at.z)));
  lamps.name = 'string-bulbs';
  // every bulb a light of its own, faint as one bulb is
  lamps.geometry.userData['glows'] = bulbs.map(({ x, y, z }) => [x, y, z, 0, 0, 0, 0, 5]);
  lamps.userData['bulbs'] = {
    day: palette.window.clone(),
    lit: palette.windowLit.clone().lerp(palette.snow, 0.5),
  };
  // put up for an event, not for a season: a decoration of its own
  lamps.userData['decoration'] = decoration;
  lamps.visible = false;
  return lamps;
}

/** Shows what is put up for some seasons only - the strings of lights - in those, and not in others. */
export function showSeasonal(root: Object3D, season: string): void {
  root.traverse(object => {
    const seasons = object.userData['seasons'] as string[] | undefined;
    if (seasons !== undefined) {
      object.visible = seasons.includes(season);
    }
  });
}
