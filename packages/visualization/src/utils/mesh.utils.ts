import type { Object3D } from 'three';
import { Mesh, Vector3 } from 'three';

/**
 * Small builders of meshes the structures are made of - struts, mitred rails, a ring of roof - and freeing what was built.
 */
/**
 * A box from one point to another, square across by a width, for a beam or a
 * brace - turned so one pair of its sides faces a way, if given: a post, which
 * stands upright, has none of its own.
 */
export function strut(
  positions: number[],
  from: Vector3,
  to: Vector3,
  width: number,
  facing?: Vector3,
  roll = 0
): void {
  const along = to.clone().sub(from).normalize();
  const side = (facing?.clone() ?? new Vector3(0, 1, 0)).cross(along);
  if (side.lengthSq() < 1e-6) {
    side.set(1, 0, 0);
  }
  side.normalize().multiplyScalar(width / 2);
  const up = along
    .clone()
    .cross(side)
    .normalize()
    .multiplyScalar(width / 2);
  // turned about its own length, if asked: a round pipe drawn square reads
  // rounder standing on an edge
  if (roll !== 0) {
    const [turnedSide, turnedUp] = [
      side.clone().multiplyScalar(Math.cos(roll)).addScaledVector(up, Math.sin(roll)),
      up.clone().multiplyScalar(Math.cos(roll)).addScaledVector(side, -Math.sin(roll)),
    ];
    side.copy(turnedSide);
    up.copy(turnedUp);
  }
  const corners = (at: Vector3) => [
    at.clone().add(side).add(up),
    at.clone().add(side).sub(up),
    at.clone().sub(side).sub(up),
    at.clone().sub(side).add(up),
  ];
  const [a, b] = [corners(from), corners(to)];
  const quad = (p: Vector3, q: Vector3, r: Vector3, t: Vector3) =>
    [p, q, r, p, r, t].forEach(v => positions.push(v.x, v.y, v.z));
  [0, 1, 2, 3].forEach(k => {
    const l = (k + 1) % 4;
    quad(a[k] as Vector3, b[k] as Vector3, b[l] as Vector3, a[l] as Vector3);
  });
  quad(a[0] as Vector3, a[1] as Vector3, a[2] as Vector3, a[3] as Vector3);
  quad(b[3] as Vector3, b[2] as Vector3, b[1] as Vector3, b[0] as Vector3);
}

/**
 * A rail along a line of points, square across by a width and turned about
 * its length: each piece ending where it meets the next in the plane halving
 * the angle between the two - mitred, like a frame's corner - so that at a
 * corner their edges meet round its outside and nothing stands out past it;
 * at either end of the line flat, half its width past the last point.
 */
export function mitred(positions: number[], points: Vector3[], width: number, roll: number): void {
  const ways = points.slice(1).map((point, step) =>
    point
      .clone()
      .sub(points[step] as Vector3)
      .normalize()
  );
  // each piece's sideways, square to it on the plan - a piece standing
  // straight up, as where a rail bends down into its post, has none of its
  // own and takes its nearest neighbour's, so the pipe does not twist
  const flat = ways.map(way => {
    const side = new Vector3(0, 1, 0).cross(way);
    return side.lengthSq() < 1e-6 ? undefined : side.normalize();
  });
  const sides = flat.map(
    (side, step) =>
      side ??
      flat.slice(step).find(other => other !== undefined) ??
      flat
        .slice(0, step)
        .reverse()
        .find(other => other !== undefined) ??
      new Vector3(1, 0, 0)
  );
  ways.forEach((way, step) => {
    const [from, to] = [points[step] as Vector3, points[step + 1] as Vector3];
    const [before, after] = [ways[step - 1], ways[step + 1]];
    // the plane each end lies in: through the point, square to the halfway
    // between this piece's way and the other's - or to its own, at an end
    const planes = [
      before === undefined
        ? { at: from.clone().addScaledVector(way, -width / 2), normal: way }
        : { at: from, normal: before.clone().add(way).normalize() },
      after === undefined
        ? { at: to.clone().addScaledVector(way, width / 2), normal: way }
        : { at: to, normal: way.clone().add(after).normalize() },
    ];
    const side = (sides[step] as Vector3).clone().multiplyScalar(width / 2);
    const up = way
      .clone()
      .cross(side)
      .normalize()
      .multiplyScalar(width / 2);
    const [turnedSide, turnedUp] = [
      side.clone().multiplyScalar(Math.cos(roll)).addScaledVector(up, Math.sin(roll)),
      up.clone().multiplyScalar(Math.cos(roll)).addScaledVector(side, -Math.sin(roll)),
    ];
    const offsets = [
      turnedSide.clone().add(turnedUp),
      turnedSide.clone().sub(turnedUp),
      turnedSide.clone().negate().sub(turnedUp),
      turnedSide.clone().negate().add(turnedUp),
    ];
    // each corner of the section slid along the rail onto the end's plane
    const [a, b] = [from, to].map((point, end) => {
      const { at, normal } = planes[end] as { at: Vector3; normal: Vector3 };
      return offsets.map(offset => {
        const corner = point.clone().add(offset);
        const by = at.clone().sub(corner).dot(normal) / way.dot(normal);
        return corner.addScaledVector(way, by);
      });
    }) as [Vector3[], Vector3[]];
    const quad = (p: Vector3, q: Vector3, r: Vector3, t: Vector3) =>
      [p, q, r, p, r, t].forEach(v => positions.push(v.x, v.y, v.z));
    [0, 1, 2, 3].forEach(k => {
      const l = (k + 1) % 4;
      quad(a[k] as Vector3, b[k] as Vector3, b[l] as Vector3, a[l] as Vector3);
    });
    quad(a[0] as Vector3, a[1] as Vector3, a[2] as Vector3, a[3] as Vector3);
    quad(b[3] as Vector3, b[2] as Vector3, b[1] as Vector3, b[0] as Vector3);
  });
}

/** An octagonal ring of faces from one ring of corners to another, for a roof. */
export function octagonal(positions: number[], lower: Vector3[], upper: Vector3[]): void {
  lower.forEach((a, k) => {
    const [b, c, d] = [lower[(k + 1) % 8], upper[(k + 1) % 8], upper[k]] as [
      Vector3,
      Vector3,
      Vector3,
    ];
    [a, b, c, a, c, d].forEach(v => positions.push(v.x, v.y, v.z));
  });
}

/** Frees the GPU memory of a subtree, three.js does not do it on removal. */
export function dispose(root: Object3D): void {
  root.traverse(object => {
    if (!(object instanceof Mesh)) {
      return;
    }
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => material.dispose());
  });
}
