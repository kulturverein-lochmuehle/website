import type { Point } from '../data/data.js';
import type { Decoration } from '../models/decorations/decorations.js';
import type { EventTypeKey } from '../models/events/events.js';
import { EVENT_TYPE_KEYS, EVENT_TYPES, eventSetting } from '../models/events/events.js';
import type { Season } from '../models/terrain/trees.js';
import { lightsDue } from '../scene/sky.js';

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
  /**
   * The season it is baked in: the woods in leaf of its colour, or bare and
   * under snow. A view is one season - another season is another view.
   */
  season: Season;
  /** The hour of the clock it is lit at, if not by the sun set for the mill. */
  hour?: number;
  /** How much moon there is at night, nought to one: `MOON` unless it says. */
  moon?: number;
  /** Whether the windows are lit: by default once it is dark at that hour. */
  lights?: boolean;
  /** Whether the street lamps are lit: as the windows are, unless it says. */
  lanterns?: boolean;
  /** What is put up for it - the strings of lights, a campfire - by their tags: nothing unless it says. */
  decorations?: readonly string[];
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
  path?: { eye: Point; look: Point; height?: number; pitch?: number }[];
  /**
   * Whether the path closes on itself: on from its last point back to where
   * it started, and flown round and round at an even pace rather than there
   * and back. Each point of it may climb to a height of its own over the
   * ground and look down by a pitch of its own; the eye eases between them.
   */
  loop?: boolean;
}

/**
 * Round the yard and back, at a walk and then a little over it: from the
 * street where the still view stands, at a grown-up's eye height, rising
 * towards the pavilion and round it on the hill, west, north and east -
 * looking down on it - back over the road, down to the yard to look at the
 * workshop, along the mill's front, and on to the street again, where it
 * started: a loop, flown round and round.
 */
const YARD_LOOP = {
  kind: 'path',
  eye: [35, 13.5],
  height: 1.7,
  look: [15.4, 17.3],
  pitch: 4,
  fov: 90,
  far: 400,
  loop: true,
  path: [
    { eye: [31, 19], look: [29.9, 28.4], height: 3, pitch: -6 },
    { eye: [23, 28.5], look: [29.9, 28.4], height: 5, pitch: -16 },
    { eye: [29, 35.5], look: [29.9, 28.4], height: 6, pitch: -35 },
    { eye: [36, 30], look: [29.9, 28.4], height: 6, pitch: -18 },
    { eye: [39, 19], look: [22, 3], height: 5, pitch: -10 },
    { eye: [46, 6], look: [40, -9.2], height: 4, pitch: -12 },
    { eye: [30, 12], look: [18, 1], height: 2.5, pitch: -3 },
  ],
} as const satisfies Omit<ViewSpec, 'title' | 'season'>;

/**
 * Where each kind of event is looked at from, at a grown-up's eye height: its
 * places in sight and what is put up there. The Feierabend from the road
 * north east of the workshop, the fire before the lean-to's door in the
 * middle and the Vereinsraum's open door behind it; the Frühlingsfatsche
 * further back, the hall's gate, the bar and the grill as well; the
 * SOMMERFESTival from the road over the mill's front to the terraces; the
 * Adventskalender before the mill's terrace, its window.
 */
const EVENT_EYES = {
  feierabend: { eye: [51.5, 5], look: [45.5, -4], height: 1.7, pitch: 3, fov: 80 },
  fruehlingsfatsche: { eye: [49, 5], look: [40, -4], height: 1.7, pitch: 3, fov: 90 },
  sommerfestival: { eye: [25.8, 30.5], look: [20.5, 8], height: 1.7, pitch: -7, fov: 95 },
  adventskalender: { eye: [32, 14.5], look: [19, 5.5], height: 1.7, pitch: 3, fov: 85 },
} as const satisfies Record<
  EventTypeKey,
  Pick<ViewSpec, 'eye' | 'look' | 'height' | 'pitch' | 'fov'>
>;

/** The seasons a kind of event is held in: its own, or all four through the year. */
const heldIn = (type: EventTypeKey): Season[] => {
  const { season } = EVENT_TYPES[type] as { season?: Season };
  return season === undefined ? ['spring', 'summer', 'autumn', 'winter'] : [season];
};

/** The month an event of no season of its own is set in, for its season: the middle one. */
const MIDDLE_OF: Record<Season, number> = { spring: 4, summer: 7, autumn: 10, winter: 1 };

/** A kind of event's view in a season, by the name it is baked and listed under. */
export function eventViewName(type: EventTypeKey, season: Season): string {
  return `20260930-event-${type}-${season}`;
}

/** The seasons by what the site calls them. */
const SEASON_TITLES: Record<Season, string> = {
  spring: 'im Frühling',
  summer: 'im Sommer',
  autumn: 'im Herbst',
  winter: 'im Winter',
};

/**
 * A still view of each kind of event, in each season it is held in: set up as
 * it is set up - its season, its usual start, what is put up for it - and
 * seen from where its places are.
 */
const EVENT_VIEWS: Record<string, ViewSpec> = Object.fromEntries(
  EVENT_TYPE_KEYS.flatMap(type =>
    heldIn(type).map(season => {
      const { hour, decorations } = eventSetting(type, MIDDLE_OF[season]);
      const view: ViewSpec = {
        ...EVENT_EYES[type],
        title: `${EVENT_TYPES[type].title}, ${SEASON_TITLES[season]}`,
        kind: 'still',
        season,
        hour,
        decorations,
        far: 400,
      };
      return [eventViewName(type, season), view];
    })
  )
);

/** By day, or at night. */
export type Daytime = 'day' | 'night';

/**
 * What the mill's overview is seen in: a season, or the time before
 * Christmas - from the day after Totensonntag to Epiphany - in the winter's
 * woods, with what is put up for it.
 */
export type Welcome = Season | 'christmas';

/** The overview of the mill in a season by day or night, by the name it is baked and listed under. */
export function overviewViewName(welcome: Welcome, time: Daytime): string {
  return `20261001-overview-${welcome}-${time}`;
}

/**
 * The hour the day's overview is lit at: early afternoon - but autumn's by
 * the sun set for the mill, low and golden across its front. By the clock
 * its late afternoon sun stands behind the mill from here, in the south
 * west, and all this view sees of it is its shade.
 */
const DAY: Record<Welcome, number | undefined> = {
  spring: 14,
  summer: 14,
  autumn: undefined,
  winter: 14,
  christmas: 14,
};

/** The hour the night's overview is lit at, in every season: late in the evening, dark even in June. */
const NIGHT = 22;

/** What is put up for the overview: the fire before the small house at night, and the lights and Christmas before it. */
const WELCOME_UP: Record<Welcome, Record<Daytime, Decoration[]>> = {
  spring: { day: [], night: ['feuer-selbis'] },
  summer: { day: [], night: ['feuer-selbis'] },
  autumn: { day: [], night: ['feuer-selbis'] },
  winter: { day: [], night: ['feuer-selbis'] },
  christmas: {
    day: ['lichterkette-gelaender', 'weihnacht-hexenhaus'],
    night: ['lichterkette-gelaender', 'weihnacht-hexenhaus', 'feuer-selbis'],
  },
};

/**
 * The mill as it is best known, as it is seen coming up the road: from the
 * road to the north, above it, looking back south - the mill's front in the
 * middle, the workshop behind it and the small house beside it, the pavilion
 * over the stairs on the left. The eye drifts round a little and back, over
 * and over - a few meters aside and up and down, never off the front. In each
 * season and before Christmas, by day and at night: what the site welcomes
 * with, picked by the visitor's own day and hour.
 */
const OVERVIEWS: Record<string, ViewSpec> = Object.fromEntries(
  (['spring', 'summer', 'autumn', 'winter', 'christmas'] as const).flatMap(welcome =>
    (['day', 'night'] as const).map(time => {
      const season = welcome === 'christmas' ? 'winter' : welcome;
      const view: ViewSpec = {
        title: `Die Lochmühle ${welcome === 'christmas' ? 'vor Weihnachten' : SEASON_TITLES[welcome]}, ${time === 'day' ? 'am Tag' : 'in der Nacht'}`,
        kind: 'path',
        loop: true,
        season,
        ...(time === 'night'
          ? { hour: NIGHT }
          : DAY[welcome] === undefined
            ? {}
            : { hour: DAY[welcome] }),
        decorations: WELCOME_UP[welcome][time],
        eye: [-2, 58],
        height: 13,
        look: [20, 8],
        pitch: -12,
        fov: 60,
        far: 600,
        path: [
          { eye: [1, 57], look: [20, 8], height: 14.5, pitch: -14 },
          { eye: [0.5, 60.5], look: [20, 8.5], height: 14, pitch: -13 },
          { eye: [-4, 60], look: [20, 8.5], height: 12, pitch: -11 },
        ],
      };
      return [overviewViewName(welcome, time), view];
    })
  )
);

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
    season: 'summer',
    // the strings of lights up, as they always hung in these seasons
    decorations: ['lichterkette-gelaender'],
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
    season: 'summer',
    // the strings of lights up, as they always hung in these seasons
    decorations: ['lichterkette-gelaender'],
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
    season: 'summer',
    // the strings of lights up, as they always hung in these seasons
    decorations: ['lichterkette-gelaender'],
    eye: [35, 13.5],
    height: 1.7,
    look: [15.4, 17.3],
    pitch: 4,
    fov: 100,
    far: 1200,
  },
  // the still one again, on an autumn afternoon: the low sun through the
  // haze and the leaves coming down
  '20260928-street-autumn-still': {
    title: 'From the street, an autumn afternoon',
    kind: 'still',
    season: 'autumn',
    hour: 16,
    eye: [35, 13.5],
    height: 1.7,
    look: [15.4, 17.3],
    pitch: 4,
    fov: 100,
    far: 400,
  },
  // and on a winter's evening after dark, under snow, the lights on
  '20260928-street-winter-still': {
    title: 'From the street, a winter evening',
    kind: 'still',
    season: 'winter',
    // the strings of lights up, as they always hung in these seasons, and
    // the workshop's hall lit after dark, as it always was
    decorations: ['lichterkette-gelaender', 'licht-werkstatt'],
    hour: 17,
    eye: [35, 13.5],
    height: 1.7,
    look: [15.4, 17.3],
    pitch: 4,
    fov: 100,
    far: 400,
  },
  // round the yard and back, in each season at its own hour: a winter's
  // evening with the lights on, a spring afternoon, a summer's midday and
  // an autumn morning
  '20260929-yard-loop-winter-evening': {
    ...YARD_LOOP,
    title: 'Round the yard, a winter evening',
    season: 'winter',
    // the strings of lights up, as they always hung in these seasons, and
    // the workshop's hall lit after dark, as it always was
    decorations: ['lichterkette-gelaender', 'licht-werkstatt'],
    hour: 17,
  },
  '20260929-yard-loop-spring-afternoon': {
    ...YARD_LOOP,
    title: 'Round the yard, a spring afternoon',
    season: 'spring',
    hour: 15.5,
  },
  '20260929-yard-loop-summer-midday': {
    ...YARD_LOOP,
    title: 'Round the yard, a summer midday',
    season: 'summer',
    // the strings of lights up, as they always hung in these seasons
    decorations: ['lichterkette-gelaender'],
    hour: 13,
  },
  '20260929-yard-loop-autumn-morning': {
    ...YARD_LOOP,
    title: 'Round the yard, an autumn morning',
    season: 'autumn',
    hour: 9.5,
  },
  // and one of each kind of event, in each season it is held in
  ...EVENT_VIEWS,
  // and the mill from above, the site's welcome, in every season
  ...OVERVIEWS,
} as const satisfies Record<string, ViewSpec>;

/**
 * How long a view might take to bake, in milliseconds, from what it is: a
 * path sees from many eyes, round a loop the more; after dark every lamp
 * casts its shadows; and every decoration put up is more to light. Within a
 * third of what they take, which is near enough to start the longest first.
 */
export function bakeCost(view: ViewSpec): number {
  const lit = view.lights ?? lightsDue(view.season, view.hour);
  return (
    6000 *
    (view.kind === 'path' ? 2 : view.kind === 'free' ? 0.8 : 1) *
    (view.loop === true ? 2 : 1) *
    (lit ? 2 : 1) *
    (1 + 0.15 * (view.decorations?.length ?? 0))
  );
}
