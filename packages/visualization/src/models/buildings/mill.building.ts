/**
 * The Lochmühle itself. Its numbers come off the survey drawings of 2014
 * (Straßenfassade, Rückfassade, Giebel West, Schnitt B) rather than off a
 * photograph: storey heights from the section, opening counts and sizes from
 * the schedules on each elevation.
 */

import type { House, Row } from './profile.js';

/**
 * The elevations were read as vectors, their dimension chain gives 0.04723 m
 * per point, and every opening was taken from that. The floor stands 0.80m
 * above the yard, which is where the window heights below are measured from.
 */
const MILL = { ground: 1.66, dormer: 6.67, attic: 6.48 } as const;

/**
 * Both gables carry the same pair of attic windows, and the frame of the
 * triangle is built around them - so they are one row, written once. Two copies
 * of it drift apart the moment either is moved.
 */
const MILL_ATTIC_BAYS: [number, number] = [2.65, 5.92];

const MILL_ATTIC: Row = { windows: MILL_ATTIC_BAYS, size: [0.8, 1.16], y: MILL.attic };

/**
 * The storey windows of the framed gable, which stands at the east end. Its
 * pair sits on its own lines, wider apart than the attic's.
 */
const MILL_GABLE_STOREY: Row = { windows: [1.64, 6.93], size: [0.7, 0.95], y: 4.05 };

/**
 * The west gable is set out differently: its storey windows stand under the
 * attic pair rather than on lines of their own, so they are taken from the
 * attic and cannot drift off it.
 */
const MILL_WEST_STOREY: Row = {
  windows: MILL_ATTIC_BAYS,
  size: MILL_GABLE_STOREY.size,
  y: MILL_GABLE_STOREY.y,
};

/**
 * The line every window of the upper storey stands on, gable and long wall
 * alike, and the line the beam under them is hung from.
 */
const MILL_UPPER_SILL = MILL_GABLE_STOREY.y - MILL_GABLE_STOREY.size[1] / 2;

/** Upper storey windows of the long walls, a little taller than the gable's. */
const MILL_UPPER_SIZE: [width: number, height: number] = [0.7, 1];

/**
 * Both long walls of the mill, measured off the street elevation. The wall
 * toward the brook repeats it: the same numbers run from the same end of the
 * house, which puts the openings opposite each other and reads as the mirror of
 * the street front from outside.
 */
const MILL_UPPER: Row = {
  windows: [2.18, 4.41, 6.39, 8.58, 10.84, 12.75, 14.83, 16.92, 18.77],
  size: MILL_UPPER_SIZE,
  y: MILL_UPPER_SILL + MILL_UPPER_SIZE[1] / 2,
};

/** The street front, measured off the elevation: the storey over two entrances. */
const MILL_STREET: Row[] = [
  {
    windows: [2.18, 4.41, 8.58, 10.84, 16.92, 18.77],
    doors: [6.54, 14.98],
    door: [0.96, 2.17],
    size: [0.8, 1.1],
    y: MILL.ground,
  },
  MILL_UPPER,
];

/**
 * The wall toward the brook. Its storey repeats the street's, its ground floor
 * does not: neither entrance is one on this side, the eastern opening is the
 * door instead, and the bay at 12.75 is a window here - on the street it is the
 * one the staircase stands behind.
 */
const MILL_BROOK: Row[] = [
  {
    windows: [2.18, 4.41, 6.54, 8.58, 10.84, 12.75, 14.98, 16.92],
    doors: [18.77],
    door: [0.96, 2.17],
    size: [0.8, 1.1],
    y: MILL.ground,
  },
  MILL_UPPER,
];

/**
 * Section B stacks 2.52 + 0.24 + 2.16 + 0.24 to the eaves and 2.33 + 0.20 +
 * 2.02 + 0.50 from there to the ridge.
 */
export const MILL_HOUSE: House = {
  id: 110309799,
  profile: {
    eaves: 5.16,
    ridge: 5.05,
    storey: 2.76,
    // the eastern one stands clear of the ridge, the western one further down
    // the slope again and in line with the sixth window from the east
    chimneys: [
      { at: 15.76, down: 0.3 },
      // the western stack is the taller of the two, and still ends under the
      // ridge because it sits half way down the slope
      { at: 8.58, down: 0.5, proud: 1.98 },
    ],
    timbered: {
      to: 4.74,
      posts: [
        7.17, 8.17, 8.99, 10.43, 11.25, 12.34, 13.16, 14.42, 15.24, 16.51, 17.33, 18.36, 19.18,
        20.23,
      ],
    },
    plinth: 0.65,
    terrace: { depth: 2.4, stairs: 2 },
    gablePosts: {
      // the corners of the wall; the pair around the middle stands a window's
      // width apart, so it is measured from the window like the jambs are
      storey: [0.07, 8.5],
      // the attic has one post between its windows and none beside the rafters
      attic: [4.285],
    },
    front: MILL_STREET,
    rear: MILL_BROOK,
    // the far gable is the west one, at the stone end: its ground floor carries
    // the door alone, and door, storey windows and attic windows all stand on
    // the same two lines
    farGable: [
      // and the door under them too, on the nearer of the two lines
      {
        windows: [],
        doors: [MILL_ATTIC_BAYS[0]],
        door: [1, 2.1],
        size: [0.8, 1.1],
        y: MILL.ground,
      },
      MILL_WEST_STOREY,
      MILL_ATTIC,
    ],
    gable: [
      { windows: [1.39, 4.12, 6.64], size: [0.8, 1.1], y: MILL.ground },
      // measured off the photograph of this gable, where the wall is 8.57m wide:
      // two in the framed storey sitting on its through beam, two more in the
      // attic, a good deal larger and set high
      MILL_GABLE_STOREY,
      MILL_ATTIC,
    ],
    // the elevation draws five, the roof carries seven since it was redone
    dormer: { windows: 7, size: [0.6, 0.8], share: 0.68 },
  },
};
