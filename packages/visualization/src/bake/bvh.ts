/**
 * Triangles sorted into a tree of boxes, for a bake's shadow rays: each box
 * holds the boxes of its two halves, split across its longest side, down to a
 * few triangles each - so a ray is tested against the few triangles in the
 * boxes it passes through, not against every one round it.
 */

/** How many triangles a box holds at most before it is split. */
const LEAF = 4;

/** Into how many bins a box's triangles are sorted along each side, to weigh where to split it. */
const BINS = 16;

/** The surface of a box, six numbers from a place in a list: how likely a ray through its parent passes it. */
const surface = (box: Float64Array, at: number) => {
  const x = (box[at + 3] as number) - (box[at] as number);
  const y = (box[at + 4] as number) - (box[at + 1] as number);
  const z = (box[at + 5] as number) - (box[at + 2] as number);
  return x < 0 ? 0 : x * y + y * z + z * x;
};

/**
 * Sorts a stretch of the order so its two halves make the cheapest pair of
 * boxes for a ray to test - each side weighed by its surface and how many
 * triangles it holds, at every bin's edge along every side - and says where
 * the second half starts. Where nothing parts them, it halves the stretch at
 * its middle along its longest side.
 */
function split(
  triangles: Float32Array,
  middles: Float32Array,
  order: Int32Array,
  from: number,
  to: number
): number {
  const least = [Infinity, Infinity, Infinity];
  const most = [-Infinity, -Infinity, -Infinity];
  for (let at = from; at < to; at += 1) {
    const triangle = order[at] as number;
    for (let k = 0; k < 3; k += 1) {
      const value = middles[triangle * 3 + k] as number;
      least[k] = Math.min(least[k] as number, value);
      most[k] = Math.max(most[k] as number, value);
    }
  }
  let best = { cost: Infinity, axis: -1, bin: -1 };
  const boxes = new Float64Array(BINS * 6);
  const counts = new Int32Array(BINS);
  const sweep = new Float64Array(6);
  const before = new Float64Array(BINS);
  const beforeCount = new Int32Array(BINS);
  const binOf = (value: number, axis: number) =>
    Math.min(
      BINS - 1,
      Math.floor(
        ((value - (least[axis] as number)) / ((most[axis] as number) - (least[axis] as number))) *
          BINS
      )
    );
  for (let axis = 0; axis < 3; axis += 1) {
    if ((most[axis] as number) <= (least[axis] as number)) {
      continue;
    }
    for (let bin = 0; bin < BINS; bin += 1) {
      boxes.set([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], bin * 6);
    }
    counts.fill(0);
    for (let at = from; at < to; at += 1) {
      const triangle = order[at] as number;
      const bin = binOf(middles[triangle * 3 + axis] as number, axis);
      counts[bin] = (counts[bin] as number) + 1;
      for (let corner = 0; corner < 3; corner += 1) {
        for (let k = 0; k < 3; k += 1) {
          const value = triangles[triangle * 9 + corner * 3 + k] as number;
          boxes[bin * 6 + k] = Math.min(boxes[bin * 6 + k] as number, value);
          boxes[bin * 6 + k + 3] = Math.max(boxes[bin * 6 + k + 3] as number, value);
        }
      }
    }
    // from the low end: the box and count of every bin up to each edge
    sweep.set([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    let count = 0;
    for (let bin = 0; bin < BINS - 1; bin += 1) {
      for (let k = 0; k < 3; k += 1) {
        sweep[k] = Math.min(sweep[k] as number, boxes[bin * 6 + k] as number);
        sweep[k + 3] = Math.max(sweep[k + 3] as number, boxes[bin * 6 + k + 3] as number);
      }
      count += counts[bin] as number;
      before[bin] = surface(sweep, 0);
      beforeCount[bin] = count;
    }
    // and from the high end, weighing each edge as it is passed
    sweep.set([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    count = 0;
    for (let bin = BINS - 1; bin > 0; bin -= 1) {
      for (let k = 0; k < 3; k += 1) {
        sweep[k] = Math.min(sweep[k] as number, boxes[bin * 6 + k] as number);
        sweep[k + 3] = Math.max(sweep[k + 3] as number, boxes[bin * 6 + k + 3] as number);
      }
      count += counts[bin] as number;
      const below = beforeCount[bin - 1] as number;
      if (below === 0 || count === 0) {
        continue;
      }
      const cost = (before[bin - 1] as number) * below + surface(sweep, 0) * count;
      if (cost < best.cost) {
        best = { cost, axis, bin };
      }
    }
  }
  if (best.axis < 0) {
    const sides = [0, 1, 2].map(k => (most[k] as number) - (least[k] as number));
    const axis = sides.indexOf(Math.max(...sides));
    const stretch = Array.from(order.subarray(from, to)).sort(
      (one, other) => (middles[one * 3 + axis] as number) - (middles[other * 3 + axis] as number)
    );
    order.set(stretch, from);
    return Math.floor((from + to) / 2);
  }
  // the stretch parted at the best edge, the low bins first
  const stretch = Array.from(order.subarray(from, to));
  const low = stretch.filter(
    triangle => binOf(middles[triangle * 3 + best.axis] as number, best.axis) < best.bin
  );
  const high = stretch.filter(
    triangle => binOf(middles[triangle * 3 + best.axis] as number, best.axis) >= best.bin
  );
  order.set([...low, ...high], from);
  return from + low.length;
}

export class Triangles {
  /** Nine numbers a triangle, corners in scene space, in the tree's order. */
  readonly #triangles: Float32Array;
  /** Six numbers a box: its least and most corner. */
  readonly #bounds: Float32Array;
  /** Two numbers a box: its first half's box, or where its triangles start, and how many - none for a split one. */
  readonly #nodes: Int32Array;
  readonly #stack = new Int32Array(256);

  constructor(triangles: Float32Array) {
    const count = Math.floor(triangles.length / 9);
    const middles = new Float32Array(count * 3);
    for (let at = 0; at < count; at += 1) {
      for (let k = 0; k < 3; k += 1) {
        middles[at * 3 + k] =
          ((triangles[at * 9 + k] as number) +
            (triangles[at * 9 + 3 + k] as number) +
            (triangles[at * 9 + 6 + k] as number)) /
          3;
      }
    }
    const order = Int32Array.from({ length: count }, (_, at) => at);
    const most = Math.max(count * 2 - 1, 1);
    const bounds = new Float32Array(most * 6);
    const nodes = new Int32Array(most * 2);
    let made = 1;
    // each box from a stretch of the order, split in half along its longest side
    const pending: [number, number, number][] = [[0, 0, count]];
    while (pending.length > 0) {
      const [node, from, to] = pending.pop() as [number, number, number];
      const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      const spread = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let at = from; at < to; at += 1) {
        const triangle = order[at] as number;
        for (let corner = 0; corner < 3; corner += 1) {
          for (let k = 0; k < 3; k += 1) {
            const value = triangles[triangle * 9 + corner * 3 + k] as number;
            box[k] = Math.min(box[k] as number, value);
            box[k + 3] = Math.max(box[k + 3] as number, value);
          }
        }
        for (let k = 0; k < 3; k += 1) {
          const value = middles[triangle * 3 + k] as number;
          spread[k] = Math.min(spread[k] as number, value);
          spread[k + 3] = Math.max(spread[k + 3] as number, value);
        }
      }
      bounds.set(box, node * 6);
      const sides = [0, 1, 2].map(k => (spread[k + 3] as number) - (spread[k] as number));
      const axis = sides.indexOf(Math.max(...sides));
      if (to - from <= LEAF || (sides[axis] as number) <= 0) {
        [nodes[node * 2], nodes[node * 2 + 1]] = [from, to - from];
        continue;
      }
      const half = split(triangles, middles, order, from, to);
      const left = made;
      made += 2;
      [nodes[node * 2], nodes[node * 2 + 1]] = [left, 0];
      pending.push([left, from, half], [left + 1, half, to]);
    }
    this.#triangles = new Float32Array(count * 9);
    order.forEach((triangle, at) =>
      this.#triangles.set(triangles.subarray(triangle * 9, triangle * 9 + 9), at * 9)
    );
    this.#bounds = bounds.slice(0, made * 6);
    this.#nodes = nodes.slice(0, made * 2);
  }

  /**
   * Whether anything stands on the way from a point to another, short of it
   * by `short` meters - Möller and Trumbore's test on each triangle in a box
   * the way passes through.
   */
  between(
    ox: number,
    oy: number,
    oz: number,
    px: number,
    py: number,
    pz: number,
    short: number
  ): boolean {
    // plain numbers all through, no arrays made and taken apart: this runs
    // for every point of every lamp's shadow
    const dx = px - ox;
    const dy = py - oy;
    const dz = pz - oz;
    const length = Math.hypot(dx, dy, dz);
    const reach = 1 - short / length;
    const ix = 1 / dx;
    const iy = 1 / dy;
    const iz = 1 / dz;
    const bounds = this.#bounds;
    const nodes = this.#nodes;
    const triangles = this.#triangles;
    const stack = this.#stack;
    let top = 0;
    stack[top++] = 0;
    while (top > 0) {
      const node = stack[--top] as number;
      const b = node * 6;
      // the slabs' test: where the way enters and leaves the box, from nought to its reach
      const ax0 = ((bounds[b] as number) - ox) * ix;
      const ax1 = ((bounds[b + 3] as number) - ox) * ix;
      const ay0 = ((bounds[b + 1] as number) - oy) * iy;
      const ay1 = ((bounds[b + 4] as number) - oy) * iy;
      const az0 = ((bounds[b + 2] as number) - oz) * iz;
      const az1 = ((bounds[b + 5] as number) - oz) * iz;
      const enter = Math.max(
        ax0 < ax1 ? ax0 : ax1,
        ay0 < ay1 ? ay0 : ay1,
        az0 < az1 ? az0 : az1,
        0
      );
      const leave = Math.min(
        ax0 < ax1 ? ax1 : ax0,
        ay0 < ay1 ? ay1 : ay0,
        az0 < az1 ? az1 : az0,
        reach
      );
      // NaN, from a way along a box's face, keeps the box in
      if (enter > leave) {
        continue;
      }
      const first = nodes[node * 2] as number;
      const count = nodes[node * 2 + 1] as number;
      if (count === 0) {
        stack[top++] = first;
        stack[top++] = first + 1;
        continue;
      }
      for (let at = first * 9; at < (first + count) * 9; at += 9) {
        const ax = triangles[at] as number;
        const ay = triangles[at + 1] as number;
        const az = triangles[at + 2] as number;
        const e1x = (triangles[at + 3] as number) - ax;
        const e1y = (triangles[at + 4] as number) - ay;
        const e1z = (triangles[at + 5] as number) - az;
        const e2x = (triangles[at + 6] as number) - ax;
        const e2y = (triangles[at + 7] as number) - ay;
        const e2z = (triangles[at + 8] as number) - az;
        const qx = dy * e2z - dz * e2y;
        const qy = dz * e2x - dx * e2z;
        const qz = dx * e2y - dy * e2x;
        const det = e1x * qx + e1y * qy + e1z * qz;
        if (det > -1e-9 && det < 1e-9) {
          continue;
        }
        const tx = ox - ax;
        const ty = oy - ay;
        const tz = oz - az;
        const u = (tx * qx + ty * qy + tz * qz) / det;
        if (u < 0 || u > 1) {
          continue;
        }
        const rx = ty * e1z - tz * e1y;
        const ry = tz * e1x - tx * e1z;
        const rz = tx * e1y - ty * e1x;
        const v = (dx * rx + dy * ry + dz * rz) / det;
        if (v < 0 || u + v > 1) {
          continue;
        }
        const t = (e2x * rx + e2y * ry + e2z * rz) / det;
        if (t > 1e-4 && t < reach) {
          return true;
        }
      }
    }
    return false;
  }
}
