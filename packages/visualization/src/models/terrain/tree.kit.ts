import {
  BufferGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  Vector3,
} from 'three';

import { random } from '../../utils/geometry.utils.js';

/**
 * The trees the woods are drawn with: a handful of shapes per kind, each made
 * once and stood a few hundred times, and each in two pieces. The stem is a
 * unit tall and is stretched to reach the crown; the crown - its lumps, the
 * limbs into them and the winter's twigs - is drawn in crown radii and scaled
 * the same way every way, so however tall a tree and however narrow its crown,
 * no lump is ever drawn out of its shape.
 *
 * A crown is a few lumps round a leader rather than one: from any side it is
 * ragged, with sky between the lumps, the way a broadleaf reads from a way off.
 * About a hundred triangles a tree; a textured library tree is several
 * thousand, and the site draws without textures anyway.
 */

/** What makes a kind, every length in crown radii. */
export interface TreeKind {
  /** How far above the fork the crown starts, and how deep it is from there. */
  gap: number;
  depth: number;
  /** How many lumps stand round the leader's, the fewest and the most. */
  lumps: [number, number];
  /** How far out they stand, and how big they are across. */
  out: number;
  size: number;
  /** How flat each lump is: its height against the crown's depth. */
  flat: number;
  /** How much stouter than a limb its limbs are: forked low and stout, they are stems. */
  limb?: number;
  /**
   * How far up the crown a lump may be lifted off its underside, as a share of
   * its depth: the lumps then stand in two tiers. Held low where the limbs
   * come up from far below, or they show bare between the lumps.
   */
  tiers?: number;
  /** How much of the crown's depth the leader's lump takes, from the top down. */
  leader?: number;
}

export const BEECH: TreeKind = {
  gap: 0.3,
  depth: 2.1,
  lumps: [2, 3],
  out: 0.45,
  size: 0.55,
  flat: 0.3,
};
export const OAK: TreeKind = {
  gap: 0.25,
  depth: 1.9,
  lumps: [3, 5],
  out: 0.55,
  size: 0.5,
  flat: 0.26,
};

/**
 * The alders along the brook: two or three stems from low down - the fork a
 * long way under the crown - and the crown round.
 */
export const ALDER: TreeKind = {
  gap: 1.2,
  depth: 2,
  lumps: [2, 3],
  out: 0.45,
  size: 0.55,
  flat: 0.32,
  limb: 1.5,
  tiers: 0.08,
  leader: 0.8,
};

/** The young trees planted on the meadow: a thin stem and a small crown, its lumps close. */
export const SAPLING: TreeKind = {
  gap: 0.4,
  depth: 1.9,
  lumps: [2, 3],
  out: 0.42,
  size: 0.5,
  flat: 0.3,
  tiers: 0.08,
  leader: 0.8,
};

/** How many shapes each kind is drawn with. */
export const TREE_SHAPES = 4;

/** The pieces a shape is drawn in, each its own mesh. */
export interface TreeShape {
  /** A unit tall, a crown's radius across: stretched from the ground to the fork. */
  stem: BufferGeometry;
  /** In crown radii from the fork: the limbs, the lumps, and the twigs. */
  wood: BufferGeometry;
  crown: BufferGeometry;
  /**
   * What a broadleaf shows once its leaves are gone: the limbs carried on to
   * the crown's skin and fanning out into twigs. Inside the crown while it is
   * in leaf, so drawn only for a winter - hidden until then, and then with the
   * crown hidden instead.
   */
  twigs?: BufferGeometry;
  /** How far above the fork the crown's top is, in crown radii. */
  top: number;
}

/**
 * A shape as it is drawn near the yard, and the same shape as it is drawn far
 * off: there the leader's lump and one other, on a plain stem, is all the eye
 * makes out - and half the triangles.
 */
export interface TreeDetail {
  near: TreeShape;
  far: TreeShape;
}

/** How many shapes the shrubs are drawn with. */
export const SHRUB_SHAPES = 4;

/** Stem radius at its foot and where it forks, in crown radii. */
const STEM = { foot: 0.075, fork: 0.055, sides: 5 };

/** A limb's radius where it leaves the fork and where it ends in its lump. */
const LIMB = { from: 0.05, to: 0.03, sides: 4 };

/**
 * The winter's wood: each limb carried on from where it stops in its lump out
 * to the crown's skin (`reach` of the lump's size), and this many twigs out of
 * it on the way, each with one of its own off half way - so a bare crown has
 * the crown's outline, filled with a fan of lines rather than a few sticks.
 */
const TWIG = { count: 4, on: 0.03, tip: 0.012, from: 0.02, to: 0.008, sides: 3, reach: 0.95 };

/** Corner positions of a set of triangles, one list for a whole part. */
type Faces = number[];

/**
 * A tapered prism between two points, open at both ends: its foot is in the
 * ground or in the stem it grows from, its top inside a lump.
 */
function prism(from: Vector3, to: Vector3, [a, b]: [number, number], sides: number): Faces {
  const axis = to.clone().sub(from).normalize();
  const helper = Math.abs(axis.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  const u = new Vector3().crossVectors(axis, helper).normalize();
  const v = new Vector3().crossVectors(axis, u);
  const ring = (center: Vector3, radius: number) =>
    Array.from({ length: sides }, (_, k) => {
      const angle = (k / sides) * Math.PI * 2;
      return center
        .clone()
        .addScaledVector(u, Math.cos(angle) * radius)
        .addScaledVector(v, Math.sin(angle) * radius);
    });
  const [low, high] = [ring(from, a), ring(to, b)];
  return low.flatMap((corner, k) => {
    const next = (k + 1) % sides;
    const [p, q, r, s] = [corner, low[next], high[next], high[k]] as [
      Vector3,
      Vector3,
      Vector3,
      Vector3,
    ];
    return [p, q, r, p, r, s].flatMap(({ x, y, z }) => [x, y, z]);
  });
}

/** One lump of a crown: the icosahedron stretched to its size and turned. */
function lump(center: Vector3, [across, up]: [number, number], turn: number): Faces {
  const shape = new IcosahedronGeometry(1, 0);
  shape.applyMatrix4(
    new Matrix4()
      .makeRotationY(turn)
      .premultiply(new Matrix4().makeScale(across, up, across))
      .premultiply(new Matrix4().makeTranslation(center.x, center.y, center.z))
  );
  const faces = Array.from(shape.getAttribute('position').array);
  shape.dispose();
  return faces;
}

function geometry(faces: Faces): BufferGeometry {
  const made = new BufferGeometry();
  made.setAttribute('position', new Float32BufferAttribute(faces, 3));
  made.computeVertexNormals();
  return made;
}

/**
 * The shapes of one kind. The leader's lump tops the crown; the others stand
 * round it, spread evenly with a little give, their undersides where the crown
 * starts - or higher up, so the lumps stand in two tiers - and a limb runs
 * from the fork into each.
 */
export function treeShapes(kind: TreeKind, seed: number): TreeDetail[] {
  const next = random(seed);
  const stout = kind.limb ?? 1;
  return Array.from({ length: TREE_SHAPES }, (_, index) => {
    const depth = kind.depth * (0.9 + next() * 0.2);
    const bottom = kind.gap;
    const top = bottom + depth;
    // an icosahedron's top and bottom vertices lie at 0.85 of its radius
    const leaderUp = (depth * (kind.leader ?? 0.55)) / 0.85 / 2;
    const leader = new Vector3((next() - 0.5) * 0.1, top - leaderUp * 0.85, (next() - 0.5) * 0.1);
    const leaderSize: [number, number] = [kind.size * 1.15, leaderUp];
    const count = kind.lumps[0] + Math.floor(next() * (kind.lumps[1] - kind.lumps[0] + 1));
    const start = next() * Math.PI * 2;
    const lumps = Array.from({ length: count }, (_, k) => {
      const angle = start + ((k + (next() - 0.5) * 0.5) / count) * Math.PI * 2;
      const size = kind.size * (0.85 + next() * 0.3);
      const up = (depth * kind.flat * (0.85 + next() * 0.3)) / 0.85;
      const out = kind.out * (0.85 + next() * 0.3);
      const lift = next() * depth * (kind.tiers ?? 0.35);
      const center = new Vector3(
        Math.cos(angle) * out,
        bottom + up * 0.85 + lift,
        Math.sin(angle) * out
      );
      return { center, size: [size, up] as [number, number], turn: next() * Math.PI };
    });
    const every = [{ center: leader, size: leaderSize }, ...lumps];

    const fork = new Vector3();
    const stem = prism(
      new Vector3(0, -0.02, 0),
      new Vector3(0, 1, 0),
      [STEM.foot, STEM.fork],
      STEM.sides
    );
    // into each lump, short of its middle: the rest is inside it
    const limbEnd = (center: Vector3) => fork.clone().lerp(center, 0.7);
    const limbs = every.flatMap(({ center }) =>
      prism(fork, limbEnd(center), [LIMB.from * stout, LIMB.to * stout], LIMB.sides)
    );

    // the winter's wood on a draw of its own, so the shapes stay the ones they were
    const bare = random(seed * 31 + index);
    const skin = (center: Vector3, [across, up]: [number, number], lean: number) => {
      const [azimuth, elevation] = [bare() * Math.PI * 2, (lean + bare() * 0.35) * Math.PI];
      return center
        .clone()
        .add(
          new Vector3(
            Math.cos(elevation) * Math.cos(azimuth) * across,
            Math.sin(elevation) * up,
            Math.cos(elevation) * Math.sin(azimuth) * across
          ).multiplyScalar(TWIG.reach)
        );
    };
    const winter = every.map(({ center, size }) => {
      const from = limbEnd(center);
      // on past its end, out and up to the skin, the way it was growing
      const onward = from.clone().add(
        from
          .clone()
          .normalize()
          .multiply(new Vector3(size[0], size[1], size[0]))
      );
      const on = prism(from, onward, [LIMB.to * stout, TWIG.on], LIMB.sides);
      // far off a three sided one does: nobody counts a limb's faces there
      const farOn = prism(from, onward, [LIMB.to * stout, TWIG.on], 3);
      const twigs = Array.from({ length: TWIG.count }, (_, k) => {
        const root = from.clone().lerp(onward, k / TWIG.count);
        const end = skin(center, size, 0.1);
        return {
          main: prism(root, end, [TWIG.from, TWIG.tip], TWIG.sides),
          side: prism(
            root.clone().lerp(end, 0.5),
            skin(center, size, 0.2),
            [TWIG.to * 1.5, TWIG.to],
            TWIG.sides
          ),
        };
      });
      return { on, farOn, twigs };
    });

    const crown = every.flatMap(({ center, size }, k) =>
      lump(center, size, k === 0 ? next() * Math.PI : (lumps[k - 1]?.turn ?? 0))
    );
    const [, first] = every as [(typeof every)[number], (typeof every)[number]];
    return {
      near: {
        stem: geometry(stem),
        wood: geometry(limbs),
        crown: geometry(crown),
        twigs: geometry(
          winter.flatMap(({ on, twigs }) => [
            ...on,
            ...twigs.flatMap(({ main, side }) => [...main, ...side]),
          ])
        ),
        top,
      },
      // far off, the leader's lump and one other on one limb each; bare, the
      // two carried on and half their twigs, none branching again
      far: {
        stem: geometry(stem),
        wood: geometry(
          [every[0], first].flatMap(lumped =>
            lumped === undefined
              ? []
              : prism(
                  fork,
                  limbEnd(lumped.center),
                  [LIMB.from * stout, LIMB.to * stout],
                  LIMB.sides
                )
          )
        ),
        crown: geometry([
          ...lump(leader, leaderSize, 0),
          ...lump(first.center, first.size, lumps[0]?.turn ?? 0),
        ]),
        twigs: geometry(
          winter
            .slice(0, 2)
            .flatMap(({ farOn, twigs }) => [
              ...farOn,
              ...twigs.slice(0, TWIG.count / 4).flatMap(({ main }) => main),
            ])
        ),
        top,
      },
    };
  });
}

/** One shrub's shape as it is drawn near and far, and its bare rods in each. */
export interface ShrubShape {
  near: BufferGeometry;
  far: BufferGeometry;
  /** A winter's shrub: rods out of the ground into each lump's skin, hidden while in leaf. */
  nearTwigs: BufferGeometry;
  farTwigs: BufferGeometry;
}

/**
 * The rods a shrub is bare to in winter: from round its foot up to the skin
 * of its lumps, `per` a lump, each with one more off half way - a shrub is
 * stems from the ground, not a stem forking. Far off `far` of them, plain.
 */
const ROD = { per: 2, far: 3, from: 0.035, to: 0.012, sides: 3, reach: 0.9 };

/**
 * The shrubs' shapes, drawn in the unit the lone lump they replace was: a
 * radius of one round the middle, the foot at 0.85 below it. Near the yard a
 * shrub is two or three low lumps round a taller one, every underside on the
 * foot's line, so it sits on the ground as the lone lump did; far off it is
 * that lone lump still.
 */
export function shrubShapes(seed: number): ShrubShape[] {
  const next = random(seed);
  const foot = -0.85;
  return Array.from({ length: SHRUB_SHAPES }, (_, index) => {
    // the tallest one stands on the foot too and tops the shrub about where
    // the lone lump did: hung higher, it left the ground bare under the middle
    const up = 0.9 + next() * 0.1;
    const lumps: { center: Vector3; size: [number, number]; turn: number }[] = [
      { center: new Vector3(0, foot + up * 0.85, 0), size: [0.65, up], turn: next() * Math.PI },
    ];
    const count = 2 + Math.floor(next() * 2);
    const start = next() * Math.PI * 2;
    Array.from({ length: count }, (_, k) => {
      const angle = start + ((k + (next() - 0.5) * 0.4) / count) * Math.PI * 2;
      const out = 0.35 + next() * 0.1;
      const high = 0.5 + next() * 0.1;
      lumps.push({
        center: new Vector3(Math.cos(angle) * out, foot + high * 0.85, Math.sin(angle) * out),
        size: [0.5 + next() * 0.1, high],
        turn: next() * Math.PI,
      });
    });

    // the rods on a draw of their own, so the shapes stay the ones they were
    const bare = random(seed * 29 + index);
    const rods = (center: Vector3, [across, high]: [number, number], per: number, branch = true) =>
      Array.from({ length: per }, () => {
        const root = new Vector3((bare() - 0.5) * 0.2, foot - 0.05, (bare() - 0.5) * 0.2);
        const skin = () => {
          const [azimuth, elevation] = [bare() * Math.PI * 2, (0.2 + bare() * 0.3) * Math.PI];
          return center
            .clone()
            .add(
              new Vector3(
                Math.cos(elevation) * Math.cos(azimuth) * across,
                Math.sin(elevation) * high,
                Math.cos(elevation) * Math.sin(azimuth) * across
              ).multiplyScalar(ROD.reach)
            );
        };
        const end = skin();
        const off = skin();
        return [
          ...prism(root, end, [ROD.from, ROD.to], ROD.sides),
          ...(branch
            ? prism(root.clone().lerp(end, 0.5), off, [ROD.to * 1.5, ROD.to], ROD.sides)
            : []),
        ];
      }).flat();

    return {
      near: geometry(lumps.flatMap(({ center, size, turn }) => lump(center, size, turn))),
      far: geometry(lump(new Vector3(), [1, 1], 0)),
      nearTwigs: geometry(lumps.flatMap(({ center, size }) => rods(center, size, ROD.per))),
      // far off a few rods, none branching again
      farTwigs: geometry(rods(new Vector3(), [1, 1], ROD.far, false)),
    };
  });
}

/**
 * A spruce: a short stem under three cones stacked into one another, each
 * narrower than the one below and closed underneath, where a low eye sees
 * into it. In crown radii like the broadleaves; far off one cone.
 */
export function spruceShape(): TreeDetail {
  const sides = 7;
  const cone = (base: number, tip: number, radius: number): Faces => {
    const ring = Array.from({ length: sides }, (_, k) => {
      const angle = (k / sides) * Math.PI * 2;
      return [Math.cos(angle) * radius, base, Math.sin(angle) * radius] as const;
    });
    return ring.flatMap((corner, k) => {
      const next = ring[(k + 1) % sides] as typeof corner;
      // the side, wound to face out, and the floor under it, wound to face down
      return [...corner, 0, tip, 0, ...next, ...corner, ...next, 0, base, 0];
    });
  };
  const stem = geometry(prism(new Vector3(0, -0.02, 0), new Vector3(0, 1, 0), [0.1, 0.08], 5));
  // the stem carries on up the middle, under the tiers
  const wood = geometry(prism(new Vector3(), new Vector3(0, 2.2, 0), [0.08, 0.03], 5));
  const top = 3.1;
  return {
    near: {
      stem,
      wood,
      crown: geometry([cone(0, 1.45, 1), cone(0.85, 2.3, 0.72), cone(1.6, top, 0.46)].flat()),
      top,
    },
    far: { stem, wood, crown: geometry(cone(0, top, 1)), top },
  };
}
