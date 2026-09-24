import type { Point } from '../../data/data.js';
import { distanceToPath, nearestOn, within } from '../../utils/geometry.utils.js';
import { LANDFILL_GROUND } from '../seam/fills.js';
import { DECK_TOP } from '../structures/decks.js';
import { heightAt, WAY_RUNS } from '../terrain/ground.js';

/**
 * How far a point of the plan is from what must be kept clear - a fire, the
 * bar, a wall - measured to its edge, and nought inside it.
 */
export type Keepout = (at: Point) => number;

/**
 * The surface something stands on at a point of the plan: the ground, or what
 * is piled on it, or the deck or the way laid over it - whichever is highest.
 * A lane stands as proud of the ground as the road did, so it is not the
 * ground's height where one runs.
 */
export function surfaceAt(x: number, y: number): number {
  const way = WAY_RUNS.filter(({ points, half }) => nearestOn(points, x, y).distance <= half).map(
    ({ level }) => level(x, y)
  );
  return Math.max(DECK_TOP()(x, y) ?? -Infinity, LANDFILL_GROUND()(x, y) ?? heightAt(x, y), ...way);
}

/** How far inside an outline a point lies, to its nearest edge; negative where it lies outside. */
export function depthIn(outline: Point[], at: Point): number {
  const edge = distanceToPath([...outline, outline[0] as Point], at);
  return within(at, outline) ? edge : -edge;
}

/** The area an outline encloses, in square meters. */
export const areaOf = (outline: Point[]): number =>
  Math.abs(
    outline.reduce((sum, [x, y], step) => {
      const [nx, ny] = outline[(step + 1) % outline.length] as Point;
      return sum + (x * ny - nx * y);
    }, 0)
  ) / 2;

/** The unit direction of an outline's longest edge, which its rows are laid along. */
export function longestEdge(outline: Point[]): Point {
  const [dx, dy] = outline.reduce<Point>(
    (longest, [x, y], step) => {
      const [nx, ny] = outline[(step + 1) % outline.length] as Point;
      return Math.hypot(nx - x, ny - y) > Math.hypot(longest[0], longest[1])
        ? [nx - x, ny - y]
        : longest;
    },
    [1, 0]
  );
  const length = Math.hypot(dx, dy) || 1;
  return [dx / length, dy / length];
}

/** A point in a frame laid on the plan: so far along, so far across. */
export const inFrame = (at: Point, along: Point, [u, v]: Point): Point => [
  at[0] + along[0] * u - along[1] * v,
  at[1] + along[1] * u + along[0] * v,
];
