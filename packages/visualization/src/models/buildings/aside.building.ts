/**
 * Lotzebachstraße 27, the smaller house west of the mill. No survey drawing of
 * its own: everything here is measured off two photographs. One is taken from
 * the playground across the brook and shows the wall toward the road square on
 * and the east gable edge on, the other looks down onto the wall toward the
 * hillside from the slope above. Its wall comes out 924 pixels for the 12.41m the
 * footprint gives it, and the mill's door beside it, 2.17m on the elevation,
 * measures the same scale to within a few percent - so the heights are read
 * off the same photograph as the widths.
 *
 * The rectangle this footprint wraps into runs from west to east, the other way
 * round from the mill's: its local front faces the hillside and its rear the
 * road, and both are measured from the east end. The west gable is on neither
 * photograph and carries nothing yet.
 */

import type { House, Row } from './profile.js';

/**
 * The ground floor toward the road: three windows, the front door, and the wide
 * arched opening at the west end that the shop is behind.
 */
const ASIDE_ROAD: Row[] = [
  {
    windows: [1.38, 2.94, 6.68],
    size: [0.9, 1.25],
    y: 1.37,
    doors: [4.79],
    door: [1.03, 2.15],
  },
  // a flat arch, its head rounded off at the shoulders only. The ground in
  // front of it stands 11 to 16cm above the floor over the first 1.5m, so it
  // starts on that: its head where the photograph has it, 2.03m up
  { windows: [], size: [0, 0], y: 0, doors: [9.96], door: [2.28, 1.91], arch: 0.7, sill: 0.12 },
];

/**
 * The east gable, measured from the corner at the road. Its pair of windows
 * lights the half storey under the roof and stands astride the line of the
 * eaves, either side of the middle; the small one low down at the far end is
 * half hidden behind a car and taken as far as it shows.
 */
const ASIDE_EAST: Row[] = [
  { windows: [5.9], size: [0.5, 0.85], y: 1.9 },
  { windows: [1.8, 5.1], size: [0.8, 1.2], y: 4.05 },
];

/**
 * The wall toward the hillside, mostly behind bushes: one small window high up
 * at the west end. What stands against the wall in the middle is too blurred to
 * tell a door from a cold frame, so it is left out.
 */
const ASIDE_HILL: Row[] = [{ windows: [9.44], size: [0.85, 1.05], y: 2.1 }];

export const ASIDE_HOUSE: House = {
  id: 293452398,
  profile: {
    // the timbered knee wall stands on the ground floor's stonework and ends
    // under the eaves
    eaves: 4.1,
    ridge: 3,
    storey: 2.57,
    // at the east end, just inside the gable wall - both photographs put it
    // there, the slope above shows it standing a third of the way down
    chimneys: [{ at: 0.7, down: 0.3 }],
    front: ASIDE_HILL,
    rear: ASIDE_ROAD,
    gable: [],
    farGable: ASIDE_EAST,
    // three roof windows in the slope toward the road, two in the other, all
    // of them the same size and as far up the slope
    // only toward the road: the wall toward the hill is stone to the eaves.
    // Thirteen posts a meter apart, between stone piers 0.3m wide at the
    // corners, and the rail low down, a quarter of the way up the frame
    kneeWall: {
      facade: 'rear',
      posts: [0.29, 1.22, 2.22, 3.21, 4.2, 5.23, 6.26, 7.29, 8.3, 9.28, 10.24, 11.16, 12.1],
      sill: 2.63,
      rail: 2.88,
      plate: 3.9,
    },
    // the ground in front of the door lies 14 to 19cm below the floor over the
    // first meter out, and the photograph shows the step it takes
    // and one beside the front door
    doorLanterns: { facade: 'rear', side: 1 },
    doorstep: { facade: 'rear', at: 4.79, width: 1.4, depth: 0.35 },
    skylights: { front: [2.38, 6.2], rear: [1.97, 5.07, 10.32], size: [1.14, 1.4], up: 1.13 },
  },
};
