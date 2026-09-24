import {
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from 'three';

import type { Point } from '../../data/data.js';
import { WOODS } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import { contains, distanceToPath, random } from '../../utils/geometry.utils.js';
import { distanceToBuildings, YARD_CENTER } from '../buildings/footprint.js';
import { BROOK_LINE, heightAt } from './ground.js';
import { BROOK_WIDTH, insideTerrain, ROADS, TERRAIN_RADIUS, YARD_MARGIN } from './terrain.field.js';

/**
 * The woods, scattered where the survey says they stand.
 */
/**
 * One tree per this many square meters of woodland. The survey's surface model
 * (DOM1 minus DGM1) counts 44 crowns on 3600 square meters of the slope behind
 * the mill - one per 82, a canopy that covers four fifths of the ground. Drawn
 * at that spacing the mill disappears under it, so the wood is thinned by
 * around a half: set this to 82 for the forest as it stands.
 */
const TREE_SPACING = 140;

/**
 * The same measurement gives the heights: a canopy of 20m in the middle, 30m at
 * the ninth tenth, the tallest beech 37m. Crowns run about ten meters across.
 */
const TREE_HEIGHT = { from: 14, to: 33 };

/**
 * The mill stands in the woods, and the woods are most of what the valley looks
 * like - so they are drawn, as two instanced meshes rather than a few thousand
 * objects. Trunk and crown are the simplest shapes that still read as a tree.
 */
export function createTrees(palette: Palette): Group {
  const next = random(1400); // the year the mill was first mentioned
  const [ox, oy] = YARD_CENTER;
  const group = new Group();
  group.name = 'trees';

  const placed = WOODS.flatMap(polygon => {
    const xs = polygon.map(([x]) => x);
    const ys = polygon.map(([, y]) => y);
    const [minX, maxX] = [
      Math.max(Math.min(...xs), ox - TERRAIN_RADIUS),
      Math.min(Math.max(...xs), ox + TERRAIN_RADIUS),
    ];
    const [minY, maxY] = [
      Math.max(Math.min(...ys), oy - TERRAIN_RADIUS),
      Math.min(Math.max(...ys), oy + TERRAIN_RADIUS),
    ];
    const attempts = Math.round(((maxX - minX) * (maxY - minY)) / TREE_SPACING);

    return Array.from({ length: attempts }, () => ({
      point: [minX + next() * (maxX - minX), minY + next() * (maxY - minY)] as Point,
      height: TREE_HEIGHT.from + next() * (TREE_HEIGHT.to - TREE_HEIGHT.from),
      // a crown radius between a fifth and a quarter of the tree's height, so
      // no two trees are quite the same shape
      spread: 0.22 + next() * 0.06,
      turn: next() * Math.PI * 2,
    })).filter(({ point }) => {
      if (!contains(polygon, point) || !insideTerrain(point, 8)) {
        return false;
      }
      // the yard and the ways stay clear, nothing grows where people drive,
      // and nothing stands in the brook - on its bank is close enough
      return (
        distanceToBuildings(point) > YARD_MARGIN + 14 &&
        distanceToPath(BROOK_LINE, point) > BROOK_WIDTH / 2 + 1.5 &&
        ROADS.every(({ points, width }) => distanceToPath(points, point) > width / 2 + 2.5)
      );
    });
  });

  const trunks = new InstancedMesh(
    new CylinderGeometry(0.18, 0.32, 1, 5),
    new MeshLambertMaterial({ color: palette.trunk, flatShading: true }),
    placed.length
  );
  // the Lotzebachtal is broadleaved, so the crowns are lumps and not cones. They
  // do not cast shadows: a few hundred of them would cost more than they show
  const crowns = new InstancedMesh(
    new IcosahedronGeometry(1, 0),
    new MeshLambertMaterial({ color: palette.foliage, flatShading: true }),
    placed.length
  );

  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const axis = new Vector3(0, 1, 0);
  const shade = new Color();
  placed.forEach(({ point: [x, y], height, spread, turn }, index) => {
    const ground = heightAt(x, y);
    rotation.setFromAxisAngle(axis, turn);

    const trunk = height * 0.4;
    matrix.compose(
      new Vector3(x, ground + trunk / 2, -y),
      rotation,
      new Vector3(height / 22, trunk, height / 22)
    );
    trunks.setMatrixAt(index, matrix);

    // the icosahedron has a radius of one, so the scale is the crown's radius.
    // A beech carries a crown taller than it is wide, but drawn as one lump
    // anything past a fifth of stretch reads as a balloon rather than a tree
    const crown = height * spread;
    const reach = 1.15;
    // its lowest vertex sits at 0.85 of that radius, not at 1 - hanging the
    // crown a full radius above the trunk leaves it floating there
    matrix.compose(
      new Vector3(x, ground + trunk + crown * reach * 0.7, -y),
      rotation,
      new Vector3(crown, crown * reach, crown)
    );
    crowns.setMatrixAt(index, matrix);
    // every tree a shade of its own, a forest of one color reads as a carpet
    crowns.setColorAt(index, shade.copy(palette.foliage).lerp(palette.hills, next() * 0.35));
  });

  return group.add(trunks, crowns);
}
