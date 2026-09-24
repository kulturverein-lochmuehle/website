import { Vector3 } from 'three';

/**
 * A triangle as the occlusion test takes it: its corners in scene space, and
 * how far it is pulled towards the eye to lie over what it is painted on.
 */
export interface Occluder {
  corners: [Vector3, Vector3, Vector3];
  /** Drawn over what it lies on, the way a polygon offset draws it. */
  pulled: boolean;
}

/** How many pixels across each face of the cube around the eye is tested at. */
const RESOLUTION = 1024;

/** How near the eye nothing is tested, in meters. */
const NEAR = 0.05;

/** How much nearer a pulled triangle counts, as a share of its distance. */
const PULL = 2e-4;

/** And how much nearer anything may be and still count as a tie, as a share. */
const TIE = 1e-4;

/**
 * Which triangles an eye standing still could ever see: all of them drawn,
 * from where it stands, onto five faces of a cube around it - ahead, to
 * either side, above and below, so a canvas of any shape is covered - each
 * pixel keeping the nearest. A triangle is kept where it could win any pixel
 * it touches, even in part, at its nearest corner: so none is left out that
 * might show, whatever the resolution the page draws at, and only what is
 * wholly behind others goes.
 */
export function visibleFrom(eye: Vector3, forward: Vector3, triangles: Occluder[]): boolean[] {
  const ahead = forward.clone().normalize();
  const right = ahead
    .clone()
    .cross(new Vector3(0, 1, 0))
    .normalize();
  const up = right.clone().cross(ahead).normalize();
  const faces: [Vector3, Vector3, Vector3][] = [
    [ahead, right, up],
    [right, ahead.clone().negate(), up],
    [right.clone().negate(), ahead, up],
    [up, right, ahead.clone().negate()],
    [up.clone().negate(), right, ahead],
  ];
  const visible = triangles.map(() => false);
  const nearness = new Float32Array(RESOLUTION * RESOLUTION);

  faces.forEach(([facing, across, upward]) => {
    nearness.fill(0);
    // each triangle seen from the eye on this face: its corners as how far
    // across and up the face they fall, and one over how far ahead - which
    // runs straight across the face, so it can be interpolated there
    const projected = triangles.map(({ corners, pulled }) => {
      const seen = corners.map(corner => {
        const at = corner.clone().sub(eye);
        return [at.dot(across), at.dot(upward), at.dot(facing)] as [number, number, number];
      });
      return clipped(seen).map(polygon =>
        polygon.map(([x, y, w]) => {
          const inverse = (1 / w) * (pulled ? 1 + PULL : 1);
          return [
            ((x / w) * 0.5 + 0.5) * RESOLUTION,
            ((y / w) * 0.5 + 0.5) * RESOLUTION,
            inverse,
          ] as [number, number, number];
        })
      );
    });

    // first how near every pixel is covered - by a triangle covering all of
    // it, at the farthest it is within it: a gap narrower than a pixel is
    // never taken to be closed
    projected.forEach(polygons =>
      polygons.forEach(polygon =>
        fan(polygon).forEach(triangle =>
          raster(triangle, 'covering', (index, inverse) => {
            if (inverse > (nearness[index] as number)) {
              nearness[index] = inverse;
            }
          })
        )
      )
    );
    // then each triangle against it, over every pixel it touches at all, at
    // the nearest it comes anywhere
    projected.forEach((polygons, step) => {
      if (visible[step]) {
        return;
      }
      const nearest = Math.max(...polygons.flat().map(([, , inverse]) => inverse));
      const wins = polygons.some(polygon =>
        fan(polygon).some(triangle => {
          let won = false;
          raster(triangle, 'touching', index => {
            if (nearest >= (nearness[index] as number) * (1 - TIE)) {
              won = true;
            }
          });
          return won;
        })
      );
      if (wins) {
        visible[step] = true;
      }
    });
  });
  return visible;
}

type Seen = [x: number, y: number, w: number];

/** A triangle cut to what lies ahead of the eye, as none, one or a polygon of four. */
function clipped(corners: Seen[]): Seen[][] {
  const kept: Seen[] = [];
  corners.forEach((corner, step) => {
    const next = corners[(step + 1) % corners.length] as Seen;
    const [inside, nextInside] = [corner[2] >= NEAR, next[2] >= NEAR];
    if (inside) {
      kept.push(corner);
    }
    if (inside !== nextInside) {
      const share = (NEAR - corner[2]) / (next[2] - corner[2]);
      kept.push([
        corner[0] + (next[0] - corner[0]) * share,
        corner[1] + (next[1] - corner[1]) * share,
        NEAR,
      ]);
    }
  });
  return kept.length >= 3 ? [kept] : [];
}

/** A polygon as triangles fanned from its first corner. */
function fan<T>(polygon: T[]): [T, T, T][] {
  return polygon
    .slice(1, -1)
    .map((corner, step) => [polygon[0] as T, corner, polygon[step + 2] as T]);
}

/**
 * Visits the pixels of a triangle on a face: covering, those it covers all
 * of, with one over the farthest it is within each; touching, every pixel it
 * reaches into at all.
 */
function raster(
  [a, b, c]: [Seen, Seen, Seen],
  mode: 'covering' | 'touching',
  visit: (index: number, inverse: number) => void
): void {
  const touching = mode === 'touching';
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const xs = [a[0], b[0], c[0]];
  const ys = [a[1], b[1], c[1]];
  const [left, right] = [
    Math.max(0, Math.floor(Math.min(...xs))),
    Math.min(RESOLUTION - 1, Math.floor(Math.max(...xs))),
  ];
  const [bottom, top] = [
    Math.max(0, Math.floor(Math.min(...ys))),
    Math.min(RESOLUTION - 1, Math.floor(Math.max(...ys))),
  ];
  if (left > right || bottom > top) {
    return;
  }
  if (touching) {
    // a sliver or a speck might cover no pixel's middle and still show: it
    // counts on every pixel its box reaches into, which only ever keeps more
    if (Math.abs(area) < 1 || (right - left + 1) * (top - bottom + 1) <= 4) {
      for (let y = bottom; y <= top; y += 1) {
        for (let x = left; x <= right; x += 1) {
          visit(y * RESOLUTION + x, 0);
        }
      }
      return;
    }
  }
  if (area === 0) {
    return;
  }
  const sign = area > 0 ? 1 : -1;
  // one over the distance runs straight across the face: how fast it changes
  // either way, which says how much farther it is at a pixel's far corner
  const across = ((b[2] - a[2]) * (c[1] - a[1]) - (c[2] - a[2]) * (b[1] - a[1])) / area;
  const upward = ((c[2] - a[2]) * (b[0] - a[0]) - (b[2] - a[2]) * (c[0] - a[0])) / area;
  const spread = (Math.abs(across) + Math.abs(upward)) / 2;
  // how far a pixel's middle is from an edge when the pixel just touches it,
  // or just lies wholly inside: half its width and half its height along the
  // edge's normal, outside or in
  const edges = [
    [b, c],
    [c, a],
    [a, b],
  ].map(([from, to]) => {
    const [p, q] = [from as Seen, to as Seen];
    const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
    const half = (Math.abs(dx) + Math.abs(dy)) / 2;
    return { p, dx, dy, slack: touching ? -half : half };
  });
  for (let y = bottom; y <= top; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const [px, py] = [x + 0.5, y + 0.5];
      const weights = edges.map(({ p, dx, dy }) => ((px - p[0]) * dy - (py - p[1]) * dx) * -sign);
      if (weights.every((weight, edge) => weight >= (edges[edge] as { slack: number }).slack)) {
        const [wa, wb, wc] = weights.map(weight => weight / Math.abs(area)) as [
          number,
          number,
          number,
        ];
        visit(y * RESOLUTION + x, wa * a[2] + wb * b[2] + wc * c[2] - (touching ? 0 : spread));
      }
    }
  }
}
