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
];
