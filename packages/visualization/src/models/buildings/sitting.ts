import type { Point } from '../../data/data.js';
import { BUILDINGS } from '../../data/data.js';
import { once } from '../../utils/geometry.utils.js';
import { ASIDE_HOUSE } from './aside.building.js';
import { RECTS } from './footprint.js';
import { MILL_HOUSE } from './mill.building.js';
import type { House } from './profile.js';
import { leanToEnds } from './profile.js';
import { WORKSHOP_HOUSE } from './workshop.building.js';

/**
 * How each house sits on the ground: its walls round on the plan - the box it
 * is drawn as, the workshop's lean-to with it, which makes its plan an L, and
 * the mill's terrace, whose edge is its front -
 * and the height it stands at, the lowest the ground comes to along its walls:
 * there it meets the ground, and everywhere else it is sunk in, as a house on
 * a slope is. Nowhere does it stand clear of the ground, and the ground is not
 * moved to suit it - but along the terrace's edge, held straight at it.
 */
export interface Sitting {
  /** What it is called on the bench. */
  name: string;
  /** Its corners round its walls, counter clockwise on the plan. */
  corners: Point[];
  /** The height it stands at. */
  level: number;
  /** The ground's height at each corner, as it lay before the house was cut out of it. */
  grounds: number[];
  /**
   * Its front's edge, where that is not its wall - the mill's terrace's - as
   * a line the ground is held to at its height, straight along it.
   */
  edge?: [Point, Point];
  /**
   * The workshop's rooms behind the lean-to's door: where the wall between
   * them and the hall meets the rear wall, where the front wall's corner
   * stands inside the lean-to, where its door's side of the wall the kitchen
   * and the toilet are parted at meets the outer wall and the front wall, and
   * the height of the floor, up the porch's steps.
   */
  rooms?: { rear: Point; gable: Point; splitOut: Point; splitIn: Point; floor: number };
  /** The mill's terrace's top, its four corners round it and the height it stands at. */
  terrace?: { corners: Point[]; top: number };
}

/**
 * Each house by its name on the bench, and the height it stands at: the
 * lowest the drawn ground came to along its walls, just outside them, as
 * measured before the terrace's edge was held to it. Read again off the
 * ground it holds, the ground just past the held edge falls away towards the
 * road, and the house sank a little further with every bake. And the height
 * of the ground at each corner, round the walls as `corners` runs: what the
 * seam round the house holds it to. Measured before the seam was traced - read
 * off the ground the seam holds, it came out a little different every bake.
 */
const HOUSES: (House & { name: string; level: number; grounds: number[] })[] = [
  { ...MILL_HOUSE, name: 'mill', level: -0.47, grounds: [-0.098, -0.47, -0.47, -0.075, 0, 0] },
  { ...ASIDE_HOUSE, name: 'selbis', level: -0.23, grounds: [0, 0.007, -0.215, 0.217] },
  {
    ...WORKSHOP_HOUSE,
    name: 'werkstatt',
    level: -0.01,
    grounds: [0.005, -0.001, 0, -0.01, 0, 0.092],
  },
];

/** How far past the lean-to's door the kitchen and the toilet behind it are parted. */
const ROOM_SPLIT = 0.1;

/** From a house's own frame - x along it, z out of its front - onto the plan, as its group is turned. */
const onPlan =
  ([cx, cy]: Point, angle: number) =>
  ([x, z]: Point): Point => [
    cx + x * Math.cos(angle) + z * Math.sin(angle),
    cy + x * Math.sin(angle) - z * Math.cos(angle),
  ];

/** Each house as it sits, in the order of the buildings. */
export const SITTINGS = once((): Sitting[] =>
  BUILDINGS.map(({ id }, index) => {
    const rect = RECTS[index];
    const house = HOUSES.find(one => one.id === id);
    if (rect === undefined) {
      return { name: String(id), corners: [], level: 0, grounds: [] };
    }
    const { center, length, width, angle } = rect;
    const [l, w] = [length / 2, width / 2];
    const { leanTo, terrace } = house?.profile ?? {};
    // the mill's terrace runs the length of its street front and stands on
    // the ground as the house does: its edge is the house's front
    // round the box, and out round the lean-to where it stands on the front:
    // it starts where the gable does, so the corner there is the box's own
    const own: Point[] =
      terrace !== undefined
        ? [
            [-l, -w],
            [l, -w],
            [l, w],
            [l, w + terrace.depth],
            [-l, w + terrace.depth],
            [-l, w],
          ]
        : leanTo === undefined
          ? [
              [-l, -w],
              [l, -w],
              [l, w],
              [-l, w],
            ]
          : (() => {
              const middle = l - leanTo.at;
              const [from, to] = [middle - leanTo.width / 2, middle + leanTo.width / 2];
              const out = w + leanTo.depth;
              return [
                [-l, -w],
                [l, -w],
                [l, w],
                [to, w],
                [to, out],
                [Math.max(from, -l), out],
                ...(from > -l + 0.05 ? [[from, w] as Point, [-l, w] as Point] : []),
              ];
            })();
    const placed = own.map(onPlan(center, angle));
    // counter clockwise on the plan: the house's frame is mirrored onto it
    const area = placed.reduce((sum, [x, y], step) => {
      const [nx, ny] = placed[(step + 1) % placed.length] as Point;
      return sum + (x * ny - nx * y);
    }, 0);
    const corners = area < 0 ? placed.reverse() : placed;
    return {
      name: house?.name ?? String(id),
      corners,
      level: house?.level ?? 0,
      grounds: house?.grounds ?? corners.map(() => house?.level ?? 0),
      ...(leanTo === undefined
        ? {}
        : (() => {
            // the gable the lean-to is flush with, and its other, inner end
            const { flush, inner, middle } = leanToEnds(length, leanTo);
            const out = w + leanTo.depth;
            // parted 10cm past the door's side towards the inner end
            const door = leanTo.door?.[0] ?? 1;
            const split = middle + Math.sign(inner - middle) * (door / 2 + ROOM_SPLIT);
            const at = onPlan(center, angle);
            return {
              rooms: {
                rear: at([inner, -w]),
                gable: at([flush, w]),
                splitOut: at([split, out]),
                splitIn: at([split, w]),
                floor: (house?.level ?? 0) + (leanTo.porch?.rise ?? 0),
              },
            };
          })()),
      ...(terrace === undefined
        ? {}
        : {
            // the slab's top, where the steps come up to: the house's plinth
            // over the height it stands at, less the hair it is set down by
            terrace: {
              corners: [
                [-l, w],
                [l, w],
                [l, w + terrace.depth],
                [-l, w + terrace.depth],
              ].map(point => onPlan(center, angle)(point as Point)),
              top: (house?.level ?? 0) + (house?.profile.plinth ?? 0) - 0.02,
            },
            edge: [
              onPlan(center, angle)([l, w + terrace.depth]),
              onPlan(center, angle)([-l, w + terrace.depth]),
            ] as [Point, Point],
          }),
    };
  })
);

/** The height a building stands at, by its OpenStreetMap id. */
export const levelOf = (id: number): number | undefined =>
  SITTINGS()[BUILDINGS.findIndex(building => building.id === id)]?.level;
