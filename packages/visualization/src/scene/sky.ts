import { Color, Vector3 } from 'three';

import { BUILDINGS } from '../data/data.js';
import { boundingRect } from '../models/buildings/footprint.js';
import { MILL_HOUSE } from '../models/buildings/mill.building.js';
import type { Season } from '../models/terrain/trees.js';
import { once } from '../utils/geometry.utils.js';
import type { Palette } from './palette.js';

/**
 * The sky over the valley in a season: its colour overhead and at the
 * horizon, the sun - where it stands, what colour it lights with and how
 * strongly - and the haze that the far side of the valley fades into. Every
 * colour is the brand's, mixed.
 */
export interface Sky {
  zenith: Color;
  horizon: Color;
  /** The haze the distance fades into, the horizon's colour. */
  haze: Color;
  sun: {
    /** Compass direction the sun stands in, clockwise from north, and how high, in degrees. */
    azimuth: number;
    elevation: number;
    color: Color;
    intensity: number;
    /** What lights: the sun by day, the moon once the sun is down. */
    body: 'sun' | 'moon';
  };
  /** How much of the day's fill light there is - sky and ground bounce - nought to one. */
  fill: number;
  /** What the fill is tinted by: white, but cool blue in the shade of a golden hour. */
  fillTint: Color;
  /** How much day it is, nought at night to one by day. */
  day: number;
  /**
   * How dark the shadows are, nought to one, and how soft their edges: a high
   * sun throws short, hard, dark ones, a low sun long, pale, soft ones that
   * fade into the light round them.
   */
  shadow: { strength: number; softness: number };
  /**
   * How far off the haze has taken seven tenths of all it takes, in meters,
   * and how much it takes at most: the far rim stays in sight.
   */
  hazeReach: number;
  hazeMost: number;
  /**
   * The clouds, small and fair weather: how much of the sky they cover,
   * nought to one, their colour where the light is on them, and underneath.
   */
  clouds: { cover: number; lit: Color; shade: Color };
}

/**
 * Where the sun stands, and how strongly and warmly it lights. The mill's
 * front looks north over the road, and the workshop's yard side north north
 * east: an honest sun over Dresden lights neither, for most of the year. So it
 * is set for them rather than by the almanac - turned off the mill's front by
 * `off` degrees, to fall across it at a slant and on the workshop with it - and
 * only its height is the season's: high in summer, low and warm in autumn,
 * whose long light through the haze makes the leaves glow, lowest in winter.
 * Summer's and spring's come from the morning side, autumn's and winter's from
 * the evening's.
 */
const SUN = {
  spring: { off: 40, elevation: 34, intensity: 2.3, warmth: 0 },
  summer: { off: 30, elevation: 52, intensity: 2.4, warmth: 0 },
  autumn: { off: -35, elevation: 13, intensity: 2.2, warmth: 0.35 },
  winter: { off: -30, elevation: 13, intensity: 1.8, warmth: 0.12 },
} as const;

/**
 * How high the valley's ridges stand round the mill, in degrees: the sun
 * leaves the valley floor this much before it sets and comes over them this
 * much after it rises, so evening comes earlier and morning later than the
 * almanac's - and the lights go on sooner.
 */
export const RIDGE = 8;

/** The compass bearing the mill's street front looks towards, off its footprint. */
const MILL_FRONT = once(() => {
  const mill = BUILDINGS.find(({ id }) => id === MILL_HOUSE.id);
  if (mill === undefined) {
    return 0;
  }
  // the house's local front, +z, on the plan: its long axis turned a quarter
  const { angle } = boundingRect(mill.footprint);
  return ((Math.atan2(Math.sin(angle), -Math.cos(angle)) * 180) / Math.PI + 360) % 360;
});

/**
 * The day a season is drawn on, as days into the year - the middle of spring
 * and autumn, the longest day and the shortest - and whether the clocks are
 * on summer time then.
 */
const DAY = {
  spring: { day: 110, summerTime: true },
  summer: { day: 172, summerTime: true },
  autumn: { day: 288, summerTime: true },
  winter: { day: 355, summerTime: false },
} as const;

/**
 * How much moon there is at night, nought at new moon to one at full: a
 * quarter by default - enough to make out the valley, not enough to light it.
 */
export const MOON = 0.25;

/** Dresden, for where the sun stands by the clock: its latitude and longitude. */
const PLACE = { latitude: 51.07, longitude: 13.61 } as const;

/**
 * Where the sun stands at an hour of the clock on a season's day, by the
 * almanac: its declination that day, the hour's angle off the local noon -
 * the clock runs on Central European time, an hour ahead of the sun at 15°
 * east and a little more here - and from those its height and its bearing.
 */
export function sunAt(season: Season, hour: number): { azimuth: number; elevation: number } {
  const { day, summerTime } = DAY[season];
  const rad = Math.PI / 180;
  const declination = 23.44 * Math.sin((360 / 365) * (day - 81) * rad) * rad;
  const solar = hour - (summerTime ? 2 : 1) + PLACE.longitude / 15;
  const angle = 15 * (solar - 12) * rad;
  const latitude = PLACE.latitude * rad;
  const elevation = Math.asin(
    Math.sin(latitude) * Math.sin(declination) +
      Math.cos(latitude) * Math.cos(declination) * Math.cos(angle)
  );
  const azimuth = Math.atan2(
    Math.sin(angle),
    Math.cos(angle) * Math.sin(latitude) - Math.tan(declination) * Math.cos(latitude)
  );
  return { azimuth: (azimuth / rad + 180 + 360) % 360, elevation: elevation / rad };
}

/**
 * How dark the shadows are in a season by day, before the sun's height is
 * taken in: summer's the darkest, winter's the palest - its light is weak and
 * much of it comes off the sky and the snow. And how much of that a low sun
 * keeps, and how soft they go then: most seasons' pale and soften down low,
 * but autumn's low sun is its best, clear and golden, its shadows long and
 * as dark as summer's.
 */
const SHADOW = {
  spring: { strength: 0.85, low: 0.7, soften: 2 },
  summer: { strength: 0.9, low: 0.7, soften: 2 },
  autumn: { strength: 0.95, low: 0.95, soften: 0.6 },
  winter: { strength: 0.55, low: 0.7, soften: 2 },
} as const;

/**
 * Autumn's golden hour: below this height the low sun gilds the scene - its
 * light deeper and more golden, and stronger, the fill under it dimmer so the
 * shadows stand dark against it and cool blue, and the horizon warm - the
 * more the lower it is over the ridges round the valley (`RIDGE`).
 * The other seasons only warm round sunrise and sunset.
 */
const GOLDEN = {
  spring: { reach: 0, light: 0, fill: 0, horizon: 0, more: 0, cool: 0 },
  summer: { reach: 0, light: 0, fill: 0, horizon: 0, more: 0, cool: 0 },
  autumn: { reach: 32, light: 0.75, fill: 0.6, horizon: 0.5, more: 0.75, cool: 0.45 },
  winter: { reach: 0, light: 0, fill: 0, horizon: 0, more: 0, cool: 0 },
} as const;

const smooth = (from: number, to: number, value: number) => {
  const t = Math.min(Math.max((value - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * How much of the sky the clouds cover: a few small ones in spring, fewer on
 * a summer's day, more in autumn, and a winter's sky mostly grey.
 */
const CLOUDS = { spring: 0.34, summer: 0.2, autumn: 0.42, winter: 0.55 } as const;

/** How far the haze reaches, clear in summer and misty in autumn. */
const HAZE = {
  spring: { reach: 700, most: 0.55 },
  summer: { reach: 900, most: 0.5 },
  autumn: { reach: 420, most: 0.65 },
  winter: { reach: 520, most: 0.6 },
} as const;

/**
 * The sky of a season, from the palette: set for the mill (see `SUN`) unless
 * an hour of the clock is given, and then as the almanac has it that day - the
 * sun's height lighting the day, a warm horizon round sunrise and sunset, and
 * after dark the moon opposite the sun in a night sky - as bright as `moon`
 * says, and the fill light with it.
 */
export function skyOf(palette: Palette, season: Season, hour?: number, moon: number = MOON): Sky {
  const { sky, skyDeep, light, hills, autumnGold, autumnOrange, autumnRust, snow, ground } =
    palette;
  // overhead the spray blue, paled and greyed by the season; at the horizon
  // it pales into the day's haze
  const colors = {
    // spring's the clearest blue of the year, washed by its showers
    spring: { zenith: skyDeep.clone(), horizon: light.clone().lerp(sky, 0.5) },
    summer: { zenith: skyDeep.clone(), horizon: light.clone().lerp(sky, 0.4) },
    autumn: {
      zenith: skyDeep.clone().lerp(hills, 0.3),
      horizon: light.clone().lerp(autumnGold, 0.15),
    },
    winter: { zenith: skyDeep.clone().lerp(snow, 0.45), horizon: snow.clone().lerp(hills, 0.12) },
  }[season];
  const { off, elevation: set, intensity, warmth } = SUN[season];
  const placed =
    hour === undefined
      ? { azimuth: (MILL_FRONT() + off + 360) % 360, elevation: set }
      : sunAt(season, hour);
  // how high it stands over the ridges round the valley, which is what the
  // light down in it goes by - the sun set for the mill stands over them
  const elevation = placed.elevation - (hour === undefined ? 0 : RIDGE);
  // how much day it is, and how much of a sunrise or a sunset
  const day = smooth(-6, 8, elevation);
  const dusk = smooth(-5, 1, elevation) * (1 - smooth(4, 14, elevation));
  // and how much of autumn's golden hour
  const golden = GOLDEN[season];
  const gold = golden.reach > 0 && elevation > -2 ? 1 - smooth(5, golden.reach, elevation) : 0;
  const night = {
    floor: (full: number) => 0.05 + 0.15 * full,
    zenith: ground.clone().lerp(skyDeep, 0.1 + 0.14 * moon),
    horizon: ground.clone().lerp(sky, 0.14 + 0.18 * moon),
  };
  const zenith = night.zenith.clone().lerp(colors.zenith, day);
  const horizon = night.horizon
    .clone()
    .lerp(colors.horizon, day)
    .lerp(autumnOrange.clone().lerp(light, 0.35), dusk * 0.6)
    .lerp(autumnGold.clone().lerp(autumnOrange, 0.4), gold * golden.horizon);
  const up = placed.elevation > -2;
  // the lower the sun, the warmer - and never quite gone until it is down
  const glow = warmth + (1 - smooth(0, 25, elevation)) * 0.35 + gold * golden.light;
  return {
    zenith,
    horizon,
    haze: horizon.clone(),
    sun: up
      ? {
          ...placed,
          // autumn's deepening to orange as it sinks
          color: light
            .clone()
            .lerp(
              season === 'winter'
                ? autumnRust
                : season === 'autumn'
                  ? autumnGold.clone().lerp(autumnOrange, 0.35)
                  : autumnGold,
              Math.min(glow, 0.9)
            ),
          intensity: intensity * smooth(-2, 10, placed.elevation) * (1 + gold * golden.more),
          body: 'sun',
        }
      : {
          azimuth: (placed.azimuth + 180) % 360,
          elevation: Math.min(Math.max(-placed.elevation, 12), 45),
          color: light.clone().lerp(skyDeep, 0.5),
          intensity: 0.5 * moon,
          body: 'moon',
        },
    // at night the fill is what the sky and the moon give: little
    fill: (night.floor(moon) + (1 - night.floor(moon)) * day) * (1 - gold * golden.fill),
    fillTint: new Color(1, 1, 1).lerp(skyDeep.clone().lerp(sky, 0.3), gold * golden.cool),
    day,
    shadow: up
      ? {
          // a tree must stand on its shadow: pale and soft only down low
          // down to the almanac's horizon: below the ridges the terrain's own
          // shadow takes the valley
          strength:
            SHADOW[season].strength *
            (SHADOW[season].low + (1 - SHADOW[season].low) * smooth(5, 30, elevation)),
          softness: 1 + SHADOW[season].soften * (1 - smooth(8, 35, elevation)),
        }
      : { strength: 0.35 * moon, softness: 4 },
    hazeReach: HAZE[season].reach,
    hazeMost: HAZE[season].most,
    // white where the sun is on them, and greyer underneath; dimmed with the
    // day, and as dark as the sky at night
    clouds: (() => {
      const lit = light
        .clone()
        .lerp(horizon, season === 'winter' ? 0.45 : 0.15)
        .lerp(zenith, 1 - day);
      return { cover: CLOUDS[season], lit, shade: lit.clone().lerp(hills, 0.35) };
    })(),
  };
}

/** Towards the sun, as a unit vector in the scene: y up, north at -z. */
export function sunDirection({ sun: { azimuth, elevation } }: Sky): Vector3 {
  const [phi, theta] = [(azimuth * Math.PI) / 180, (elevation * Math.PI) / 180];
  return new Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.sin(theta),
    -Math.cos(phi) * Math.cos(theta)
  );
}

/** How much haze lies between an eye and what it sees this far off: the site's scene lays the same. */
export const hazeAt = ({ hazeReach, hazeMost }: Sky, distance: number): number =>
  hazeMost * (1 - Math.exp(-((distance / hazeReach) ** 2) * 1.2));

/**
 * Whether the lights are due on at an hour of the season's day: once the sun
 * is lower than 3°. Without an hour - the sun set for the mill - it is day.
 * What the editor's switch starts from, and a view's lights unless it says.
 */
export const lightsDue = (season: Season, hour: number | undefined): boolean =>
  hour !== undefined && sunAt(season, hour).elevation < 3 + RIDGE;

/**
 * The hours of a season's day the lights are due on outside of: from when
 * they go out in the morning to when they come on in the evening, to a
 * minute - what a page picks a view of the day or of the evening by.
 */
export function daylight(season: Season): [from: number, until: number] {
  const minutes = Array.from({ length: 24 * 60 }, (_, minute) => minute / 60);
  const light = minutes.filter(hour => !lightsDue(season, hour));
  return [light[0] ?? 12, (light.at(-1) ?? 12) + 1 / 60];
}
