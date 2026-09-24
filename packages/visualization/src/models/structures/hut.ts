import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Vector3,
} from 'three';

import type { Point } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import { heightAt } from '../terrain/ground.js';

/**
 * The A-frame hut in the woods up the valley, from photographs: its roof
 * comes down to just over the ground on either side, over a low boarded box
 * narrower than the roof's foot, and the gable facing south carries a low door
 * with the hatch to the loft above it. The loft's floor stands 1.5m up, as
 * counted on site, and the photograph square on to that gable is scaled by it:
 * 187 pixels to the meter. How deep it is comes off the roof, which carries
 * three rows of boards a meter each from the eaves to the ridge - the slope
 * those scaled numbers give is 3.02m - and four of them along it.
 */
export const HUT = {
  /**
   * Where it stands and which way its door looks, counter clockwise from east.
   * No photograph places it well - their cameras scatter over ten meters - so
   * it stands as it was described: back off the road, against the tree line,
   * which the survey's canopy has 11m east of the road's middle here. Its
   * eastern foot is half a meter short of it.
   */
  at: [8.5, 70] as Point,
  facing: 270,
  /** How wide the roof's foot is, how high it stands, and how high the ridge. */
  width: 3.74,
  eaves: 0.72,
  ridge: 3.09,
  /** How deep it is along the ridge, and how far the roof reaches past the gables. */
  depth: 4,
  overhang: 0.1,
  /** How wide the box under the roof is, between its foot on either side. */
  box: 2.67,
  /** The tiling's thickness. */
  roof: 0.08,
  /** The door, width and height, and the loft's floor above it. */
  door: [0.83, 1.45] as [number, number],
  loft: 1.5,
  /** The hatch into the loft over the door, as wide as it, and how high. */
  hatch: 0.75,
  /** How far nothing else grows from its middle: its corners, and a little. */
  clear: 3.5,
} as const;

/** How far the walls run into the ground, the slope falling away under them. */
const HUT_SUNK = 1;

/** Where the hut stands in the scene: its foot on the lowest ground under its corners, and the turn about the vertical its own frame has. */
export function hutFrame(): { position: Vector3; angle: number } {
  const { at, facing, width, depth } = HUT;
  const angle = (facing * Math.PI) / 180;
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const corners = [-1, 1].flatMap(across =>
    [-1, 1].map(along => {
      const [u, v] = [(across * width) / 2, (along * depth) / 2];
      // the door looks along the facing, the width runs square to it
      return heightAt(at[0] + v * cos - u * sin, at[1] + v * sin + u * cos);
    })
  );
  // the scene's y turns counter clockwise on the map the other way round, and
  // local +z has to come out where the door looks
  return { position: new Vector3(at[0], Math.min(...corners), -at[1]), angle: angle + Math.PI / 2 };
}

/** A point in the hut's own frame - x across, y up from its foot, z out of its door - in the scene. */
export function onHut(local: Vector3): Vector3 {
  const { position, angle } = hutFrame();
  return local
    .clone()
    .applyAxisAngle(new Vector3(0, 1, 0), angle)
    .add(position);
}

/**
 * The roof's four edges under the gables, from the foot up to the ridge, as
 * lines in the scene a string of lights is hung along: just clear of the
 * gable's face and over the tiling's edge, in steps short enough for the
 * string to follow the slope.
 */
export function hutRoofEdges(): Vector3[][] {
  const { width, eaves, ridge, depth, overhang, roof } = HUT;
  const steps = 4;
  const edge = 0.06;
  return [-1, 1].flatMap(end =>
    [-1, 1].map(side =>
      Array.from({ length: steps + 1 }, (_, step) => {
        const t = step / steps;
        return onHut(
          new Vector3(
            side * (width / 2) * (1 - t),
            eaves + (ridge - eaves) * t + roof + edge,
            end * (depth / 2 + overhang + 0.04)
          )
        );
      })
    )
  );
}

/** The hut, on the lowest ground under its corners. */
export function createHut(palette: Palette): Group {
  const { width, eaves, ridge, depth, overhang, box, roof, door } = HUT;
  const group = new Group();
  group.name = 'hut';

  const { position, angle } = hutFrame();
  group.position.copy(position);
  group.rotation.y = angle;

  const boards = new MeshLambertMaterial({ color: palette.boarding, flatShading: true });
  const walls = new Mesh(new BoxGeometry(box, eaves + HUT_SUNK, depth), boards);
  walls.position.y = (eaves - HUT_SUNK) / 2;

  // the two gables, from the roof's foot up to the ridge, seen from both sides
  const gables = new BufferGeometry();
  gables.setAttribute(
    'position',
    new Float32BufferAttribute(
      [1, -1].flatMap(end => [
        -width / 2,
        eaves,
        (end * depth) / 2,
        width / 2,
        eaves,
        (end * depth) / 2,
        0,
        ridge,
        (end * depth) / 2,
      ]),
      3
    )
  );
  gables.computeVertexNormals();
  const gable = new Mesh(gables, boards.clone());
  (gable.material as MeshLambertMaterial).side = DoubleSide;

  // each slope a slab from the foot to the ridge, its underside on the gable's
  // edge and its top a tiling's thickness above it. Cut square, the two would
  // leave a notch along the ridge: each runs on past it until the tops meet
  const run = Math.hypot(width / 2, ridge - eaves);
  const pitch = Math.atan2(ridge - eaves, width / 2);
  const past = roof * Math.tan(pitch);
  const tiles = new MeshLambertMaterial({ color: palette.roof, flatShading: true });
  const slopes = [1, -1].map(side => {
    const slope = new Mesh(new BoxGeometry(run + past, roof, depth + overhang * 2), tiles);
    slope.rotation.z = -side * pitch;
    slope.position.set(
      side * (width / 4 + (Math.sin(pitch) * roof) / 2 - (Math.cos(pitch) * past) / 2),
      (eaves + ridge) / 2 + (Math.cos(pitch) * roof) / 2 + (Math.sin(pitch) * past) / 2,
      0
    );
    return slope;
  });

  // the door in the gable's middle bay, standing on the ground, and the hatch
  // into the loft above it, standing on the loft's floor
  const glass = new MeshBasicMaterial({ color: palette.window, side: DoubleSide });
  const openings = (
    [
      [door[1], door[1] / 2],
      [HUT.hatch, HUT.loft + HUT.hatch / 2],
    ] as const
  ).map(([height, middle]) => {
    const opening = new Mesh(new BoxGeometry(door[0], height, 0.02), glass);
    opening.position.set(0, middle, depth / 2 + 0.015);
    return opening;
  });

  return group.add(walls, gable, ...slopes, ...openings);
}
