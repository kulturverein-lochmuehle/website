import cdt2d from 'cdt2d';
import { BufferGeometry, Float32BufferAttribute, MeshLambertMaterial } from 'three';

import type { Point } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import { nearestOn, resample, within } from '../../utils/geometry.utils.js';
import { DECK_THICKNESS, lineLevel, SLAB_CELL } from '../structures/measures.js';
import { onGround } from './terrain.field.js';

/**
 * What is laid over the ground as a band - ways, the brook - and the slabs of the decks, and the layers they are stacked in.
 */
/**
 * Lays a band of the given width along a polyline and drapes it over the
 * terrain - brook and roads are painted on the ground, not cut into it. The
 * line is resampled first: OpenStreetMap draws a long straight stretch with two
 * points, and a straight band would cut through every rise between them.
 */
/** A cross section of a ribbon: the two corners it is laid between, and their height. */
export interface Section {
  left: Point;
  right: Point;
  up: number;
}

/** Where the line through two points meets another, if the two are not parallel. */
function meet(from: Point, to: Point, [a, b]: [Point, Point]): Point | undefined {
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
  const denominator = dx * ey - dy * ex;
  if (Math.abs(denominator) < 1e-9) {
    return undefined;
  }
  const t = ((a[0] - from[0]) * ey - (a[1] - from[1]) * ex) / denominator;
  return [from[0] + t * dx, from[1] + t * dy];
}

/**
 * Cuts the end of a ribbon on a line rather than square to its own run. A band
 * stopped where its middle crosses stands square to itself, and against
 * something at an angle - the edge of the deck - that leaves a wedge open on
 * one side. Height is left alone: the cut section carries on the gradient the
 * band already holds.
 */
function mitre(sections: Section[], line: [Point, Point]): Section[] {
  const middle = ({ left, right }: Section): Point => [
    (left[0] + right[0]) / 2,
    (left[1] + right[1]) / 2,
  ];
  const [head, tail] = [sections[0], sections[sections.length - 1]];
  if (sections.length < 2 || head === undefined || tail === undefined) {
    return sections;
  }

  // whichever end runs into the line is the one that is cut, the other is left
  const reach = (section: Section) => {
    const [x, y] = middle(section);
    return nearestOn(line, x, y).distance;
  };
  const flipped = reach(head) < reach(tail);
  const facing = flipped ? [...sections].reverse() : sections;

  // the middle of a band is the last part of it to cross, so a corner of the
  // end is already over the line and carrying that one forward would throw it
  // backwards and fold the quad. The line is an endless one and a long run can
  // wander over it far from here, so this looks for the last section wholly on
  // the near side rather than the first one that is not
  const [a, b] = line;
  const sideOf = ([x, y]: Point) =>
    Math.sign((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]));
  const home = sideOf(middle(facing[facing.length - 1] as Section));
  const whole = facing.reduce(
    (step, section, index) =>
      sideOf(section.left) === home && sideOf(section.right) === home ? index : step,
    0
  );
  const kept = facing.slice(0, Math.max(2, whole + 1));

  const [before, end] = [kept[kept.length - 2] as Section, kept[kept.length - 1] as Section];
  const carried = (from: Point, to: Point) => meet(from, to, line) ?? to;
  const laid = [
    ...kept.slice(0, -1),
    {
      left: carried(before.left, end.left),
      right: carried(before.right, end.right),
      up: end.up,
    },
  ];
  return flipped ? laid.reverse() : laid;
}

/**
 * The cross sections a ribbon is laid between, its end cut on a line if it is
 * given one. The kerbs of a way are read off these too: set out on their own,
 * they end square where the band ends mitred, and a seam pinned to them stops
 * short of the band on one side and runs past it on the other.
 */
export function ribbonSections(
  points: Point[],
  width: number,
  profile: (x: number, y: number) => number,
  lift: number,
  cut?: [Point, Point]
): Section[] {
  const dense = points.flatMap(([x, y], index): Point[] => {
    const next = points[index + 1];
    if (next === undefined) {
      return [[x, y]];
    }
    const [nx, ny] = next;
    const steps = Math.max(1, Math.ceil(Math.hypot(nx - x, ny - y) / 2));
    return Array.from({ length: steps }, (_, step): Point => [
      x + ((nx - x) * step) / steps,
      y + ((ny - y) * step) / steps,
    ]);
  });

  const sections = dense.map(([x, y], index): Section => {
    const [px, py] = dense[index - 1] ?? ([x, y] as Point);
    const [nx, ny] = dense[index + 1] ?? ([x, y] as Point);
    const length = Math.hypot(nx - px, ny - py) || 1;
    // the normal of the averaged direction keeps corners from pinching
    const [ox, oy] = [(-(ny - py) / length) * (width / 2), ((nx - px) / length) * (width / 2)];
    // both edges sit at the height the line holds here, so the band is level
    // across its width and only follows its own gradient along it
    return {
      left: onGround([x + ox, y + oy]),
      right: onGround([x - ox, y - oy]),
      up: profile(x, y) + lift,
    };
  });
  return cut === undefined ? sections : mitre(sections, cut);
}

/** A band drawn between its sections, each level across its width. */
export function ribbon(sections: Section[]): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  sections.forEach(({ left, right, up }, index) => {
    positions.push(left[0], up, -left[1]);
    positions.push(right[0], up, -right[1]);

    if (index === 0) {
      return;
    }
    const [a, b] = [(index - 1) * 2, (index - 1) * 2 + 1];
    indices.push(a, b, a + 2, b, b + 2, a + 2);
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The bands laid on the ground are stacked: the road runs over the lane, the
 * lane over the brook, all of them over the terrain. They are cut into the
 * ground rather than lifted off it, so what keeps them apart where they share
 * a line is the order they are drawn in and a depth offset each.
 */
export const LAYERS = { brook: 1, lane: 2, road: 3 } as const;

export type Layer = keyof typeof LAYERS;

export function groundMaterial(color: Palette[keyof Palette], layer: Layer): MeshLambertMaterial {
  return new MeshLambertMaterial({
    color,
    // the terrain itself stays coplanar with them, so it keeps the offset
    polygonOffset: true,
    polygonOffsetFactor: -1 - LAYERS[layer],
    polygonOffsetUnits: -1 - LAYERS[layer],
  });
}

/**
 * A plate: a flat shape given a top and an underside, and the wall round its
 * rim. It is cut up rather than drawn corner to corner, because what it lies
 * under is not flat - a triangle spanning a bend of the road holds the line its
 * three corners lie on, and stands out of the road everywhere between them.
 */
export function slab(outline: Point[], top: (point: Point) => number): number[] {
  // the rim first, at the pitch the inside is cut to
  const ring = resample([...outline, outline[0] as Point], SLAB_CELL).filter((point, step, all) => {
    const before = all[step - 1] ?? all[all.length - 1];
    return before === undefined || Math.hypot(point[0] - before[0], point[1] - before[1]) > 1e-6;
  });

  // and points across the inside of it, kept off the rim so that the cut does
  // not come out as a row of needles along it
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  const inside: Point[] = [];
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += SLAB_CELL) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += SLAB_CELL) {
      const at: Point = [x, y];
      const clear = ring.every(([rx, ry]) => Math.hypot(rx - x, ry - y) > SLAB_CELL * 0.5);
      if (clear && within(at, outline)) {
        inside.push(at);
      }
    }
  }

  const points = [...ring, ...inside];
  const held = ring.map((_, step): [number, number] => [step, (step + 1) % ring.length]);
  const cut = cdt2d(
    points.map(([x, y]) => [x, y] as [number, number]),
    held,
    { delaunay: true, interior: true, exterior: false }
  );

  const positions = cut.flatMap(triangle => {
    const [a, b, c] = triangle.map(corner => points[corner] as Point) as [Point, Point, Point];
    // the cut says nothing about which way round a triangle is, and the mirror
    // into the scene turns it again: a plan that winds counter clockwise faces up
    const turn = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const [one, other, third] = turn < 0 ? [a, c, b] : [a, b, c];
    return [
      ...[one, other, third].flatMap(point => [point[0], top(point), -point[1]]),
      ...[third, other, one].flatMap(point => [point[0], top(point) - DECK_THICKNESS, -point[1]]),
    ];
  });

  ring.forEach((point, step) => {
    const next = ring[(step + 1) % ring.length] as Point;
    const [ax, ay, bx, by] = [point[0], point[1], next[0], next[1]];
    const [ta, tb] = [top(point), top(next)];
    positions.push(
      ax,
      ta,
      -ay,
      ax,
      ta - DECK_THICKNESS,
      -ay,
      bx,
      tb,
      -by,
      bx,
      tb,
      -by,
      ax,
      ta - DECK_THICKNESS,
      -ay,
      bx,
      tb - DECK_THICKNESS,
      -by
    );
  });
  return positions;
}

/**
 * The height a band's edge holds anywhere along it: its sections' own, and
 * straight between them as the band's faces run. Read off the profile instead,
 * a kerb stands off its band wherever the band's end is mitred - by 32mm at
 * the lane's end at the deck.
 */
export function edgeLevel(edge: Point[], sections: Section[]): (x: number, y: number) => number {
  return lineLevel(
    edge,
    sections.map(({ up }) => up)
  );
}

/** Lotzebachstraße through the valley and the lane past the mill. */
/** The edge of an outline nearest a point, as a line to cut a band against. */
export function edgeNear(outline: Point[], [x, y]: Point) {
  return outline.reduce<{ distance: number; line: [Point, Point] }>(
    (best, corner, step) => {
      const line: [Point, Point] = [corner, outline[(step + 1) % outline.length] as Point];
      const { distance } = nearestOn(line, x, y);
      return distance < best.distance ? { distance, line } : best;
    },
    { distance: Infinity, line: [outline[0] as Point, outline[0] as Point] }
  );
}
