import cdt2d from 'cdt2d';
import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshLambertMaterial,
} from 'three';

import type { Point } from '../../data/data.js';
import { GROUND } from '../../data/terrain.baked.js';
import type { Palette } from '../../scene/palette.js';
import {
  boxed,
  nearestOn,
  offsetLine,
  raster,
  resample,
  segmentsOf,
  smoothstep,
  within,
} from '../../utils/geometry.utils.js';
import { YARD_CENTER } from '../buildings/footprint.js';
import { createFills, GROUND_NORMALS } from '../seam/fills.js';
import { HELD, KEEPS, PLATES, TRACED } from '../seam/seam.js';
import { DENT_CELL, PAVILION, PAVILION_CUT } from '../structures/pavilion.js';
import { heightAt, WAY_RUNS } from './ground.js';
import { RELIEF, terrainTint, unpacked } from './terrain.drawn.js';
import {
  CARRIAGEWAY_REACH,
  distanceToYard,
  FIELD_CLEAR,
  FLANK_BEYOND,
  FLANK_STRIDE,
  insideTerrain,
  KEEP_CELL,
  NEEDLE_LENGTH,
  NEEDLE_WIDTH,
  RIM_KEEP,
  RIM_MARGIN,
  ringRadii,
  SEAM_CLEAR,
  SKIRT_DEPTH,
} from './terrain.field.js';

/**
 * The terrain cut to the seam - built once and baked - and drawn as the scene gets it.
 */
/**
 * The ground, cut to the seam. The rings give the points - fine over the yard,
 * coarse out on the hills - the seam gives every line the ground is held to, at
 * the height it is held at, and a constrained triangulation puts the two
 * together while keeping every line of the seam as an edge. The network is
 * planar already, which is what lets it be handed over whole: lines handed in
 * raw cross one another, and a triangulation cannot hold that.
 *
 * What is not ground is then taken out again: the carriageways, where the ways
 * are laid, and the plates, where a bridge spans the water.
 */
export function buildTerrain(): { positions: number[]; indices: number[] } {
  const [ox, oy] = YARD_CENTER;
  const seam = HELD();
  // the traced seams: the ones the ground is taken away inside, and the ones it
  // is kept inside whatever else would take it
  const cutouts = TRACED().flatMap(ring =>
    ring === undefined || ring.keep ? [] : [boxed(ring.points)]
  );
  const cutOut = (point: Point) =>
    insideTerrain(point, RIM_MARGIN + RIM_KEEP) && cutouts.some(({ holds }) => holds(point));
  const keeps = KEEPS();
  const kept = (point: Point) => keeps.some(({ holds }) => holds(point));

  /**
   * The ways marked on a grid, twice over and for two different jobs: wide, to
   * keep the field's own points out of the way of the kerbs, and tight, to say
   * which triangles are carriageway. A point of the field close outside a kerb
   * takes the ground's own height, and where a way runs on a bank the two are
   * meters apart - the triangle between them dives under the carriageway's edge.
   */
  const beside = raster(
    WAY_RUNS.map(({ points, half }) => ({ points, width: half + FIELD_CLEAR })),
    1
  );
  // the last few meters of ground are left whole, though: out there one
  // triangle of it is wider than the road, so taking it away opens a notch in
  // the rim for the skirt to show through. The band is laid over it instead
  const laidOn = raster(
    WAY_RUNS.map(({ points, half }) => ({ points, width: half + CARRIAGEWAY_REACH })),
    0.25,
    point => insideTerrain(point, RIM_MARGIN + RIM_KEEP)
  );
  // and clear of every other line of the seam: a point of the field sitting on
  // one has nowhere to go, and one a hair beside it is a sliver
  const onSeam = raster(
    seam.edges.map(([from, to]) => ({
      points: [seam.points[from] as Point, seam.points[to] as Point],
      width: SEAM_CLEAR,
    })),
    0.25
  );
  // kept ground is the field's own, however near a way it lies
  const clear = ([x, y]: Point) => !onSeam(x, y) && (!beside(x, y) || kept([x, y]));
  // the raster only says where to look, and it looks a little past the kerb:
  // a cell of it reaches a third of a meter past the width it marks, which
  // took away a triangle between a kerb and a wall a wing's width off it, and
  // marked short of the kerb, it let a triangle 12cm inside it stand, rising
  // from the brook to the road's own edge. Which side of the kerb a triangle
  // is on is the distance to the middle of the way
  const onCarriageway = ([x, y]: Point) =>
    laidOn(x, y) && WAY_RUNS.some(({ points, half }) => nearestOn(points, x, y).distance < half);

  /**
   * Points laid beside the ways out where the rings are coarse. Between a held
   * kerb and a ring ten meters away the cut has nothing to work with, so it
   * fills the gap with needles a hundred meters long - and a needle carries its
   * three corners' heights across everything between them.
   */
  const flanks = WAY_RUNS.flatMap(({ points, half }) => {
    const stations = resample(points, 2).filter(point => insideTerrain(point, RIM_MARGIN));
    return [FIELD_CLEAR + 1, FIELD_CLEAR + 6, FIELD_CLEAR + 12].flatMap(off =>
      [half + off, -(half + off)].flatMap(distance =>
        offsetLine(stations, distance).filter(
          (point, step) =>
            step % FLANK_STRIDE === 0 &&
            distanceToYard(point) > FLANK_BEYOND &&
            insideTerrain(point, RIM_MARGIN) &&
            clear(point)
        )
      )
    );
  });

  const rings = ringRadii().map(radius => ({ radius, count: segmentsOf(radius) }));
  const ground = rings.flatMap(({ radius, count }, ring) =>
    Array.from({ length: count }, (_, segment): Point => {
      const angle = (segment / count) * Math.PI * 2;
      return [ox + Math.cos(angle) * radius, oy + Math.sin(angle) * radius];
    })
      // the outermost ring stays whole, or the slab loses the shape of its rim
      .filter(point => ring === rings.length - 1 || clear(point))
  );

  /**
   * And kept ground filled in on a grid of its own: the rings are four meters
   * apart along themselves, and a strip under a bridge two meters wide would
   * get next to none of them.
   */
  const filled = keeps.flatMap(({ box: [minX, minY, maxX, maxY], holds }) =>
    Array.from({ length: Math.ceil((maxX - minX) / KEEP_CELL) + 1 }, (_, column) =>
      Array.from({ length: Math.ceil((maxY - minY) / KEEP_CELL) + 1 }, (_, row): Point => [
        minX + column * KEEP_CELL,
        minY + row * KEEP_CELL,
      ])
    )
      .flat()
      .filter(point => holds(point) && clear(point))
  );

  // and the dent dug for the pavilion, laid finely: the terrain's own points
  // lie a couple of meters apart there
  const dent = PAVILION_CUT();
  const dug =
    dent === undefined
      ? []
      : Array.from(
          { length: Math.ceil((dent.box[2] - dent.box[0]) / DENT_CELL) + 1 },
          (_, column) =>
            Array.from(
              { length: Math.ceil((dent.box[3] - dent.box[1]) / DENT_CELL) + 1 },
              (_, row): Point => [dent.box[0] + column * DENT_CELL, dent.box[1] + row * DENT_CELL]
            )
        )
          .flat()
          .filter(
            ([x, y]) =>
              dent.reaches(x, y) &&
              heightAt(x, y) > dent.heightAt(x, y) - Math.max(DENT_CELL, PAVILION.brow) &&
              clear([x, y])
          );
  // the lower of the two, but for where they come near each other up the
  // bank - its top - there run into one another rather than broken off. Not
  // on the flat: rounded there too, the ground sank under the dumps' edges
  const cutAt = (x: number, y: number) => {
    const [field, dug] = [heightAt(x, y), dent?.heightAt(x, y) ?? Infinity];
    const brow = PAVILION.brow;
    const up = smoothstep(0, brow, dent?.bankAt(x, y) ?? 0);
    const near = Math.max(brow - Math.abs(field - dug), 0) / brow;
    return Math.min(field, dug) - (up * near * near * brow) / 4;
  };

  // the flanks go in front: the skirt reads the outermost ring off the end of
  // the field, and anything added after it is taken for the rim
  const field = [...flanks, ...filled, ...dug, ...ground];
  const { count: rimCount } = rings[rings.length - 1] as { count: number };
  const rim = field.length - rimCount;

  // the outermost ring is the one place that is never cleared for a way, so it
  // is the one place the field sits right beside a kerb. A point of the ground
  // two meters from one and four meters under it puts a cliff beneath the
  // carriageway's own edge, so there alone the ground takes the way's level
  const rimLevel = ([x, y]: Point) =>
    WAY_RUNS.map(({ points, half, level }) => ({
      beside: nearestOn(points, x, y).distance <= half + FIELD_CLEAR,
      level,
    }))
      .find(({ beside: near }) => near)
      ?.level(x, y) ?? heightAt(x, y);

  const points: Point[] = [...field, ...seam.points];
  const held = seam.edges.map(([from, to]): [number, number] => [
    field.length + from,
    field.length + to,
  ]);
  const heights = points.map((point, step) =>
    step >= field.length
      ? (seam.heights[step - field.length] as number)
      : step >= rim
        ? rimLevel(point)
        : cutAt(point[0], point[1])
  );

  const laid = cdt2d(
    points.map(([x, y]) => [x, y] as [number, number]),
    held,
    { delaunay: true, interior: true, exterior: true }
  );

  /**
   * A needle: long and with next to no ground in it. The cut hands them out
   * where a held line runs on into the coarse rings near the rim, and a needle
   * a hundred meters long carries its three corners' heights across everything
   * between them - which is a wall across the valley, not a piece of ground.
   */
  const needle = (corners: [Point, Point, Point]) => {
    const [a, b, c] = corners;
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
    const longest = Math.max(
      ...corners.map((one, step) => {
        const other = corners[(step + 1) % 3] as Point;
        return Math.hypot(one[0] - other[0], one[1] - other[1]);
      })
    );
    // the width it would have if it were a rectangle of that length
    return longest > NEEDLE_LENGTH && area / longest < NEEDLE_WIDTH;
  };

  const indices = laid.flatMap(([a, b, c]) => {
    const corners = [a, b, c].map(corner => points[corner] as Point) as [Point, Point, Point];
    const [pa, pb, pc] = corners;
    const middle: Point = [(pa[0] + pb[0] + pc[0]) / 3, (pa[1] + pb[1] + pc[1]) / 3];
    // the carriageway is where a way is laid, under a plate is the water, and
    // inside a traced seam is whatever it was traced round - unless the seam
    // was traced round ground to be kept
    if (
      !kept(middle) &&
      (cutOut(middle) ||
        onCarriageway(middle) ||
        PLATES.some(ring => within(middle, ring)) ||
        needle(corners))
    ) {
      return [];
    }
    // the scene mirrors north onto -z, and that mirror turns the winding with
    // it: a triangle drawn counter clockwise on the plan comes out facing up
    const turn = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1]);
    return turn > 0 ? [a, b, c] : [a, c, b];
  });

  const positions = points.flatMap(([x, y], point) => [x, heights[point] as number, -y]);

  // a skirt under the outer ring: the valley is cut out of the map, and a cut
  // has a side. Without it the terrain would end in a paper thin edge
  const skirt = points.length;
  const floor = heights.reduce((low, height) => Math.min(low, height), Infinity) - SKIRT_DEPTH;
  field.slice(rim).forEach(([x, y]) => positions.push(x, floor, -y));
  Array.from({ length: rimCount }, (_, segment) => {
    const [a, b] = [rim + segment, rim + ((segment + 1) % rimCount)];
    const [c, d] = [skirt + segment, skirt + ((segment + 1) % rimCount)];
    indices.push(a, c, b, b, c, d);
  });

  return { positions, indices };
}

export function createTerrain(palette: Palette): Mesh {
  const positions = new Float32Array(unpacked(GROUND.positions));
  const count = positions.length / 3;
  // the indices are packed as small as the vertices let them be
  const indices =
    count > 0xffff
      ? new Uint32Array(unpacked(GROUND.indices))
      : new Uint16Array(unpacked(GROUND.indices));

  const heights = Array.from({ length: count }, (_, vertex) => positions[vertex * 3 + 1] as number);
  const { floor } = RELIEF();
  const tint = terrainTint(palette);
  const colors = heights.flatMap((height, vertex) => {
    const [x, z] = [positions[vertex * 3] as number, positions[vertex * 3 + 2] as number];
    return height === floor ? [palette.rim.r, palette.rim.g, palette.rim.b] : tint(x, -z, height);
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.setAttribute('normal', new BufferAttribute(GROUND_NORMALS(), 3));

  // the only smooth shaded thing in the scene: a hillside is a surface, and
  // faceting it into tiles says something about the mesh, not about the valley
  const mesh = new Mesh(geometry, new MeshLambertMaterial({ vertexColors: true }));
  mesh.name = 'terrain';
  // and the ground piled on it, tinted the same
  mesh.add(createFills(tint));
  return mesh;
}
