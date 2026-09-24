import { expect } from '@open-wc/testing';
import type { Line, Mesh, Object3D } from 'three';
import { Group, Raycaster, Vector3 } from 'three';

import { readPalette } from '../../scene/palette.js';
import { YARD_CENTER } from '../buildings/footprint.js';
import { createCulvert, createDeck } from '../structures/decks.js';
import { unknownHandles } from '../structures/railings.js';
import { createWays, heightAt } from '../terrain/ground.js';
import { TERRAIN_RADIUS } from '../terrain/terrain.field.js';
import { buildTerrain, createTerrain } from '../terrain/terrain.js';
import { pathOf, SEAM_PICKS, seamNetwork, tracedSeams } from './seam.js';

/** The seam's own contract, which the tooling around it is only as good as. */
describe('the seam', () => {
  const palette = readPalette(document.documentElement);

  it('should offer handles on both edges of every wall and on the ways', () => {
    const kinds = SEAM_PICKS.map(({ edge }) => edge);

    expect(kinds).to.contain('top');
    expect(kinds).to.contain('foot');
    expect(kinds).to.contain('road');
  });

  it('should name every handle once, and every name it is referred to by', () => {
    const keys = SEAM_PICKS.map(({ key }) => key);

    expect(new Set(keys).size, 'two handles of one name').to.equal(keys.length);
    expect(unknownHandles(), 'names no handle has').to.be.empty;
  });

  it('should carry every wall point at its top and at its foot', () => {
    // what lies on the ground has a top only
    const tops = SEAM_PICKS.filter(({ edge, lying }) => edge === 'top' && !lying);
    const feet = SEAM_PICKS.filter(({ edge }) => edge === 'foot');

    expect(tops).to.have.lengthOf(feet.length);
    tops.forEach(({ at, level }) => {
      const foot = feet.find(other => Math.hypot(other.at[0] - at[0], other.at[1] - at[1]) < 0.01);

      expect(foot, `no foot under the handle at ${at.join(', ')}`).to.exist;
      expect(level).to.be.greaterThan(foot?.level ?? 0);
    });
  });

  it('should hold a planar network, which a triangulation can be built on', function () {
    // the network is cut twice over for this, the traced seams routed through
    // the first, which takes a moment
    this.timeout(20000);
    const { points, edges } = seamNetwork();
    type At = [number, number];
    const pieces = edges.map(([from, to]) => [points[from] as At, points[to] as At] as [At, At]);

    // the whole valley, filed on a grid so that only neighbours are compared
    const cell = 2;
    const cells = ([a, b]: [At, At]) =>
      Array.from(
        {
          length:
            Math.floor(Math.max(a[0], b[0]) / cell) - Math.floor(Math.min(a[0], b[0]) / cell) + 1,
        },
        (_, x) => x + Math.floor(Math.min(a[0], b[0]) / cell)
      ).flatMap(x =>
        Array.from(
          {
            length:
              Math.floor(Math.max(a[1], b[1]) / cell) - Math.floor(Math.min(a[1], b[1]) / cell) + 1,
          },
          (_, y) => `${x}:${y + Math.floor(Math.min(a[1], b[1]) / cell)}`
        )
      );
    const grid = new Map<string, number[]>();
    pieces.forEach((piece, step) =>
      cells(piece).forEach(key => grid.set(key, [...(grid.get(key) ?? []), step]))
    );

    const shared = (one: At, other: At) => Math.hypot(one[0] - other[0], one[1] - other[1]) < 1e-6;
    // an end of one lying on the middle of the other is as much a fault as a
    // crossing: the triangulation folds over the point the line runs past
    const touches = (point: At, [a, b]: [At, At]) => {
      if (shared(point, a) || shared(point, b)) {
        return false;
      }
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const share =
        ((point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1])) / length ** 2;
      const away =
        Math.abs((b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0])) / length;
      return share > 0 && share < 1 && away < 0.01;
    };
    const faults = pieces.flatMap(([a, b], step) => {
      const near = new Set(cells([a, b]).flatMap(key => grid.get(key) ?? []));
      return [...near]
        .filter(other => other > step)
        .flatMap(other => {
          const [c, d] = pieces[other] as [At, At];
          if (
            [c, d].some(end => touches(end, [a, b])) ||
            [a, b].some(end => touches(end, [c, d]))
          ) {
            return [`touching at ${a.join(', ')}`];
          }
          if (shared(a, c) || shared(a, d) || shared(b, c) || shared(b, d)) {
            return [];
          }
          const [ux, uy] = [b[0] - a[0], b[1] - a[1]];
          const [vx, vy] = [d[0] - c[0], d[1] - c[1]];
          const denominator = ux * vy - uy * vx;
          if (Math.abs(denominator) < 1e-12) {
            return [];
          }
          const t = ((c[0] - a[0]) * vy - (c[1] - a[1]) * vx) / denominator;
          const u = ((c[0] - a[0]) * uy - (c[1] - a[1]) * ux) / denominator;
          return t > 0 && t < 1 && u > 0 && u < 1 ? [`crossing near ${a.join(', ')}`] : [];
        });
    });

    expect(pieces.length).to.be.greaterThan(100);
    expect(faults, 'lines cross or touch away from a point of the network').to.have.lengthOf(0);
  });

  it('should trace along the edge between two handles, not straight across', () => {
    const wall = SEAM_PICKS.map((handle, index) => ({ ...handle, index })).filter(
      ({ edge }) => edge === 'top'
    );
    const [from, to] = [wall[15], wall[16]];
    const positions = pathOf([from?.index ?? 0, to?.index ?? 0], false);

    // a straight hop would be the two ends and nothing in between
    expect(positions.length / 3).to.be.greaterThan(2);
  });

  it('should find every handle a traced seam names', () => {
    // a seam is written by coordinates, and a handle that moved is not found:
    // the seam is then not cut at all, which has to be noticed
    const seams = tracedSeams();

    expect(seams.length).to.be.greaterThan(0);
    seams.forEach((ring, step) => expect(ring, `seam ${step + 1} lost a handle`).to.exist);
  });

  it('should cut no needles into the ground', async function () {
    // the ground is triangulated from scratch for this, which takes a moment
    this.timeout(20000);
    const terrain = createTerrain(palette);
    const position = terrain.geometry.getAttribute('position');
    const index = terrain.geometry.getIndex();
    const faces = index === null ? position.count / 3 : index.count / 3;

    const needles = Array.from({ length: faces }, (_, face) => {
      const corners = [0, 1, 2].map(step => {
        const at = index === null ? face * 3 + step : index.getX(face * 3 + step);
        return [position.getX(at), -position.getZ(at)] as [number, number];
      }) as [[number, number], [number, number], [number, number]];
      const [a, b, c] = corners;
      const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
      const longest = Math.max(
        ...corners.map((one, step) => {
          const other = corners[(step + 1) % 3] as [number, number];
          return Math.hypot(one[0] - other[0], one[1] - other[1]);
        })
      );
      // the skirt hangs straight down, so it has no ground in it by rights
      const upright = area < 1e-6;
      return { longest, width: area / longest, upright };
    }).filter(({ longest, width, upright }) => !upright && longest > 20 && width < 0.2);

    expect(needles, 'the ground carries triangles with no ground in them').to.have.lengthOf(0);
  });

  it('should never ask the ground to rise into the brook', () => {
    // a road is held up to, a brook is held down to: the bed filled in is a dam
    const asked = SEAM_PICKS.filter(({ edge }) => edge === 'bed').map(
      ({ at, level }) => level - heightAt(at[0], at[1])
    );

    expect(asked.length).to.be.greaterThan(0);
    expect(Math.max(...asked)).to.be.at.most(0.001);
  });

  it('should keep the rim of the ground whole', async function () {
    // the ground is cut away under a road, and out here one triangle of it is
    // wider than the road: cutting one opens a notch for the skirt to show through
    this.timeout(20000);
    const terrain = createTerrain(palette);
    terrain.updateMatrixWorld(true);
    const ray = new Raycaster();

    const bare = Array.from({ length: 360 }, (_, step) => (step * Math.PI) / 180).filter(angle =>
      [296, 299].some(reach => {
        const [x, y] = [
          YARD_CENTER[0] + Math.cos(angle) * reach,
          YARD_CENTER[1] + Math.sin(angle) * reach,
        ];
        ray.set(new Vector3(x, 400, -y), new Vector3(0, -1, 0));
        return ray.intersectObject(terrain, false).length === 0;
      })
    );

    expect(bare, 'the rim has a notch cut out of it').to.have.lengthOf(0);
  });

  it('should stand nothing through a carriageway', async function () {
    // around the mill, where the walls, the plates and the held ground all meet
    // the road: a wall top read every few meters stands through a road that
    // bends between them, and a plate laid corner to corner through one that sags
    this.timeout(20000);
    const ways = createWays(palette);
    const built = new Group().add(
      createCulvert(palette),
      createDeck(palette),
      createTerrain(palette)
    );
    built.updateMatrixWorld(true);
    ways.updateMatrixWorld(true);
    const ray = new Raycaster();
    const from = (x: number, y: number) => {
      ray.set(new Vector3(x, 400, -y), new Vector3(0, -1, 0));
      return ray;
    };

    const roads = ways.children.filter(part => {
      // the main road is the wide band
      const position = (part as Mesh).geometry.getAttribute('position');
      return (
        Math.hypot(position.getX(0) - position.getX(1), position.getZ(0) - position.getZ(1)) > 4
      );
    });
    const through = roads.flatMap((road: Object3D) => {
      const position = (road as Mesh).geometry.getAttribute('position');
      return Array.from({ length: position.count / 2 }, (_, step) => step * 2).flatMap(at => {
        const [lx, ly, rx, ry] = [
          position.getX(at),
          -position.getZ(at),
          position.getX(at + 1),
          -position.getZ(at + 1),
        ];
        if (Math.hypot(lx - YARD_CENTER[0], ly - YARD_CENTER[1]) > 80) {
          return [];
        }
        return [0.1, 0.3, 0.5, 0.7, 0.9].flatMap(share => {
          const [x, y] = [lx + (rx - lx) * share, ly + (ry - ly) * share];
          const surface = from(x, y).intersectObject(road, false)[0]?.point.y;
          const highest = from(x, y).intersectObject(built, true)[0]?.point.y;
          return surface === undefined || highest === undefined || highest <= surface
            ? []
            : [`${(highest - surface).toFixed(4)}m at ${x.toFixed(2)}, ${y.toFixed(2)}`];
        });
      });
    });

    expect(through, 'something stands through the road').to.have.lengthOf(0);
  });

  it('should bake the ground the seam cuts', async function () {
    // the baked terrain is only as good as the model it was baked from. The
    // indices are not compared: the rings are circles, four points of one are
    // as good as cocircular, and which diagonal the cut takes there turns on
    // the last digit of a sine - which is not the model having changed
    this.timeout(30000);
    const { positions, indices } = buildTerrain();
    const baked = createTerrain(palette).geometry;
    const position = baked.getAttribute('position');
    const index = baked.getIndex();

    expect(position.count, 'stale: run npm run data:terrain').to.equal(positions.length / 3);
    expect(index?.count, 'stale: run npm run data:terrain').to.equal(indices.length);
    const moved = positions.reduce(
      (most, value, step) => Math.max(most, Math.abs(value - (position.array[step] as number))),
      0
    );

    expect(moved, 'stale: run npm run data:terrain').to.be.below(1e-3);
  });

  it('should carry the ways out to the rim of the modelled ground', () => {
    const ways = createWays(palette);
    const reached = ways.children.reduce((furthest, part) => {
      const position = (part as Line).geometry.getAttribute('position');
      return Array.from({ length: position.count }, (_, step) =>
        Math.hypot(position.getX(step) - YARD_CENTER[0], -position.getZ(step) - YARD_CENTER[1])
      ).reduce((most, out) => Math.max(most, out), furthest);
    }, 0);

    // the corners of a band are held on the ground, so it reaches the rim and
    // stops there rather than hanging over the edge
    expect(reached).to.be.greaterThan(TERRAIN_RADIUS - 1);
    expect(reached).to.be.at.most(TERRAIN_RADIUS + 0.01);
  });
});
