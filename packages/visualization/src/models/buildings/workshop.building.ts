/**
 * The workshop to the south east of the mill, a shed with no windows worth
 * drawing - it reads as background, so it is the dark one of the three.
 */

import type { House } from './profile.js';

export const WORKSHOP_HOUSE: House = {
  id: 293452515,
  profile: {
    eaves: 4.6,
    ridge: 3.2,
    storey: 4.6,
    dark: true,
    // the gate stands in the middle of the wall toward the yard, with two big
    // windows either side of it. What counts as the middle is the stretch one
    // sees: the extension stands in front of the last four meters of that wall,
    // so the openings are set out on what is left of it and the numbers below
    // sit further along than the middle of the house would put them. Each pair
    // is spread evenly over the piece of wall it has, between the gate and the
    // end of that stretch - a meter of wall, a window, a meter, a window, a
    // meter, except that the inner window of each pair is pulled a little closer
    // to the gate than the spread would put it. The four are mirrored across the
    // gate, so each number here has its opposite at twice the gate's less itself
    front: [
      {
        windows: [1.8, 3.95, 8.85, 11],
        // their heads run on the same line as the head of the gate
        size: [1.1, 1.6],
        y: 2,
        doors: [6.4],
        door: [2.6, 2.8],
        // the gate is arched, as the photographs show it
        arch: 0.6,
      },
    ],
    rear: [],
    gable: [],
    // the way in from the hillside behind: a narrow, steep gable carried up to
    // the ridge a third of the way along, standing over a door that is not drawn
    crossGable: { at: 5.6, width: 2, rise: 1.75 },
    // and the lean-to at the eastern end, which is what makes the plan an L. Its
    // roof carries the main one on from the edge of its overhang and reaches
    // well past the wall, so the steps up to the door are under cover
    leanTo: {
      at: 14.8,
      width: 4,
      depth: 1.5,
      door: [1.1, 2.1],
      // the toilet is behind it, which is why it sits so high and so small
      window: { size: [0.5, 0.6], y: 1.8 },
      porch: { reach: 1.4, rise: 0.36, steps: 2, width: 1.6 },
    },
  },
};
