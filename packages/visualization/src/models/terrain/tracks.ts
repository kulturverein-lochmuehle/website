import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshLambertMaterial } from 'three';

import type { Point } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import { random } from '../../utils/geometry.utils.js';
import { WAY_RUNS } from './ground.js';
import { LAYERS } from './surfaces.js';

/**
 * The wheel tracks in the snow along the road, in winter only. On a road
 * under snow nobody keeps to a lane: every car drives down the middle, on the
 * line one would drive it - cutting in on the inside of each bend - and each
 * a little off the last one's, wandering its own way. The fresher its tracks,
 * the more of the tarmac they show: many pairs, overlapping, some dark, some
 * nearly filled in again.
 */
export const TRACKS = {
  /** How far apart a car's wheels run, and how wide a tyre's track is at most and least. */
  gauge: 1.55,
  tyre: [0.18, 0.24] as const,
  /**
   * The cars that came by: how far each ran off the line - to the right,
   * where more than nought - and how fresh its tracks are, nought to one.
   */
  cars: [
    [0, 0.95],
    [0.12, 0.5],
    [-0.1, 0.45],
    [0.22, 0.3],
    [-0.2, 0.25],
    [0.05, 0.65],
    [-0.04, 0.35],
    [0.3, 0.2],
  ] as [number, number][],
  /**
   * How far in on a bend the line cuts, for each radian it turns over
   * `bend` meters, and at most.
   */
  cut: 1.6,
  bend: 16,
  most: 0.9,
  /** How far a car's line wanders either side, over how long a stretch, and how finely it is laid. */
  wander: 0.08,
  over: [18, 34] as const,
  step: 1,
  /**
   * How high over the road they lie, all of them: one over another they are
   * drawn in turn, the oldest first, and none hides another by its depth -
   * laid a hair apart instead, they flickered through each other further off.
   */
  lift: 0.012,
} as const;

/**
 * The line through a run's bends, as an offset off its middle by the distance
 * along it: in towards the inside of each bend, the more the sharper it is.
 */
export function idealLine(points: Point[]): (walked: number) => number {
  const walked = points.reduce<number[]>(
    (all, point, index) =>
      index === 0
        ? [0]
        : [
            ...all,
            (all[index - 1] as number) +
              Math.hypot(
                point[0] - (points[index - 1] as Point)[0],
                point[1] - (points[index - 1] as Point)[1]
              ),
          ],
    []
  );
  const headingAt = (by: number) => {
    const index = Math.max(
      1,
      Math.min(
        walked.findIndex(at => at >= by),
        points.length - 1
      )
    );
    const [a, b] = [points[index - 1] as Point, points[index] as Point];
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  const raw = (by: number) => {
    let turn = headingAt(by + TRACKS.bend / 2) - headingAt(by - TRACKS.bend / 2);
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    // a left turn has its inside on the left, which is the offset's plus
    return Math.max(-TRACKS.most, Math.min(TRACKS.most, turn * TRACKS.cut));
  };
  // smoothed over a car's length and more: nobody steers in steps
  const window = Array.from({ length: 13 }, (_, k) => k - 6);
  return by => window.reduce((sum, k) => sum + raw(by + k), 0) / window.length;
}

/** A ribbon along a line, at an offset from it that may change along it. */
function ribbon(
  points: Point[],
  offset: (walked: number) => number,
  width: number,
  level: (x: number, y: number) => number,
  lift: number,
  shade: [number, number, number],
  positions: number[],
  colors: number[]
): void {
  // the line walked in even steps, with the way it runs at each
  const steps: { at: Point; side: Point; walked: number }[] = [];
  let walked = 0;
  points.slice(1).forEach((to, index) => {
    const from = points[index] as Point;
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (length < 1e-6) {
      return;
    }
    const side: Point = [-(to[1] - from[1]) / length, (to[0] - from[0]) / length];
    for (let t = 0; t < length; t += TRACKS.step) {
      steps.push({
        at: [
          from[0] + ((to[0] - from[0]) * t) / length,
          from[1] + ((to[1] - from[1]) * t) / length,
        ],
        side,
        walked: walked + t,
      });
    }
    walked += length;
  });
  steps.slice(1).forEach((step, index) => {
    const before = steps[index] as (typeof steps)[number];
    const edge = ({ at, side, walked: by }: (typeof steps)[number], across: number) => {
      const out = offset(by) + across;
      const [x, y] = [at[0] + side[0] * out, at[1] + side[1] * out];
      return [x, level(x, y) + lift, -y];
    };
    const [a, b, c, d] = [
      edge(before, -width / 2),
      edge(before, width / 2),
      edge(step, width / 2),
      edge(step, -width / 2),
    ];
    // wound to face up once the plan's y is the scene's -z
    positions.push(...a, ...c, ...b, ...a, ...d, ...c);
    colors.push(...shade, ...shade, ...shade, ...shade, ...shade, ...shade);
  });
}

/** The wheel tracks along the road: snow driven hard, as dark as it is fresh. */
export function createTracks(palette: Palette): Group {
  const group = new Group();
  group.name = 'tracks';
  const positions: number[] = [];
  const colors: number[] = [];
  const next = random(1412);
  WAY_RUNS.filter(({ main }) => main).forEach(({ points, level }) => {
    const line = idealLine(points);
    // the oldest first, so the fresher lie over them
    [...TRACKS.cars]
      .sort(([, one], [, other]) => one - other)
      .forEach(([off, fresh]) => {
        const phase = next() * Math.PI * 2;
        const over = TRACKS.over[0] + next() * (TRACKS.over[1] - TRACKS.over[0]);
        const tyre = TRACKS.tyre[0] + next() * (TRACKS.tyre[1] - TRACKS.tyre[0]);
        // hard snow over the tarmac: the fresher, the more of the tarmac it shows
        const { r, g, b } = palette.road.clone().lerp(palette.snow, 0.72 - 0.5 * fresh);
        [-1, 1].forEach(wheel =>
          ribbon(
            points,
            by =>
              line(by) +
              off +
              TRACKS.wander * Math.sin((by / over) * Math.PI * 2 + phase) +
              (wheel * TRACKS.gauge) / 2,
            tyre,
            level,
            TRACKS.lift,
            [r, g, b],
            positions,
            colors
          )
        );
      });
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: -1 - LAYERS.track,
    polygonOffsetUnits: -1 - LAYERS.track,
    // over the road, each over the one before - not hiding one by its depth
    depthWrite: false,
  });
  // driven on, no fresh snow lies on it
  material.userData['snowless'] = true;
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = LAYERS.track;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.userData['seasons'] = ['winter'];
  group.visible = false;
  return group;
}
