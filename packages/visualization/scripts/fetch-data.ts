/**
 * Fetches everything the `kvlm-houses` scene is built from and writes it as a
 * plain data module. The scene must not talk to any API at runtime: the area
 * around the Lochmühle changes about as often as the mill itself, and a map
 * that waits for two third party services is a map nobody sees.
 *
 * Run with `bun run data:fetch`.
 *
 * Sources:
 * - OpenStreetMap via Overpass (buildings, brook, ways, woodland) - ODbL
 * - DGM1 via the height WMS of the Landesamt für Geobasisinformation Sachsen
 *   (terrain heights, 1m laser scan grid) - dl-de/by-2-0
 */

import { writeFile } from 'node:fs/promises';

import { METERS_PER_LAT, METERS_PER_LON, ORIGIN, surveyModel } from './geosn.js';

/** The ground the terrain is sampled from: the survey's one meter laser scan. */
const elevationAt = surveyModel('dgm1');

/** Edge length of the sampled terrain square in meters. */
const TERRAIN_SIZE = 640;

/** Samples per terrain axis, 129 puts one every 5 meters. */
const TERRAIN_RESOLUTION = 129;

/**
 * The yard is sampled again, on its own, at the resolution the DGM1 actually
 * has: ten meter samples average a retaining wall away, and the houses here are
 * cut into the hillside with walls and paths that are narrower than that.
 */
const YARD_SIZE = 160;

/** One sample per meter across that square, which is the survey's own grid. */
const YARD_STEP = 1;

/** Radius in meters around the origin that is kept from the OSM data. */
const CLIP_RADIUS = 340;

/** Only buildings this close to the origin belong to the Lochmühle itself. */
const BUILDING_RADIUS = 90;

/**
 * The only two ways the scene shows: the road through the valley and the lane
 * past the mill. Every other track and path around them is left out, they would
 * draw a net over the woods without saying anything about the place.
 *
 * A way is named, and the road changes its name on the way up the valley: the
 * Lotzebachstraße becomes the Talstraße at the bend north of the mill. Both
 * belong to the same road here, or the data stops at the bend and the scene is
 * left to guess where the carriageway goes.
 */
const ROADS = {
  Lotzebachstraße: { main: true, width: 5, names: ['Lotzebachstraße', 'Talstraße'] },
  Lochmühlenweg: { main: false, width: 3, names: ['Lochmühlenweg'] },
} as const;

const OUTPUT = new URL('../src/data/data.ts', import.meta.url);

type Point = [x: number, y: number];

interface OverpassElement {
  type: string;
  id: number;
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

/** Projects WGS84 onto a local meter grid, x pointing east, y pointing north. */
const project = ({ lat, lon }: { lat: number; lon: number }): Point => [
  (lon - ORIGIN.lon) * METERS_PER_LON,
  (lat - ORIGIN.lat) * METERS_PER_LAT,
];

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

const distance = ([x, y]: Point) => Math.hypot(x, y);

/** Drops points that add less than `tolerance` to a polyline (Douglas-Peucker). */
function simplify(points: Point[], tolerance = 1.5): Point[] {
  if (points.length < 3) {
    return points;
  }
  const [first] = points as [Point];
  const last = points[points.length - 1] as Point;
  const [ax, ay] = first;
  const [bx, by] = last;
  const length = Math.hypot(bx - ax, by - ay);

  let index = 0;
  let maxDistance = 0;
  points.slice(1, -1).forEach(([x, y], offset) => {
    const deviation =
      length === 0
        ? Math.hypot(x - ax, y - ay)
        : Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / length;
    if (deviation > maxDistance) {
      [maxDistance, index] = [deviation, offset + 1];
    }
  });

  if (maxDistance <= tolerance) {
    return [first, last];
  }
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

/** Cuts a polyline into the pieces that run inside the clip radius. */
function clip(points: Point[]): Point[][] {
  return points.reduce<Point[][]>((segments, point) => {
    const current = segments[segments.length - 1];
    if (distance(point) > CLIP_RADIUS) {
      return current?.length ? [...segments, []] : segments;
    }
    if (current === undefined) {
      return [[point]];
    }
    return [...segments.slice(0, -1), [...current, point]];
  }, []);
}

const near = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5;

/**
 * Joins polylines that share an end into one run. OpenStreetMap splits the
 * Lotzebach wherever a tag changes - every culvert under the road ends one way
 * and starts the next - and the brook has to come out of it in one piece.
 */
function chain(lines: Point[][]): Point[][] {
  return lines.reduce<Point[][]>((runs, line) => {
    const head = line[0] as Point;
    const tail = line[line.length - 1] as Point;
    const match = runs.find(run => {
      const start = run[0] as Point;
      const end = run[run.length - 1] as Point;
      return near(end, head) || near(end, tail) || near(start, head) || near(start, tail);
    });
    if (match === undefined) {
      return [...runs, [...line]];
    }

    const start = match[0] as Point;
    const end = match[match.length - 1] as Point;
    const joined = near(end, head)
      ? [...match, ...line.slice(1)]
      : near(end, tail)
        ? [...match, ...[...line].reverse().slice(1)]
        : near(start, head)
          ? [...[...line].reverse(), ...match.slice(1)]
          : [...line, ...match.slice(1)];
    // a run that grew can now reach another one, so the whole set is folded again
    return chain([...runs.filter(run => run !== match), joined]);
  }, []);
}

async function fetchOverpass(): Promise<OverpassElement[]> {
  const query = `
    [out:json][timeout:90];
    (
      way["building"](around:${BUILDING_RADIUS},${ORIGIN.lat},${ORIGIN.lon});
      way["waterway"](around:${CLIP_RADIUS},${ORIGIN.lat},${ORIGIN.lon});
      way["highway"](around:${CLIP_RADIUS},${ORIGIN.lat},${ORIGIN.lon});
      way["landuse"="forest"](around:${CLIP_RADIUS},${ORIGIN.lat},${ORIGIN.lon});
      way["natural"="wood"](around:${CLIP_RADIUS},${ORIGIN.lat},${ORIGIN.lon});
    );
    out geom tags;
  `;
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
  });
  if (!response.ok) {
    throw new Error(`Overpass answered ${response.status}`);
  }
  const { elements } = (await response.json()) as { elements: OverpassElement[] };
  return elements;
}

/** A square grid of heights, row major from south to north and west to east. */
async function sampleElevations(
  [cx, cy]: Point,
  size: number,
  resolution: number
): Promise<number[]> {
  const step = size / (resolution - 1);
  const heights: number[] = [];
  for (let index = 0; index < resolution ** 2; index += 1) {
    const x = cx - size / 2 + step * (index % resolution);
    const y = cy - size / 2 + step * Math.floor(index / resolution);
    heights.push(await elevationAt(x, y));
  }
  return heights;
}

const serialize = (points: Point[]) =>
  `[${points.map(([x, y]) => `[${round(x)}, ${round(y)}]`).join(', ')}]`;

const [elements, elevations] = await Promise.all([
  fetchOverpass(),
  sampleElevations([0, 0], TERRAIN_SIZE, TERRAIN_RESOLUTION),
]);

const buildings = elements
  .filter(({ tags }) => tags?.['building'] !== undefined)
  // OSM closes its ways by repeating the first node, the scene does not need it
  .map(({ id, tags, geometry = [] }) => ({
    id,
    name: tags?.['name'],
    housenumber: tags?.['addr:housenumber'],
    footprint: geometry.slice(0, -1).map(project),
  }))
  .filter(({ footprint }) => footprint.every(point => distance(point) < BUILDING_RADIUS));

// the dense patch is laid around the buildings, not around the origin: what has
// to be right is the ground they stand in
const corners = buildings.flatMap(({ footprint }) => footprint);
const yard: Point = [
  corners.reduce((sum, [x]) => sum + x, 0) / corners.length,
  corners.reduce((sum, [, y]) => sum + y, 0) / corners.length,
];
const yardResolution = YARD_SIZE / YARD_STEP + 1;
const yardElevations = await sampleElevations(yard, YARD_SIZE, yardResolution);

/**
 * Where the drawn course of the brook has been measured against the orthophoto
 * and found wanting. OpenStreetMap traces a waterway by eye, and by the mill it
 * runs some two meters north of the channel: the offset is measured there,
 * pushed square to the line, held over the near stretch and faded out by the
 * reach given.
 */
const BROOK_FIXES = [{ at: [25, 19.4] as Point, holds: 15, reach: 45, shift: 2.4 }];

/** Moves a run sideways where it was measured to be off, leaving the rest. */
function corrected(points: Point[]): Point[] {
  return points.map(([x, y], index): Point => {
    const [px, py] = points[Math.max(index - 1, 0)] as Point;
    const [nx, ny] = points[Math.min(index + 1, points.length - 1)] as Point;
    const length = Math.hypot(nx - px, ny - py) || 1;
    const [ox, oy] = [-(ny - py) / length, (nx - px) / length];
    const shift = BROOK_FIXES.reduce((sum, fix) => {
      const away = Math.hypot(x - fix.at[0], y - fix.at[1]);
      const fade = Math.min(Math.max((away - fix.holds) / (fix.reach - fix.holds), 0), 1);
      return sum + fix.shift * (1 - fade * fade * (3 - 2 * fade));
    }, 0);
    return [x + ox * shift, y + oy * shift];
  });
}

// culverts included: under the road the brook is still the brook. Of the runs
// that come out of it only the longest is kept - that one is the Lotzebach,
// the rest are the ditches feeding it
const [brook] = chain(
  elements
    .filter(({ tags }) => tags?.['waterway'] !== undefined)
    .map(({ geometry = [] }) => geometry.map(project))
)
  .flatMap(clip)
  .map(points => simplify(points, 1))
  .map(corrected)
  .filter(points => points.length > 1)
  .sort((a, b) => b.length - a.length);

// each road is chained before it is cut, the same way the brook is: OSM splits
// a road wherever its tags change, and the scene wants one run per road
const ways = Object.values(ROADS).flatMap(({ main, width, names }) =>
  chain(
    elements
      .filter(({ tags }) => {
        const name = tags?.['name'];
        return name !== undefined && (names as readonly string[]).includes(name);
      })
      .map(({ geometry = [] }) => geometry.map(project))
  )
    .flatMap(clip)
    .map(points => ({ main, width, points: simplify(points, 1) }))
    .filter(({ points }) => points.length > 1)
);

const woods = elements
  .filter(({ tags }) => tags?.['landuse'] === 'forest' || tags?.['natural'] === 'wood')
  .map(({ geometry = [] }) => geometry.map(project))
  // the outlines stay whole, clipping them open would let the trees run out
  .filter(points => points.some(point => distance(point) < CLIP_RADIUS))
  .map(points => simplify(points, 3))
  .filter(points => points.length > 2);

const contents = `// Generated by scripts/fetch-data.ts - do not edit by hand.
//
// Buildings, brook, ways and woodland: © OpenStreetMap contributors, ODbL.
// Terrain heights: DGM1, © Landesamt für Geobasisinformation Sachsen, dl-de/by-2-0.
//
// All coordinates are meters on a local grid around ${ORIGIN.lat}, ${ORIGIN.lon}
// (Lotzebachstraße 27, 01156 Dresden), x pointing east and y pointing north.

export type Point = [x: number, y: number];

export interface BuildingData {
  /** OSM way id, the key the scene hangs its height estimates on. */
  id: number;
  name?: string;
  housenumber?: string;
  /** Outline in counter clockwise order, without the repeated closing point. */
  footprint: Point[];
}

export interface WayData {
  /** The road through the valley, drawn over everything else it crosses. */
  main: boolean;
  /** Constant along the whole run, the scene draws a road, not a survey. */
  width: number;
  points: Point[];
}

export const ORIGIN = { lat: ${ORIGIN.lat}, lon: ${ORIGIN.lon} } as const;

/**
 * Terrain heights in meters above sea level (DHHN2016), row major from south to
 * north and west to east, one sample every ${TERRAIN_SIZE / (TERRAIN_RESOLUTION - 1)}m
 * across a ${TERRAIN_SIZE}m square centered on the origin.
 */
export const TERRAIN = {
  size: ${TERRAIN_SIZE},
  resolution: ${TERRAIN_RESOLUTION},
  elevations: [
${Array.from(
  { length: TERRAIN_RESOLUTION },
  (_, row) =>
    `    ${elevations
      .slice(row * TERRAIN_RESOLUTION, (row + 1) * TERRAIN_RESOLUTION)
      .map(elevation => round(elevation))
      .join(', ')},`
).join('\n')}
  ],
} as const;

/**
 * The same ground again around the buildings, one sample per meter: the paths,
 * the retaining walls and the bank cut behind the houses are all narrower than
 * a coarse sample, and the scene reads this grid wherever a point falls in it.
 */
export const YARD_TERRAIN = {
  center: [${round(yard[0])}, ${round(yard[1])}] as Point,
  size: ${YARD_SIZE},
  resolution: ${yardResolution},
  elevations: [
${Array.from(
  { length: yardResolution },
  (_, row) =>
    `    ${yardElevations
      .slice(row * yardResolution, (row + 1) * yardResolution)
      .map(elevation => round(elevation))
      .join(', ')},`
).join('\n')}
  ],
} as const;

export const BUILDINGS: BuildingData[] = [
${buildings
  .map(({ id, name, housenumber, footprint }) =>
    [
      '  {',
      `    id: ${id},`,
      ...(name === undefined ? [] : [`    name: '${name}',`]),
      ...(housenumber === undefined ? [] : [`    housenumber: '${housenumber}',`]),
      `    footprint: ${serialize(footprint)},`,
      '  },',
    ].join('\n')
  )
  .join('\n')}
];

/** The Lotzebach, joined across the culverts OSM splits it at. */
export const BROOK: Point[] = ${serialize(brook ?? [])};

export const WAYS: WayData[] = [
${ways
  .map(
    ({ main, width, points }) =>
      `  { main: ${main}, width: ${width}, points: ${serialize(points)} },`
  )
  .join('\n')}
];

/** Outlines of the woodland around the mill, the scene scatters its trees in them. */
export const WOODS: Point[][] = [
${woods.map(points => `  ${serialize(points)},`).join('\n')}
];
`;

await writeFile(OUTPUT, contents);
console.info(
  `wrote ${buildings.length} buildings, a brook of ${brook?.length ?? 0} points, ` +
    `${ways.length} way segments and ${woods.length} woodland outlines`
);
