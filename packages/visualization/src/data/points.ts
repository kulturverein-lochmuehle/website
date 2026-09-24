/**
 * Reference points set on the bench: a place on the plan and the height the
 * ground is to have there. Each is a handle a seam or a dump can be traced to,
 * and inside a dump a height its surface has to pass through.
 */
export const POINTS: [x: number, y: number, level: number][] = [
  // where the ground behind the stairs' walls comes up to their tops, the
  // terrace deck's far edge: off the stairs' top, the U's corner, its end,
  // twice along the upper wall, and past the bend's end
  [30.86, 28.29, 0.527],
  [29.32, 29.33, 0.527],
  [24.5, 32.65, 0.527],
  [21.4, 35.43, 0.348],
  [18.68, 38.65, 0.169],
  [16.64, 42.63, -0.01],
  // round the bend and the pillar stairs, the ground they are to stand on: on
  // the bend's face half way up it, at its end and the stub's up to the
  // stub's underside - 209 to 212
  [10.93, 36.15, -1.023],
  [10.82, 37.55, -1.018],
  [12.19, 39.15, -0.16],
  [12.64, 39.68, -0.16],
  // up the slope beside the stairs, where it stands 0.6m over the steps'
  // undersides - 0.4m off the top one, where it flattens out towards the
  // terrace - off steps 10, 8, 6, 4, 2 and 1 - 213 to 218
  [17.06, 45.38, 0.051],
  [16.37, 45.48, -0.25],
  [15.13, 45.22, -0.756],
  [13.94, 45.22, -1.255],
  [12.58, 45.32, -1.746],
  [11.8, 45.4, -1.995],
  // the ground by the road, from the stairs' foot back to the lower wall's end
  // - 219 to 221
  [9.05, 41.47, -2.428],
  [9.67, 38.9, -2.212],
  [10.28, 36.33, -2.078],
  // picked on the bench south of the stairs: along the road, 222 to 225 - 224
  // lifted - and up the slope, 226 to 228
  [27.91, 21.72, -1.191],
  [29.48, 22.39, -0.994],
  [31.3, 23.34, -0.886],
  [33.76, 24.2, -1.036],
  [32.3, 27.16, 0.515],
  [33.79, 26.26, 0.483],
  [35.87, 25.58, 0.266],
  // and between the two, 229 to 232
  [29.74, 24.25, 0.514],
  [31.33, 24.67, 0.544],
  [32.94, 24.8, 0.534],
  [34.57, 24.74, 0.617],
  // for the places the events use, to be drawn round - the ones by the
  // houses' corners and the mill's terrace taken away again, which are
  // handles of their own now
  [36.95, 3.5, -0.506],
  // on the line the mill's deck keeps a meter off its terrace along
  [29.99, 8.48, -0.707],
  [53.51, -1.3, 0.283],
  [14.9, 14.69, -1.133],
  [17.82, 58.03, -2.314],
  [19.62, 70.46, -2.676],
  [-1.45, 71.67, -4.45],
  [4.15, 43.42, -2.673],
  // and more of them
  [45.75, -1.18, -0.021],
  [42.15, -4.42, 0.005],
  [36.12, -2.32, -0.016],
  [41.7, 2.2, -0.293],
  [38.41, -3.97, 0],
  [24.11, 25.93, 0.522],
  [5.05, 63.87, -4.109],
  [-6.09, 12, 0.115],
  // the garden on the lawn before the small house, as the photograph from
  // the lane between the houses has it: the sandbox, the millstone, the
  // table with its two benches, the swinging seat, the big shrub, the hedge
  // along the brook from one end to the other, two hydrangeas
  [4.5, 10.8, -0.65],
  [1, 10.5, -0.38],
  [-3.5, 20.5, -1.15],
  [-0.55, 21.07, -1.35],
  [11.5, 16.5, -2.1],
  [7.4, 15.9, -1.05],
  [-3.4, 26.1, -1.55],
  [2.5, 18.2, -1.1],
  [-0.5, 17.6, -1.05],
  // the lawn's plateau before the small house, as flat as the photographs
  // have it, and the steep bank from its edge down to the brook: along the
  // lane's edge from east to west - its east end first - then along the
  // plateau's edge over the brook from east to west, its west end on the
  // ground, and the bank's foot by the water, east to west
  [9.58, 10.41, -0.77],
  [-9.84, 9.51, 0.7],
  [-5, 8.85, 0.26],
  [-0.02, 9.2, -0.16],
  [4.93, 9.57, -0.53],
  [9.99, 15.48, -1],
  [5.94, 17.72, -1.16],
  [0.41, 22.03, -1.41],
  [-2.1, 24.97, -1.51],
  [-4.11, 27.35, -1.58],
  [-7.78, 31.44, -1.77],
  [11.88, 19.23, -3.48],
  [8.1, 21.32, -3.6],
  [3.39, 24.99, -3.77],
  [1.14, 27.64, -3.89],
  [-0.92, 30.09, -4.02],
  // the plateau on west along the brook, twice as long: its edge over the
  // brook on from the last, east to west, sinking with the road, then
  // curving back in to where the hillside meets it, west to east; the
  // bank's foot under it
  [-10.72, 34.83, -2.45],
  [-12.09, 27.64, -1.77],
  [-4.66, 34.25, -4.28],
  [-7.54, 37.58, -4.5],
  // and on east, towards the mill, the ramp it comes down onto the ground
  // by: by the lane, and towards the bridge; and the shrubs on it
  [13.5, 12, -0.97],
  [14.5, 16, -2.48],
  [12, 13.4, -1.15],
  [12.9, 15.6, -1.5],
  [11.2, 17.6, -1.9],
  // the dry stone wall from the millstone's socket, its line through the
  // stone's middle, curving on along the brook to the lower lawn's west tip: its foot on the lower lawn, east to west, its
  // top on the upper plateau, east to west, and where that plateau meets the
  // ground towards the hillside, east to west
  [0.54, 11.1, -0.5],
  [-2.61, 15.22, -0.9],
  [-5.29, 17.56, -1.2],
  [-9.13, 19.96, -1.5],
  [-10.93, 22.08, -1.65],
  [-13.41, 24.84, -1.75],
  [0.18, 10.83, 0],
  [-2.94, 14.92, 0],
  [-5.55, 17.2, 0],
  [-9.41, 19.61, 0],
  [-11.27, 21.78, 0],
  [-13.77, 24.57, 0],
  [-7.77, 10.56, 0],
  [-8.79, 12.75, 0],
  [-12.69, 15.51, 0],
  [-16.34, 17.33, 0],
  [-19.96, 19.9, 0],
  // and along the lane's kerb between the two the lawn starts from, east of
  // the millstone: it bows away from a straight line between them
  [6.04, 9.75, -0.6],
  [7.01, 9.93, -0.65],
  [7.98, 10.1, -0.7],
  [8.94, 10.28, -0.74],
  // and where the old ground falls below the lower lawn, out from the wall's
  // foot towards the brook, east to west: the strip between is cut out
  [2.94, 12.9, -0.5],
  [-0.39, 17.24, -0.9],
  [-3.53, 19.99, -1.2],
  [-7.26, 22.3, -1.5],
  [-8.12, 24.56, -1.65],
  [-9.21, 27.99, -1.75],
  // the wall's last top, at its end by the lawn's west tip, and where the
  // upper plateau meets the ground beyond it
  [-22.3, 40.6, 0],
  [-22.75, 25.22, 0],
  // the young tree by the swinging seat, where the table stood: the two
  // swapped places
  [-6.24, 23.76, -1.4],
  // the dry wall's last foot, where it now ends, its top, where the plateau
  // behind it meets the ground, and the strip cut out before it
  [-15.79, 28.53, -1.94],
  [-16.34, 28.56, 0],
  [-24.33, 31.91, 0],
  [-25.66, 38.93, 0],
  [-11.03, 30.74, -1.94],
  // the lower lawn held at the wall's foot between its points, 0.6m out:
  // laid on that far from anything held, it stood up to 0.75m over the foot
  [-9.19, 20.94, -1.54],
  [-9.62, 21.45, -1.57],
  [-10.05, 21.97, -1.61],
  [-11.09, 23.16, -1.67],
  [-11.7, 23.84, -1.7],
  [-12.32, 24.52, -1.73],
  [-13.51, 26.1, -1.8],
  [-14.08, 26.99, -1.84],
  [-14.66, 27.89, -1.89],
  // where the upper plateau, past the second wall, meets the hillside
  [-25.8, 44, 0],
  [-26, 42, 0],
  // the upper plateau behind the second wall: where its top's level stretch
  // ends, at its back
  [-14.26, 31.15, 0],
  // the bank the upper plateau comes down to the ground by, past the second
  // wall: the wall's end at its back, at the lawn's level, and its foot on
  // the ground, east to west
  [-13.08, 32.61, -1.94],
  [-12.27, 36.91, -4.34],
  [-14.09, 39.44, -4.49],
  [-16.1, 41.8, -4.51],
  [-21.73, 41.09, -0.6],
  [-23.53, 42.84, -0.48],
  [-25.63, 44.18, -0.07],
  // the second wall's end at its front, on the lower lawn
  [-12.73, 32.33, -1.94],
  // the lower lawn's corners round 290 and 347 rounded off, each by a point
  // a meter along either edge and one between, and the one at 293 eased
  // by a point a meter on towards 347
  [-10.06, 34.07, -1.91],
  [-10.37, 34.8, -2.09],
  [-9.96, 35.48, -2.56],
  [-8.53, 37.44, -4.47],
  [-11.28, 37.05, -4.37],
  [-12.07, 36.7, -4.21],
  [-12.46, 35.93, -3.79],
  // a young tree on the bank between the stairs' lower wall and the railing,
  // at its end by the wall's end (127)
  [11.75, 34.4, -1.06],
  // the flower bed on the upper plateau west of the millstone by the lane, as
  // the photograph has it at its left
  [-2, 10, 0],
];
