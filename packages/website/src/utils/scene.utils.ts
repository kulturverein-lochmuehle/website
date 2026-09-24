import views from '@kvlm/visualization/views/manifest.json';
import {
  daylight,
  type Daytime,
  eventViewName,
  type EventSetting,
  overviewViewName,
  type Season,
  seasonOf,
  type Welcome,
} from '@kvlm/visualization';
import type { CollectionEntry } from 'astro:content';

import { atMill, getChronicleSetting } from './event.utils.js';

/** A baked view as a page shows it: the file to draw it from, and its first frame to show meanwhile. */
export type Scene = {
  name: string;
  kind: 'free' | 'path' | 'still';
  loop: boolean;
  src: string;
  /** The file's size as served, packed: what the loader fills against without a `Content-Length`. */
  size: number;
  poster?: string | undefined;
};

// the files as the build serves them, hashed
const files = import.meta.glob<string>('@views/*.{view.bin,still.webp}', {
  query: '?url',
  import: 'default',
  eager: true,
});

const fileOf = (name: string): string | undefined =>
  Object.entries(files).find(([path]) => path.endsWith(`/${name}`))?.[1];

/** The view of a name, if it has been baked. */
function sceneOf(name: string): Scene | undefined {
  const view = views.find(entry => entry.name === name);
  const src = view === undefined ? undefined : fileOf(view.file);
  if (view === undefined || src === undefined) {
    return undefined;
  }
  return {
    name,
    kind: view.kind as Scene['kind'],
    loop: view.loop,
    src,
    size: view.bytes,
    poster: fileOf(`${name}.still.webp`),
  };
}

/**
 * A season's view where an event has none of its own: one that looks at the
 * mill as it is - a still by preference, else what flies round - and not one of
 * an event's, which set up what is put up for it.
 */
function sceneOfSeason(season: EventSetting['season']): Scene | undefined {
  const fitting = views.filter(
    ({ name, kind, season: of }) => of === season && kind !== 'free' && !name.includes('-event-'),
  );
  const view = fitting.find(({ kind }) => kind === 'still') ?? fitting[0];
  return view === undefined ? undefined : sceneOf(view.name);
}

/**
 * The view an event is shown in: the one baked for its kind in its season,
 * else the season's view of the mill, else - a season none was baked for -
 * nothing at all.
 */
export function getEventScene(
  setting: EventSetting | undefined,
  now = new Date(),
): Scene | undefined {
  return (
    (setting === undefined ? undefined : sceneOf(eventViewName(setting.type, setting.season))) ??
    sceneOfSeason(setting?.season ?? seasonOf(atMill(now).month))
  );
}

/** The scene of a chronicle entry: of its own kind of event, or the season's. */
export const getChronicleScene = (entry: CollectionEntry<'chronicle'>): Scene | undefined =>
  getEventScene(getChronicleSetting(entry), entry.data.date);

/** The mill's overviews, by season - or Christmas - and time of day, and when the day is light in each season. */
export type MillScenes = {
  scenes: Partial<Record<`${Welcome}-${Daytime}`, Scene>>;
  daylight: Record<Season, [from: number, until: number]>;
};

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const WELCOMES: Welcome[] = [...SEASONS, 'christmas'];
const TIMES: Daytime[] = ['day', 'night'];

/**
 * Every overview of the mill as it is seen coming up the road, in each season
 * and before Christmas, by day and at night, and the hours the day is light in each - for the
 * page to pick from by the visitor's own day and hour, not the build's.
 */
export function getMillScenes(): MillScenes {
  const scenes = Object.fromEntries(
    WELCOMES.flatMap(welcome =>
      TIMES.flatMap(time => {
        const scene = sceneOf(overviewViewName(welcome, time));
        return scene === undefined ? [] : [[`${welcome}-${time}`, scene]];
      }),
    ),
  );
  return {
    scenes,
    daylight: Object.fromEntries(
      SEASONS.map(season => [season, daylight(season)]),
    ) as MillScenes['daylight'],
  };
}
