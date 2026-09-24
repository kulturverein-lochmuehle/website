import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshLambertMaterial,
  Vector3,
} from 'three';

import type { Point } from '../../data/data.js';
import { POINTS } from '../../data/points.js';
import type { Palette } from '../../scene/palette.js';
import { convexHull, nearestOn, once, within } from '../../utils/geometry.utils.js';
import { octagonal, strut } from '../../utils/mesh.utils.js';
import { LANDFILL_GROUND } from '../seam/fills.js';
import { SEAM_FOUND } from './measures.js';
import { STAIRS_PLAN } from './stairs.js';

/**
 * The octagonal pavilion on the terrace deck, and the dent dug for it.
 */
/**
 * The pavilion on the terrace deck, where the stairs come up: eight timber
 * posts on an octagon, an eaves beam round their tops and a knee brace from
 * each post to either beam beside it, under an octagonal roof open at its top,
 * with a small roof of its own raised over the opening - as the photographs
 * have it. Its posts 1.2m apart; one side of it faces the stairs, and its far
 * posts stand a meter short of where the deck ends on their line.
 */
export const PAVILION = {
  /** How far apart the posts stand, and how thick they are, in meters. */
  side: 1.2,
  post: 0.14,
  /** How high the roof's lower edge stands over the socket - 2.2m over the ground - and how deep the beam round the posts' tops is. */
  eaves: 2.05,
  beam: 0.16,
  /** How far down the posts the knee braces start, and how far along the beams they end. */
  brace: 0.6,
  /** How far the roof reaches past the posts, how steep it rises, and how wide it is open at its top. */
  overhang: 0.45,
  pitch: 35,
  opening: 0.35,
  /** The small roof over the opening: how wide, and how far it stands over the rafters' ends. */
  cap: 0.6,
  lift: 0.02,
  /**
   * The rafters of its mandala roof: how many - one over each post - how thick, how near the middle
   * each passes - straight, and tangent to that circle, not through it - and
   * how far on past it each runs, its end under the small roof.
   */
  rafters: 8,
  rafter: 0.1,
  swirl: 0.32,
  past: 0.35,
  /** How far short of the eaves' edge the rafters end, under the roof, in meters. */
  short: 0.2,
  /**
   * How high the rails between its posts run over its floor, and the sides it
   * is entered from, which have none: the one facing the stairs, and the one
   * either side of it.
   */
  rail: 0.8,
  entries: [-1, 0, 1],
  /** How high the second rail runs over its floor, on the sides across from the entries. */
  low: 0.1,
  /** Its socket: how high it stands off the deck, and how far it reaches past the posts' outer faces. */
  socket: 0.15,
  plinth: 0.25,
  /** How far off the top step of the stairs its near posts stand. */
  from: 3,
  /**
   * The dent dug for it in the slope behind: the path round its posts, the
   * bank from there up to the slope, and how deep it digs at most.
   */
  path: 1,
  bank: 0.8,
  deep: 2,
  /** How far out the bank's foot is rounded, and how far its top runs into the slope, in meters. */
  toe: 1,
  brow: 0.4,
  /** Where to the south it opens onto the deck's extension: that one's upper edge, 226 to 228. */
  opens: [
    [32.3, 27.16],
    [33.79, 26.26],
    [35.87, 25.58],
  ],
} as const;

/**
 * The two posts of the side facing the stairs, which has no knee braces: the
 * octagon's corners go round from the stairs' way, and theirs is the side
 * straight back along it.
 */
const PAVILION_OPEN = [3, 4];

/** How finely the dent behind the pavilion is laid, in meters. */
export const DENT_CELL = 0.3;

/** How far over the eaves beam the roof lies, in meters: on it exactly, the two show through each other. */
const PAVILION_BED = 0.02;

/** Where the pavilion stands and how it is turned: its middle, the deck's height there, and the stairs' way. */
const PAVILION_AT = once(() => {
  const plan = STAIRS_PLAN;
  if (plan === undefined) {
    return undefined;
  }
  const { at, walked, top } = plan;
  const start = at(walked, 0);
  const next = at(walked + 1, 0);
  const way: Point = [next[0] - start[0], next[1] - start[1]];
  // on the stairs' line, its near posts `from` off the top step - the posts'
  // flat sides stand this far from its middle - at the top step's height
  const apothem = PAVILION.side / 2 / Math.tan(Math.PI / 8);
  const by = PAVILION.from + apothem;
  const middle: Point = [start[0] + way[0] * by, start[1] + way[1] * by];
  return { middle, way, level: top };
});

/**
 * The dent the slope behind the pavilion is dug back to, so it stands on the
 * deck with a path round it: flat at the deck's height out to `path` past the
 * posts' outer faces, and a bank at `bank` from there up to where it meets the
 * slope - the ground no higher than that anywhere. It is baked into the
 * terrain itself (`buildTerrain`), with a grid of points of its own, since the
 * terrain's own lie a couple of meters apart there.
 */
export const PAVILION_CUT = once(() => {
  const at = PAVILION_AT();
  if (at === undefined) {
    return undefined;
  }
  const { middle, way, level } = at;
  const [mx, my] = middle;
  const facing = Math.atan2(way[1], way[0]);
  const apothem = PAVILION.side / 2 / Math.tan(Math.PI / 8);
  const flat = apothem + PAVILION.post / 2 + PAVILION.path;
  // how far out from the middle a point is, square to the octagon's side it faces
  const out = (x: number, y: number) =>
    Math.max(
      ...Array.from({ length: 8 }, (_, k) => {
        const angle = facing + (k * Math.PI) / 4;
        return (x - mx) * Math.cos(angle) + (y - my) * Math.sin(angle);
      })
    );
  // and to the south it opens onto the deck's extension: out to its upper
  // edge up the slope, flattened to the plane through the dent and that edge
  const opens = PAVILION.opens.flatMap(([x, y]) => {
    const point = POINTS.find(([px, py]) => Math.hypot(px - x, py - y) < SEAM_FOUND);
    return point === undefined ? [] : [point];
  });
  const corners = Array.from({ length: 8 }, (_, k): Point => {
    const angle = facing + Math.PI / 8 + (k * Math.PI) / 4;
    const reach = flat / Math.cos(Math.PI / 8);
    return [mx + Math.cos(angle) * reach, my + Math.sin(angle) * reach];
  });
  const hull = convexHull([...corners, ...opens.map(([x, y]): Point => [x, y])]);
  // between the dent and that edge, blended from the deck's height at the one
  // to the edge's own heights at the other - so the two meet on the edge
  const edgeLine = opens.map(([x, y]): Point => [x, y]);
  const edgeAt = (x: number, y: number) => {
    const { at: on, along } = nearestOn(edgeLine, x, y);
    const step = Math.min(Math.floor(along), opens.length - 2);
    const [from, to] = [opens[step], opens[step + 1]] as [
      [number, number, number],
      [number, number, number],
    ];
    const share = along - step;
    return {
      level: from[2] + (to[2] - from[2]) * share,
      distance: Math.hypot(on[0] - x, on[1] - y),
    };
  };
  const plane = (x: number, y: number) => {
    if (opens.length < 2) {
      return level;
    }
    const edge = edgeAt(x, y);
    const fromDent = Math.max(0, out(x, y) - flat);
    const share = fromDent / (fromDent + edge.distance || 1);
    return level + (edge.level - level) * share;
  };
  const toHull = (x: number, y: number) =>
    within([x, y], hull) ? 0 : nearestOn([...hull, hull[0] as Point], x, y).distance;
  const reach = PAVILION.deep / PAVILION.bank + PAVILION.toe;
  // how high the bank stands a way out from its foot: rounded there, reaching
  // its full slope a toe out - started at it straight away, it met the ground
  // at its foot in a crease
  const banked = (by: number) => {
    const { bank, toe } = PAVILION;
    return by <= 0 ? 0 : by < toe ? (bank * by * by) / (2 * toe) : bank * (by - toe / 2);
  };
  const xs = hull.map(([x]) => x);
  const ys = hull.map(([, y]) => y);
  return {
    box: [
      Math.min(...xs) - reach,
      Math.min(...ys) - reach,
      Math.max(...xs) + reach,
      Math.max(...ys) + reach,
    ] as const,
    reaches: (x: number, y: number) => toHull(x, y) <= reach,
    heightAt: (x: number, y: number) =>
      out(x, y) <= flat
        ? level
        : Math.min(level + banked(out(x, y) - flat), plane(x, y) + banked(toHull(x, y))),
    // how far a point is up the bank, over the flat or the plane it rises from
    bankAt: (x: number, y: number) =>
      out(x, y) <= flat ? 0 : Math.min(banked(out(x, y) - flat), banked(toHull(x, y))),
  };
});

export function createPavilion(palette: Palette): Group {
  const group = new Group();
  group.name = 'pavilion';
  const at = PAVILION_AT();
  if (at === undefined) {
    return group;
  }
  const { middle, way, level } = at;
  const { side, post, eaves, beam, brace, overhang, pitch, opening, cap, lift } = PAVILION;
  const { rafters, rafter, swirl, past, short } = PAVILION;
  // the corners of an octagon round the middle, one side square to the stairs
  const facing = Math.atan2(way[1], way[0]);
  const radius = side / 2 / Math.sin(Math.PI / 8);
  const ring = (out: number, height: number) =>
    Array.from({ length: 8 }, (_, k) => {
      const angle = facing + Math.PI / 8 + (k * Math.PI) / 4;
      return new Vector3(
        middle[0] + Math.cos(angle) * out,
        height,
        -(middle[1] + Math.sin(angle) * out)
      );
    });
  // the beam's top where the roof, laid on its outer edge and running on past
  // it, comes down to the height asked for at its lower edge
  const slope = Math.tan((pitch * Math.PI) / 180);
  // it stands on its socket: an octagon a little wider than it, raised off
  // the deck, its sides down into the ground - and that is its floor
  const floor = level + PAVILION.socket;
  const top = floor + eaves + overhang * slope - (beam / 2) * slope - PAVILION_BED;
  const ground = LANDFILL_GROUND();
  const socket: number[] = [];
  const plinth =
    (radius * Math.cos(Math.PI / 8) + post / 2 + PAVILION.plinth) / Math.cos(Math.PI / 8);
  const rim = ring(plinth, floor);
  const middleTop = new Vector3(middle[0], floor, -middle[1]);
  rim.forEach((corner, k) => {
    const next = rim[(k + 1) % 8] as Vector3;
    // the top, a fan from the middle - three.js mirrors north onto -z, so
    // this way round it faces up
    [middleTop, next, corner].forEach(v => socket.push(v.x, v.y, v.z));
    // and the side, down a hair into the ground under each corner
    const [low, lowNext] = [corner, next].map(
      v => new Vector3(v.x, (ground(v.x, -v.z) ?? level) - 0.05, v.z)
    ) as [Vector3, Vector3];
    [corner, next, lowNext, corner, lowNext, low].forEach(v => socket.push(v.x, v.y, v.z));
  });
  const timber: number[] = [];
  const posts = ring(radius, top);
  // a rail between each two posts, but on the sides it is entered from: the
  // one facing the stairs - between posts 3 and 4 - and the one either side
  // of it
  const facingStairs = PAVILION_OPEN[0] as number;
  posts.forEach((head, k) => {
    if (PAVILION.entries.some(by => (facingStairs + by + 8) % 8 === k)) {
      return;
    }
    const next = posts[(k + 1) % 8] as Vector3;
    // and a second close over the floor on the side across from the entry
    // and the one either side of that
    const across = PAVILION.entries.some(by => (facingStairs + 4 + by + 8) % 8 === k);
    [PAVILION.rail, ...(across ? [PAVILION.low] : [])].forEach(over =>
      strut(timber, head.clone().setY(floor + over), next.clone().setY(floor + over), post * 0.7)
    );
    // and there, a panel closing the side in between the two rails, in the
    // posts' line, from post to post
    if (across) {
      const way = next
        .clone()
        .sub(head)
        .setY(0)
        .normalize()
        .multiplyScalar(post / 2);
      const [from, to] = [head.clone().add(way), next.clone().sub(way)];
      const [low, high] = [floor + PAVILION.low, floor + PAVILION.rail];
      [
        from.clone().setY(low),
        to.clone().setY(low),
        to.clone().setY(high),
        from.clone().setY(low),
        to.clone().setY(high),
        from.clone().setY(high),
      ].forEach(v => timber.push(v.x, v.y, v.z));
    }
  });
  posts.forEach((head, k) => {
    // each post from the socket, a hair into it, to the eaves
    const foot = new Vector3(head.x, floor - 0.02, head.z);
    // square in its corner: a face towards the middle
    const inward = new Vector3(middle[0], head.y, -middle[1]).sub(head).setY(0).normalize();
    strut(timber, foot, head.clone().setY(top - beam), post, inward.cross(new Vector3(0, 1, 0)));
    // the beam to the next post, and a knee brace to it and to the one before
    const next = posts[(k + 1) % 8] as Vector3;
    const low = top - beam / 2;
    strut(timber, head.clone().setY(low), next.clone().setY(low), beam);
    // but for the side facing the stairs, which is open: posts 3 and 4, whose
    // side has the stairs square before it
    (
      [
        [next, (k + 1) % 8],
        [posts[(k + 7) % 8] as Vector3, (k + 7) % 8],
      ] as [Vector3, number][]
    ).forEach(([other, index]) => {
      if ([k, index].sort().join() === PAVILION_OPEN.join()) {
        return;
      }
      const toward = other.clone().sub(head).setY(0).normalize();
      strut(
        timber,
        head.clone().setY(top - beam - brace),
        head
          .clone()
          .addScaledVector(toward, brace)
          .setY(top - beam),
        post * 0.7
      );
    });
  });
  // the roof: from past the posts up to its opening, and the small one over it
  // resting on the eaves beam over the posts, and running down past them
  const eave = radius + overhang;
  // on the beam's outer edge: the roof falls away outwards, and laid on its
  // middle, the beam came through it
  const bed = top + (beam / 2) * slope + PAVILION_BED;
  const peak = bed + (radius - opening) * slope;
  const roofing: number[] = [];
  octagonal(roofing, ring(eave, bed - overhang * slope), ring(opening, peak));
  // the rafters under it, a mandala: each straight from the eaves up past the
  // opening, tangent to a small circle round the middle rather than through
  // it, all turned the same way, so they lie on one another round it - and
  // their ends stick up out of the opening, under the small roof
  const across = Math.cos(Math.PI / 8);
  const [mx, my] = middle;
  // the roof's height over a point of the plan: on each face it rises with
  // how far in from the eaves the point is, square to that face
  const roofAt = (x: number, y: number) => {
    const out = Math.max(
      ...Array.from({ length: 8 }, (_, k) => {
        const angle = facing + (k * Math.PI) / 4;
        return (x - mx) * Math.cos(angle) + (y - my) * Math.sin(angle);
      })
    );
    return bed + (radius - out / across) * slope;
  };
  // their tops a hair under it: running at a slant to the faces, a rafter's
  // corner stands higher than its middle
  const under = rafter * Math.SQRT1_2 + 0.02;
  const ends = Array.from({ length: rafters }, (_, k) => {
    const angle = facing + Math.PI / 8 + (k * 2 * Math.PI) / rafters;
    // out short of the eaves' edge, square to the face it runs under, so it
    // ends under the roof rather than past it
    const face = Math.round((angle - facing) / (Math.PI / 4)) * (Math.PI / 4) + facing;
    const reach = ((eave - short) * across) / Math.cos(angle - face);
    const from: Point = [mx + Math.cos(angle) * reach, my + Math.sin(angle) * reach];
    // in to where it touches the circle, and on past it
    const turn = angle + Math.acos(swirl / reach);
    const touch: Point = [mx + Math.cos(turn) * swirl, my + Math.sin(turn) * swirl];
    const length = Math.hypot(touch[0] - from[0], touch[1] - from[1]);
    const way: Point = [(touch[0] - from[0]) / length, (touch[1] - from[1]) / length];
    const [low, high] = [roofAt(...from) - under, roofAt(...touch) - under];
    const rise = (high - low) / length;
    const end: Point = [touch[0] + way[0] * past, touch[1] + way[1] * past];
    const start = new Vector3(from[0], low, -from[1]);
    const finish = new Vector3(end[0], high + rise * past, -end[1]);
    strut(timber, start, finish, rafter);
    return finish.y + rafter / 2;
  });
  // and the small roof on their ends
  const capBase = Math.max(...ends) + lift;
  octagonal(roofing, ring(cap, capBase), ring(0.001, capBase + cap * slope));
  const mesh = (positions: number[], color: Palette[keyof Palette]) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return new Mesh(
      geometry,
      new MeshLambertMaterial({ color, flatShading: true, side: DoubleSide })
    );
  };
  group.add(
    mesh(timber, palette.boarding),
    mesh(roofing, palette.roof),
    mesh(socket, palette.wallAccent)
  );
  return group;
}
