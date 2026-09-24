import type { Point } from '../../data/data.js';
import { alongLine, crossings, nearestOn } from '../../utils/geometry.utils.js';

/**
 * The measures the structures are set out by, as counted and measured on site - and the seams traced on the bench.
 */
/**
 * How far a wall is carried below what it stands on, in meters. The terrain is
 * a coarser mesh than the heights it is sampled from, so a foot laid exactly on
 * the ground stands off it wherever the mesh runs high - but it is let up by
 * the lift the road has given back, or the seam pinned to it drags the ground
 * down with it.
 */
export const WALL_FOOT = 0.09;

/**
 * The walls the brook runs between under the road. Seen from above, the two
 * edges of the road and the two of the brook cross in four points; those four
 * at the road's level are the upper corners and at the brook's level the lower
 * ones. Between its two points each wall follows the bank itself - the brook
 * turns under the road, and a straight face between the corners would stand in
 * the water.
 */
/** How finely a plate is cut up, in meters, so that it can follow what it lies under. */
export const SLAB_CELL = 1.5;

/** How far from the road the ground is held down beside it, in meters. */
export const TERRACE_REACH = 10;

/** How far the terrace lies above the water it runs beside, in meters. */
export const TERRACE_OVER = 0.15;

/**
 * A shape read off the map by hand, drawn flat on the road to be checked
 * against what is modelled. Debug only - it is meant to be looked at once and
 * taken out again.
 */
/** How thick the deck is, in meters. */
export const DECK_THICKNESS = 0.5;

/** How short a step a wall is drawn in, in meters, so that it follows the road. */
export const WALL_STEP = 1;

/**
 * How far everything the road is laid on sits under it, in meters: the plates
 * at the crossings and the walls that carry them alike. Drawn at the road's own
 * level they cross it dead flat, and a wall top that reads its height every few
 * meters stands through a carriageway that bends between them.
 */
export const UNDER_ROAD = 0.02;

export const DECK_OUTLINE: Point[] = [
  [19.17, 15.3],
  [14.9, 15.06],
  [20.9, 8.81],
  // both were picked under trees and came out off the road by much the same
  // amount; each is slid in square to the kerb it belongs to, to stand the same
  // 30cm off the carriageway. The first was set out again on the band's own
  // edge, from which it stood 0.296m off: carried square to the road from its
  // nearest point on the kerb, 0.3m
  [42.6119, 11.7232],
  // and this one the same way, from 0.2986m off - then moved on along the road
  // to stand 1m from the wing past the near bank (31), as its kerb (21) now is
  // from the bank's own pass under the kerb (27): it stood 1.96m off
  [28.9311, 20.106],
];

/**
 * The corners of the plate the walls are hung on, by what they are rather than
 * by where they fall in the outline: a corner put in between two others must
 * not send a wall off to a different one.
 */
export const DECK_ACUTE = DECK_OUTLINE[DECK_OUTLINE.length - 1] as Point;
export const DECK_WIDE = DECK_OUTLINE[DECK_OUTLINE.length - 2] as Point;

/** How far from the mill a crossing is still built out with walls, in meters. */
export const CULVERT_REACH = 150;

/** How far on up the road from the water the second crossing's wall turns off, in meters. */
export const CROSSING_ON = 1;

/** How far from the second crossing a bank's pass under a kerb is taken for part of it. */
export const CROSSING_REACH = 12;

/** How far a wall under a crossing runs on past the road at either end, in meters. */
export const BANK_WALL_OVER = 0.3;

/**
 * The two banks of the brook where a road runs over them, both cut to the same
 * stretch of it. Each bank meets the road's edges at its own two places, and
 * where the road crosses at a skew - which it does at both crossings here -
 * those places are meters apart along the water: cut each to its own, and one
 * wall starts where the other has already ended. The pair is what a culvert is,
 * so they take the whole of what either of them covers.
 *
 * Both banks are offsets of the same line, so a count along one is a count
 * along the other.
 */
export function bankRuns(banks: Point[][], edges: Point[][], at: Point): Point[][] {
  const spans = banks.map(bank =>
    edges
      .flatMap(edge => crossings(bank, edge))
      .sort(
        (one, other) =>
          Math.hypot(one.at[0] - at[0], one.at[1] - at[1]) -
          Math.hypot(other.at[0] - at[0], other.at[1] - at[1])
      )
      .slice(0, 2)
      .sort((one, other) => one.along - other.along)
  );
  const alongs = spans.flatMap(span => (span.length < 2 ? [] : span.map(({ along }) => along)));
  if (alongs.length < 2) {
    return banks.map(() => []);
  }

  const [from, to] = [Math.min(...alongs), Math.max(...alongs)];
  return banks.map(bank => [
    alongLine(bank, from),
    ...bank.filter((_, step) => step > from && step < to),
    alongLine(bank, to),
  ]);
}

/** How far the far bank's outer end is carried along the road, in meters. */
export const FAR_BANK_ALONG = 2;

/**
 * The lines every wall of the two crossings is drawn along, worked out once.
 * The terrain wants them as much as the walls do: the ground has to meet a wall
 * at its foot, which it can only do if it holds that line as an edge of its own.
 */
/** The part of a line between two points on it, their own ends left to the caller. */
export function follow(line: Point[], from: Point, to: Point): Point[] {
  if (line.length < 2) {
    return [];
  }
  const [one, other] = [
    nearestOn(line, from[0], from[1]).along,
    nearestOn(line, to[0], to[1]).along,
  ];
  const [start, end] = one <= other ? [one, other] : [other, one];
  const middle = line.filter((_, step) => step > start && step < end);
  return one <= other ? middle : [...middle].reverse();
}

/**
 * How far the seam is let down towards the feet of the walls where it meets
 * one: nought leaves it at the road's own level, one takes it all the way down.
 */
export const SEAM_TO_WALL = 1;

/** How far apart two pieces may lie and still be taken for the same line. */
export const SEAM_DOUBLE = 0.15;

/** And how far off each other's direction they may run, in radians. */
export const SEAM_ALONG = Math.PI / 12;

/** How many times over the lines are cut at their crossings before giving up. */
export const SEAM_PASSES = 6;

/**
 * How far apart two points of the seam are taken to be the same one. Wide
 * enough to swallow the couple of centimeters between a kerb and the corner
 * that was set out on it: left apart, the two lines cross just short of their
 * ends, and a crossing that is not a point of the network is what a
 * triangulation cannot hold.
 */
export const SEAM_SNAP = 0.05;

/**
 * The seam: every line the ground has to be held to, cut into a network that a
 * triangulation can hold. Lines that cross are the whole difficulty - a mesh
 * can only keep an edge whose ends are its own vertices - so each crossing is
 * made a point of both lines and the lines are split there. What comes out is
 * the contract between the ground and everything laid on it: points, the edges
 * between them, and the height each one is to be held at.
 */
/**
 * A run through its points, each stretch between two along the line it is
 * named with - straight across where it is named with none. Walls and plates
 * are set out this way from their points, and nothing is run if one is missing.
 * A ring closes back to its first point along the last line named: left open,
 * the southern plate's closing leg ran as a chord rather than along the road.
 */
export function alongLines(stretches: [Point | undefined, Point[]][], closed = false): Point[] {
  if (stretches.some(([at]) => at === undefined)) {
    return [];
  }
  return stretches.flatMap(([at, line], step) => {
    const next = stretches[step + 1]?.[0] ?? (closed ? stretches[0]?.[0] : undefined);
    return [
      at as Point,
      ...(next === undefined || line.length < 2 ? [] : follow(line, at as Point, next)),
    ];
  });
}

/**
 * The point a distance on along a kerb from where another stands by it,
 * measured along the kerb, north or south - which way along it is north is
 * read off the kerb, not assumed.
 */
export function alongKerb(kerb: Point[], from: Point, by: number, northwards: boolean): Point {
  const walked = kerb.reduce<number[]>((sums, point, step) => {
    const before = kerb[step - 1];
    const last = sums[sums.length - 1] ?? 0;
    return [
      ...sums,
      before === undefined ? 0 : last + Math.hypot(point[0] - before[0], point[1] - before[1]),
    ];
  }, []);
  const lengthAt = (along: number) => {
    const step = Math.min(Math.floor(along), kerb.length - 2);
    const [start, end] = [walked[step] as number, walked[step + 1] as number];
    return start + (end - start) * (along - step);
  };
  const pointAt = (length: number) => {
    const step = Math.max(0, Math.min(walked.findIndex(sum => sum > length) - 1, kerb.length - 2));
    const [start, end] = [walked[step] as number, walked[step + 1] as number];
    return alongLine(kerb, step + (length - start) / (end - start || 1));
  };
  const here = lengthAt(nearestOn(kerb, from[0], from[1]).along);
  const [one, other] = [pointAt(here + by), pointAt(here - by)];
  return one[1] > other[1] === northwards ? one : other;
}

/** How far off the road the mill's deck reaches beside its far corner, in meters. */
export const DECK_OFF = 0.5;

/**
 * The stairs up from the road beside the mill's deck, and the walls beside
 * them, as counted on site: the guard rail on the walls runs in sections of
 * 1.40m, and every length below is a count of them. The stairs climb square
 * off the road, their north edge at the road straight across from a point 1m
 * south of the mill's nose (1), with one step's tread made deep as a landing.
 */
export const STAIRS = {
  /** How far south of the mill's nose the line across from their north edge meets the far kerb. */
  south: 1,
  /**
   * How much a step climbs, in meters: a normal step's 17cm. The photos put
   * the coping of the wall beside them at 2.3m over twelve steps - 19.2cm each
   * - scaled off the festival banner on that wall; a normal step lands the top
   * of eleven 24cm lower, at 1.87m.
   */
  riser: 0.17,
  /** How many steps there are: twelve counted, the top one of them too many. */
  steps: 11,
  /** Which step's tread is the landing, counted from the road, and how deep it is. */
  landingAt: 6,
  landing: 0.55,
  /** How wide they are, in meters, as measured. */
  width: 1.6,
  /**
   * How far below the ground the blocks they are built of reach, in meters:
   * the ground as it is drawn, read at every corner, so no more than covers
   * where the terrain's own triangles run between them.
   */
  footing: 0.05,
} as const;

/** One section of the guard rail on the walls, in meters: what their lengths are counted in. */
export const RAIL = 1.4;

/**
 * The walls beside the stairs, by the sections counted on site. A U at terrace
 * level - back along the stairs' north side to their top step, along the road
 * north, and back into the slope at its end - an upper wall from the back of
 * that straight north, which the terrace stands on, going down with the road
 * from there, and a lower wall along the road on from the U, falling to 70cm
 * over the road and running on at that.
 * Only the bottom step reaches out in front of them: their face along the road
 * stands back from the kerb by one tread.
 */
export const RETAINING_WALL = {
  /** Beside the stairs, as counted from the road: it runs on a tread further, to their top step. */
  beside: 2 * RAIL,
  /** Along the road from the stairs. */
  along: 5 * RAIL,
  /** Back into the slope at its end. */
  back: 1.5 * RAIL,
  /** The upper wall, from there straight north. */
  upper: 9 * RAIL,
  /** And on from its far end into the slope, in two pieces each turned 45° further. */
  bend: [1 * RAIL, 1.5 * RAIL],
  /** The lower wall on along the road: falling over the first stretch, then level over the road. */
  falling: 2 * RAIL,
  lower: 6 * RAIL,
  /** How high the lower wall stands over the road, in meters. */
  low: 0.7,
  /** How thick they all are, in meters: filled against with ground, it does not show. */
  thickness: 0.25,
} as const;

/**
 * The steps on down from the end of the upper wall's bend, along the road: the
 * top one a stub of the wall at a riser under its top, the others laid on the
 * ground like fallen pillars, three side by side, each lying on the next one
 * down by a hand and turned a little further towards the road's own line.
 */
export const PILLAR_STAIRS = {
  steps: 11,
  riser: 0.15,
  /** How long each is, in meters, and by how much it lies on the one below. */
  length: 0.7,
  overlap: 0.1,
  /** How thick a pillar is, both ways, how many lie side by side and how far apart. */
  pillar: 0.15,
  pillars: 3,
  gap: 0.03,
} as const;

/** A wall of the plan: its face, the way it is thick from it, and its top along it. */
export interface WallRun {
  face: Point[];
  /** Where a point of the face has its back. */
  backOf: (point: Point) => Point;
  /** The height of its coping at a share of the way along it. */
  top: (share: number, point: Point) => number;
  /** How far under its coping it reaches, if not into the ground. */
  depth?: number;
}

/** A line the ground is held to, and the height it holds anywhere along it. */
export interface SeamLine {
  points: Point[];
  wall: boolean;
  level: (x: number, y: number) => number;
  /**
   * Traced on the bench, and which of the traced it is, counted from one: the
   * contract, whose height beats anything else's - and a later seam's beats an
   * earlier one's, since a seam traced after another is traced to refine it.
   * Kept ground counts first of all: it only fills in, and a corner a cut
   * traced round at its top stays at its top whatever the kept ground says.
   */
  traced?: number;
}

/** The height a line holds anywhere along it, straight between its own points. */
export function lineLevel(line: Point[], levels: number[]): (x: number, y: number) => number {
  return (x, y) => {
    const { along } = nearestOn(line, x, y);
    const step = Math.min(Math.floor(along), levels.length - 2);
    const [from, to] = [levels[step] as number, levels[step + 1] as number];
    return from + (to - from) * (along - step);
  };
}

/**
 * How close two handles may sit before one dot stands for both, in meters:
 * under a wall's thickness, or its face and back are taken for one.
 */
export const PICK_SPACING = 0.1;

/** And how near each other's height, in meters. */
export const PICK_SAME = 0.05;

/** Which edge a handle sits on: the top of a wall, its foot, or the carriageway. */
export type SeamEdge = 'top' | 'foot' | 'road' | 'water' | 'bed' | 'point';

/** A point a seam path can be pinned to, at the height it is to be pinned at. */
export interface SeamHandle {
  /**
   * Its name, which is what the source refers to it by - a dump's ring, a
   * railing's run - whatever it is numbered on the bench, and wherever it is
   * moved to: the list it comes from and its name there (`stairs:u-corner:top`),
   * its place in a list of survey marks (`deck:3:foot`) or of the points set
   * on the bench (`point:7`), or, for one worked out where two lines cross,
   * where that is, to the centimeter (`road:27.91,21.72`).
   */
  key: string;
  at: Point;
  level: number;
  edge: SeamEdge;
  /** A top with no foot under it: where a thing lies on the ground. */
  lying?: true;
}

/** How far a handle may lie off a line and still count as sitting on it. */
export const ON_ROUTE = 0.25;

/** How far a handle may lie from the seam network and still be routed through it. */
export const TO_NETWORK = 1.5;

/**
 * How much longer than the way straight across a way through the network may
 * be before it is not taken. Two handles either side of the brook's end are
 * 2.4m apart and joined through the network as well - by a way 668m long, down
 * the valley and back. At three times the way across, a leg of 1.15m went round
 * by 3.06m and one of 0.53m by 1.33m, back over the legs before it.
 */
export const ROUTE_DETOUR = 2;

/** How wide a step from a wall's foot to its top is drawn in the ground, in meters. */
export const SEAM_STEP = 0.1;

/** How far a handle may have moved and still be the one a seam names, in meters. */
export const SEAM_FOUND = 0.05;

/**
 * The seams traced on the bench, each a closed path of handles: the ground is
 * held to the path and taken away inside it. Written by the coordinates the
 * readout lists under the numbers, since the numbers shift whenever the model
 * does, and by the edge where a top and a foot share them - a handle that has moved further than `SEAM_FOUND` is not found, and
 * the seam is not cut rather than cut somewhere else.
 */
export const SEAMS: [x: number, y: number, edge?: SeamEdge][][] = [
  // the lane, down one kerb to the deck, across its mitred end and back up
  // the other kerb to the rim: 75, 76, 78, 77
  [
    [-252.6307, 120.7715],
    [17.6375, 12.2084],
    [20.0191, 9.7276],
    [-254.1142, 118.2238],
  ],
  // the brook, across at the rim, up one bank to the other rim, across and
  // back down the other bank: 95, 97, 98, 96
  [
    [123.2142, -284.8863],
    [125.4061, -283.9384],
    [-97.1267, 272.9071],
    [-99.353, 272.018],
  ],
  // the mill's crossing: up the wall at the lane's corner, across the lane's
  // end, along the tops to the far corner of the plate, down to the feet and
  // back along them: 4, 3, 76, 78, 5, 69, 23, 19, 7, 34, 26, 2
  [
    [14.9, 15.06, 'foot'],
    [14.9, 15.06, 'top'],
    [17.6375, 12.2084, 'road'],
    [20.0191, 9.7276, 'road'],
    [20.9, 8.81, 'top'],
    // on the same line, where the deck beside the road ends: the lift is eased
    // out from 5 to here, the way the deck's own edge eases it
    [38.7557, 7.27, 'top'],
    [39.8966, 7.1716, 'top'],
    [42.4582, 11.4656, 'top'],
    [42.6119, 11.7232, 'top'],
    [35.7337, 15.8618, 'foot'],
    [35.5732, 15.5975, 'foot'],
    [19.17, 15.3, 'foot'],
  ],
  // the footway behind the road wall: down its end on the slant, so the ground
  // buries half of it, along its foot, up at the far corner and back along the
  // kerb at the top: 11, 14, 18, 16, 15
  [
    [2.6243, 35.7759, 'top'],
    [2.2041, 35.5049, 'foot'],
    [18.7177, 19.9048, 'foot'],
    [19.8245, 19.7573, 'foot'],
    [19.8245, 19.7573, 'top'],
  ],
  // the strip between the kerb and the wall a wing's width off it, past the
  // plate's near corner: across it at the wall's top, down the wall on the
  // slant to its foot, and back along the kerb: 21, 9, 32, 28
  [
    [28.7701, 19.8528, 'top'],
    [28.9311, 20.106, 'top'],
    [29.775, 19.5695, 'foot'],
    [29.614, 19.3163, 'foot'],
  ],
  // the second crossing's four strips between the kerb and the walls a wing's
  // width off it, all at the walls' top: along the kerb, out, back along the
  // wall and in again - 55, 39, 41, 57; 59, 47, 49, 61; 45, 43, 35, 37; and
  // 53, 51, 63, 65
  [
    [64.3458, -10.9548, 'top'],
    [66.8649, -15.2698, 'top'],
    [66.6019, -15.4141, 'top'],
    [64.4324, -11.6731, 'top'],
  ],
  [
    [60.6796, -6.4942, 'top'],
    [61.44, -7.1436, 'top'],
    [61.5183, -7.6754, 'top'],
    [60.4842, -6.7218, 'top'],
  ],
  [
    [60.2941, 0.4462, 'top'],
    [60.3468, 0.0385, 'top'],
    [58.7098, 1.1868, 'top'],
    [58.8792, 1.4344, 'top'],
  ],
  [
    [63.0282, -1.585, 'top'],
    [63.0907, -2.0132, 'top'],
    [63.8663, -2.644, 'top'],
    [64.0617, -2.4164, 'top'],
  ],
  // and the walls' outer faces buried on the slant: from a wall's foot where it
  // meets the bank up to its top at the road's end, across that end and back -
  // 50, 61, 59; 58, 41, 39; 63, 65, 54; and 35, 37, 46. Traced after the
  // strips, they win over them along the walls they share
  [
    [61.5183, -7.6754, 'foot'],
    [60.4842, -6.7218, 'top'],
    [60.6796, -6.4942, 'top'],
  ],
  [
    [64.4324, -11.6731, 'foot'],
    [66.6019, -15.4141, 'top'],
    [66.8649, -15.2698, 'top'],
  ],
  [
    [63.8663, -2.644, 'top'],
    [64.0617, -2.4164, 'top'],
    [63.0282, -1.585, 'foot'],
  ],
  [
    [58.7098, 1.1868, 'top'],
    [58.8792, 1.4344, 'top'],
    [60.2941, 0.4462, 'foot'],
  ],
];

/**
 * And the seams traced round ground that is to be kept: nothing inside one is
 * taken away, whatever runs over it, and it is the height field itself rather
 * than whatever lines cross it - the ground under a bridge, which is ground.
 */
export const KEPT: [x: number, y: number, edge?: SeamEdge][][] = [
  // under the mill's crossing, between the walls' feet and the near bank:
  // 4, 2, 26, 34, 104, along the bank, 106
  [
    [14.9, 15.06, 'foot'],
    [19.17, 15.3, 'foot'],
    [35.5732, 15.5975, 'foot'],
    [35.7337, 15.8618, 'foot'],
    [33.8737, 16.6519, 'water'],
    [23.8754, 17.0596, 'water'],
  ],
  // and the corner past the near wall's end under the road's half of the deck,
  // between the wall and the bank where it comes a wing's width off the road:
  // 28, 32, 110
  [
    [29.614, 19.3163, 'foot'],
    [29.775, 19.5695, 'foot'],
    [30.2187, 19.2873, 'water'],
  ],
];

/** How far under a deck's top the walls it lies on are topped out, in meters. */
export const UNDER_DECK = 0.005;
