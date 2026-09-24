import type { Point } from '../data/data.js';

/**
 * A view of the model as it is baked for the site: where an eye stands on the
 * plan and how high over the ground under it, where it looks, and how wide. A
 * still view leaves out everything its eye cannot see; a free one keeps the
 * whole model, and the eye is only where it starts.
 */
export interface ViewSpec {
  /** What it is called where it is listed. */
  title: string;
  /** Seen from where the eye stands only, or from anywhere. */
  kind: 'still' | 'free';
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
