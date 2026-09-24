import type { Point } from '../../data/data.js';
import { nearestOn } from '../../utils/geometry.utils.js';
import { SITTINGS } from '../buildings/sitting.js';
import { pickByKey } from '../seam/seam.js';
import { WAY_KERBS } from '../terrain/ground.js';

/**
 * The places the events use, each named once here so an event can say where
 * it is held - by its kind, in `EVENT_TYPES` - and a view can show it: an area, a
 * ring round its ground, or a spot, one point where something stands - a
 * campfire, the bar. They are drawn by the person on the bench, as the seam
 * is: reference points set where the corners go, and their keys written in
 * here in order round the area. Where two corners in a row lie on the same
 * edge of the road the ring runs along it between them, round its bends. A
 * corner the bench has no handle for - inside a house - is a point of its
 * own, worked out from what it is. An empty outline is one still to draw;
 * nothing is shown for it.
 */
export interface Place {
  /** What the site calls it. */
  title: string;
  /** Where it is, for whoever draws it. */
  where: string;
  kind: 'area' | 'spot';
  /** Its corners round it, counter clockwise on the plan - or the one, for a spot: handles by name, or points. */
  outline: (string | Point)[];
  /** The height it lies at, where that is a floor and not the ground: a room's. */
  level?: number | undefined;
}

/** The workshop as it sits, and its rooms behind the lean-to's door. */
const WORKSHOP_SITTING = SITTINGS().find(({ name }) => name === 'werkstatt');
const ROOMS = WORKSHOP_SITTING?.rooms;

/** The workshop's corners by what they are, round it as the bench numbers them from 213. */
const WORKSHOP = {
  outerGable: 'house:werkstatt:0',
  outerInner: 'house:werkstatt:1',
  leanToFront: 'house:werkstatt:2',
  frontWest: 'house:werkstatt:3',
  rearWest: 'house:werkstatt:4',
  rearGable: 'house:werkstatt:5',
} as const;

/** The edges of the ways. */
const KERBS = WAY_KERBS.map(({ points }) => points);

/** How near a corner must lie to an edge of the road to count as on it, in meters. */
const ON_KERB = 0.05;

/** The edge of the road a point lies on, if it lies on one. */
function kerbUnder(at: Point | undefined): Point[] | undefined {
  if (at === undefined) {
    return undefined;
  }
  return KERBS.find(kerb => nearestOn(kerb, at[0], at[1]).distance < ON_KERB);
}

/** The point on the edge of the road a handle stands on that is nearest a place on the plan. */
function onKerbOf(handle: string, near: Point): Point {
  const kerb = kerbUnder(pickByKey(handle)?.at);
  return kerb === undefined ? near : nearestOn(kerb, near[0], near[1]).at;
}

/**
 * Where the road's edges are cut across north of the A-hut, for the stretch
 * closed up to it: level with the young trees on the meadow behind it.
 */
const PAST_HUT: Point = [1, 95];

/** A spot's own corner, a handle; and a room's floor, when the workshop is known. */
const room = (corners: (string | Point)[]) => (ROOMS === undefined ? [] : corners);

export const PLACES = {
  'werkstatt-vereinsraum': {
    title: 'Werkstatt, Vereinsraum',
    where:
      "inside the workshop behind the lean-to's door and small window, up its three steps, " +
      'back to the rear wall: the stage, the kitchen and the toilet',
    kind: 'area',
    outline: room([
      WORKSHOP.rearGable,
      WORKSHOP.outerGable,
      WORKSHOP.outerInner,
      WORKSHOP.leanToFront,
      ...(ROOMS === undefined ? [] : [ROOMS.rear]),
    ]),
    level: ROOMS?.floor,
  },
  'werkstatt-buehne': {
    title: 'Werkstatt, Bühne',
    where:
      'the part of the Vereinsraum in the house itself, from the rear gable corner to the lean-to',
    kind: 'area',
    outline: room(
      ROOMS === undefined ? [] : [WORKSHOP.rearGable, ROOMS.gable, WORKSHOP.leanToFront, ROOMS.rear]
    ),
    level: ROOMS?.floor,
  },
  'werkstatt-kueche': {
    title: 'Werkstatt, Küche',
    where: "in the lean-to, from its gable end to 10cm past the door's far side",
    kind: 'area',
    outline: room(
      ROOMS === undefined ? [] : [ROOMS.gable, WORKSHOP.outerGable, ROOMS.splitOut, ROOMS.splitIn]
    ),
    level: ROOMS?.floor,
  },
  'werkstatt-toilette': {
    title: 'Werkstatt, Toilette',
    where: 'in the lean-to, the rest of it past the kitchen',
    kind: 'area',
    outline: room(
      ROOMS === undefined
        ? []
        : [ROOMS.splitIn, ROOMS.splitOut, WORKSHOP.outerInner, WORKSHOP.leanToFront]
    ),
    level: ROOMS?.floor,
  },
  'werkstatt-saal': {
    title: 'Werkstatt, Saal',
    where: 'inside the workshop behind the gate and the four big windows',
    kind: 'area',
    outline: room(
      ROOMS === undefined
        ? []
        : [WORKSHOP.frontWest, WORKSHOP.rearWest, ROOMS.rear, WORKSHOP.leanToFront]
    ),
    level: WORKSHOP_SITTING?.level,
  },
  'werkstatt-vorplatz': {
    title: 'Vor der Werkstatt',
    where: "in front of the workshop: between its gate, the lean-to's door and the road",
    kind: 'area',
    outline: [
      WORKSHOP.frontWest,
      WORKSHOP.leanToFront,
      WORKSHOP.outerInner,
      WORKSHOP.outerGable,
      'point:32',
      'road:36.61,9.13',
    ],
  },
  'feuer-werkstatt': {
    title: 'Lagerfeuer vor der Werkstatt',
    where: 'where the campfire is laid, diagonally in front of the door',
    kind: 'spot',
    outline: ['point:38'],
  },
  'bar-werkstatt': {
    title: 'Bar vor der Werkstatt',
    where: 'where the bar stands in front of the workshop - at the Frühlingsfatsche',
    kind: 'spot',
    outline: ['point:40'],
  },
  'grill-werkstatt': {
    title: 'Grill vor der Werkstatt',
    where: 'where the grill stands in front of the workshop - at the Frühlingsfatsche',
    kind: 'spot',
    outline: ['point:39'],
  },
  'feuer-selbis': {
    title: 'Lagerfeuer vor dem kleinen Haus',
    where: 'where the campfire is laid in front of the small house',
    kind: 'spot',
    outline: ['point:45'],
  },
  'feuer-terrasse': {
    title: 'Lagerfeuer auf der Terrasse',
    where: "where the campfire is laid on the pavilion's terrace",
    kind: 'spot',
    outline: ['point:43'],
  },
  'feuer-hexenhaus': {
    title: 'Lagerfeuer vor dem Hexenhaus',
    where: 'where the campfire is laid in front of the A-hut',
    kind: 'spot',
    outline: ['point:44'],
  },
  'muehle-vorplatz': {
    title: 'Vor der Mühle',
    where: 'in front of the mill, from its terrace across the deck to the road',
    kind: 'area',
    outline: [
      'road:19.82,19.76',
      'deck:8:top',
      'deck:0:top',
      'deck:1:top',
      'house:mill:2',
      'house:mill:1',
      'point:31',
      'mill:1:top',
      'road:36.61,9.13',
      'road:26.41,15.43',
      'deck:15:top',
    ],
  },
  'muehle-seite': {
    title: 'Am Ostgiebel',
    where:
      "the ground before the mill's east gable, from its terrace to the workshop's corner and the road",
    kind: 'area',
    outline: [
      'house:mill:1',
      'house:mill:0',
      'house:mill:5',
      WORKSHOP.frontWest,
      'road:36.61,9.13',
      'mill:1:top',
      'point:31',
    ],
  },
  'terrasse-pavillon': {
    title: 'Terrasse am Pavillon',
    where: 'the terrace the pavilion stands on, behind the stairs from their top round to the bend',
    kind: 'area',
    outline: [
      'stairs:top-south:top',
      'point:26',
      'point:27',
      'point:28',
      'point:29',
      'point:25',
      'point:24',
      'point:23',
      'point:0',
      'point:1',
      'point:2',
      'point:3',
      'point:4',
      'point:5',
      'stairs:stub-end-back:top',
      'stairs:bend-end-back:top',
      'stairs:bend-1-back:top',
      'stairs:upper-end-back:top',
      'stairs:u-back-end:top',
      'stairs:u-back-end-inside:top',
      'stairs:u-inside:top',
      'stairs:u-corner-back:top',
      'stairs:u-top-back:top',
      'stairs:top-north:top',
    ],
  },
  'terrasse-muehle': {
    title: 'Terrasse an der Mühle',
    where: "the mill's terrace along its street front",
    kind: 'area',
    outline: ['house:mill:0', 'house:mill:3', 'house:mill:2', 'house:mill:1'],
    // on the slab's top, not on the ground round it
    level: SITTINGS().find(({ name }) => name === 'mill')?.terrace?.top,
  },
  'wiese-hexenhaus': {
    title: 'Wiese am Hexenhaus',
    where: 'the meadow in front of the A-hut, from the road round the pillar stairs up the slope',
    kind: 'area',
    outline: [
      'point:36',
      'point:35',
      'point:34',
      'stairs:pillar-foot-left:lying',
      'stairs:pillar-10-left:lying',
      'stairs:pillar-9-left:lying',
      'stairs:pillar-8-left:lying',
      'stairs:pillar-7-left:lying',
      'stairs:pillar-6-left:lying',
      'stairs:pillar-5-left:lying',
      'stairs:pillar-4-left:lying',
      'stairs:pillar-3-left:lying',
      'stairs:pillar-2-left:lying',
      'stairs:stub-end:top',
      'stairs:stub-end-back:top',
      'stairs:bend-end-back:top',
      'stairs:bend-end:top',
      'stairs:pillar-2-right:lying',
      'stairs:pillar-3-right:lying',
      'stairs:pillar-4-right:lying',
      'stairs:pillar-5-right:lying',
      'stairs:pillar-6-right:lying',
      'stairs:pillar-7-right:lying',
      'stairs:pillar-8-right:lying',
      'stairs:pillar-9-right:lying',
      'stairs:pillar-10-right:lying',
      'stairs:pillar-foot-right:lying',
      'point:37',
    ],
  },
  'strasse-werkstatt': {
    title: 'Straße vor der Werkstatt',
    where: 'the road on from the mill past the front of the workshop, to the second crossing',
    kind: 'area',
    outline: [
      'road:63.87,-2.64',
      'road:60.68,-6.49',
      'road:36.61,9.13',
      'road:42.46,11.47',
      'road:58.71,1.19',
      'road:60.35,0.04',
      'road:63.09,-2.01',
    ],
  },
  'strasse-muehle': {
    title: 'Straße vor der Mühle',
    where: 'the road in front of the mill, from the deck on to the foot of the stairs',
    kind: 'area',
    outline: [
      'road:42.46,11.47',
      'road:35.58,15.61',
      'road:29.61,19.32',
      'road:6.91,38.36',
      'road:2.62,35.78',
      'road:19.82,19.76',
      'road:26.41,15.43',
      'road:36.61,9.13',
    ],
  },
  'strasse-hexenhaus': {
    title: 'Straße bis zum Hexenhaus',
    where: 'the road on from the foot of the stairs past the A-hut, to the young trees behind it',
    kind: 'area',
    outline: [
      'road:6.91,38.36',
      onKerbOf('road:6.91,38.36', PAST_HUT),
      onKerbOf('road:2.62,35.78', PAST_HUT),
      'road:2.62,35.78',
    ],
  },
} as const satisfies Record<string, Place>;

export type PlaceKey = keyof typeof PLACES;

export const PLACE_KEYS = Object.keys(PLACES) as PlaceKey[];

/** A corner of a place on the plan: a handle's, or a point as it is. */
const cornerAt = (corner: string | Point): Point | undefined =>
  typeof corner === 'string' ? pickByKey(corner)?.at : corner;

/**
 * An outline on the plan off its corners, running along an edge of the road
 * between two that lie on it - none while there are none, or a handle is
 * unknown. A place's own, or one still being drawn on the bench.
 */
export function outlineOf(outline: readonly (string | Point)[]): Point[] | undefined {
  const corners = outline.map(cornerAt);
  if (corners.length === 0 || corners.some(corner => corner === undefined)) {
    return undefined;
  }
  const points = corners as Point[];
  if (points.length < 3) {
    return points;
  }
  return points.flatMap((from, step) => {
    const to = points[(step + 1) % points.length] as Point;
    const kerb = kerbUnder(from);
    if (kerb === undefined || kerbUnder(to) !== kerb) {
      return [from];
    }
    const [one, other] = [nearestOn(kerb, from[0], from[1]), nearestOn(kerb, to[0], to[1])];
    const between = kerb.filter(
      (_, index) =>
        index > Math.min(one.along, other.along) && index < Math.max(one.along, other.along)
    );
    return [from, ...(one.along <= other.along ? between : between.reverse())];
  });
}

/** A place's outline on the plan (`outlineOf()` its corners). */
export function placeOutline(key: PlaceKey): Point[] | undefined {
  return outlineOf((PLACES[key] as Place).outline);
}

/** The places still to be drawn on the bench. */
export const undrawnPlaces = (): PlaceKey[] =>
  PLACE_KEYS.filter(key => (PLACES[key] as Place).outline.length === 0);
