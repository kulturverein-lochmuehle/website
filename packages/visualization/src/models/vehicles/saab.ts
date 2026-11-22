import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshLambertMaterial,
  Vector3,
} from 'three';

import { SAAB_BAKED, SAAB_SPEC } from '../../data/saab.baked.js';
import type { Palette } from '../../scene/palette.js';
import { unpacked } from '../terrain/terrain.drawn.js';

/**
 * The classic Saab 900 combi coupé, remodelled by hand in Blender
 * (`models/saab-900.blend`) and baked into `data/saab.baked.ts` by
 * `scripts/cars/saab_blend_bake.py`, run by Blender itself. Run that again
 * after changing the model; the faces take their material from their slot's
 * name, the palette lays the colours on.
 */

/** The car's measures in meters, as the model has them; the axles' middles from the tail, the track wheel middle to wheel middle. */
export const SAAB_900 = SAAB_SPEC;

/** Which palette colour each of the baked materials takes. */
const COLORS: Record<keyof typeof SAAB_BAKED, keyof Palette> = {
  body: 'saab',
  glass: 'window',
  trim: 'trunk',
  tail_light: 'tailLight',
  tail_light_dim: 'tailLight',
  head_light: 'snow',
  head_light_dim: 'snow',
  reverse: 'snow',
  tyre: 'ground',
  hub: 'granite',
  indicator: 'lantern',
  chrome: 'granite',
};

/** The triangles of a baked part whose middles pass a test, as a geometry of their own. */
function pick(
  geometry: BufferGeometry,
  keep: (middle: Vector3, corners: Vector3[]) => boolean
): BufferGeometry {
  const [position, index] = [geometry.getAttribute('position'), geometry.getIndex()];
  const corners = (first: number) =>
    [0, 1, 2].map(k =>
      new Vector3().fromBufferAttribute(position, index?.getX(first + k) ?? first + k)
    );
  const picked = Array.from({ length: (index?.count ?? position.count) / 3 }, (_, t) =>
    corners(t * 3)
  ).filter(triangle =>
    keep(triangle.reduce((sum, corner) => sum.add(corner), new Vector3()).divideScalar(3), triangle)
  );
  const made = new BufferGeometry();
  made.setAttribute(
    'position',
    new BufferAttribute(
      new Float32Array(picked.flatMap(triangle => triangle.flatMap(c => c.toArray()))),
      3
    )
  );
  return made;
}

/** The other paints a Saab drives in, besides the palette's own aubergine. */
export const SAAB_PAINTS = ['#2d4a3e', '#b8b8ae', '#26406b'] as const;

/** The Saab, nose to +x, its middle at the origin, its wheels on y = 0; in a paint of its own if given. */
export function createSaab(palette: Palette, paint?: string, name = 'saab-900'): Group {
  const car = new Group();
  car.name = name;
  const material = (name: string) =>
    new MeshLambertMaterial({
      color:
        paint !== undefined && name === 'body'
          ? new Color(paint)
          : palette[COLORS[name as keyof typeof SAAB_BAKED]],
      flatShading: true,
    });
  const add = (name: string, geometry: BufferGeometry, where: Group = car) => {
    const mesh = new Mesh(geometry, material(name));
    mesh.name = name;
    where.add(mesh);
  };
  Object.entries(SAAB_BAKED).forEach(([name, data]) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(unpacked(data.positions)), 3)
    );
    geometry.setIndex(new BufferAttribute(new Uint16Array(unpacked(data.indices)), 1));
    if (name === 'tyre' || name === 'hub') {
      // the rear wheels stay as they are; each front wheel turns about its own middle
      add(
        name,
        pick(geometry, ({ x }) => x < 0)
      );
      ([1, -1] as const).forEach(side => {
        const wheel = pick(geometry, ({ x, z }) => x > 0 && Math.sign(z) === side);
        wheel.computeBoundingBox();
        const middle = wheel.boundingBox?.getCenter(new Vector3()) ?? new Vector3();
        const turning = car.children.find(child => child.userData['steer'] === side) as
          Group | undefined;
        const group = turning ?? Object.assign(new Group(), { name: `front-wheel-${side}` });
        if (turning === undefined) {
          group.userData['steer'] = side;
          group.position.set(middle.x, middle.y, middle.z);
          car.add(group);
        }
        // offset by the group's place (the tyre's middle), so a hub off it keeps its own
        const { x, y, z } = group.position;
        add(name, wheel.translate(-x, -y, -z), group);
      });
      return;
    }
    add(name, geometry);
  });
  return car;
}
