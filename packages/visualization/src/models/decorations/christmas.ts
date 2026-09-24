import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OctahedronGeometry,
  TorusGeometry,
  Vector3,
} from 'three';

import type { Palette } from '../../scene/palette.js';
import { random } from '../../utils/geometry.utils.js';
import { HUT, hutFrame, onHut } from '../structures/hut.js';
import { surfaceAt } from './area.js';

/**
 * What the A-hut wears at Christmas besides its string of lights along the
 * roof: a fir beside it - where in the hut's own frame, how tall, how many
 * tiers of branches and how wide the lowest is, and how many baubles hang on
 * it - and a wreath on its door, at a height of the door, with its ribbon.
 */
export const CHRISTMAS = {
  fir: { at: [-2.8, 1.4], height: 2.1, tiers: 4, radius: 0.85, baubles: 18 },
  wreath: { radius: 0.17, tube: 0.035, up: 1.22 },
} as const;

/** The fir beside the hut, on whatever the ground is under it, hung with baubles and a star. */
function fir(palette: Palette): Group {
  const { at, height, tiers, radius, baubles } = CHRISTMAS.fir;
  const group = new Group();
  const foot = onHut(new Vector3(at[0], 0, at[1]));
  group.position.set(foot.x, surfaceAt(foot.x, -foot.z), foot.z);
  const needles = new MeshLambertMaterial({
    color: palette.foliage.clone().multiplyScalar(0.8),
    flatShading: true,
  });
  const trunk = new Mesh(
    new CylinderGeometry(0.05, 0.07, 0.4, 5),
    new MeshLambertMaterial({ color: palette.trunk, flatShading: true })
  );
  trunk.position.y = 0.2;
  group.add(trunk);
  // the tiers stacked into one another, each narrower and higher than the one below
  const reach = (height - 0.3) / (tiers * 0.55 + 0.45);
  const tierAt = (tier: number) => ({
    base: 0.3 + tier * reach * 0.55,
    wide: radius * (1 - tier * 0.2),
    high: reach,
  });
  Array.from({ length: tiers }, (_, tier) => {
    const { base, wide, high } = tierAt(tier);
    const branches = new Mesh(new ConeGeometry(wide, high, 7), needles);
    branches.position.y = base + high / 2;
    group.add(branches);
  });
  // the baubles on the branches' faces, gold and rust and snow, bright as they are
  const next = random(17);
  const hung = new InstancedMesh(
    new IcosahedronGeometry(0.045, 0),
    new MeshBasicMaterial({ color: 0xffffff }),
    baubles
  );
  const colors = [palette.autumnGold, palette.autumnRust, palette.snow, palette.lantern];
  const matrix = new Matrix4();
  Array.from({ length: baubles }, (_, index) => {
    const { base, wide, high } = tierAt(index % tiers);
    const t = 0.15 + next() * 0.6;
    const turn = next() * Math.PI * 2;
    const out = wide * (1 - t) * 0.92;
    hung.setMatrixAt(
      index,
      matrix.makeTranslation(Math.cos(turn) * out, base + t * high, Math.sin(turn) * out)
    );
    hung.setColorAt(index, colors[index % colors.length] ?? palette.snow);
  });
  hung.userData['lamp'] = true;
  const top = tierAt(tiers - 1);
  const star = new Mesh(
    new OctahedronGeometry(0.09, 0),
    new MeshBasicMaterial({ color: palette.lantern.clone().lerp(palette.snow, 0.3) })
  );
  star.position.y = top.base + top.high + 0.05;
  star.userData['lamp'] = true;
  group.add(hung, star);
  return group;
}

/** The wreath on the door, a ring of fir with a few baubles and a ribbon's bow at its foot. */
function wreath(palette: Palette): Group {
  const { radius, tube, up } = CHRISTMAS.wreath;
  const group = new Group();
  const { position, angle } = hutFrame();
  group.position.copy(position);
  group.rotation.y = angle;
  // in front of the door's boards, which stand 2cm proud of the gable
  const front = HUT.depth / 2 + 0.04 + tube;
  const ring = new Mesh(
    new TorusGeometry(radius, tube, 5, 10),
    new MeshLambertMaterial({
      color: palette.foliage.clone().multiplyScalar(0.8),
      flatShading: true,
    })
  );
  ring.position.set(0, up, front);
  const ribbon = new MeshLambertMaterial({ color: palette.autumnRust, flatShading: true });
  const bow = [-1, 1].map(side => {
    const loop = new Mesh(new BoxGeometry(0.09, 0.05, 0.02), ribbon);
    loop.position.set(side * 0.05, up - radius, front + tube);
    loop.rotation.z = side * 0.5;
    return loop;
  });
  const gold = new MeshBasicMaterial({ color: palette.autumnGold });
  const baubles = [0.6, 2.2, 3.9].map(turn => {
    const bauble = new Mesh(new IcosahedronGeometry(0.03, 0), gold);
    bauble.position.set(Math.cos(turn) * radius, up + Math.sin(turn) * radius, front + tube * 0.6);
    return bauble;
  });
  group.add(ring, ...bow, ...baubles);
  return group;
}

/** The fir and the wreath at the A-hut, tagged: shown only where Christmas there is asked for. */
export function createChristmas(palette: Palette): Group[] {
  return [fir(palette), wreath(palette)].map((piece, index) => {
    piece.name = ['fir', 'wreath'][index] ?? 'christmas';
    piece.userData['decoration'] = 'weihnacht-hexenhaus';
    piece.visible = false;
    return piece;
  });
}
