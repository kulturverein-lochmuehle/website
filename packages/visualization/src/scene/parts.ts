import type { BufferGeometry, EulerOrder, Material, Object3D, TypedArray } from 'three';
import {
  BufferAttribute,
  BufferGeometry as Geometry,
  Color,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Vector2,
  Vector3,
} from 'three';

import { createBuildings } from '../models/buildings/buildings.js';
import { createDecorations } from '../models/decorations/decorations.js';
import { createLandfill } from '../models/seam/landfill.js';
import { createCulvert, createDeck } from '../models/structures/decks.js';
import { createGarden } from '../models/structures/garden.js';
import { createHut } from '../models/structures/hut.js';
import { createPavilion } from '../models/structures/pavilion.js';
import { createRailings } from '../models/structures/railings.js';
import { createRoadside } from '../models/structures/roadside.js';
import { createStairs } from '../models/structures/stairs.js';
import { createLightStrings, createStreetLamps } from '../models/structures/streetlamps.js';
import { createBrook, createMarkings, createWays } from '../models/terrain/ground.js';
import { createTerrain } from '../models/terrain/terrain.js';
import { createTracks } from '../models/terrain/tracks.js';
import { createTrees } from '../models/terrain/trees.js';
import { createCars } from '../models/vehicles/cars.js';
import type { Palette } from './palette.js';
import type { Layer } from './scene.js';

/**
 * A part of the model, built on its own: what it is called, the layers that
 * show it - none for what is always there - and what has to stand before it.
 */
export interface ModelPart {
  name: string;
  layers: readonly Layer[];
  needs?: readonly string[];
  make: (palette: Palette, built: ReadonlyMap<string, Object3D>) => Object3D;
}

/**
 * The model's parts in the order they are built. Each stands on its own - the
 * ground's heights are read off the field, not the terrain's mesh - so any of
 * them can be built anywhere, a worker of its own included.
 */
export const MODEL_PARTS: readonly ModelPart[] = [
  {
    name: 'terrain',
    layers: ['terrain'],
    make: palette => {
      const terrain = createTerrain(palette);
      // what is piled on it goes with it, and is hidden with it
      terrain.add(createLandfill());
      return terrain;
    },
  },
  { name: 'brook', layers: ['roads'], make: createBrook },
  // the walls and the plate over the brook, switched on their own
  { name: 'culvert', layers: ['walls', 'decks'], make: createCulvert },
  { name: 'stairs', layers: ['walls'], make: createStairs },
  { name: 'decks', layers: ['decks'], make: createDeck },
  { name: 'roads', layers: ['roads'], make: createWays },
  { name: 'markings', layers: ['roads'], make: createMarkings },
  { name: 'tracks', layers: ['roads'], make: createTracks },
  { name: 'trees', layers: ['trees'], make: createTrees },
  { name: 'buildings', layers: ['houses'], make: createBuildings },
  { name: 'pavilion', layers: ['houses'], make: createPavilion },
  { name: 'hut', layers: ['houses'], make: createHut },
  { name: 'street lamps', layers: ['roads'], make: createStreetLamps },
  { name: 'roadside', layers: ['roads'], make: createRoadside },
  { name: 'cars', layers: ['roads'], make: createCars },
  { name: 'garden', layers: [], make: createGarden },
  { name: 'railings', layers: ['walls'], make: createRailings },
  { name: 'decorations', layers: [], make: createDecorations },
  {
    name: 'light strings',
    layers: ['houses'],
    // hung from the railings' handrails
    needs: ['railings'],
    make: (palette, built) =>
      createLightStrings(palette, built.get('railings')?.userData['handrails'] as Vector3[][]),
  },
];

/** Builds a part, and what it needs first if that is not built yet, into `built`. */
export function buildPart(name: string, palette: Palette, built: Map<string, Object3D>): Object3D {
  const part = MODEL_PARTS.find(candidate => candidate.name === name);
  if (part === undefined) {
    throw new Error(`no part of the model is called ${name}`);
  }
  (part.needs ?? [])
    .filter(need => !built.has(need))
    .forEach(need => buildPart(need, palette, built));
  const object = part.make(palette, built);
  built.set(name, object);
  return object;
}

/**
 * What survives a trip through `postMessage` of the three.js values kept in
 * user data and on materials: a tag and the numbers, since a clone keeps an
 * object's own fields only, and a vector's `isVector3` is its prototype's.
 */
interface Frozen {
  $three: 'Color' | 'Vector2' | 'Vector3' | 'Euler';
  at: number[];
  order?: string;
}

const isFrozen = (value: object): value is Frozen => '$three' in value && 'at' in value;

function freeze(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || ArrayBuffer.isView(value)) {
    return value;
  }
  if (value instanceof Color || (value as Color).isColor === true) {
    const { r, g, b } = value as Color;
    return { $three: 'Color', at: [r, g, b] } satisfies Frozen;
  }
  if ((value as Vector3).isVector3 === true) {
    const { x, y, z } = value as Vector3;
    return { $three: 'Vector3', at: [x, y, z] } satisfies Frozen;
  }
  if ((value as Vector2).isVector2 === true) {
    const { x, y } = value as Vector2;
    return { $three: 'Vector2', at: [x, y] } satisfies Frozen;
  }
  if ((value as Euler).isEuler === true) {
    const { x, y, z, order } = value as Euler;
    return { $three: 'Euler', at: [x, y, z], order } satisfies Frozen;
  }
  if (Array.isArray(value)) {
    return value.map(freeze);
  }
  // anything else of three's, an object or a geometry, would arrive as a
  // husk of its fields: better said where it is built than found later
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`a ${value.constructor.name} cannot be handed over`);
  }
  return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, freeze(field)]));
}

function thaw(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || ArrayBuffer.isView(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(thaw);
  }
  if (isFrozen(value)) {
    const [a = 0, b = 0, c = 0] = value.at;
    return value.$three === 'Color'
      ? new Color(a, b, c)
      : value.$three === 'Vector3'
        ? new Vector3(a, b, c)
        : value.$three === 'Euler'
          ? new Euler(a, b, c, value.order as EulerOrder)
          : new Vector2(a, b);
  }
  return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, thaw(field)]));
}

/** A palette as it can be posted to a worker, and back. */
export const freezePalette = (palette: Palette): unknown => freeze(palette);
export const thawPalette = (frozen: unknown): Palette => thaw(frozen) as Palette;

interface PackedAttribute {
  array: TypedArray;
  itemSize: number;
  normalized: boolean;
}

interface PackedGeometry {
  attributes: Record<string, PackedAttribute>;
  index: TypedArray | undefined;
  groups: { start: number; count: number; materialIndex?: number | undefined }[];
  drawRange: { start: number; count: number };
  userData: unknown;
}

interface PackedMaterial {
  type: string;
  fields: Record<string, unknown>;
}

interface PackedNode {
  kind: 'Group' | 'Mesh' | 'InstancedMesh';
  /** Its parent's place in the list, none for the part itself. */
  parent: number | undefined;
  name: string;
  matrix: number[];
  visible: boolean;
  renderOrder: number;
  userData: unknown;
  geometry?: number;
  material?: number | number[];
  instances?: { count: number; matrix: TypedArray; color: TypedArray | undefined };
}

/** A part of the model as plain arrays, what a worker hands over to the page. */
export interface PackedPart {
  nodes: PackedNode[];
  geometries: PackedGeometry[];
  materials: PackedMaterial[];
}

/** What a material is made from again: the kinds the model is drawn with. */
const MATERIALS: Record<string, new () => Material> = {
  MeshBasicMaterial,
  MeshLambertMaterial,
};

/** A material's own settings, as many as are not its identity or bookkeeping. */
const UNPACKED = new Set(['uuid', 'id', 'version', 'type', '_listeners']);

/**
 * A part of the model as plain arrays and the buffers under them, which are
 * handed over rather than copied - the part is no use where it was built
 * after. What is shared in it, a geometry or a material, is shared again.
 */
export function packPart(part: Object3D): { packed: PackedPart; transfer: ArrayBuffer[] } {
  const geometries = new Map<BufferGeometry, number>();
  const materials = new Map<Material, number>();
  const packed: PackedPart = { nodes: [], geometries: [], materials: [] };
  const transfer = new Set<ArrayBuffer>();
  const hand = (array: TypedArray) => {
    if (array.buffer instanceof ArrayBuffer) {
      transfer.add(array.buffer);
    }
    return array;
  };
  const geometryOf = (geometry: BufferGeometry): number => {
    const known = geometries.get(geometry);
    if (known !== undefined) {
      return known;
    }
    const attributes = Object.fromEntries(
      Object.entries(geometry.attributes).map(([key, attribute]) => {
        const { array, itemSize, normalized } = attribute as BufferAttribute;
        return [key, { array: hand(array), itemSize, normalized }];
      })
    );
    const index = geometry.index === null ? undefined : hand(geometry.index.array);
    packed.geometries.push({
      attributes,
      index,
      groups: geometry.groups.map(group => ({ ...group })),
      drawRange: { ...geometry.drawRange },
      userData: freeze(geometry.userData),
    });
    geometries.set(geometry, packed.geometries.length - 1);
    return packed.geometries.length - 1;
  };
  const materialOf = (material: Material): number => {
    const known = materials.get(material);
    if (known !== undefined) {
      return known;
    }
    if (MATERIALS[material.type] === undefined) {
      throw new Error(`a ${material.type} cannot be handed over`);
    }
    const fields = Object.fromEntries(
      Object.entries(material)
        .filter(([key]) => !UNPACKED.has(key) && !key.startsWith('is'))
        .filter(
          ([, value]) =>
            typeof value !== 'function' && (value as { isTexture?: boolean })?.isTexture !== true
        )
        .map(([key, value]) => [key, freeze(value)])
    );
    packed.materials.push({ type: material.type, fields });
    materials.set(material, packed.materials.length - 1);
    return packed.materials.length - 1;
  };
  const places = new Map<Object3D, number>();
  part.updateMatrix();
  part.traverse(object => {
    object.updateMatrix();
    const parent =
      object === part || object.parent === null ? undefined : places.get(object.parent);
    const node: PackedNode = {
      kind:
        object instanceof InstancedMesh
          ? 'InstancedMesh'
          : object instanceof Mesh
            ? 'Mesh'
            : 'Group',
      parent,
      name: object.name,
      matrix: object.matrix.toArray(),
      visible: object.visible,
      renderOrder: object.renderOrder,
      userData: freeze(object.userData),
    };
    if (object instanceof Mesh) {
      const mesh = object as Mesh;
      node.geometry = geometryOf(mesh.geometry);
      node.material = Array.isArray(mesh.material)
        ? mesh.material.map(materialOf)
        : materialOf(mesh.material);
    }
    if (object instanceof InstancedMesh) {
      node.instances = {
        count: object.count,
        matrix: hand(object.instanceMatrix.array),
        color: object.instanceColor === null ? undefined : hand(object.instanceColor.array),
      };
    }
    places.set(object, packed.nodes.length);
    packed.nodes.push(node);
  });
  return { packed, transfer: [...transfer] };
}

/** The part again, from what `packPart` made of it. */
export function unpackPart({ nodes, geometries, materials }: PackedPart): Object3D {
  const madeGeometries = geometries.map(({ attributes, index, groups, drawRange, userData }) => {
    const geometry = new Geometry();
    Object.entries(attributes).forEach(([key, { array, itemSize, normalized }]) =>
      geometry.setAttribute(key, new BufferAttribute(array, itemSize, normalized))
    );
    if (index !== undefined) {
      geometry.setIndex(new BufferAttribute(index, 1));
    }
    groups.forEach(({ start, count, materialIndex }) =>
      geometry.addGroup(start, count, materialIndex)
    );
    geometry.setDrawRange(drawRange.start, drawRange.count);
    geometry.userData = thaw(userData) as Record<string, unknown>;
    return geometry;
  });
  const madeMaterials = materials.map(({ type, fields }) => {
    const Made = MATERIALS[type] as new () => Material;
    const material = new Made() as unknown as Record<string, unknown>;
    Object.entries(fields).forEach(([key, frozen]) => {
      const value = thaw(frozen);
      const own = material[key] as { copy?: (from: unknown) => unknown } | null | undefined;
      // a colour is the material's own object, which its uniforms hold on to
      if (typeof own?.copy === 'function' && value?.constructor === own.constructor) {
        own.copy(value);
      } else {
        material[key] = value;
      }
    });
    return material as unknown as Material;
  });
  const made = nodes.map(node => {
    const geometry = node.geometry === undefined ? undefined : madeGeometries[node.geometry];
    const material =
      node.material === undefined
        ? undefined
        : Array.isArray(node.material)
          ? node.material.map(one => madeMaterials[one] as Material)
          : madeMaterials[node.material];
    let object: Object3D;
    if (node.kind === 'InstancedMesh' && node.instances !== undefined) {
      const { count, matrix, color } = node.instances;
      const instanced = new InstancedMesh(geometry, material, 0);
      instanced.instanceMatrix = new InstancedBufferAttribute(matrix, 16);
      instanced.instanceColor = color === undefined ? null : new InstancedBufferAttribute(color, 3);
      instanced.count = count;
      object = instanced;
    } else {
      object = node.kind === 'Mesh' ? new Mesh(geometry, material) : new Group();
    }
    object.name = node.name;
    object.matrix.fromArray(node.matrix);
    object.matrix.decompose(object.position, object.quaternion, object.scale);
    object.visible = node.visible;
    object.renderOrder = node.renderOrder;
    object.userData = thaw(node.userData) as Record<string, unknown>;
    return object;
  });
  nodes.forEach(({ parent }, place) => {
    if (parent !== undefined) {
      made[parent]?.add(made[place] as Object3D);
    }
  });
  return made[0] ?? new Group();
}
