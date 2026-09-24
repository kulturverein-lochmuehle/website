import type { Point } from '../../data/data.js';
import { idealLine } from '../terrain/tracks.js';
import { ROAD } from './cars.js';

/**
 * How the traffic drives, in meters and seconds: its pace, how far to the
 * right of the line through the road's bends it keeps, and how long it is
 * between one car and the next.
 */
export const TRAFFIC = {
  speed: 9,
  bias: 0.45,
  every: { least: 10, most: 30 },
} as const;

const POINTS: Point[] = ROAD?.points ?? [];
const SUMS = POINTS.reduce<number[]>((sums, [x, y], index) => {
  const before = POINTS[index - 1];
  return [
    ...sums,
    before === undefined ? 0 : (sums[index - 1] ?? 0) + Math.hypot(x - before[0], y - before[1]),
  ];
}, []);

const LINE = idealLine(POINTS);

/** The length of the road's middle line. */
export const ROAD_LENGTH = SUMS[SUMS.length - 1] ?? 0;

/** The point on the road's middle at a length along it, and the way the road runs there. */
function roadAt(s: number): { at: Point; way: Point } {
  const clamped = Math.min(Math.max(s, 0), ROAD_LENGTH);
  const index = Math.min(Math.max(SUMS.findIndex(sum => sum >= clamped) - 1, 0), POINTS.length - 2);
  const [a, b] = [POINTS[index] as Point, POINTS[index + 1] as Point];
  const span = (SUMS[index + 1] ?? 0) - (SUMS[index] ?? 0) || 1;
  const t = (clamped - (SUMS[index] ?? 0)) / span;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return {
    at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    way: [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
  };
}

/**
 * The way a car drives the road in one direction, in plan, a point every
 * meter from the one end to the other: on the line the tracks in the snow
 * follow - towards the middle of the road, cutting in on the inside of each
 * bend - a little to the right of it.
 */
export function driveRoute(dir: 1 | -1): Point[] {
  return Array.from({ length: Math.floor(ROAD_LENGTH) + 1 }, (_, travelled) => {
    const s = dir === 1 ? travelled : ROAD_LENGTH - travelled;
    const { at, way } = roadAt(s);
    // the line's offset is to the road's left; to the right of the way of travel is the other side
    const off = LINE(s) - dir * TRAFFIC.bias;
    return [at[0] - way[1] * off, at[1] + way[0] * off];
  });
}

/** The point on a route, and the way it heads there, at a length along it. */
export function onRoute(route: Point[], s: number): { at: Point; heading: Point } {
  const last = route.length - 1;
  const clamped = Math.min(Math.max(s, 0), last);
  const index = Math.min(Math.floor(clamped), last - 1);
  const [a, b] = [route[index] as Point, route[index + 1] as Point];
  const t = clamped - index;
  // the heading from a short stretch round it, so it follows a bend smoothly
  const [back, ahead] = [Math.max(clamped - 1.2, 0), Math.min(clamped + 1.2, last)].map(at => {
    const i = Math.min(Math.floor(at), last - 1);
    const [p, q] = [route[i] as Point, route[i + 1] as Point];
    return [p[0] + (q[0] - p[0]) * (at - i), p[1] + (q[1] - p[1]) * (at - i)] as Point;
  }) as [Point, Point];
  const reach = Math.hypot(ahead[0] - back[0], ahead[1] - back[1]) || 1;
  return {
    at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    heading: [(ahead[0] - back[0]) / reach, (ahead[1] - back[1]) / reach],
  };
}

/**
 * A car on a route, as a car follows a road: its front axle steered along the
 * line, and its rear one drawn after it at the wheelbase - never pushed
 * sideways - so it cuts in on the inside of a bend as a real car's does. The
 * body points from the rear axle to the front one, its middle - between its
 * ends - set back from the rear axle along it, and the front wheels are
 * turned by as much as the road under them turns off the body's way. Given
 * where the rear axle was as the car stood `was` along, it follows on from
 * there; without, it starts straight behind the front one.
 */
export function onAxles(
  route: Point[],
  s: number,
  behind: number,
  ahead: number,
  was?: { s: number; rear: Point }
): { at: Point; heading: Point; steer: number; rear: Point } {
  const base = ahead - behind;
  const { at: front, heading: road } = onRoute(route, s + ahead);
  // drawn on in short steps, as it would be by the wheel
  const steps = was === undefined ? 0 : Math.ceil(Math.abs(s - was.s) / 0.1);
  const rear = Array.from({ length: steps }, (_, step) =>
    was === undefined
      ? front
      : onRoute(route, was.s + ((s - was.s) * (step + 1)) / steps + ahead).at
  ).reduce<Point>(
    (from, to) => {
      const span = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
      return [to[0] - ((to[0] - from[0]) / span) * base, to[1] - ((to[1] - from[1]) / span) * base];
    },
    was?.rear ?? [front[0] - road[0] * base, front[1] - road[1] * base]
  );
  const reach = Math.hypot(front[0] - rear[0], front[1] - rear[1]) || 1;
  const heading: Point = [(front[0] - rear[0]) / reach, (front[1] - rear[1]) / reach];
  const steer = Math.atan2(
    heading[0] * road[1] - heading[1] * road[0],
    heading[0] * road[0] + heading[1] * road[1]
  );
  return {
    at: [rear[0] - heading[0] * behind, rear[1] - heading[1] * behind],
    heading,
    steer,
    rear,
  };
}
