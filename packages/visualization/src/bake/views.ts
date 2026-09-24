import type { Point } from '../data/data.js';

/**
 * A view of the model as it is baked for the site: where an eye stands on the
 * plan and how high over the ground under it, where it looks, and how wide. A
 * still view leaves out everything its eye cannot see; a path view everything
 * its eye cannot see anywhere along its path; a free one keeps the whole
 * model, and the eye is only where it starts.
 */
export interface ViewSpec {
  /** What it is called where it is listed. */
  title: string;
  /** Seen from where the eye stands, from along a path, or from anywhere. */
  kind: 'still' | 'path' | 'free';
  /** Where the eye stands on the plan. */
  eye: Point;
  /** How high over the ground under it, in meters. */
  height: number;
  /** The point of the plan it looks towards. */
  look: Point;
  /** How far it looks up from level, in degrees. */
  pitch: number;
  /** How wide it sees, across, in degrees - kept whatever shape the page gives it. */
  fov: number;
  /** How far it sees, in meters: past that nothing is baked. */
  far: number;
  /**
   * For a path view, where the eye goes on to from where it starts, and where
   * it looks on the way there: it moves through them on a smooth curve, at
   * its height over the ground wherever it is, and turns as it goes.
   */
  path?: { eye: Point; look: Point }[];
}

/**
 * The views baked for the site, each written to `views/<name>.view.bin` and
 * shown on the site's demo at `/demo/<name>`: named by the day it was set up,
 * what it looks at, and its kind.
 */
export const VIEWS = {
  // from the road south east of the stairs, at a grown-up's eye height,
  // looking west: the stairs up their open side on the right, half the mill
  // on the left
  '20260926-street-still': {
    title: 'From the street, still',
    kind: 'still',
    eye: [35, 13.5],
    height: 1.7,
    look: [15.4, 17.3],
    pitch: 4,
    fov: 100,
    far: 400,
  },
  // along the road from the north west, past the stairs, to where the still
  // one stands: the pavilion over the wall first, then up the stairs as they
  // are passed, and the mill at the end - flown there and back again
  '20260926-road-path': {
    title: 'Along the road, moving',
    kind: 'path',
    eye: [9, 31.5],
    height: 1.7,
    look: [21.9, 16.2],
    pitch: 3,
    fov: 100,
    far: 400,
    path: [
      { eye: [22, 20.2], look: [28, 25] },
      { eye: [35, 13.5], look: [15.4, 17.3] },
    ],
  },
  // the whole model, uncut, to be looked at from anywhere: starting where
  // the still one stands
  '20260926-whole-free': {
    title: 'The whole model, free',
    kind: 'free',
    eye: [35, 13.5],
    height: 1.7,
    look: [15.4, 17.3],
    pitch: 4,
    fov: 100,
    far: 1200,
  },
} as const satisfies Record<string, ViewSpec>;

/** The seasons every view is baked in, summer first: its file is the view's own name. */
export const BAKED_SEASONS = ['summer', 'spring', 'autumn', 'winter'] as const;

/** The file a view is baked to in a season. */
export const viewFile = (name: string, season: (typeof BAKED_SEASONS)[number]) =>
  season === 'summer' ? `${name}.view.bin` : `${name}.${season}.view.bin`;
