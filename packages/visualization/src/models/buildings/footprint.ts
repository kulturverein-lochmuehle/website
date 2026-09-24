import type { Point } from '../../data/data.js';
import { BUILDINGS } from '../../data/data.js';

export interface Rect {
  center: Point;
  /** Extent along the longer axis in meters. */
  length: number;
  /** Extent along the shorter axis in meters. */
  width: number;
  /** Rotation of the longer axis against east, counter clockwise in radians. */
  angle: number;
}

/**
 * Wraps a footprint in the smallest rectangle it fits into. The outlines are
 * traced from aerial imagery and never quite square, a box built straight from
 * their corners would lean.
 */
export function boundingRect(footprint: Point[]): Rect {
  return footprint.reduce<Rect | undefined>((best, [ax, ay], index) => {
    const [bx, by] = footprint[(index + 1) % footprint.length] as Point;
    const angle = Math.atan2(by - ay, bx - ax);
    const [cos, sin] = [Math.cos(-angle), Math.sin(-angle)];
    const rotated = footprint.map(([x, y]): Point => [x * cos - y * sin, x * sin + y * cos]);
    const xs = rotated.map(([x]) => x);
    const ys = rotated.map(([, y]) => y);
    const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
    const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
    const [width, height] = [maxX - minX, maxY - minY];
    if (best !== undefined && width * height >= best.length * best.width) {
      return best;
    }

    // back into the local grid, the rectangle was measured in the rotated frame
    const [cx, cy] = [(minX + maxX) / 2, (minY + maxY) / 2];
    const center: Point = [cx * cos + cy * sin, -cx * sin + cy * cos];
    return width >= height
      ? { center, length: width, width: height, angle }
      : { center, length: height, width, angle: angle + Math.PI / 2 };
  }, undefined) as Rect;
}

/** The three buildings as rectangles, measured once. */
export const RECTS: Rect[] = BUILDINGS.map(({ footprint }) => boundingRect(footprint));

/** Center of the built cluster - the yard, and what the scene is arranged around. */
export const YARD_CENTER: Point = [
  RECTS.reduce((sum, { center: [x] }) => sum + x, 0) / RECTS.length,
  RECTS.reduce((sum, { center: [, y] }) => sum + y, 0) / RECTS.length,
];

/** Distance from a point to the nearest wall, zero inside a building. */
export function distanceToBuildings([x, y]: Point): number {
  return RECTS.reduce((closest, { center: [cx, cy], length, width, angle }) => {
    const [cos, sin] = [Math.cos(-angle), Math.sin(-angle)];
    const [dx, dy] = [x - cx, y - cy];
    // into the rectangle's own frame, where the distance is two clamps
    const along = Math.abs(dx * cos - dy * sin) - length / 2;
    const across = Math.abs(dx * sin + dy * cos) - width / 2;
    const outside = Math.hypot(Math.max(along, 0), Math.max(across, 0));
    return Math.min(closest, outside);
  }, Infinity);
}
