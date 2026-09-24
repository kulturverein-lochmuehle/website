import { BufferGeometry, Float32BufferAttribute, Mesh, MeshLambertMaterial } from 'three';

/**
 * What a brush does where it is laid on, each weighed by how near the middle
 * of the brush a point is:
 *
 * - `raise` piles ground on, `strength` times a tenth of a meter a dab,
 * - `lower` takes piled ground away again, as much - never the terrain's own,
 * - `flatten` piles or takes away towards the height it was started at, that
 *   share of the way a dab,
 * - `smooth` takes every point that share of the way to its neighbours' mean.
 */
export type BrushTool = 'raise' | 'lower' | 'flatten' | 'smooth';

/**
 * One dab of a brush, the way it is written down: the tool, where on the plan
 * it was laid, how far it reaches, how strongly, and - for flattening - the
 * height it flattens to.
 */
export type Stroke =
  | [tool: 'raise' | 'lower' | 'smooth', x: number, y: number, radius: number, strength: number]
  | [tool: 'flatten', x: number, y: number, radius: number, strength: number, level: number];

/** How finely the landfill is kept, in meters. */
export const BRUSH_CELL = 0.25;

/** How much a raise or a lower moves the ground a dab at full strength, in meters. */
const BRUSH_STEP = 0.1;

/**
 * How far the ground under one cell may rise across it before it is a cliff -
 * a wall's face, a dump's edge - which landfill is not laid over, in meters.
 */
const BRUSH_CLIFF = 0.3;

/** How far a node may rise or sink before it is tinted again, in meters. */
const TINT_KEPT = 0.05;

/** Less piled on than this is no landfill, only the ground it lies on. */
const BRUSH_NONE = 0.002;

/** How strongly a brush works at a share of its radius out: fully in the middle, not at all at its rim. */
const falloff = (share: number) => (share >= 1 ? 0 : (1 - share * share) ** 2);

/** A grid node's key, from its column and row. */
const keyOf = (column: number, row: number) => `${column}:${row}`;

/**
 * Ground piled onto the terrain by hand: a grid of how much is added at every
 * node, over a ground it is only ever added to. Laid on dab by dab, so the same
 * strokes always give the same landfill.
 */
export class Landfill {
  readonly #added = new Map<string, number>();
  readonly #base = new Map<string, number>();
  /** Each node's color, kept while its height barely changes: tinting is the slow part of drawing. */
  readonly #colors = new Map<string, { height: number; color: number[] }>();
  readonly #groundAt: (x: number, y: number) => number | undefined;

  constructor(groundAt: (x: number, y: number) => number | undefined) {
    this.#groundAt = groundAt;
  }

  /** The ground a node is piled onto, if there is any there. */
  #ground(column: number, row: number): number | undefined {
    const key = keyOf(column, row);
    if (!this.#base.has(key)) {
      const ground = this.#groundAt(column * BRUSH_CELL, row * BRUSH_CELL);
      this.#base.set(key, ground ?? Number.NaN);
    }
    const ground = this.#base.get(key) as number;
    return Number.isNaN(ground) ? undefined : ground;
  }

  /** The height at a node, landfill and all. */
  #height(column: number, row: number): number | undefined {
    const ground = this.#ground(column, row);
    return ground === undefined ? undefined : ground + (this.#added.get(keyOf(column, row)) ?? 0);
  }

  /** The height at a point of the plan, landfill and all, read off the grid. */
  heightAt(x: number, y: number): number | undefined {
    const [column, row] = [Math.floor(x / BRUSH_CELL), Math.floor(y / BRUSH_CELL)];
    const [dx, dy] = [x / BRUSH_CELL - column, y / BRUSH_CELL - row];
    const corners = [
      [column, row, (1 - dx) * (1 - dy)],
      [column + 1, row, dx * (1 - dy)],
      [column, row + 1, (1 - dx) * dy],
      [column + 1, row + 1, dx * dy],
    ] as const;
    const heights = corners.map(([c, r]) => this.#height(c, r));
    if (heights.some(height => height === undefined)) {
      return this.#groundAt(x, y);
    }
    return corners.reduce(
      (sum, [, , weight], corner) => sum + weight * (heights[corner] as number),
      0
    );
  }

  /** Lays one dab on. */
  dab(stroke: Stroke): void {
    const [tool, x, y, radius, strength] = stroke;
    const reach = Math.ceil(radius / BRUSH_CELL);
    const [middle, centre] = [Math.round(x / BRUSH_CELL), Math.round(y / BRUSH_CELL)];
    const nodes = Array.from(
      { length: (reach * 2 + 1) ** 2 },
      (_, step): [number, number, number] => {
        const [column, row] = [
          middle - reach + (step % (reach * 2 + 1)),
          centre - reach + Math.floor(step / (reach * 2 + 1)),
        ];
        const share = Math.hypot(column * BRUSH_CELL - x, row * BRUSH_CELL - y) / radius;
        return [column, row, falloff(share)];
      }
    ).filter(([column, row, weight]) => weight > 0 && this.#ground(column, row) !== undefined);

    // every node's new height worked out before any is written, so a smoothing
    // dab reads its neighbours as they were
    const moved = nodes.map(([column, row, weight]) => {
      const ground = this.#ground(column, row) as number;
      const height = this.#height(column, row) as number;
      const towards = (() => {
        switch (tool) {
          case 'raise':
            return height + BRUSH_STEP * strength * weight;
          case 'lower':
            return height - BRUSH_STEP * strength * weight;
          case 'flatten':
            return height + (stroke[5] - height) * Math.min(1, strength) * weight;
          case 'smooth': {
            const around = [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ].flatMap(([dc, dr]) => {
              const other = this.#height(column + (dc as number), row + (dr as number));
              return other === undefined ? [] : [other];
            });
            const mean = around.reduce((sum, other) => sum + other, height) / (around.length + 1);
            return height + (mean - height) * Math.min(1, strength) * weight;
          }
        }
      })();
      // landfill only: never under the ground it is piled on
      return [keyOf(column, row), Math.max(0, towards - ground)] as const;
    });
    moved.forEach(([key, added]) =>
      added > BRUSH_NONE ? this.#added.set(key, added) : this.#added.delete(key)
    );
  }

  /** Whether anything is piled on at all. */
  get empty(): boolean {
    return this.#added.size === 0;
  }

  /**
   * The landfill as a surface: every grid cell with ground piled on at all
   * four corners, and no cliff under it. A cell half piled on would run out
   * over a wall's coping as a saw tooth, and the few millimeters a brush's rim
   * leaves are not worth one.
   */
  geometry(tint: (x: number, y: number, height: number) => number[]): BufferGeometry {
    const cells = [...this.#added.keys()].filter(key => {
      const [column, row] = key.split(':').map(Number) as [number, number];
      const corners = [
        [column, row],
        [column + 1, row],
        [column, row + 1],
        [column + 1, row + 1],
      ] as const;
      if (corners.some(([c, r]) => !this.#added.has(keyOf(c, r)))) {
        return false;
      }
      const grounds = corners.map(([c, r]) => this.#ground(c, r) as number);
      return Math.max(...grounds) - Math.min(...grounds) < BRUSH_CLIFF;
    });
    const index = new Map<string, number>();
    const positions: number[] = [];
    const colors: number[] = [];
    const vertex = (column: number, row: number): number | undefined => {
      const key = keyOf(column, row);
      const known = index.get(key);
      if (known !== undefined) {
        return known;
      }
      const height = this.#height(column, row);
      if (height === undefined) {
        return undefined;
      }
      const [x, y] = [column * BRUSH_CELL, row * BRUSH_CELL];
      index.set(key, positions.length / 3);
      positions.push(x, height, -y);
      const kept = this.#colors.get(key);
      const color =
        kept !== undefined && Math.abs(kept.height - height) < TINT_KEPT
          ? kept.color
          : tint(x, y, height);
      if (color !== kept?.color) {
        this.#colors.set(key, { height, color });
      }
      colors.push(...color);
      return index.get(key);
    };
    const indices = [...cells].flatMap(key => {
      const [column, row] = key.split(':').map(Number) as [number, number];
      const corners = [
        vertex(column, row),
        vertex(column + 1, row),
        vertex(column + 1, row + 1),
        vertex(column, row + 1),
      ];
      if (corners.some(corner => corner === undefined)) {
        return [];
      }
      const [a, b, c, d] = corners as [number, number, number, number];
      // counter clockwise on the plan faces up once north is mirrored onto -z
      return [a, b, c, a, c, d];
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
}

/** The landfill drawn over the terrain, which it meets where nothing is piled on. */
export function createLandfill(): Mesh {
  const mesh = new Mesh(
    new BufferGeometry(),
    new MeshLambertMaterial({
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  mesh.name = 'landfill';
  return mesh;
}

/** Strokes as they are written into the source, a dab a line, to the centimeter. */
export function strokesSource(strokes: Stroke[]): string {
  const round = (value: number) => Math.round(value * 100) / 100;
  return [
    'export const BRUSHES: Stroke[] = [',
    ...strokes.map(
      stroke =>
        `  [${stroke.map(part => (typeof part === 'number' ? round(part) : `'${part}'`)).join(', ')}],`
    ),
    '];',
  ].join('\n');
}
