import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
} from 'three';

import { E30_BAKED, E30_SPEC } from '../../data/e30.baked.js';
import type { Palette } from '../../scene/palette.js';
import { unpacked } from '../terrain/terrain.drawn.js';

/**
 * The 1986 BMW E30 (`scripts/cars/e30_bake.py`): the model's outside as it came, in the scene's colours,
 * with the scene's own wheels - a tyre and a hub - where its wheels were.
 */
export { E30_SPEC };

/** The colour each baked material takes. */
const COLORS: Record<keyof typeof E30_BAKED, (palette: Palette, paint: string) => Color> = {
  body: (_, paint) => new Color(paint),
  glass: palette => palette.window,
  trim: palette => palette.trunk,
  head_light: palette => palette.snow,
  head_light_dim: palette => palette.snow,
  tail_light: palette => palette.tailLight,
  tail_light_dim: palette => palette.tailLight,
  indicator: palette => palette.lantern,
};

/** One wheel on the ground at an axle; the front pair turn about their middles. */
function wheel(palette: Palette, x: number, side: 1 | -1, steers: boolean): Group {
  const group = new Group();
  group.name = steers ? `front-wheel-${side}` : `rear-wheel-${side}`;
  if (steers) {
    group.userData['steer'] = side;
  }
  group.position.set(x, E30_SPEC.tyre, (side * E30_SPEC.track) / 2);
  const round = (radius: number, width: number, name: string, color: Color) => {
    const mesh = new Mesh(
      new CylinderGeometry(radius, radius, width, 18).rotateX(Math.PI / 2),
      new MeshLambertMaterial({ color, flatShading: true })
    );
    mesh.name = name;
    return mesh;
  };
  group.add(
    round(E30_SPEC.tyre, E30_SPEC.tyreWidth, 'tyre', palette.ground),
    round(E30_SPEC.tyre * 0.62, E30_SPEC.tyreWidth + 0.012, 'hub', palette.granite)
  );
  return group;
}

/** The E30, nose to +x, its middle at the origin, its wheels on y = 0. */
/** The other paints an E30 drives in, besides the red it was baked with. */
export const E30_PAINTS = ['#e4e2da', '#233a63', '#1f1f22'] as const;

export function createE30(
  palette: Palette,
  paint: string = E30_SPEC.paint,
  name = 'bmw-e30'
): Group {
  const car = new Group();
  car.name = name;
  Object.entries(E30_BAKED).forEach(([name, data]) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(unpacked(data.positions)), 3)
    );
    geometry.setIndex(new BufferAttribute(new Uint16Array(unpacked(data.indices)), 1));
    geometry.computeBoundingSphere();
    const mesh = new Mesh(
      geometry,
      new MeshLambertMaterial({
        color: COLORS[name as keyof typeof E30_BAKED](palette, paint),
        flatShading: true,
      })
    );
    mesh.name = name;
    car.add(mesh);
  });
  const [rear, front] = E30_SPEC.axles.map(axle => axle - E30_SPEC.length / 2) as [number, number];
  ([1, -1] as const).forEach(side => {
    car.add(wheel(palette, rear, side, false), wheel(palette, front, side, true));
  });
  return car;
}
