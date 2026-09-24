import type { Point } from '../data/data.js';

/**
 * Plane geometry the model is set out with: lines, rings, distances and lookups, none of it about the Lochmühle in particular.
 */
/**
 * Arc between two vertices of a ring, in meters. The rings carry as many
 * segments as they need to keep to it: a ring of a fixed count would be a fan
 * of splinters near the middle and a polygon at the rim, and flat shading
 * paints every splinter as a streak of its own.
 */
const SEGMENT_ARC = 4;

export const segmentsOf = (radius: number) =>
  radius === 0 ? 1 : Math.max(12, Math.round((2 * Math.PI * radius) / SEGMENT_ARC));

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Hermite fade between two edges, 0 below `from` and 1 above `to`. */
export function smoothstep(from: number, to: number, value: number): number {
  const t = clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Rounds the corners off a polyline (Chaikin). OpenStreetMap traces a bend as a
 * handful of straight pieces, and a brook drawn from them has elbows - three
 * passes of cutting every corner in quarters take them out without the
 * overshoot a spline would add on the sharp turns of a forest lane.
 */
export function smooth(points: Point[], passes = 3): Point[] {
  if (points.length < 3 || passes === 0) {
    return points;
  }
  const rounded = points.flatMap(([x, y], index): Point[] => {
    const next = points[index + 1];
    if (next === undefined) {
      return [];
    }
    const [nx, ny] = next;
    return [
      [x + (nx - x) * 0.25, y + (ny - y) * 0.25],
      [x + (nx - x) * 0.75, y + (ny - y) * 0.75],
    ];
  });
  // the ends stay where the survey put them, only the corners give
  return smooth([points[0] as Point, ...rounded, points[points.length - 1] as Point], passes - 1);
}

/** Walks a polyline in even steps, so a long straight stretch gets points too. */
export function resample(points: Point[], step: number): Point[] {
  return [
    ...points.flatMap(([x, y], index): Point[] => {
      const next = points[index + 1];
      if (next === undefined) {
        return [];
      }
      const [nx, ny] = next;
      const count = Math.max(1, Math.ceil(Math.hypot(nx - x, ny - y) / step));
      return Array.from({ length: count }, (_, sub): Point => [
        x + ((nx - x) * sub) / count,
        y + ((ny - y) * sub) / count,
      ]);
    }),
    points[points.length - 1] as Point,
  ];
}

/** Worked out the first time it is asked for, and kept. */
export function once<T>(make: () => T): () => T {
  let made: { value: T } | undefined;
  return () => (made ??= { value: make() }).value;
}

/**
 * Marks on a grid where a set of lines runs, each out to a width of its own.
 * Only what `keep` lets through is marked, stations and cells alike, so a
 * raster meant to stop short of the rim does not reach over it from inside.
 */
export function raster(
  lines: { points: Point[]; width: number }[],
  cell: number,
  keep: (point: Point) => boolean = () => true
): (x: number, y: number) => boolean {
  const key = (x: number, y: number) => `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
  const marked = new Set<string>();
  lines.forEach(({ points, width }) => {
    const reach = Math.ceil(width / cell);
    const offsets = Array.from({ length: reach * 2 + 1 }, (_, step) => (step - reach) * cell);
    resample(points, cell / 2)
      .filter(keep)
      .forEach(([x, y]) =>
        offsets.forEach(dx =>
          offsets.forEach(dy => {
            if (Math.hypot(dx, dy) <= width && keep([x + dx, y + dy])) {
              marked.add(key(x + dx, y + dy));
            }
          })
        )
      );
  });
  return (x, y) => marked.has(key(x, y));
}

/** The nearest point of a line to another, with the line's heading there. */
export function nearestOn(points: Point[], x: number, y: number) {
  return points.reduce(
    (closest, [ax, ay], index) => {
      const next = points[index + 1];
      if (next === undefined) {
        return closest;
      }
      const [bx, by] = next;
      const length = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length, 0, 1);
      const [px, py] = [ax + t * (bx - ax), ay + t * (by - ay)];
      const distance = Math.hypot(x - px, y - py);
      return distance < closest.distance
        ? {
            distance,
            at: [px, py] as Point,
            heading: [bx - ax, by - ay] as Point,
            along: index + t,
          }
        : closest;
    },
    { distance: Infinity, at: [0, 0] as Point, heading: [1, 0] as Point, along: 0 }
  );
}

/** Whether a point lies inside a closed outline, seen from above. */
export function within([x, y]: Point, outline: Point[]): boolean {
  return outline.reduce((inside, [ax, ay], index) => {
    const [bx, by] = outline[(index + 1) % outline.length] as Point;
    const crosses = ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay || 1e-9) + ax;
    return crosses ? !inside : inside;
  }, false);
}

/**
 * The parts of a line that lie outside an outline, cut on its edge. The lane
 * ends where the bridge's deck begins - the deck carries its own surface, and
 * a band running on over it would lie in the road twice.
 */
export function outside(points: Point[], outline: Point[]): Point[][] {
  const stepped = resample(points, 0.25);
  return stepped.reduce<Point[][]>((runs, point) => {
    const last = runs[runs.length - 1];
    if (within(point, outline)) {
      return last === undefined || last.length === 0 ? runs : [...runs, []];
    }
    return last === undefined ? [[point]] : [...runs.slice(0, -1), [...last, point]];
  }, []);
}

/** One side of a line, as a polyline of its own: every point pushed out square to it. */
export function offsetLine(points: Point[], distance: number): Point[] {
  return points.map(([x, y], index): Point => {
    const [px, py] = points[index - 1] ?? [x, y];
    const [nx, ny] = points[index + 1] ?? [x, y];
    const length = Math.hypot(nx - px, ny - py) || 1;
    return [x + (-(ny - py) / length) * distance, y + ((nx - px) / length) * distance];
  });
}

/** Where a polyline runs into another, as a distance along the first of them. */
export function crossings(line: Point[], other: Point[]): { at: Point; along: number }[] {
  return line.flatMap(([ax, ay], index) => {
    const next = line[index + 1];
    if (next === undefined) {
      return [];
    }
    const [bx, by] = next;
    return other.flatMap(([cx, cy], step) => {
      const after = other[step + 1];
      if (after === undefined) {
        return [];
      }
      const [dx, dy] = after;
      const denominator = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
      if (Math.abs(denominator) < 1e-9) {
        return [];
      }
      const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denominator;
      const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denominator;
      return t < 0 || t > 1 || u < 0 || u > 1
        ? []
        : [{ at: [ax + t * (bx - ax), ay + t * (by - ay)] as Point, along: index + t }];
    });
  });
}

/** A line carried on past both its ends, keeping the heading it had there. */
export function extended(line: Point[], by: number): Point[] {
  const beyond = (from: Point, to: Point): Point => {
    const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
    const length = Math.hypot(dx, dy) || 1;
    return [to[0] + (dx / length) * by, to[1] + (dy / length) * by];
  };
  const [first, second] = [line[0] as Point, line[1] as Point];
  const [last, before] = [line[line.length - 1] as Point, line[line.length - 2] as Point];
  return [beyond(second, first), ...line, beyond(before, last)];
}

/** One bank of the brook where it passes under a road, cut at the road's edges. */
/** A point somewhere along a line, by the same count its crossings are given in. */
export function alongLine(line: Point[], along: number): Point {
  const step = Math.max(0, Math.min(line.length - 2, Math.floor(along)));
  const [ax, ay] = line[step] as Point;
  const [bx, by] = line[step + 1] as Point;
  const share = along - step;
  return [ax + (bx - ax) * share, ay + (by - ay) * share];
}

/** A point as a key, to a tenth of a micrometer. */
export const pointKey = ([x, y]: Point) => `${x.toFixed(7)}:${y.toFixed(7)}`;

/** How long a polyline is on the ground. */
export const runs = (points: Point[]) =>
  points.slice(1).reduce((sum, [x, y], step) => {
    const [px, py] = points[step] as Point;
    return sum + Math.hypot(x - px, y - py);
  }, 0);

/** A ring on the plan, with the box round it to keep asking about it cheap. */
export function boxed(ring: Point[]) {
  const [xs, ys] = [ring.map(([x]) => x), ring.map(([, y]) => y)];
  const [minX, minY, maxX, maxY] = [
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
  ];
  return {
    ring,
    box: [minX, minY, maxX, maxY] as const,
    /** Whether a point lies inside, and not on the ring itself. */
    holds: ([x, y]: Point) =>
      x > minX &&
      x < maxX &&
      y > minY &&
      y < maxY &&
      within([x, y], ring) &&
      nearestOn([...ring, ring[0] as Point], x, y).distance > 0.01,
  };
}

/** Deterministic noise, the trees have to stand in the same spot every reload. */
export function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function contains(polygon: Point[], [x, y]: Point): boolean {
  return polygon.reduce((inside, [ax, ay], index) => {
    const [bx, by] = polygon[(index + 1) % polygon.length] as Point;
    const crosses = ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax;
    return crosses ? !inside : inside;
  }, false);
}

/** Distance from a point to a polyline, used to keep the trees off the ways. */
export function distanceToPath(points: Point[], [x, y]: Point): number {
  return points.reduce((closest, [ax, ay], index) => {
    const next = points[index + 1];
    if (next === undefined) {
      return Math.min(closest, Math.hypot(x - ax, y - ay));
    }
    const [bx, by] = next;
    const length = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
    const t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length, 0, 1);
    return Math.min(closest, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
  }, Infinity);
}

/** The smallest convex outline round a set of points, counter clockwise. */
export function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort(([ax, ay], [bx, by]) => ax - bx || ay - by);
  const turn = ([ax, ay]: Point, [bx, by]: Point, [cx, cy]: Point) =>
    (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const half = (list: Point[]) =>
    list.reduce<Point[]>((kept, point) => {
      while (
        kept.length >= 2 &&
        turn(kept[kept.length - 2] as Point, kept[kept.length - 1] as Point, point) <= 0
      ) {
        kept.pop();
      }
      return [...kept, point];
    }, []);
  const lower = half(sorted);
  const upper = half([...sorted].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
