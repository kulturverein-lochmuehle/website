import type { Material } from 'three';
import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';

import type { Point } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import { heightAt, WAY_RUNS } from '../terrain/ground.js';
import { DRAWN_GROUND } from '../terrain/terrain.drawn.js';
import { CROSSING } from './crossings.js';

/**
 * What stands along the road south of the last bridge, where the brook keeps
 * to its western side: a hewn granite post every `every` meters between the
 * road and the water, as the old roads had them, `high` over the ground and
 * `off` the carriageway's edge, and cut `square` with a low pyramid on top.
 */
export const GRANITE_POSTS = {
  every: 5,
  high: 0.75,
  square: 0.15,
  cap: 0.05,
  off: 0.35,
  buried: 0.3,
} as const;

/**
 * The delineator posts along both edges, as the guidelines for a Landstraße
 * set them: in pairs across the road, 50m apart, closer only in a bend
 * under a radius of 200m - halved, and halved again under 100m - standing
 * `off` the carriageway's outermost edge, `high` out of the ground. A
 * hollow three-sided post, `wide` across its back and `deep` to the edge
 * that points at the road, its top slanted down towards the road by `slant`;
 * white, with a black band `band` high `cap` under the top, parallel to it -
 * measured off a maker's photograph, by its 180mm reflector. On the band, on the two faces that look along the
 * road: an upright white oblong, 40 by 180mm, facing the traffic that has the post on its
 * right, two round ones 60mm across facing the traffic that has it on its left.
 * Each is `length` long and stands in the ground as deep as that leaves.
 */
export const DELINEATORS = {
  spacing: [
    { radius: 200, every: 50 },
    { radius: 100, every: 25 },
    { radius: 0, every: 12.5 },
  ],
  off: 0.5,
  high: 1,
  length: 2.4,
  wide: 0.12,
  deep: 0.1,
  slant: 0.05,
  band: 0.25,
  cap: 0.22,
  oblong: [0.04, 0.18],
  round: 0.03,
  /** How far either side of a place the road's bend is measured over. */
  bend: 15,
} as const;

/** The main road, walked from its northern end: where a distance along it lies, and which way it runs there. */
const ROAD = (() => {
  const run = WAY_RUNS.find(({ main }) => main);
  const points = run?.points ?? [];
  const walked = points.reduce<number[]>(
    (all, point, index) => [
      ...all,
      index === 0
        ? 0
        : (all[index - 1] as number) +
          Math.hypot(
            point[0] - (points[index - 1] as Point)[0],
            point[1] - (points[index - 1] as Point)[1]
          ),
    ],
    []
  );
  const at = (distance: number): { at: Point; way: Point } => {
    const index = Math.min(
      Math.max(
        walked.findIndex(one => one > distance),
        1
      ),
      points.length - 1
    );
    const [a, b] = [points[index - 1] as Point, points[index] as Point];
    const [from, to] = [walked[index - 1] as number, walked[index] as number];
    const t = (distance - from) / (to - from || 1);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return {
      at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
      way: [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
    };
  };
  // how far along the road a point lies, off the nearest point on it
  const along = ([x, y]: Point) =>
    points.slice(1).reduce(
      (best, b, index) => {
        const a = points[index] as Point;
        const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
        const t = Math.min(
          Math.max(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0),
          1
        );
        const distance = Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y);
        return distance < best.distance
          ? { distance, along: (walked[index] as number) + t * Math.hypot(dx, dy) }
          : best;
      },
      { distance: Infinity, along: 0 }
    ).along;
  return {
    at,
    along,
    length: walked.at(-1) ?? 0,
    half: run?.half ?? 2.5,
    level: run?.level ?? heightAt,
  };
})();

/** Where the last bridge ends, going south: the far end of the walls it is held between. */
const PAST_BRIDGE = Math.max(0, ...CROSSING.walls.flat().map(point => ROAD.along(point)));

/** How far it is to the next pair of delineators, by how sharply the road bends there. */
function spacingAt(distance: number): number {
  const { bend, spacing } = DELINEATORS;
  const [before, after] = [ROAD.at(distance - bend).way, ROAD.at(distance + bend).way];
  const turn = Math.acos(Math.min(Math.max(before[0] * after[0] + before[1] * after[1], -1), 1));
  const radius = turn < 1e-6 ? Infinity : (bend * 2) / turn;
  return (spacing.find(({ radius: least }) => radius >= least) ?? spacing[spacing.length - 1])
    ?.every as number;
}

/** A place beside the road: `off` its edge, to the right going south or to the left, and turned along it. */
function beside(distance: number, off: number, right: boolean) {
  const { at, way } = ROAD.at(distance);
  // to the right of the way south, in plan: the brook's side
  const side: Point = right ? [way[1], -way[0]] : [-way[1], way[0]];
  const out = ROAD.half + off;
  const place: Point = [at[0] + side[0] * out, at[1] + side[1] * out];
  // the road's own height at its edge there, and the ground's
  const edge = ROAD.level(at[0] + side[0] * ROAD.half, at[1] + side[1] * ROAD.half);
  return {
    place,
    edge,
    // the terrain as it is drawn: the field's heights are not what the road
    // was cut into, and stand metres off it south of the bridge
    ground: DRAWN_GROUND()(place[0], place[1]) ?? heightAt(place[0], place[1]),
    // local +z along the way south, in the scene's mirrored north - turned
    // round on the left, so that local +x always points away from the road
    turn: new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.atan2(way[0], -way[1]) + (right ? 0 : Math.PI)
    ),
  };
}

/** Instances of one part, each placed by a matrix. */
function instanced(
  geometry: BufferGeometry,
  material: Material,
  matrices: Matrix4[],
  name: string
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.name = name;
  return mesh;
}

/** Triangles turned to face away from a point inside what they close round, with their normals. */
function outward(positions: number[], [cx, cy, cz]: [number, number, number]): BufferGeometry {
  for (let at = 0; at + 8 < positions.length; at += 9) {
    const [a, b, c] = [0, 3, 6].map(
      k => new Vector3(positions[at + k], positions[at + k + 1], positions[at + k + 2])
    ) as [Vector3, Vector3, Vector3];
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    const centre = a.clone().add(b).add(c).divideScalar(3);
    if (normal.dot(centre.sub(new Vector3(cx, cy, cz))) < 0) {
      // swap two corners
      for (let k = 0; k < 3; k += 1) {
        [positions[at + 3 + k], positions[at + 6 + k]] = [
          positions[at + 6 + k] as number,
          positions[at + 3 + k] as number,
        ];
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * One delineator in its own frame: +x away from the road, +z along it, and
 * nought at the top's highest point. Its outline in plan is a triangle, the
 * point towards the road; its top falls towards the road by `slant`.
 */
function delineator(): { body: BufferGeometry; band: BufferGeometry; reflectors: BufferGeometry } {
  const { wide, deep, slant, band, cap, length, oblong, round } = DELINEATORS;
  const outline: [number, number][] = [
    [-deep / 2, 0],
    [deep / 2, -wide / 2],
    [deep / 2, wide / 2],
  ];
  const middleX = outline.reduce((sum, [x]) => sum + x, 0) / outline.length;
  // how far under the highest point the top is, over a place in plan
  const top = (x: number) => (slant * (deep / 2 - x)) / deep;
  // a three-sided piece between two heights under the top, grown a little
  const piece = (from: number, to: number, grown = 0) => {
    const ring = outline.map(([x, z]) => [x * (1 + grown), z * (1 + grown)] as [number, number]);
    const up = (x: number, z: number, under: number) => [x, -top(x) - under, z];
    const positions = ring.flatMap(([x, z], k) => {
      const [nx, nz] = ring[(k + 1) % ring.length] as [number, number];
      return [
        ...up(x, z, to),
        ...up(nx, nz, to),
        ...up(nx, nz, from),
        ...up(x, z, to),
        ...up(nx, nz, from),
        ...up(x, z, from),
      ];
    });
    // and the top and bottom of it
    const [a, b, c] = ring as [[number, number], [number, number], [number, number]];
    positions.push(...up(...a, from), ...up(...c, from), ...up(...b, from));
    positions.push(...up(...a, to), ...up(...b, to), ...up(...c, to));
    return outward(positions, [middleX, -(from + to) / 2, 0]);
  };
  // the reflectors on the two faces along the road, a hair off each, in the
  // band's middle: the oblong on the face looking back along local -z
  const faces = [-1, 1].map(side => {
    const [ax, az] = outline[0] as [number, number];
    const [bx, bz] = outline[side < 0 ? 1 : 2] as [number, number];
    const middle = new Vector3((ax + bx) / 2, 0, (az + bz) / 2);
    const normal = new Vector3(bz - az, 0, -(bx - ax)).normalize();
    if (normal.x * (middle.x - middleX) + normal.z * middle.z < 0) {
      normal.negate();
    }
    middle.y = -top(middle.x) - cap - band / 2;
    return { side, normal, middle: middle.addScaledVector(normal, 0.003) };
  });
  const laid = (geometry: BufferGeometry, { normal, middle }: (typeof faces)[number], up = 0) =>
    geometry
      .rotateY(Math.atan2(normal.x, normal.z))
      .translate(middle.x, middle.y + up, middle.z)
      .toNonIndexed();
  const [back, ahead] = faces as [(typeof faces)[number], (typeof faces)[number]];
  const merged = (parts: BufferGeometry[]) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        parts.flatMap(part => Array.from(part.getAttribute('position').array)),
        3
      )
    );
    geometry.computeVertexNormals();
    return geometry;
  };
  return {
    body: piece(0, length),
    band: piece(cap, cap + band, 0.04),
    reflectors: merged([
      laid(new PlaneGeometry(oblong[0], oblong[1]), back),
      laid(new CircleGeometry(round, 10), ahead, round * 1.4),
      laid(new CircleGeometry(round, 10), ahead, -round * 1.4),
    ]),
  };
}

export function createRoadside(palette: Palette): Group {
  const group = new Group();
  group.name = 'roadside';
  const end = ROAD.length - 2;
  const one = new Vector3(1, 1, 1);

  // the delineators first: a granite post does not stand where one does
  const pairs: number[] = [];
  // each gap as the bend is half way along it, not where it starts: read at
  // the start, the first pair out of the bridge's bend stood 12m from the
  // next, and that one 49m from the one after on the straight
  const gapFrom = (distance: number) =>
    DELINEATORS.spacing.reduce(
      (gap, { every }) => (every < gap && spacingAt(distance + gap / 2) <= every ? every : gap),
      spacingAt(distance + (DELINEATORS.spacing[0]?.every ?? 50) / 2)
    );
  for (let distance = PAST_BRIDGE + 5; distance < end; distance += gapFrom(distance)) {
    pairs.push(distance);
  }
  // and the first gap no wider than the one after it: coming out of the
  // bridge's bend onto the straight, the first stood 49m before one of 24m,
  // and is halved as a bend's are
  const [first, second, third] = pairs as [number, number, number];
  if (pairs.length > 2 && second - first > 1.5 * (third - second)) {
    pairs.splice(1, 0, (first + second) / 2);
  }
  const white = new MeshLambertMaterial({ color: palette.marking });
  const black = new MeshLambertMaterial({ color: palette.ground });
  const bright = new MeshLambertMaterial({ color: palette.snow, side: DoubleSide });
  const posts = pairs.flatMap(distance =>
    [true, false].map(right => beside(distance, DELINEATORS.off, right))
  );
  const place = ({ place: [x, y], turn }: { place: Point; turn: Quaternion }, height: number) =>
    new Matrix4().compose(new Vector3(x, height, -y), turn, one);
  // each placed by the highest point of its top: a meter over the road's
  // edge, the guidelines say, on a verge as level as the road. Here the
  // ground falls away to the brook 30 to 50cm, and a meter over the road
  // stood half as tall again there as across it - so a meter out of the
  // ground it stands in
  const heads = posts.map(post => place(post, post.ground + DELINEATORS.high));
  const { body, band, reflectors } = delineator();
  group.add(
    instanced(body, white, heads, 'delineator-posts'),
    instanced(band, black, heads, 'delineator-bands'),
    instanced(reflectors, bright, heads, 'delineator-reflectors')
  );

  // the granite posts between the road and the brook
  const stones: ReturnType<typeof beside>[] = [];
  for (let distance = PAST_BRIDGE + 1; distance < end; distance += GRANITE_POSTS.every) {
    if (pairs.some(pair => Math.abs(pair - distance) < 0.6)) {
      continue;
    }
    stones.push(beside(distance, GRANITE_POSTS.off, true));
  }
  const granite = new MeshLambertMaterial({ color: palette.granite, flatShading: true });
  const { square, cap } = GRANITE_POSTS;
  const stone = new BoxGeometry(square, 1, square);
  stone.translate(0, 0.5, 0);
  // a low pyramid, its corners on the stone's
  const pyramid = new CylinderGeometry(0.01, (square / 2) * Math.SQRT2, cap, 4);
  pyramid.rotateY(Math.PI / 4);
  pyramid.translate(0, cap / 2, 0);
  const tops = stones.map(post => {
    const ground = Math.min(post.ground, post.edge);
    return { post, top: ground + GRANITE_POSTS.high - cap, foot: ground - GRANITE_POSTS.buried };
  });
  group.add(
    instanced(
      stone,
      granite,
      tops.map(({ post, top, foot }) => place(post, foot).scale(new Vector3(1, top - foot, 1))),
      'granite-posts'
    ),
    instanced(
      pyramid,
      granite,
      tops.map(({ post, top }) => place(post, top)),
      'granite-caps'
    )
  );
  return group;
}
