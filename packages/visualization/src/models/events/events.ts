import type { Decoration } from '../decorations/decorations.js';
import type { PlaceKey } from '../places/places.js';
import type { Season } from '../terrain/trees.js';

/**
 * A kind of event held at the mill, the same each time it comes round: known
 * by its name - in the chronicle's title, or the calendar's summary - and set
 * up once here, where it is held and what is put up for it. Its predecessors
 * go by names of their own and are held as it is. A scene of one is lit at
 * its start, in its season - its own, or the one its date falls in, for what
 * is held all the year round.
 */
export interface EventType {
  /** What the site calls it. */
  title: string;
  /** The names it goes by, its predecessors' too: the whole of one, so a meeting to prepare it does not pass for it. */
  names: RegExp;
  /** The season it is held in, if always the same one: otherwise its date's. */
  season?: Season;
  /** The hour it usually starts at, where its entry does not say. */
  hour: number;
  /** Where it is held. */
  places: readonly PlaceKey[];
  /** What is put up for it. */
  decorations: readonly Decoration[];
}

export const EVENT_TYPES = {
  // nearly every month, in the Vereinsraum and before it, round the fire
  // before the lean-to's door - in whatever season it falls: no benches,
  // which stood between the fire and whoever looked at it
  feierabend: {
    title: 'Feierabend an der Lochmühle',
    names: /^feierabend\b/i,
    hour: 18,
    places: ['werkstatt-vereinsraum', 'werkstatt-vorplatz', 'feuer-werkstatt'],
    decorations: ['licht-vereinsraum', 'feuer-werkstatt'],
  },
  // dancing in the hall, the bar, the grill and the fire before it
  fruehlingsfatsche: {
    title: 'Frühlingsfatsche',
    names: /^fr(ü|ue)hlings(fatsche|konzert)$/i,
    season: 'spring',
    hour: 18,
    places: [
      'werkstatt-saal',
      'werkstatt-buehne',
      'werkstatt-vorplatz',
      'feuer-werkstatt',
      'bar-werkstatt',
      'grill-werkstatt',
    ],
    decorations: [
      'licht-werkstatt',
      'feuer-werkstatt',
      'bar-werkstatt',
      'grill-werkstatt',
      'buehne-werkstatt',
      'baenke-werkstatt-vorplatz',
    ],
  },
  // the mill's front, its terrace and the pavilion's, into the evening
  sommerfestival: {
    title: 'SOMMERFESTival',
    // the calendar spelt it with one m, once
    names: /^(somm?erfest(ival)?|m(ü|ue)hle,? markt & musik)$/i,
    season: 'summer',
    hour: 15,
    places: ['muehle-vorplatz', 'terrasse-muehle', 'terrasse-pavillon', 'strasse-muehle'],
    decorations: [
      'lichterkette-gelaender',
      'feuer-terrasse',
      'baenke-muehle-vorplatz',
      'baenke-terrasse-pavillon',
    ],
  },
  // at dusk, the mill's terrace its window, and the A-hut in its lights
  adventskalender: {
    title: 'Lebendiger Adventskalender',
    names: /^lebendiger adventskalender$/i,
    season: 'winter',
    hour: 16.5,
    places: ['terrasse-muehle', 'muehle-vorplatz'],
    decorations: ['lichterkette-gelaender', 'weihnacht-hexenhaus'],
  },
} as const satisfies Record<string, EventType>;

export type EventTypeKey = keyof typeof EVENT_TYPES;

export const EVENT_TYPE_KEYS = Object.keys(EVENT_TYPES) as EventTypeKey[];

/** The kind of event a name is of, if any is known by it. */
export function eventTypeOf(name: string): EventTypeKey | undefined {
  return EVENT_TYPE_KEYS.find(key => EVENT_TYPES[key].names.test(name));
}

/** An event as its scene is set up: of its kind, in its season, at its hour. */
export interface EventSetting {
  type: EventTypeKey;
  season: Season;
  hour: number;
  places: readonly PlaceKey[];
  decorations: readonly Decoration[];
}

/**
 * The season a day falls in, by the months: winter from December, spring from
 * March, and so on - as the weather has it, not the sky.
 */
export function seasonOf(month: number): Season {
  const seasons: Season[] = ['winter', 'spring', 'summer', 'autumn'];
  return seasons[Math.floor((month % 12) / 3)] ?? 'winter';
}

/**
 * How an event of a kind is set up: its month, one to twelve, for the season
 * where it has none of its own, and its start where known - the hour, with
 * its minutes as a fraction.
 */
export function eventSetting(type: EventTypeKey, month: number, hour?: number): EventSetting {
  const { season, hour: usual, places, decorations } = EVENT_TYPES[type] as EventType;
  return {
    type,
    season: season ?? seasonOf(month),
    hour: hour ?? usual,
    places,
    decorations,
  };
}

/**
 * The start an event's text gives, in hours: the first time of the clock in
 * it - "Ab 18:00 Uhr", "16.30 Uhr" - or nothing where it gives none.
 */
export function startIn(text: string): number | undefined {
  const found = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*Uhr/.exec(text);
  return found === null ? undefined : Number(found[1]) + Number(found[2]) / 60;
}
