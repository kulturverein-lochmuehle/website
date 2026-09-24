import type { BrushTool, Place, Point, Season, Stroke } from '@kvlm/visualization';
import { DECORATION_KEYS } from '@kvlm/visualization';

import type { DraftCorner, EditorLayer, EditorTool } from '../../scene/editor.scene.js';

// What the editor works with, apart from how it is laid out: the camera's
// numbers, the features, the tools and their keys, the lights' switches, what
// is kept across a reload - and what each tool's work is copied out as.

/** The camera is three numbers, so the controls are built from three rows. */
export const CONTROLS = [
  // the compass has no ends, dragging past north continues at south
  { property: 'azimuth', label: 'Azimuth', min: 0, max: 360, value: 340, wraps: true },
  { property: 'elevation', label: 'Elevation', min: 5, max: 89, value: 28, wraps: false },
  { property: 'span', label: 'Span', min: 8, max: 600, value: 200, wraps: false },
] as const;

export type Property = (typeof CONTROLS)[number]['property'];

/** What can be switched off while the model is being worked on, in the order it is listed. */
export const FEATURES: { property: EditorLayer; label: string }[] = [
  { property: 'terrain', label: 'Terrain' },
  { property: 'roads', label: 'Roads' },
  { property: 'walls', label: 'Walls' },
  { property: 'decks', label: 'Decks' },
  { property: 'houses', label: 'Houses' },
  { property: 'trees', label: 'Trees' },
  { property: 'sky', label: 'Sky' },
  { property: 'particles', label: 'Particles' },
  { property: 'places', label: 'Places' },
];

/** The seasons the woods can be looked at in, in the order of the year. */
export const SEASONS: { value: Season; label: string }[] = [
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'autumn', label: 'Autumn' },
  { value: 'winter', label: 'Winter' },
];

/** An hour as the clock shows it, or the sun set for the mill. */
export const clock = (hour: number | undefined) =>
  hour === undefined
    ? 'mill'
    : `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round(hour * 60) % 60).padStart(2, '0')}`;

/** The tools, each with the key that takes it up and what it does. */
export const TOOLS: { value: EditorTool; label: string; key: string; title: string }[] = [
  { value: 'navigate', label: 'Navigate', key: 'v', title: 'a drag moves the view' },
  { value: 'brush', label: 'Brush', key: 'b', title: 'piles landfill on, or takes it off' },
  { value: 'point', label: 'Point', key: 'p', title: 'sets reference points' },
  { value: 'seam', label: 'Seam', key: 's', title: 'picks the handles a seam runs between' },
  { value: 'place', label: 'Place', key: 'a', title: 'draws a place the events use' },
];

/** What the brush does with the ground, each on a number key while it is in hand. */
export const MODES: { value: BrushTool; label: string }[] = [
  { value: 'raise', label: 'Raise' },
  { value: 'lower', label: 'Lower' },
  { value: 'flatten', label: 'Flatten' },
  { value: 'smooth', label: 'Smooth' },
];

/** The brush's reach and strength, each a slider. */
export const BRUSH = [
  { property: 'radius', label: 'Radius', min: 0.5, max: 10, step: 0.25, value: 2 },
  { property: 'strength', label: 'Strength', min: 0.05, max: 1, step: 0.05, value: 0.3 },
] as const;

/** A light left to the hour, or switched by hand. */
export type Switch = 'auto' | 'on' | 'off';

export const SWITCHES: Switch[] = ['auto', 'on', 'off'];

/** A switch as the scene takes it: none leaves it to the hour. */
export const switched = (value: Switch): boolean | undefined =>
  value === 'auto' ? undefined : value === 'on';

/**
 * The decorations that are lights and nothing else - a room lit, its door
 * open - which the lights panel switches: the rest are put up, and the
 * season's panel puts them up.
 */
export const ROOM_LIGHTS = DECORATION_KEYS.filter(tag => tag.startsWith('licht-'));
export const PUT_UP = DECORATION_KEYS.filter(tag => !tag.startsWith('licht-'));

/** The fires among what is put up, which burn unless put out. */
export const FIRES = DECORATION_KEYS.filter(tag => tag.startsWith('feuer-'));

/** The panels down the right, in their order. */
export const PANELS = [
  { key: 'view', label: 'View' },
  { key: 'features', label: 'Features' },
  { key: 'season', label: 'Season' },
  { key: 'lights', label: 'Lights' },
] as const;

export type PanelKey = (typeof PANELS)[number]['key'];

/** How wide the panels down the right may be dragged, in pixels. */
export const DOCK = { least: 220, most: 640, value: 300 };

/** Dragging with the right button turns the camera: sideways the compass, up and down the horizon. */
export const DRAG = { azimuth: 0.4, elevation: 0.3 };

/**
 * The way the camera looks, clockwise from north. Its azimuth is where it
 * stands, seen from what it looks at, so it looks the other way.
 */
export const heading = (azimuth: number) => (azimuth + 180) % 360;

/** The eight points of the compass, a heading rounded to the nearest. */
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export const cardinal = (degrees: number) => POINTS[Math.round(degrees / 45) % 8];

/** How far a wheel notch counted in lines scrolls, in pixels. */
export const LINE_HEIGHT = 16;

/** How many steps back undo goes. */
export const HISTORY = 200;

export type Placed = [x: number, y: number, level: number];

/** A handle as the viewport reports it picked. */
export interface Handle {
  index: number;
  /** Its name, which the source refers to it by: the number is only today's. */
  key: string;
  at: [x: number, y: number];
  level: number;
  edge: string;
}

export interface Picked {
  trace: number[];
  seams: number[][];
  handles: Handle[];
}

/** The place being drawn: what it is called and said to be, and its corners round it. */
export interface Draft {
  key: string;
  title: string;
  where: string;
  kind: Place['kind'];
  level: number | undefined;
  corners: DraftCorner[];
}

export const EMPTY_DRAFT: Draft = {
  key: '',
  title: '',
  where: '',
  kind: 'area',
  level: undefined,
  corners: [],
};

/** What undo takes back: the work of every tool, as it was before a step. */
export interface Step {
  strokes: Stroke[];
  drags: number[];
  points: Placed[];
  picks: string;
  draft: Draft;
}

/**
 * The editor survives a reload with the view it was left in, which is what
 * makes it usable while the model is being worked on. Session storage, not
 * local: a second tab is a second view, and closing it forgets.
 */
export const STORED = {
  camera: 'kvlm-editor-camera',
  brush: 'kvlm-editor-brush',
  points: 'kvlm-editor-points',
  place: 'kvlm-editor-place',
  layout: 'kvlm-editor-layout',
} as const;

export const load = <T extends object>(key: string): Partial<T> => {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? '{}') as Partial<T>;
  } catch {
    return {};
  }
};

export const save = (key: string, value: unknown): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // a private window may refuse to store - the editor still works
  }
};

/** What was picked, ready to be pasted back into the source. */
export function seamSource({ trace, seams, handles }: Picked): string {
  if (handles.length === 0) {
    return '// nothing picked';
  }
  const numbers = (path: number[]) => path.map(index => index + 1).join(', ');
  return [
    seams.length === 0
      ? '// no seam closed yet'
      : `const SEAMS = [\n${seams.map(seam => `  [${numbers(seam)}],`).join('\n')}\n];`,
    ...(trace.length === 0 ? [] : [`// open: ${numbers(trace)}`]),
    // and each as the coordinates it is written into the source with, for
    // SEAMS or KEPT - FILLS and RAILINGS take the names
    ...seams.map(seam =>
      [
        `// ${numbers(seam)}`,
        '[',
        ...seam.flatMap(index => {
          const handle = handles.find(one => one.index === index);
          return handle === undefined
            ? []
            : [`  [${handle.at[0].toFixed(4)}, ${handle.at[1].toFixed(4)}, '${handle.edge}'],`];
        }),
        '],',
      ].join('\n')
    ),
    ...[...handles]
      .sort((one, other) => one.index - other.index)
      .map(
        ({ index, key, at, edge }) =>
          `// ${String(index + 1).padStart(3)}  ${edge.padEnd(4)}  ` +
          `${at[0].toFixed(2)}, ${at[1].toFixed(2)}  '${key}'`
      ),
  ].join('\n');
}

/** What is copied is meant to go straight into brushes.ts in @kvlm/visualization. */
export function strokesSource(strokes: Stroke[]): string {
  const lines = strokes.map(
    stroke =>
      `  [${stroke.map(part => (typeof part === 'string' ? `'${part}'` : String(part))).join(', ')}],`
  );
  return ['export const BRUSHES: Stroke[] = [', ...lines, '];'].join('\n');
}

/** And this into points.ts in @kvlm/visualization. */
export function pointsSource(points: Placed[]): string {
  return [
    'export const POINTS: [x: number, y: number, level: number][] = [',
    ...points.map(([x, y, level]) => `  [${x}, ${y}, ${level}],`),
    '];',
  ].join('\n');
}

/** A string as the source writes one: single quotes, unless it holds one. */
const quoted = (text: string) =>
  text.includes("'") ? `"${text.replaceAll('"', '\\"')}"` : `'${text}'`;

/** And this into PLACES in places.ts: one entry, its corners as handles by name or points. */
export function placeSource({ key, title, where, kind, level, corners }: Draft): string {
  const corner = (one: DraftCorner) =>
    typeof one === 'string' ? quoted(one) : `[${one[0]}, ${one[1]}]`;
  return [
    `  ${quoted(key === '' ? 'new-place' : key)}: {`,
    `    title: ${quoted(title)},`,
    `    where: ${quoted(where)},`,
    `    kind: '${kind}',`,
    `    outline: [${corners.map(corner).join(', ')}],`,
    ...(level === undefined ? [] : [`    level: ${level},`]),
    '  },',
  ].join('\n');
}

/** A place's corners on the plan, a handle's where it stands. */
export const cornerPoint = (corner: DraftCorner, handleAt: (key: string) => Point | undefined) =>
  typeof corner === 'string' ? handleAt(corner) : corner;
