import type { BufferGeometry, Material, Object3D } from 'three';
import {
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix3,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  Vector3,
} from 'three';

import type { Palette } from '../scene/palette.js';
import { direction, FILL, SUN } from '../scene/scene.js';
import { visibleFrom } from './occlusion.js';
import type { ViewSpec } from './views.js';

/**
 * A view baked for the site, and what the component that shows it reads:
 *
 * - `KVLM`, then the length of the header in bytes, a little endian uint32,
 * - the header, JSON, padded with spaces to four bytes (`PrefabHeader`),
 * - then each group of triangles in turn: its vertices - positions as float32
 *   x, y, z, then colors as sRGB bytes r, g, b, the light already in them -
 *   and the triangles as indices into them, three a triangle, uint16 where
 *   the vertices allow and uint32 where not, each written as the step from
 *   the one before, wrapping round: they climb as the vertices are first
 *   used, and small steps compress well. Each block padded to four bytes.
 *
 * The whole of it gzipped, as written to the file: the site's host may not
 * compress what it does not know, and the browser unpacks it as it comes.
 *
 * One group is one draw call, all of them drawn unlit with one shader: the
 * eye never moves, and neither does the sun, so the light is baked.
 */
export interface PrefabHeader {
  version: 1;
  /** Seen from where its camera stands only, or from anywhere. */
  kind: ViewSpec['kind'];
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    /** What a free view turns around: the point looked at, on the ground. */
    pivot: [number, number, number];
    /** How wide it sees, across, in degrees. */
    fov: number;
    near: number;
    far: number;
  };
  groups: PrefabGroup[];
}

export interface PrefabGroup {
  doubleSided: boolean;
  /** Pulled towards the camera by so much, to lie over what it is painted on. */
  offset?: [factor: number, units: number];
  renderOrder: number;
  /** How many vertices it shares out. */
  vertices: number;
  /** How many indices, three a triangle. */
  indices: number;
}

type Drawn = Omit<PrefabGroup, 'vertices' | 'indices'>;

/** How near the eye nothing is drawn, in meters. */
const NEAR = 0.1;

/** How far past the sides of the view a triangle is still kept, in degrees. */
const MARGIN = 6;

/** The nearest render order set on an object or on what it hangs from. */
function orderOf(object: Object3D): number {
  for (let at: Object3D | null = object; at !== null; at = at.parent) {
    if (at.renderOrder !== 0) {
      return at.renderOrder;
    }
  }
  return 0;
}

/** Whether an object and all it hangs from are shown. */
function shown(object: Object3D): boolean {
  for (let at: Object3D | null = object; at !== null; at = at.parent) {
    if (!at.visible) {
      return false;
    }
  }
  return true;
}

/** The ground's height under a point of the plan: the first surface a ray down meets. */
function surfaceAt(model: Object3D, [x, y]: [number, number]): number {
  const ray = new Raycaster(new Vector3(x, 1000, -y), new Vector3(0, -1, 0));
  const hit = ray
    .intersectObject(model, true)
    .find(({ object }) => object instanceof Mesh && !(object instanceof InstancedMesh));
  return hit?.point.y ?? 0;
}

/** Where the eye of a view stands and what it looks at, in scene space. */
export function viewCamera(model: Object3D, view: ViewSpec): PrefabHeader['camera'] {
  model.updateMatrixWorld(true);
  const position = new Vector3(
    view.eye[0],
    surfaceAt(model, [view.eye[0], view.eye[1]]) + view.height,
    -view.eye[1]
  );
  // the compass direction it looks towards; turned round, it is the one it
  // looks from, which is how `direction` counts
  const bearing =
    (Math.atan2(view.look[0] - view.eye[0], view.look[1] - view.eye[1]) * 180) / Math.PI;
  const target = position.clone().sub(direction(bearing + 180, -view.pitch));
  return {
    position: position.toArray(),
    target: target.toArray(),
    pivot: [view.look[0], surfaceAt(model, [view.look[0], view.look[1]]), -view.look[1]],
    fov: view.fov,
    near: NEAR,
    far: view.far,
  };
}

/**
 * Whether a triangle's corners, seen from the eye, span some of the view's
 * width: as angles off straight ahead, the arc they span is the one left
 * once the widest gap between them is taken away, and two arcs of a circle
 * meet where either holds the other's start.
 */
function spans(seen: Vector3[], half: number): boolean {
  const angles = seen.map(({ x, z }) => Math.atan2(x, -z)).sort((a, b) => a - b);
  const [a, b, c] = angles as [number, number, number];
  const gaps = [b - a, c - b, a + Math.PI * 2 - c];
  const widest = gaps.indexOf(Math.max(...gaps));
  const start = angles[(widest + 1) % 3] as number;
  const length = Math.PI * 2 - (gaps[widest] as number);
  const holds = (angle: number) =>
    (((angle - start) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) <= length;
  return holds(-half) || Math.abs(start) <= half;
}

/**
 * Bakes a view of the model: every triangle the eye could see - within its
 * width and a margin, within its depth, facing it unless drawn on both sides,
 * and not wholly behind others - moved to where it stands, coloured and lit as the scene's own
 * lights light it, and merged with all the others drawn alike.
 */
export function bakeView(model: Object3D, view: ViewSpec, palette: Palette): ArrayBuffer {
  const camera = viewCamera(model, view);
  const eye = new PerspectiveCamera();
  eye.position.fromArray(camera.position);
  eye.lookAt(new Vector3().fromArray(camera.target));
  eye.updateMatrixWorld(true);
  const toEye = eye.matrixWorldInverse;
  const eyeAt = eye.position.clone();
  const half = ((view.fov / 2 + MARGIN) * Math.PI) / 180;
  // a still view is cut to what its eye sees; a free one keeps everything
  const still = view.kind === 'still';

  // the sun over the eye's left shoulder, as the scene sets it: the compass
  // direction the eye looks from, turned
  const from =
    (Math.atan2(camera.position[0] - camera.target[0], -(camera.position[2] - camera.target[2])) *
      180) /
    Math.PI;
  const sun = direction(from + SUN.offset, SUN.elevation);

  /**
   * The light a surface facing a way gets, as three.js lights a Lambert
   * material under the scene's lights: the sun as far as the surface faces
   * it, the ambient fill all round, and the sky's or the ground's bounce as
   * the surface faces up or down - all of it over pi, which is how its diffuse
   * reflection is counted.
   */
  const sunLight = palette.light.clone().multiplyScalar(SUN.intensity);
  const ambientLight = palette.ambient.clone().multiplyScalar(FILL.ambient);
  const lightOf = (normal: Vector3) =>
    ambientLight
      .clone()
      .add(sunLight.clone().multiplyScalar(Math.max(0, normal.dot(sun))))
      .add(
        palette.ground
          .clone()
          .lerp(palette.sky, 0.5 * normal.y + 0.5)
          .multiplyScalar(FILL.hemisphere)
      )
      .multiplyScalar(1 / Math.PI);

  const groups = new Map<string, { group: Drawn; positions: number[]; colors: number[] }>();
  const collectedFor = (group: Drawn) => {
    const key = JSON.stringify(group);
    const known = groups.get(key);
    if (known !== undefined) {
      return known;
    }
    const made = { group, positions: [], colors: [] };
    groups.set(key, made);
    return made;
  };

  const add = (
    object: Mesh,
    geometry: BufferGeometry,
    material: Material,
    matrix: Matrix4,
    tint: Color | undefined
  ) => {
    const position = geometry.getAttribute('position') as
      BufferGeometry['attributes'][string] | undefined;
    // an empty mesh - the landfill, with nothing brushed on - has nothing to give
    if (position === undefined) {
      return;
    }
    const surface = material as Material & {
      color?: Color;
      flatShading?: boolean;
      vertexColors: boolean;
    };
    const lit = !(material instanceof MeshBasicMaterial);
    const flat = surface.flatShading === true;
    const double = material.side === DoubleSide;
    // a free view draws both sides of a two sided face as faces of their own,
    // each lit for its side, so that every face can be culled from behind
    const collected = collectedFor({
      doubleSided: double && still,
      ...(material.polygonOffset
        ? { offset: [material.polygonOffsetFactor, material.polygonOffsetUnits] }
        : {}),
      renderOrder: orderOf(object),
    });
    const normal = geometry.getAttribute('normal');
    const color = geometry.getAttribute('color');
    const index = geometry.getIndex();
    const base = (surface.color ?? new Color(1, 1, 1)).clone();
    if (tint !== undefined) {
      base.multiply(tint);
    }
    const normalMatrix = new Matrix3().getNormalMatrix(matrix);
    // a mirroring matrix turns the winding round, as three.js takes it - and
    // is written the right way round, so the front is counter clockwise
    const mirrored = matrix.determinant() < 0;
    const count = index === null ? position.count : index.count;
    const at = (step: number) => (index === null ? step : index.getX(step));
    for (let first = 0; first + 2 < count; first += 3) {
      const corners = [0, 1, 2].map(k =>
        new Vector3().fromBufferAttribute(position, at(first + k)).applyMatrix4(matrix)
      );
      if (still) {
        const seen = corners.map(corner => corner.clone().applyMatrix4(toEye));
        if (seen.every(corner => corner.length() > view.far) || !spans(seen, half)) {
          continue;
        }
      }
      const [a, b, c] = corners as [Vector3, Vector3, Vector3];
      const face = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      if (mirrored) {
        face.negate();
      }
      // a still eye never sees a face from behind unless it is drawn on both
      // sides, and then only that side; a free one may see either
      const behind = face.dot(a.clone().sub(eyeAt)) >= 0;
      if (still && behind && !double) {
        continue;
      }
      const sides = still ? [behind] : double ? [false, true] : [false];
      sides.forEach(back => {
        // the corners in the order that faces the side drawn
        const order = mirrored !== back ? [0, 2, 1] : [0, 1, 2];
        order.forEach(k => {
          const vertex = at(first + k);
          const corner = corners[k] as Vector3;
          collected.positions.push(corner.x, corner.y, corner.z);
          const shade = base.clone();
          if (surface.vertexColors && color !== undefined) {
            shade.multiply(new Color().fromBufferAttribute(color, vertex));
          }
          if (lit) {
            // shaded a face at a time, or smooth by its own normal - the back
            // of a face drawn on both sides lit on that side
            const facing =
              flat || normal === undefined
                ? face.clone()
                : new Vector3()
                    .fromBufferAttribute(normal, vertex)
                    .applyMatrix3(normalMatrix)
                    .normalize();
            shade.multiply(lightOf(back ? facing.negate() : facing));
          }
          const srgb = shade.getRGB(new Color(), 'srgb');
          collected.colors.push(
            ...[srgb.r, srgb.g, srgb.b].map(value =>
              Math.round(Math.min(Math.max(value, 0), 1) * 255)
            )
          );
        });
      });
    }
  };

  model.updateMatrixWorld(true);
  model.traverse(object => {
    if (!(object instanceof Mesh) || !shown(object)) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const material = materials[0] as Material | undefined;
    if (material === undefined || !material.visible) {
      return;
    }
    if (object instanceof InstancedMesh) {
      const instance = new Matrix4();
      Array.from({ length: object.count }, (_, step) => {
        object.getMatrixAt(step, instance);
        const tint =
          object.instanceColor === null
            ? undefined
            : new Color().fromBufferAttribute(object.instanceColor, step);
        add(object, object.geometry, material, object.matrixWorld.clone().multiply(instance), tint);
      });
      return;
    }
    add(object, object.geometry, material, object.matrixWorld, undefined);
  });

  // what is wholly behind something else goes too, where the eye never moves
  const collected = [...groups.values()];
  const triangles = collected.flatMap(({ group, positions }) =>
    Array.from({ length: positions.length / 9 }, (_, triangle) => ({
      corners: [0, 1, 2].map(k => new Vector3().fromArray(positions, triangle * 9 + k * 3)) as [
        Vector3,
        Vector3,
        Vector3,
      ],
      pulled: group.offset !== undefined,
    }))
  );
  const visible = still
    ? visibleFrom(eyeAt, new Vector3().fromArray(camera.target).sub(eyeAt), triangles)
    : triangles.map(() => true);
  let seenSoFar = 0;
  collected.forEach(entry => {
    const count = entry.positions.length / 9;
    const kept = Array.from({ length: count }, (_, triangle) => triangle).filter(
      triangle => visible[seenSoFar + triangle]
    );
    seenSoFar += count;
    entry.positions = kept.flatMap(triangle =>
      entry.positions.slice(triangle * 9, triangle * 9 + 9)
    );
    entry.colors = kept.flatMap(triangle => entry.colors.slice(triangle * 9, triangle * 9 + 9));
  });

  // every vertex alike in where it is and what colour is shared
  const baked = collected
    .filter(({ positions }) => positions.length > 0)
    .map(({ group, positions, colors }) => {
      const shared = new Map<string, number>();
      const vertices = { positions: [] as number[], colors: [] as number[] };
      const indices = Array.from({ length: positions.length / 3 }, (_, vertex) => {
        const at = vertex * 3;
        const position = positions.slice(at, at + 3);
        const color = colors.slice(at, at + 3);
        const key = [...position.map(value => value.toFixed(4)), ...color].join(',');
        const known = shared.get(key);
        if (known !== undefined) {
          return known;
        }
        const index = vertices.positions.length / 3;
        shared.set(key, index);
        vertices.positions.push(...position);
        vertices.colors.push(...color);
        return index;
      });
      return { group, ...vertices, indices };
    })
    // drawn in the order they are to be drawn: the ground first, what lies on it after
    .sort((one, other) => one.group.renderOrder - other.group.renderOrder);

  const header: PrefabHeader = {
    version: 1,
    kind: view.kind,
    camera,
    groups: baked.map(({ group, positions, indices }) => ({
      ...group,
      vertices: positions.length / 3,
      indices: indices.length,
    })),
  };

  const padded = (length: number) => Math.ceil(length / 4) * 4;
  const wide = (vertices: number) => vertices > 0xffff;
  let json = JSON.stringify(header);
  json += ' '.repeat(padded(json.length) - json.length);
  const text = new TextEncoder().encode(json);
  const size =
    8 +
    text.byteLength +
    baked.reduce(
      (sum, { positions, indices }) =>
        sum +
        positions.length * 4 +
        padded(positions.length) +
        padded(indices.length * (wide(positions.length / 3) ? 4 : 2)),
      0
    );
  const buffer = new ArrayBuffer(size);
  const bytes = new Uint8Array(buffer);
  bytes.set(new TextEncoder().encode('KVLM'), 0);
  new DataView(buffer).setUint32(4, text.byteLength, true);
  bytes.set(text, 8);
  let offset = 8 + text.byteLength;
  baked.forEach(({ positions, colors, indices }) => {
    new Float32Array(buffer, offset, positions.length).set(positions);
    offset += positions.length * 4;
    new Uint8Array(buffer, offset, colors.length).set(colors);
    offset += padded(colors.length);
    const Indices = wide(positions.length / 3) ? Uint32Array : Uint16Array;
    // typed arrays wrap what does not fit, which is what makes a step back fit
    new Indices(buffer, offset, indices.length).set(
      indices.map((index, step) => index - (indices[step - 1] ?? 0))
    );
    offset += padded(indices.length * Indices.BYTES_PER_ELEMENT);
  });
  return buffer;
}
