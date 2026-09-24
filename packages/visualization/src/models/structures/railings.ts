import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshLambertMaterial,
  Vector3,
} from 'three';

import type { Point } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import { nearestOn } from '../../utils/geometry.utils.js';
import { mitred, strut } from '../../utils/mesh.utils.js';
import { FILL_LINES, FILLS } from '../seam/fills.js';
import { pickByKey } from '../seam/seam.js';
import { heightAt } from '../terrain/ground.js';
import { RAIL, STAIRS } from './measures.js';
import { STAIRS_PLAN } from './stairs.js';

/**
 * The steel pipe railings on the walls and along the stairs.
 */
/**
 * The railings on the walls, from the photographs: round steel pipe, a post
 * at most every guard rail section (`RAIL`), a top and a middle rail - each
 * run given as the pairs of handles on the face and the back of the wall it
 * stands on, by their names, and set on the wall's middle between them, on
 * its coping - so it follows the walls wherever they are set - and how far
 * short of its first pair it starts, towards the next.
 */
const RAILINGS: { short?: number; pairs: [face: string, back: string][] }[] = [
  // round the U and on along the upper wall and its bend: beside the stairs'
  // top - a tread short of it, where the sections counted end and the wall
  // runs on bare to the top step - the U's corner, its end, where the upper
  // wall starts, its far end, the bend's kink and its end
  {
    short: STAIRS_PLAN?.tread ?? 0,
    pairs: [
      ['stairs:top-north:top', 'stairs:u-top-back:top'],
      ['stairs:u-corner:top', 'stairs:u-corner-back:top'],
      ['stairs:u-end:top', 'stairs:u-inside:top'],
      ['stairs:upper-start:top', 'stairs:u-back-end-inside:top'],
      ['stairs:upper-end:top', 'stairs:upper-end-back:top'],
      ['stairs:bend-1:top', 'stairs:bend-1-back:top'],
      ['stairs:bend-end:top', 'stairs:bend-end-back:top'],
    ],
  },
];

/**
 * The railings' measures: how high the top rail runs over the coping -
 * measured off the photographs against the banner's 3.40m by 1.73m - and over
 * the treads along the stairs - against the steps' known rise - how high the
 * middle one, how thick the pipe is, and how far each is turned about its length -
 * on an edge, it reads rounder - how far in from the stairs' edge it stands
 * along them, and how round the stairs' top rail bends down into their lowest
 * post.
 */
const RAILING = {
  top: 0.95,
  stairs: 0.9,
  middle: 0.5,
  pipe: 0.04,
  roll: Math.PI / 4,
  inset: 0.06,
  bend: 0.15,
} as const;

/**
 * The names the dumps and the railings give that no handle has: a dump with
 * one in its ring is not drawn at all, a railing leaves the pair out.
 */
export function unknownHandles(): string[] {
  return [
    ...FILLS.flatMap(({ ring }) => ring),
    ...RAILINGS.flatMap(({ pairs }) => pairs.flat()),
  ].filter(key => pickByKey(key) === undefined);
}

export function createRailings(palette: Palette): Group {
  const group = new Group();
  group.name = 'railings';
  // the coping's height at a point: of the wall line nearest it
  const copingAt = (x: number, y: number) =>
    FILL_LINES().reduce(
      (best, { points, levels }) => {
        const { distance, along } = nearestOn(points, x, y);
        const step = Math.min(Math.floor(along), levels.length - 2);
        const [here, next] = [levels[step] as number, levels[step + 1] as number];
        const level = here + (next - here) * (along - step);
        return distance < best.distance ? { distance, level } : best;
      },
      { distance: Infinity, level: heightAt(x, y) }
    ).level;
  const pipes: number[] = [];
  RAILINGS.forEach(({ short = 0, pairs }) => {
    const [start, ...rest] = pairs.flatMap(([face, back]): Point[] => {
      const [one, other] = [pickByKey(face)?.at, pickByKey(back)?.at];
      return one === undefined || other === undefined
        ? []
        : [[(one[0] + other[0]) / 2, (one[1] + other[1]) / 2]];
    });
    if (start === undefined) {
      return;
    }
    const towards = rest[0] ?? start;
    const length = Math.hypot(towards[0] - start[0], towards[1] - start[1]) || 1;
    const middle: Point[] = [
      [
        start[0] + ((towards[0] - start[0]) * short) / length,
        start[1] + ((towards[1] - start[1]) * short) / length,
      ],
      ...rest,
    ];
    // a post at every corner, and between them the sections counted on site:
    // each stretch rounded to the nearest half section - on the wall's middle
    // it runs a little short of its face - the whole ones even and a half
    // one, if any, at the east end
    const posts = middle.flatMap((point, step) => {
      const next = middle[step + 1];
      if (next === undefined) {
        return [point];
      }
      const length = Math.hypot(next[0] - point[0], next[1] - point[1]);
      const westward = next[0] < point[0];
      const sections = Math.max(0.5, Math.round((length / RAIL) * 2) / 2);
      const full = Math.floor(sections);
      // counted from whichever end is west, and read back the way the run goes
      const from = Array.from({ length: full + 1 }, (_, piece) => piece / sections);
      const along = from.map(share => (westward ? 1 - share : share));
      const shares = [...new Set([0, ...along.filter(share => share > 1e-3 && share < 1 - 1e-3)])];
      return shares
        .sort((a, b) => a - b)
        .map((share): Point => [
          point[0] + (next[0] - point[0]) * share,
          point[1] + (next[1] - point[1]) * share,
        ]);
    });
    railing(posts.map(([x, y]) => new Vector3(x, copingAt(x, y), -y)));
  });
  // and the stairs' open side, from the photographs: a post on the bottom
  // step, half its tread in, on the landing a quarter tread in from its start
  // and right before the next step's riser, and on the top step, half its
  // tread in - each on its tread, a hair in from the stairs' edge
  const plan = STAIRS_PLAN;
  if (plan !== undefined) {
    const { at, half, north, steps } = plan;
    const [first, second, landing, last] = [
      steps[0],
      steps[1],
      steps[STAIRS.landingAt - 1],
      steps[steps.length - 1],
    ];
    if (
      first !== undefined &&
      second !== undefined &&
      landing !== undefined &&
      last !== undefined
    ) {
      // half a common tread: the bottom one is shallower
      const inset = (second.to - second.from) / 2;
      const side = -Math.sign(north) * (half - RAILING.inset);
      railing(
        (
          [
            [first.from + (first.to - first.from) / 2, first.top],
            [landing.from + inset / 2, landing.top],
            [landing.to - RAILING.pipe, landing.top],
            [last.from + (last.to - last.from) / 2, last.top],
          ] as const
        ).map(([by, top]) => {
          const [x, y] = at(by, side);
          return new Vector3(x, top, -y);
        }),
        // lower along the stairs than on the walls, as the photographs have
        // it against the steps' rise, and bent down into the lowest post
        RAILING.stairs,
        true
      );
    }
  }
  // a run of it: its posts, each from its foot, and the rails along them
  function railing(feet: Vector3[], top: number = RAILING.top, bent = false): void {
    const tops = feet.map(foot => foot.clone().setY(foot.y + top));
    const [lowest, next] = [feet[0], tops[1]];
    // the lowest post and the top rail one pipe, bent round from standing up
    // to running along: a quarter's worth of circle or less, tangent to both
    const bend = (() => {
      if (!bent || lowest === undefined || next === undefined) {
        return undefined;
      }
      const corner = tops[0] as Vector3;
      const up = new Vector3(0, 1, 0);
      const way = next.clone().sub(corner).normalize();
      const turn = Math.acos(Math.min(1, Math.max(-1, up.dot(way))));
      const toward = way.clone().addScaledVector(up, -up.dot(way)).normalize();
      const start = corner.clone().addScaledVector(up, -RAILING.bend * Math.tan(turn / 2));
      const middle = start.clone().addScaledVector(toward, RAILING.bend);
      const arc = Array.from({ length: 9 }, (_, step) => {
        const angle = (turn * step) / 8;
        return middle
          .clone()
          .addScaledVector(toward, -RAILING.bend * Math.cos(angle))
          .addScaledVector(up, RAILING.bend * Math.sin(angle));
      });
      return [lowest.clone().setY(lowest.y - 0.02), ...arc];
    })();
    (bend === undefined ? feet : feet.slice(1)).forEach(foot => {
      // up to the top rail's middle, where it ends inside it rather than
      // standing out of it
      strut(
        pipes,
        foot.clone().setY(foot.y - 0.02),
        foot.clone().setY(foot.y + top),
        RAILING.pipe,
        undefined,
        RAILING.roll
      );
    });
    // and the rails along them, mitred where they meet
    mitred(
      pipes,
      feet.map(foot => foot.clone().setY(foot.y + RAILING.middle)),
      RAILING.pipe,
      RAILING.roll
    );
    mitred(pipes, [...(bend ?? tops.slice(0, 1)), ...tops.slice(1)], RAILING.pipe, RAILING.roll);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pipes, 3));
  geometry.computeVertexNormals();
  // the grey green of the photographs' steel
  const steel = palette.foliage.clone().lerp(palette.wall, 0.55);
  group.add(new Mesh(geometry, new MeshLambertMaterial({ color: steel, flatShading: true })));
  return group;
}
