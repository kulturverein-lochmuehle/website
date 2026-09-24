import { Vector3 } from 'three';

/**
 * The sun's shadows for a bake, drawn the way a shadow map draws them, in
 * software: every triangle of the model laid onto a grid square to the sun,
 * each cell keeping how far towards the sun the nearest surface over it
 * stands. A point is in shadow where something stands nearer the sun over its
 * cell than it does.
 */

/** How many cells across the map is along its longer side. */
const CELLS = 4096;

/** How far a point is held towards the sun before it is tested, in meters: no face shadows itself. */
const BIAS = 0.12;

export class SunShadow {
  readonly #sun: Vector3;
  readonly #right: Vector3;
  readonly #up: Vector3;
  readonly #origin: [number, number];
  /** Meters a cell. */
  readonly #cell: number;
  readonly #width: number;
  readonly #height: number;
  readonly #nearest: Float32Array;

  /** Meters a cell of the map. */
  get cell(): number {
    return this.#cell;
  }

  /** Draws the map from the triangles, nine numbers each, corners in scene space. */
  constructor(sun: Vector3, triangles: Float32Array) {
    this.#sun = sun.clone().normalize();
    const helper = Math.abs(this.#sun.y) > 0.99 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    this.#right = new Vector3().crossVectors(helper, this.#sun).normalize();
    this.#up = new Vector3().crossVectors(this.#sun, this.#right).normalize();

    const count = triangles.length / 3;
    const [us, vs, ds] = [
      new Float32Array(count),
      new Float32Array(count),
      new Float32Array(count),
    ];
    const point = new Vector3();
    let [minU, maxU, minV, maxV] = [Infinity, -Infinity, Infinity, -Infinity];
    for (let at = 0; at < count; at += 1) {
      point.fromArray(triangles, at * 3);
      const [u, v] = [point.dot(this.#right), point.dot(this.#up)];
      [us[at], vs[at], ds[at]] = [u, v, point.dot(this.#sun)];
      [minU, maxU, minV, maxV] = [
        Math.min(minU, u),
        Math.max(maxU, u),
        Math.min(minV, v),
        Math.max(maxV, v),
      ];
    }
    this.#cell = Math.max(maxU - minU, maxV - minV, 1) / CELLS;
    this.#origin = [minU, minV];
    this.#width = Math.ceil((maxU - minU) / this.#cell) + 1;
    this.#height = Math.ceil((maxV - minV) / this.#cell) + 1;
    this.#nearest = new Float32Array(this.#width * this.#height).fill(-Infinity);

    // each triangle filled cell by cell, what it covers at the cells' middles
    for (let first = 0; first + 2 < count; first += 3) {
      const [x0, y0, x1, y1, x2, y2] = [0, 1, 2].flatMap(k => [
        ((us[first + k] as number) - minU) / this.#cell,
        ((vs[first + k] as number) - minV) / this.#cell,
      ]) as [number, number, number, number, number, number];
      const [d0, d1, d2] = [ds[first], ds[first + 1], ds[first + 2]] as [number, number, number];
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-9) {
        continue;
      }
      const [left, right] = [
        Math.max(Math.floor(Math.min(x0, x1, x2)), 0),
        Math.min(Math.ceil(Math.max(x0, x1, x2)), this.#width - 1),
      ];
      const [bottom, top] = [
        Math.max(Math.floor(Math.min(y0, y1, y2)), 0),
        Math.min(Math.ceil(Math.max(y0, y1, y2)), this.#height - 1),
      ];
      for (let y = bottom; y <= top; y += 1) {
        for (let x = left; x <= right; x += 1) {
          const [px, py] = [x + 0.5, y + 0.5];
          const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
          const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) {
            continue;
          }
          const depth = w0 * d0 + w1 * d1 + w2 * d2;
          const cell = y * this.#width + x;
          if (depth > (this.#nearest[cell] as number)) {
            this.#nearest[cell] = depth;
          }
        }
      }
    }
  }

  /**
   * How far towards the sun the nearest surface over a point's cell stands,
   * or none where nothing does. Drawn with the sun straight overhead it is
   * the height of what is uppermost there.
   */
  nearestOver(point: Vector3): number | undefined {
    const x = Math.floor((point.dot(this.#right) - (this.#origin[0] as number)) / this.#cell);
    const y = Math.floor((point.dot(this.#up) - (this.#origin[1] as number)) / this.#cell);
    if (x < 0 || y < 0 || x >= this.#width || y >= this.#height) {
      return undefined;
    }
    const nearest = this.#nearest[y * this.#width + x] as number;
    return Number.isFinite(nearest) ? nearest : undefined;
  }

  /**
   * The same, but smoothly between the cells' middles, as a surface runs on
   * under them: read cell by cell, a slope steps, and what is worked out from
   * how it slopes - the way it faces - bands with the steps. Where one of the
   * four cells round it holds nothing, the nearest cell's.
   */
  smoothOver(point: Vector3): number | undefined {
    const u = (point.dot(this.#right) - (this.#origin[0] as number)) / this.#cell - 0.5;
    const v = (point.dot(this.#up) - (this.#origin[1] as number)) / this.#cell - 0.5;
    const [x, y] = [Math.floor(u), Math.floor(v)];
    if (x < 0 || y < 0 || x + 1 >= this.#width || y + 1 >= this.#height) {
      return this.nearestOver(point);
    }
    const at = y * this.#width + x;
    const [a, b, c, d] = [at, at + 1, at + this.#width, at + this.#width + 1].map(
      cell => this.#nearest[cell] as number
    ) as [number, number, number, number];
    if (![a, b, c, d].every(Number.isFinite)) {
      return this.nearestOver(point);
    }
    const [s, t] = [u - x, v - y];
    return (a * (1 - s) + b * s) * (1 - t) + (c * (1 - s) + d * s) * t;
  }

  /**
   * How much of the sun reaches a point, nought to one: the share of samples
   * round it, spread over `softness` cells either way, that nothing stands
   * over - a soft edge, as the scene's filtered map draws one - held against
   * the plane of the surface it lies on, facing the way given.
   */
  lightAt(point: Vector3, softness: number, facing?: Vector3): number {
    const u = (point.dot(this.#right) - (this.#origin[0] as number)) / this.#cell;
    const v = (point.dot(this.#up) - (this.#origin[1] as number)) / this.#cell;
    const depth = point.dot(this.#sun) + BIAS;
    // a sample off the point is held against the surface's own plane there,
    // not against the point's depth: a low sun grazes the ground, whose
    // depth runs away a meter or more across a soft edge's samples, and the
    // ground shaded itself
    const toward = facing === undefined ? 0 : facing.dot(this.#sun);
    const [alongU, alongV] =
      facing === undefined || toward < 0.05
        ? [0, 0]
        : [
            (-facing.dot(this.#right) / toward) * this.#cell,
            (-facing.dot(this.#up) / toward) * this.#cell,
          ];
    const steps = 2;
    const spread = Math.max(softness, 1) / steps;
    let [lit, all] = [0, 0];
    for (let j = -steps; j <= steps; j += 1) {
      for (let i = -steps; i <= steps; i += 1) {
        const [x, y] = [Math.floor(u + i * spread), Math.floor(v + j * spread)];
        all += 1;
        if (x < 0 || y < 0 || x >= this.#width || y >= this.#height) {
          lit += 1;
          continue;
        }
        const [du, dv] = [i * spread, j * spread];
        if ((this.#nearest[y * this.#width + x] as number) <= depth + du * alongU + dv * alongV) {
          lit += 1;
        }
      }
    }
    return lit / all;
  }
}
