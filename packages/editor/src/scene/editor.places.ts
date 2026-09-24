import type { Place, PlaceKey, Point } from '@kvlm/visualization';
import {
  DRAWN_GROUND,
  heightAt,
  pickByKey,
  PLACE_KEYS,
  placeOutline,
  PLACES,
  SunShadow,
} from '@kvlm/visualization';
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  ShapeUtils,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
} from 'three';

// The places the events use, laid over the ground to be looked at: each area
// filled in a colour of its own with its outline round it, each spot a circle,
// and each named. Debug only - what is still to be drawn on the bench shows
// nothing. Worked out off the page's thread (`placesLaid`, in the overlays'
// worker) and only drawn on it (`createPlaces`).

/** How far over the ground the overlay is laid, and how finely an edge follows it. */
const OVER = 0.08;
const STEP = 0.5;

/** How far round a point the surface under it is looked at, in meters. */
const NEAR = 0.1;

/** How high a label stands on the ground, in meters. */
const LABEL = 0.35;

/** A spot's circle: how wide, and in how many pieces. */
const SPOT = { radius: 0.6, pieces: 32 };

/** A place as it is laid, ready to be drawn: its fill, its outline and where its name goes. */
export interface PlaceLaid {
  key: PlaceKey;
  index: number;
  /** Three numbers a corner, in scene space - the fill's and the outline's alike. */
  positions: Float32Array;
  triangles: Uint32Array;
  label: [number, number, number];
}

/** A colour of its own for each place, spread round the wheel. */
const colorOf = (index: number): Color => new Color().setHSL((index * 0.618034) % 1, 0.75, 0.5);

/** The height at a point of the plan. */
type Surface = (point: Point) => number;

/**
 * The height of whatever is uppermost at a point of the plan - the ground, a
 * road, a deck - off the surfaces' triangles, nine numbers each in scene
 * space, drawn once onto a grid seen from above.
 */
function surfaceOf(triangles: Float32Array): Surface {
  const top = new SunShadow(new Vector3(0, 1, 0), triangles);
  const at = new Vector3();
  // looked at a hand's breadth round the point too, and the highest taken: a
  // corner on the road's edge or a wall's end is where one surface stops and
  // the one under it goes on, and read there alone it took the lower - or
  // none, where the ground is cut away under the road
  const round: Point[] = [
    [0, 0],
    [NEAR, 0],
    [-NEAR, 0],
    [0, NEAR],
    [0, -NEAR],
  ];
  return ([x, y]) => {
    const hits = round.flatMap(([dx, dy]) => top.nearestOver(at.set(x + dx, 0, -(y + dy))) ?? []);
    return hits.length > 0 ? Math.max(...hits) : (DRAWN_GROUND()(x, y) ?? heightAt(x, y));
  };
}

/** The middle of an area, by its own area - or of its corners, for a spot. */
function centreOf(ring: Point[]): Point {
  const twice = ring.reduce((sum, [x, y], step) => {
    const [nx, ny] = ring[(step + 1) % ring.length] as Point;
    return sum + (x * ny - nx * y);
  }, 0);
  if (ring.length < 3 || Math.abs(twice) < 1e-9) {
    return ring
      .reduce<Point>(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0])
      .map(sum => sum / ring.length) as Point;
  }
  return ring
    .reduce<Point>(
      ([sx, sy], [x, y], step) => {
        const [nx, ny] = ring[(step + 1) % ring.length] as Point;
        const cross = x * ny - nx * y;
        return [sx + (x + nx) * cross, sy + (y + ny) * cross];
      },
      [0, 0]
    )
    .map(sum => sum / (3 * twice)) as Point;
}

/** A ring on the plan made fine enough to lie on the ground between its corners. */
function dense(ring: Point[]): Point[] {
  return ring.flatMap(([ax, ay], step) => {
    const [bx, by] = ring[(step + 1) % ring.length] as Point;
    const pieces = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / STEP));
    return Array.from({ length: pieces }, (_, piece): Point => {
      const t = piece / pieces;
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    });
  });
}

/** One place laid out: its ring on the surface under it, filled, and where its name goes. */
function laid(key: PlaceKey, index: number, uppermost: Surface): PlaceLaid | undefined {
  const outline = placeOutline(key);
  if (outline === undefined) {
    return undefined;
  }
  // a room's floor, or all its handles at one height - a terrace's top - it
  // lies flat at it, over the steps cut into it; else on what is uppermost
  const { outline: corners, level, kind } = PLACES[key] as Place;
  const levels = corners.flatMap(corner =>
    typeof corner === 'string' ? (pickByKey(corner)?.level ?? []) : []
  );
  const flat =
    level ??
    (levels.length > 1 && Math.max(...levels) - Math.min(...levels) < 0.01
      ? (levels[0] as number)
      : undefined);
  const surface: Surface = flat === undefined ? uppermost : () => flat;
  // the label at the middle of the area, not of its corners: a side traced
  // round many handles - the pillar stairs' - drew it off to that side
  const middle = centreOf(outline);
  const ring =
    kind === 'spot'
      ? Array.from({ length: SPOT.pieces }, (_, piece): Point => {
          const turn = (piece / SPOT.pieces) * Math.PI * 2;
          return [
            middle[0] + Math.cos(turn) * SPOT.radius,
            middle[1] + Math.sin(turn) * SPOT.radius,
          ];
        })
      : dense(outline);
  return {
    key,
    index,
    positions: Float32Array.from(
      ring.flatMap(point => [point[0], surface(point) + OVER, -point[1]])
    ),
    triangles: Uint32Array.from(
      ShapeUtils.triangulateShape(
        ring.map(([x, y]) => new Vector2(x, y)),
        []
      ).flat()
    ),
    label: [middle[0], surface(middle) + OVER + LABEL, -middle[1]],
  };
}

/** Every place drawn so far laid out, on the surfaces' triangles given. */
export function placesLaid(
  triangles: Float32Array,
  progress?: (share: number, step: string) => void
): PlaceLaid[] {
  // the surfaces drawn from above first, a tenth of the way; then a place at a time
  progress?.(0, 'the surfaces');
  const surface = surfaceOf(triangles);
  return PLACE_KEYS.flatMap((key, index) => {
    progress?.(0.1 + (0.9 * index) / PLACE_KEYS.length, key);
    return laid(key, index, surface) ?? [];
  });
}

/** A label on a sprite: the place's key, in its colour. */
function label(text: string, color: Color): Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const font = 'bold 28px sans-serif';
  if (context !== null) {
    context.font = font;
    canvas.width = Math.ceil(context.measureText(text).width) + 24;
    canvas.height = 44;
    context.font = font;
    context.fillStyle = `#${color.getHexString()}`;
    context.beginPath();
    context.roundRect(0, 0, canvas.width, canvas.height, 10);
    context.fill();
    // dark on a light colour, white on a dark one
    const { r, g, b } = color;
    context.fillStyle = 0.299 * r + 0.587 * g + 0.114 * b > 0.55 ? '#1a1a1a' : '#ffffff';
    context.textBaseline = 'middle';
    context.fillText(text, 12, canvas.height / 2 + 1);
  }
  const sprite = new Sprite(
    new SpriteMaterial({ map: new CanvasTexture(canvas), depthTest: false, transparent: true })
  );
  // meters on the ground, a third of one high: the labels stay the size the
  // places are, and small ones are not covered by their own name
  sprite.scale.set((canvas.width / 44) * LABEL, LABEL, 1);
  sprite.renderOrder = 24;
  return sprite;
}

/** The places as laid out, drawn: filled and outlined, each in its colour, and named. */
export function createPlaces(places: PlaceLaid[]): Group {
  const group = new Group();
  group.name = 'places';
  places.forEach(({ key, index, positions, triangles, label: at }) => {
    const color = colorOf(index);
    const place = new Group();
    place.name = `place:${key}`;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setIndex(Array.from(triangles));
    const fill = new Mesh(
      geometry,
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
      })
    );
    fill.renderOrder = 22;
    const edge = new BufferGeometry();
    edge.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const outline = new LineLoop(
      edge,
      new LineBasicMaterial({ color, depthTest: false, transparent: true })
    );
    outline.renderOrder = 23;
    const name = label(key, color);
    name.position.set(...at);
    place.add(fill, outline, name);
    group.add(place);
  });
  return group;
}
