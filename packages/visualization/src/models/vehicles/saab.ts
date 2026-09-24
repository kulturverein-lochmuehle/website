import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshLambertMaterial,
  Vector3,
} from 'three';

import { SAAB_BAKED } from '../../data/saab.baked.js';
import type { Palette } from '../../scene/palette.js';
import { unpacked } from '../terrain/terrain.drawn.js';

/**
 * The classic Saab 900 combi coupé, modelled to its blueprint and photos in
 * CAD (`scripts/saab.py`), its faces sorted into materials and thinned
 * (`scripts/saab_materials.py`, `scripts/saab_reduce.py`) and baked into
 * `data/saab.baked.ts` by `scripts/saab_bake.py`. Run that again after
 * changing the model; the palette lays the colours on.
 */

/** The car's measures in meters, as the model has them. */
export const SAAB_900 = {
  length: 4.68,
  width: 1.69,
  height: 1.425,
  /** The axles' middles, from the tail. */
  axles: [1.1245, 3.6415] as [number, number],
  tyre: 0.2967,
  tread: 0.195,
  arch: 0.4046,
  /** The track, wheel middle to wheel middle. */
  track: 1.5084,
} as const;

/** What the model's tyres sink below its ground, lifted back out. */
const LIFT = 0.0078;

/** Which palette colour each of the baked materials takes. */
const COLORS: Record<keyof typeof SAAB_BAKED, keyof Palette> = {
  body: 'saab',
  glass: 'window',
  trim: 'trunk',
  tail_light: 'tailLight',
  head_light: 'snow',
  plate: 'trunk',
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

/** The lower pieces of the tail lamps, the ones that light up: the upper ones are the indicators'. */
const TAIL_LIT = 0.635;

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
    const mesh = new Mesh(geometry, material(name.replace(/_(dim)$/, '')));
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
    if (name === 'tail_light') {
      // only the lower two of each side's pieces shine
      add(
        name,
        pick(geometry, (_, corners) => corners.every(({ y }) => y < TAIL_LIT))
      );
      add(
        'tail_light_dim',
        pick(geometry, (_, corners) => corners.some(({ y }) => y >= TAIL_LIT))
      );
      return;
    }
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
          group.position.set(middle.x, middle.y + LIFT, middle.z);
          car.add(group);
        }
        add(name, wheel.translate(-middle.x, -middle.y, -middle.z), group);
      });
      return;
    }
    add(name, geometry);
  });
  // the body's parts sit a little high out of the ground, the tyres' sink lifted back
  car.children.forEach(child => {
    if (child.userData['steer'] === undefined) {
      child.position.y = LIFT;
    }
  });
  return car;
}
