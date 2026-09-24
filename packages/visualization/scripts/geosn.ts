/**
 * The Saxon survey office's height models, as the scripts fetch them: the
 * DGM1, a one meter laser scan of the ground, and the DOM1, the same scan of
 * whatever stands on it - roofs and treetops. Both are free to download as two
 * kilometer GeoTIFF tiles, dl-de/by-2-0.
 *
 * The DGM1 is the reason this scene has a valley at all - the 25m models
 * average the Lotzebachtal away, putting the mill thirty meters up the slope it
 * actually stands below - and at one meter it also has the retaining walls and
 * the paths the houses sit between. The DOM1 less the DGM1 is how tall what
 * stands there is, which is where the trees come from.
 *
 * The tiles are named after the corner they start at, in kilometers of UTM 33.
 */

import { unzipSync } from 'fflate';
import { fromArrayBuffer } from 'geotiff';

type Point = [x: number, y: number];

/** Lotzebachstraße 27, 01156 Dresden - geocoded via Nominatim, way 293452398. */
export const ORIGIN = { lat: 51.0745771, lon: 13.608872 };

// meters per degree at the origin, good enough for a few hundred meters
export const METERS_PER_LAT = 111320;
export const METERS_PER_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

/** Edge length of one tile in meters, the size the survey packages them in. */
const TILE_SIZE = 2000;

/** The public shares the two models are published under. */
const SHARES = { dgm1: 'JCcXyifaNdLDnxZ', dom1: 'S6wwnFwX7882sZm' } as const;

export type SurveyModel = keyof typeof SHARES;

const tileUrl = (model: SurveyModel, east: number, north: number) =>
  `https://geocloud.landesvermessung.sachsen.de/public.php/dav/files/${SHARES[model]}/` +
  `${model}_33${east / 1000}_${north / 1000}_2_sn_tiff.zip`;

/** Local meters east and north of the origin as UTM 33 coordinates. */
export function toUtm33(x: number, y: number): Point {
  const [a, f] = [6378137, 1 / 298.257223563];
  const [k0, lon0] = [0.9996, (15 * Math.PI) / 180];
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const phi = ((ORIGIN.lat + y / METERS_PER_LAT) * Math.PI) / 180;
  const lambda = ((ORIGIN.lon + x / METERS_PER_LON) * Math.PI) / 180;

  const n = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const t = Math.tan(phi) ** 2;
  const c = ep2 * Math.cos(phi) ** 2;
  const a1 = (lambda - lon0) * Math.cos(phi);
  const m =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));

  return [
    k0 *
      n *
      (a1 +
        ((1 - t + c) * a1 ** 3) / 6 +
        ((5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * a1 ** 5) / 120) +
      500000,
    k0 *
      (m +
        n *
          Math.tan(phi) *
          (a1 ** 2 / 2 +
            ((5 - t + 9 * c + 4 * c ** 2) * a1 ** 4) / 24 +
            ((61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * a1 ** 6) / 720)),
  ];
}

interface Tile {
  east: number;
  north: number;
  heights: Float32Array;
  size: number;
}

const tiles = new Map<string, Promise<Tile>>();

/** One downloaded tile, unzipped and decoded, kept for the points that follow. */
async function loadTile(model: SurveyModel, east: number, north: number): Promise<Tile> {
  const key = `${model}/${east}/${north}`;
  const pending = tiles.get(key);
  if (pending !== undefined) {
    return pending;
  }

  const load = (async (): Promise<Tile> => {
    console.info(`tile ${key}`);
    const response = await fetch(tileUrl(model, east, north));
    if (!response.ok) {
      throw new Error(`GeoSN answered ${response.status} for ${key}`);
    }
    const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
    const [, tif] = Object.entries(archive).find(([name]) => name.endsWith('.tif')) ?? [];
    if (tif === undefined) {
      throw new Error(`no GeoTIFF in the tile ${key}`);
    }

    const image = await (await fromArrayBuffer(toArrayBuffer(tif))).getImage();
    const [raster] = await image.readRasters();
    return {
      east,
      north,
      heights: raster as unknown as Float32Array,
      size: image.getWidth(),
    };
  })();

  tiles.set(key, load);
  return load;
}

const toArrayBuffer = (data: Uint8Array) =>
  data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;

/** Height above sea level at a local point, bilinear between the laser samples. */
export function surveyModel(model: SurveyModel): (x: number, y: number) => Promise<number> {
  return async (x, y) => {
    const [east, north] = toUtm33(x, y);
    const tile = await loadTile(
      model,
      Math.floor(east / TILE_SIZE) * TILE_SIZE,
      Math.floor(north / TILE_SIZE) * TILE_SIZE
    );
    // the raster runs south at increasing rows, its first sample sitting half a
    // meter inside the tile's corner
    const column = east - tile.east - 0.5;
    const row = tile.north + TILE_SIZE - north - 0.5;
    const [c0, r0] = [Math.floor(column), Math.floor(row)];
    const [fx, fy] = [column - c0, row - r0];
    const at = (r: number, c: number) => {
      const clamped =
        Math.min(Math.max(r, 0), tile.size - 1) * tile.size +
        Math.min(Math.max(c, 0), tile.size - 1);
      return tile.heights[clamped] ?? 0;
    };

    const top = at(r0, c0) * (1 - fx) + at(r0, c0 + 1) * fx;
    const bottom = at(r0 + 1, c0) * (1 - fx) + at(r0 + 1, c0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}
