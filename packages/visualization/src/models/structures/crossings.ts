import type { Point } from '../../data/data.js';
import { alongLine, crossings, nearestOn, offsetLine } from '../../utils/geometry.utils.js';
import { YARD_CENTER } from '../buildings/footprint.js';
import {
  BROOK_BANKS,
  BROOK_LINE,
  CORRIDORS,
  ROAD_WALL,
  WAY_KERBS,
  WAY_RUNS,
} from '../terrain/ground.js';
import type { Corridor } from '../terrain/terrain.field.js';
import { DECK_CORNER, distanceToYard, ROAD_WALL_VERGE, ROADS } from '../terrain/terrain.field.js';
import {
  alongKerb,
  alongLines,
  BANK_WALL_OVER,
  bankRuns,
  CROSSING_ON,
  CROSSING_REACH,
  CULVERT_REACH,
  DECK_ACUTE,
  DECK_OFF,
  DECK_OUTLINE,
  DECK_WIDE,
  FAR_BANK_ALONG,
  follow,
} from './measures.js';

/**
 * The two crossings of the brook and the mill's deck, set out from numbered points on the bands' own edges.
 */
/**
 * The two banks of the brook where the deck stands over it, each turned to run
 * away from the corner of the plate it ties into. They are set out here rather
 * than where they are drawn, so that the points they start and end at can be
 * numbered with the rest.
 */
export const DECK_BANKS = (() => {
  const index = ROADS.findIndex(({ main }) => main);
  const road = CORRIDORS[index] as Corridor;
  const brook = CORRIDORS[CORRIDORS.length - 1] as Corridor;
  const half = (ROADS[index] as (typeof ROADS)[number]).width / 2;
  const edges = [half, -half].map(distance => offsetLine(road.points, distance));
  const at = crossings(brook.points, road.points)
    .map(({ at: point }) => point)
    .sort(
      (a, b) =>
        Math.hypot(a[0] - DECK_CORNER[0], a[1] - DECK_CORNER[1]) -
        Math.hypot(b[0] - DECK_CORNER[0], b[1] - DECK_CORNER[1])
    )[0];
  if (at === undefined) {
    return { at: undefined, near: [] as Point[], far: [] as Point[] };
  }

  const runs = bankRuns(BROOK_BANKS, edges, at);
  const away = (point: Point | undefined, [cx, cy]: Point) =>
    point === undefined ? Infinity : Math.hypot(point[0] - cx, point[1] - cy);
  // the near bank is the one the road's own wall starts from
  const nearest = runs
    .map((run, step) => ({
      step,
      distance: Math.min(away(run[0], DECK_CORNER), away(run[run.length - 1], DECK_CORNER)),
    }))
    .sort((a, b) => a.distance - b.distance)[0];
  const facing = (run: Point[], corner: Point) =>
    away(run[0], corner) > away(run[run.length - 1], corner) ? [...run].reverse() : run;

  return {
    at,
    // each runs away from the corner it is hung on: the near bank from the acute
    // corner behind the road wall, the far one from the corner opposite it
    near: facing(runs[nearest?.step === 1 ? 1 : 0] as Point[], DECK_ACUTE),
    far: facing(runs[nearest?.step === 1 ? 0 : 1] as Point[], DECK_WIDE),
  };
})();

/**
 * The points the deck and the walls around it are set out from, in the order
 * they are numbered: the plate's own corners, the kerb its edge runs into, and
 * the two the strip along the road ends at. Everything drawn here reads them,
 * so moving one moves the plate and its walls together.
 */
/**
 * Where the brook has drawn far enough away from the road for a wall to stand
 * between them. Walking the road's edge from the bank tie towards the wall's
 * far end, the two lines start all but touching and open out: this is the point
 * on the water's side where the gap first measures the wall's own width.
 */
const BROOK_AT_VERGE: Point[] = (() => {
  const wall = ROAD_WALL;
  if (wall === undefined || wall.kerb.length < 2) {
    return [];
  }
  const kerb = wall.kerb;
  const bank = BROOK_BANKS.map(line => ({
    line,
    away: nearestOn(line, (kerb[0] as Point)[0], (kerb[0] as Point)[1]).distance,
  })).sort((one, other) => one.away - other.away)[0];
  if (bank === undefined) {
    return [];
  }

  const found = kerb.reduce<{ last?: { away: number; on: Point }; at?: Point }>((walk, point) => {
    if (walk.at !== undefined) {
      return walk;
    }
    const near = nearestOn(bank.line, point[0], point[1]);
    const step = { away: near.distance, on: near.at };
    const before = walk.last;
    if (
      before === undefined ||
      (before.away - ROAD_WALL_VERGE) * (step.away - ROAD_WALL_VERGE) >= 0
    ) {
      return { last: step };
    }
    // between the two, where the gap is exactly the wall's width
    const share = (ROAD_WALL_VERGE - before.away) / (step.away - before.away);
    return {
      last: step,
      at: [
        before.on[0] + (step.on[0] - before.on[0]) * share,
        before.on[1] + (step.on[1] - before.on[1]) * share,
      ] as Point,
    };
  }, {});

  if (found.at === undefined) {
    return [];
  }

  // found against the wall's own line, which is drawn off the road's middle,
  // it stood 0.456m off the band's own edge, which the deck is set out along:
  // carried square to the road onto that line instead. Walked on along the
  // bank to where it is that far off, it would move 2.2m and take the walls
  // with it
  return [outFromRoad(onKerb(found.at), ROAD_WALL_VERGE)];
})();

/**
 * The carriageway's own edges beside the two corners that stand closest to it,
 * and the far edge opposite the first of them: a crossing is set out from where
 * the road runs as much as from where the water does.
 */
const ROAD_AT_CORNERS: Point[] = (() => {
  const index = ROADS.findIndex(({ main }) => main);
  const road = CORRIDORS[index];
  const way = ROADS[index];
  const [one, other] = [DECK_OUTLINE[3], DECK_OUTLINE[4]];
  if (road === undefined || way === undefined || one === undefined || other === undefined) {
    return [];
  }

  const half = way.width / 2;
  const kerbs = [half, -half].map(distance => offsetLine(road.points, distance));
  const sorted = (point: Point) =>
    kerbs
      .map(kerb => nearestOn(kerb, point[0], point[1]))
      .sort((near, far) => near.distance - far.distance);

  const [nearOne, farOne] = sorted(one);
  const [nearOther] = sorted(other);
  return [nearOne?.at, nearOther?.at, farOne?.at].filter((at): at is Point => at !== undefined);
})();

/**
 * That end, moved along the road's own direction towards the corner the plate
 * reaches out to: it stands where the bank was cut, which is square to the
 * water, and the wall wants it carried on under the carriageway.
 */
const FAR_BANK_END: Point[] = (() => {
  const index = ROADS.findIndex(({ main }) => main);
  const road = CORRIDORS[index];
  const end = DECK_BANKS.far[0];
  const towards = DECK_OUTLINE[3];
  if (road === undefined || end === undefined || towards === undefined) {
    return end === undefined ? [] : [end];
  }
  const { heading } = nearestOn(road.points, end[0], end[1]);
  const length = Math.hypot(heading[0], heading[1]) || 1;
  const step: Point = [
    (heading[0] / length) * FAR_BANK_ALONG,
    (heading[1] / length) * FAR_BANK_ALONG,
  ];
  const away = (point: Point) => Math.hypot(point[0] - towards[0], point[1] - towards[1]);
  const [one, other]: Point[] = [
    [end[0] + step[0], end[1] + step[1]],
    [end[0] - step[0], end[1] - step[1]],
  ];
  return [away(one as Point) < away(other as Point) ? (one as Point) : (other as Point)];
})();

/** The edge of the road a point stands by. */
export function onRoadSide([x, y]: Point): Point[] | undefined {
  return WAY_KERBS.filter(({ main }) => main)
    .map(({ points }) => points)
    .sort((one, other) => nearestOn(one, x, y).distance - nearestOn(other, x, y).distance)[0];
}

/** A point taken onto the road's own edge where it is nearest. */
function onKerb([x, y]: Point): Point {
  const kerb = WAY_KERBS.filter(({ main }) => main)
    .map(({ points }) => points)
    .sort((one, other) => nearestOn(one, x, y).distance - nearestOn(other, x, y).distance)[0];
  return kerb === undefined ? [x, y] : nearestOn(kerb, x, y).at;
}

/**
 * A point carried out square to the road from another, on the side away from
 * it: what a wing wall is, and what keeps a wall from ending flush under the
 * carriageway's own edge.
 */
export function outFromRoad(point: Point, by: number): Point {
  const index = ROADS.findIndex(({ main }) => main);
  const road = CORRIDORS[index];
  if (road === undefined) {
    return point;
  }
  const { heading } = nearestOn(road.points, point[0], point[1]);
  const length = Math.hypot(heading[0], heading[1]) || 1;
  const [nx, ny] = [(-heading[1] / length) * by, (heading[0] / length) * by];
  const middle = (at: Point) => nearestOn(road.points, at[0], at[1]).distance;
  const [one, other]: Point[] = [
    [point[0] + nx, point[1] + ny],
    [point[0] - nx, point[1] - ny],
  ];
  return middle(one as Point) > middle(other as Point) ? (one as Point) : (other as Point);
}

/** Where each bank of the brook passes under the edge of the carriageway. */
const BANKS_AT_ROAD: Point[] = (() => {
  const index = ROADS.findIndex(({ main }) => main);
  const road = CORRIDORS[index];
  const way = ROADS[index];
  if (road === undefined || way === undefined) {
    return [];
  }
  const half = way.width / 2;
  const kerbs = [half, -half].map(distance => offsetLine(road.points, distance));
  return [DECK_BANKS.near, DECK_BANKS.far]
    .filter(run => run.length > 1)
    .flatMap(run => kerbs.flatMap(kerb => crossings(run, kerb).map(({ at }) => at)));
})();

export const DECK_MARKS: Point[] = [
  ...DECK_OUTLINE,
  ...(ROAD_WALL === undefined
    ? []
    : [
        ROAD_WALL.kerb[ROAD_WALL.kerb.length - 1] as Point,
        ROAD_WALL.face[ROAD_WALL.face.length - 1] as Point,
      ]),
  // and where each bank under the plate ties into it: the end the near one
  // comes to, and the end the far one starts from
  ...(DECK_BANKS.near.length < 2 ? [] : [DECK_BANKS.near[DECK_BANKS.near.length - 1] as Point]),
  // and where the brook first stands the wall's own width off the road
  ...BROOK_AT_VERGE,
  ...ROAD_AT_CORNERS,
  // the culvert's own corners: the far bank's outer end, and where each bank
  // passes under the edge of the carriageway
  ...FAR_BANK_END,
  ...BANKS_AT_ROAD,
  // and the two of those carried a wing's width out from the road - from the
  // band's own edge, which the second stood 0.291m off when carried from
  // where it was
  ...[BANKS_AT_ROAD[0], FAR_BANK_END[0]]
    .filter((point): point is Point => point !== undefined)
    .map(point => outFromRoad(onKerb(point), BANK_WALL_OVER)),
];

/**
 * The two walls of the crossing at the mill, each set out from the numbered
 * points and following a line of its own between them: the first runs from the
 * road wall's far end down its own face, takes up the brook's near bank where
 * the two meet, and turns out to the carriageway; the second runs along the
 * plate's landward side and out to the road's edge past the far corner.
 */
const DECK_WALLS: Point[][] = (() => {
  const index = ROADS.findIndex(({ main }) => main);
  const road = CORRIDORS[index];
  const way = ROADS[index];
  const wall = ROAD_WALL;
  if (road === undefined || way === undefined || wall === undefined) {
    return [];
  }

  const mark = (step: number) => DECK_MARKS[step];
  // the marks in the order they were set down, named by what they are
  const [nose, corner] = [mark(0), mark(1)];
  const [plateFar, plateNear] = [mark(3), mark(4)];
  const [kerbEnd, faceEnd] = [mark(5), mark(6)];
  const [tie, verge] = [mark(7), mark(8)];
  const [roadByFar, roadByNear] = [mark(9), mark(10)];
  const [farEnd, nearUnder] = [mark(12), mark(13)];
  const [nearOut, farOut] = [mark(16), mark(17)];
  const named = [
    nose,
    corner,
    plateFar,
    kerbEnd,
    faceEnd,
    tie,
    verge,
    roadByFar,
    roadByNear,
    farEnd,
    nearUnder,
    nearOut,
    farOut,
    plateNear,
  ];
  if (named.some(point => point === undefined)) {
    return [];
  }

  // the road's edge carried out a wing's width, which the far corners stand on
  const half = way.width / 2;
  const outer = [half + BANK_WALL_OVER, -(half + BANK_WALL_OVER)]
    .map(distance => offsetLine(road.points, distance))
    .sort(
      (one, other) =>
        nearestOn(one, (farOut as Point)[0], (farOut as Point)[1]).distance -
        nearestOn(other, (farOut as Point)[0], (farOut as Point)[1]).distance
    )[0] as Point[];

  const one: Point[] = [
    kerbEnd as Point,
    faceEnd as Point,
    // along the wall's width off the band's own edge, the line the deck and the
    // footway behind it are set out on: along the wall's first line, drawn off
    // the road's middle, it stood up to 4cm aside and its foot 1cm over them
    ...follow(
      kerbOut(onRoadSide(faceEnd as Point), ROAD_WALL_VERGE),
      faceEnd as Point,
      verge as Point
    ),
    verge as Point,
    tie as Point,
    ...follow(DECK_BANKS.near, tie as Point, nearUnder as Point),
    nearUnder as Point,
    nearOut as Point,
    plateNear as Point,
    roadByNear as Point,
  ];

  const other: Point[] = [
    corner as Point,
    nose as Point,
    farEnd as Point,
    farOut as Point,
    ...follow(outer, farOut as Point, plateFar as Point),
    plateFar as Point,
    roadByFar as Point,
  ];

  return [one, other];
})();

export const CULVERT = (() => {
  const index = ROADS.findIndex(({ main }) => main);
  const road = CORRIDORS[index] as Corridor;
  const brook = CORRIDORS[CORRIDORS.length - 1] as Corridor;
  const roadHalf = (ROADS[index] as (typeof ROADS)[number]).width / 2;
  const edges = [roadHalf, -roadHalf].map(distance => offsetLine(road.points, distance));
  const banks = BROOK_BANKS;

  const away = ([ax, ay]: Point, [bx, by]: Point) => Math.hypot(ax - bx, ay - by);

  // every place the road runs over the brook is walled the same way, and the
  // road crosses it more than once down the valley. Only the one at the mill is
  // decked, and there the two bank walls are part of something bigger. The
  // nearest one first, and none of the ones out at the rim: those are crossings
  // the survey never looked at, and a wall thrown across one is a wall across
  // the hillside
  const crossed = crossings(brook.points, road.points);
  const elsewhere = crossed
    .filter(({ at }) => DECK_BANKS.at === undefined || away(at, DECK_BANKS.at) > 1)
    .filter(({ at }) => away(at, YARD_CENTER) < CULVERT_REACH)
    .sort((one, other) => away(one.at, YARD_CENTER) - away(other.at, YARD_CENTER));
  const loose = elsewhere
    .flatMap(({ at }) => bankRuns(banks, edges, at))
    .filter(run => run.length > 1);
  const ends = (run: Point[]) => [run[0] as Point, run[run.length - 1] as Point];

  /**
   * A point carried along the edge of the road it stands on. A distance given
   * the other way round carries it towards the crossing instead of away.
   */
  const stepped = (point: Point, by: number): Point[] => {
    const middle = elsewhere[0]?.at;
    const edge = edges
      .map(line => nearestOn(line, point[0], point[1]))
      .sort((a, b) => a.distance - b.distance)[0];
    if (middle === undefined || edge === undefined) {
      return [];
    }
    const [hx, hy] = edge.heading;
    const length = Math.hypot(hx, hy) / Math.abs(by) || 1;
    const forth: Point = [point[0] + hx / length, point[1] + hy / length];
    const back: Point = [point[0] - hx / length, point[1] - hy / length];
    const [out, home] = away(forth, middle) > away(back, middle) ? [forth, back] : [back, forth];
    return [by < 0 ? home : out];
  };

  /** And one carried out square to that edge, on the side away from the road. */
  const aside = (point: Point, by: number): Point[] => {
    const edge = edges
      .map(line => nearestOn(line, point[0], point[1]))
      .sort((a, b) => a.distance - b.distance)[0];
    if (edge === undefined) {
      return [];
    }
    const [hx, hy] = edge.heading;
    const length = Math.hypot(hx, hy) || 1;
    const out: Point = [point[0] - (hy / length) * by, point[1] + (hx / length) * by];
    const back: Point = [point[0] + (hy / length) * by, point[1] - (hx / length) * by];
    const middle = (side: Point) => nearestOn(road.points, side[0], side[1]).distance;
    return [middle(out) > middle(back) ? out : back];
  };

  /** A wing of the wall: so far along the road from an end of it, then out. */
  const wing = (point: Point | undefined, by: number): Point[] => {
    const along = point === undefined ? [] : stepped(point, by);
    const head = along[0];
    return head === undefined ? along : [...along, ...aside(head, BANK_WALL_OVER)];
  };

  const [, second] = ends(loose[0] ?? []);
  const [third] = ends(loose[1] ?? []);
  const [ninth] = wing(second, 2);
  const [fifteenth] = wing(third, 5);

  // the second crossing's own walls and plate went the way the mill's did: set
  // out while the brook and the seam were still being worked out, half of what
  // went into them was wrong. It is set out again from its points in CROSSING
  return {
    runs: DECK_WALLS.filter(line => line.length > 1),
    // the points all of it is set out from, in the order they were numbered:
    // none of its own any more, the second crossing's are set out with it
    marks: [] as Point[],
    // where the second crossing's two wings reach the road, as they were first
    // found - set out again on the road's own edge with the rest of it
    wings: [ninth, fifteenth].filter((point): point is Point => point !== undefined),
  };
})();

/** A kerb carried out off the road by a distance, on the side away from it. */
export function kerbOut(kerb: Point[] | undefined, by: number): Point[] {
  const road = WAY_RUNS.find(({ main }) => main)?.points ?? [];
  if (kerb === undefined || road.length < 2) {
    return [];
  }
  const middle = (at: Point) => nearestOn(road, at[0], at[1]).distance;
  return (
    [by, -by]
      .map(side => offsetLine(kerb, side))
      .sort(
        (one, other) =>
          middle(other[Math.floor(other.length / 2)] as Point) -
          middle(one[Math.floor(one.length / 2)] as Point)
      )[0] ?? []
  );
}

/**
 * The points the second crossing is set out from again: where each bank of the
 * brook passes under an edge of the road, and beside each the point where that
 * bank has come a wing's width off the road. The second is walked along the
 * bank rather than carried out square to the kerb, since the wall that ends
 * there stands in the water: carried square, it would end off the bank the
 * crossing is skew to.
 */
export const CROSSING: { marks: Point[]; walls: Point[][]; plate: Point[] } = (() => {
  const road = WAY_RUNS.find(({ main }) => main);
  const kerbs = WAY_KERBS.filter(({ main }) => main).map(({ points }) => points);
  if (road === undefined) {
    return { marks: [], walls: [], plate: [] };
  }
  // the crossing named by where it is: the nearest to the yard that is not
  // the mill's, and not one out at the rim the survey never looked at
  const centre = crossings(BROOK_LINE, road.points)
    .map(({ at }) => at)
    .filter(
      at =>
        DECK_BANKS.at === undefined ||
        Math.hypot(at[0] - DECK_BANKS.at[0], at[1] - DECK_BANKS.at[1]) > 1
    )
    .filter(at => distanceToYard(at) < CULVERT_REACH)
    .sort((one, other) => distanceToYard(one) - distanceToYard(other))[0];
  if (centre === undefined) {
    return { marks: [], walls: [], plate: [] };
  }
  const middle = (at: Point) => nearestOn(road.points, at[0], at[1]).distance;

  const passes = BROOK_BANKS.flatMap(bank =>
    kerbs.flatMap(kerb =>
      crossings(bank, kerb)
        .filter(({ at }) => Math.hypot(at[0] - centre[0], at[1] - centre[1]) < CROSSING_REACH)
        .map(({ at, along }) => {
          // away from the road is the way the bank leaves the carriageway
          const off = (by: number) => nearestOn(kerb, ...alongLine(bank, along + by)).distance;
          const out =
            middle(alongLine(bank, along + 0.5)) > middle(alongLine(bank, along - 0.5)) ? 1 : -1;
          // stepped out a quarter of a piece of the bank at a time until it is
          // past the width, then halved down onto it
          const far = Array.from({ length: 40 }, (_, step) => (step + 1) * 0.25).find(
            by => off(by * out) >= BANK_WALL_OVER
          );
          if (far === undefined) {
            return { at, bank, kerb, marks: [at] };
          }
          const [near, beyond] = Array.from({ length: 60 }).reduce<[number, number]>(
            ([low, high]) => {
              const half = (low + high) / 2;
              return off(half * out) < BANK_WALL_OVER ? [half, high] : [low, half];
            },
            [far - 0.25, far]
          );
          return {
            at,
            bank,
            kerb,
            marks: [at, alongLine(bank, along + ((near + beyond) / 2) * out)],
          };
        })
    )
  );

  /**
   * And where the wall along each kerb turns off: a meter on from where the
   * water passes under the kerb, away from the crossing - up the road on the
   * south-western kerb, down it on the north-eastern - with its pair a wing's
   * width off the road square to it.
   */
  const [south, north] = [...kerbs].sort(
    (one, other) =>
      one.reduce((sum, [, y]) => sum + y, 0) / one.length -
      other.reduce((sum, [, y]) => sum + y, 0) / other.length
  );
  const turning = (kerb: Point[] | undefined, northwards: boolean) => {
    // the pass nearest the way it turns off to, so the meter leads away from
    // the crossing rather than into it
    const from = passes
      .filter(pass => pass.kerb === kerb)
      .sort((one, other) => (northwards ? other.at[1] - one.at[1] : one.at[1] - other.at[1]))[0];
    if (kerb === undefined || from === undefined) {
      return undefined;
    }
    const point = alongKerb(kerb, from.at, CROSSING_ON, northwards);
    return { from, marks: [point, outFromRoad(point, BANK_WALL_OVER)] as [Point, Point] };
  };
  const [upward, downward] = [turning(south, true), turning(north, false)];

  /**
   * The two walls, each a run of the lines the points were set out on: along
   * the road a wing's width off its kerb, and along the water on its bank - in,
   * under the road and out again. The first bank is the one the wall up the
   * road turns off from, the second the one the wall down it does.
   */
  const [southOut, northOut] = [kerbOut(south, BANK_WALL_OVER), kerbOut(north, BANK_WALL_OVER)];
  const passOf = (bank: Point[] | undefined, kerb: Point[] | undefined) =>
    passes.find(pass => pass.bank === bank && pass.kerb === kerb);
  const [firstBank, secondBank] = [upward?.from.bank, downward?.from.bank];

  /**
   * The wings the crossing kept from before, set out again on the road's own
   * edge: each taken onto the kerb it stands by, and its pair a wing's width
   * off it square to the road, as the other pairs are. They had been set out
   * against a line drawn off the road's middle, a pair 0.3m apart but not 0.3m
   * off the kerb the rest of the crossing is set out on: 41 stood 0.204m off
   * it, 37 0.325m and 35 2.5cm off the kerb it was to be on.
   */
  const wings = CULVERT.wings.flatMap(at => {
    const kerb = [...kerbs].sort(
      (one, other) =>
        nearestOn(one, at[0], at[1]).distance - nearestOn(other, at[0], at[1]).distance
    )[0];
    if (kerb === undefined) {
      return [];
    }
    const on = nearestOn(kerb, at[0], at[1]).at;
    return [[on, outFromRoad(on, BANK_WALL_OVER)] as [Point, Point]];
  });
  const nearest = (to: Point | undefined, among: Point[]) =>
    to === undefined
      ? undefined
      : [...among].sort(
          (one, other) =>
            Math.hypot(one[0] - to[0], one[1] - to[1]) -
            Math.hypot(other[0] - to[0], other[1] - to[1])
        )[0];

  const [one, other] = [passOf(secondBank, south), passOf(secondBank, north)];
  const [three, four] = [passOf(firstBank, south), passOf(firstBank, north)];
  // each wall ends at the wing nearest the bank it runs along
  const wingBy = (to: Point | undefined) => {
    const out = nearest(
      to,
      wings.map(([, off]) => off)
    );
    return wings.find(([, off]) => off === out);
  };
  const [kerbside, start] = wingBy(one?.marks[1]) ?? [];
  const [close, finish] = wingBy(four?.marks[1]) ?? [];

  const walls = [
    // from the kerb down the valley out to the wing, along the outside of the
    // road, in along the second bank, under the road, out again, and along
    // the road to the wall's turning down it and back in to the kerb
    alongLines([
      [kerbside, []],
      [start, southOut],
      [one?.marks[1], secondBank ?? []],
      [one?.at, secondBank ?? []],
      [other?.at, secondBank ?? []],
      [other?.marks[1], northOut],
      [downward?.marks[1], []],
      [downward?.marks[0], []],
    ]),
    // from the turning up the road, along the outside of it to the first bank,
    // in along it, under the road, out, and along the road to the wing past it
    alongLines([
      [upward?.marks[0], []],
      [upward?.marks[1], southOut],
      [three?.marks[1], firstBank ?? []],
      [three?.at, firstBank ?? []],
      [four?.at, firstBank ?? []],
      [four?.marks[1], northOut],
      [finish, []],
      [close, []],
    ]),
  ].filter(wall => wall.length > 1);

  /**
   * The plate the road is carried over the water on: along the outside of
   * both kerbs a wing's width off them, past the walls, and straight across the
   * road at either end where the walls turn off it. It covers the carriageway
   * and the strips between the kerbs and the walls, which are cut out of the
   * ground to be covered by it.
   */
  const [far, near] = [wingBy(one?.marks[1]), wingBy(four?.marks[1])];
  const plate = alongLines(
    [
      [far?.[1], []],
      [far?.[0], []],
      [downward?.marks[0], []],
      [downward?.marks[1], northOut],
      [other?.marks[1], northOut],
      [four?.marks[1], northOut],
      [near?.[1], []],
      [near?.[0], []],
      [upward?.marks[0], []],
      [upward?.marks[1], southOut],
      [three?.marks[1], southOut],
      [one?.marks[1], southOut],
    ],
    true
  );

  return {
    plate,
    marks: [
      ...wings.flat(),
      ...passes.flatMap(({ marks }) => marks),
      ...(upward?.marks ?? []),
      ...(downward?.marks ?? []),
    ],
    walls,
  };
})();

/** The points the second crossing is set out from, in the order they are numbered. */
export const CROSSING_MARKS = CROSSING.marks;

/**
 * Two more points the mill's deck is set out from: straight across the road
 * from the road wall's end, on the far kerb, and on the line from the plate's
 * far corner by the road back to the corner the lane comes up to, where it has
 * come `DECK_OFF` off the road. Numbered after everything else, so that the
 * rest keep theirs.
 */
export const MILL_MARKS: Point[] = (() => {
  const road = WAY_RUNS.find(({ main }) => main);
  const kerbs = WAY_KERBS.filter(({ main }) => main).map(({ points }) => points);
  const [wallEnd, lane, corner] = [DECK_MARKS[5], DECK_MARKS[2], DECK_MARKS[11]];
  if (road === undefined || wallEnd === undefined || lane === undefined || corner === undefined) {
    return [];
  }
  const offRoad = ([x, y]: Point) => Math.min(...kerbs.map(kerb => nearestOn(kerb, x, y).distance));

  // across: square to the road where the wall ends, onto the kerb it is not on
  const { heading } = nearestOn(road.points, wallEnd[0], wallEnd[1]);
  const length = Math.hypot(heading[0], heading[1]) || 1;
  const [nx, ny] = [(-heading[1] / length) * 20, (heading[0] / length) * 20];
  const far = [...kerbs].sort(
    (one, other) =>
      nearestOn(other, wallEnd[0], wallEnd[1]).distance -
      nearestOn(one, wallEnd[0], wallEnd[1]).distance
  )[0];
  const across = crossings(
    [
      [wallEnd[0] - nx, wallEnd[1] - ny],
      [wallEnd[0] + nx, wallEnd[1] + ny],
    ],
    far ?? []
  )
    .map(({ at }) => at)
    .sort(
      (one, other) =>
        Math.hypot(one[0] - wallEnd[0], one[1] - wallEnd[1]) -
        Math.hypot(other[0] - wallEnd[0], other[1] - wallEnd[1])
    )[0];

  // and beside the far corner: along towards the lane's corner until the line
  // is that far off the road, stepped out and halved down onto it
  const toward = (share: number): Point => [
    corner[0] + (lane[0] - corner[0]) * share,
    corner[1] + (lane[1] - corner[1]) * share,
  ];
  const step = 0.005;
  const past = Array.from({ length: 200 }, (_, at) => (at + 1) * step).find(
    share => offRoad(toward(share)) >= DECK_OFF
  );
  const beside =
    past === undefined
      ? undefined
      : toward(
          Array.from({ length: 60 })
            .reduce<[number, number]>(
              ([low, high]) => {
                const half = (low + high) / 2;
                return offRoad(toward(half)) < DECK_OFF ? [half, high] : [low, half];
              },
              [past - step, past]
            )
            .reduce((sum, end) => sum + end / 2, 0)
        );

  return [across, beside].filter((point): point is Point => point !== undefined);
})();

/**
 * The half of the mill's deck the road runs over, as a ring through its
 * points: across the road at the road wall's end, out along the wall's face
 * the wall's width off the road, round the far corner and across the road
 * there, back along the far side a wing's width off it past the lane's side,
 * and in along the kerb to where it started.
 */
export const MILL_ROAD_DECK: Point[] = (() => {
  const kerbs = WAY_KERBS.filter(({ main }) => main).map(({ points }) => points);
  const mark = (step: number) => DECK_MARKS[step];
  const [across, beside] = [MILL_MARKS[0], MILL_MARKS[1]];
  const [wallEnd, faceEnd, verge] = [mark(5), mark(6), mark(8)];
  const [corner, cornerFar, plateFar] = [mark(11), mark(9), mark(3)];
  const [farOut, nearOut, plateNear, kerbNear] = [mark(17), mark(16), mark(4), mark(10)];
  const kerbOf = (at: Point | undefined) =>
    at === undefined
      ? undefined
      : [...kerbs].sort(
          (one, other) =>
            nearestOn(one, at[0], at[1]).distance - nearestOn(other, at[0], at[1]).distance
        )[0];
  // the wall's side of the road and the lane's
  const [wallSide, laneSide] = [kerbOf(wallEnd), kerbOf(kerbNear)];
  const [face, wing] = [kerbOut(wallSide, ROAD_WALL_VERGE), kerbOut(laneSide, BANK_WALL_OVER)];
  return alongLines(
    [
      [across, []],
      [wallEnd, []],
      [faceEnd, face],
      [verge, face],
      [beside, []],
      [corner, []],
      [cornerFar, []],
      [plateFar, wing],
      [farOut, wing],
      [nearOut, wing],
      [plateNear, []],
      [kerbNear, laneSide ?? []],
    ],
    true
  );
})();

/**
 * And the half beside it, where the lane comes in: from the wall's face along
 * the road wall's corner to the plate's nose and the corner the lane comes up
 * to, along the lane's own end, on to the lane's other corner and back along
 * the wall's width off the road - the line the road's half runs along too, so
 * the two meet on it.
 */
export const MILL_SIDE_DECK: Point[] = (() => {
  const mark = (step: number) => DECK_MARKS[step];
  const [verge, nose, corner, lane] = [mark(8), mark(0), mark(1), mark(2)];
  const beside = MILL_MARKS[1];
  // the lane's band ends on the deck, and its two corners there are the ends
  // of its kerbs nearest the deck's corners
  const ends = WAY_KERBS.filter(({ main }) => !main).flatMap(({ points }) => [
    points[0] as Point,
    points[points.length - 1] as Point,
  ]);
  const nearest = (to: Point | undefined) =>
    to === undefined
      ? undefined
      : [...ends].sort(
          (one, other) =>
            Math.hypot(one[0] - to[0], one[1] - to[1]) -
            Math.hypot(other[0] - to[0], other[1] - to[1])
        )[0];
  const face = kerbOut(verge === undefined ? undefined : onRoadSide(verge), ROAD_WALL_VERGE);
  return alongLines(
    [
      [verge, []],
      [nose, []],
      [corner, []],
      [nearest(corner), []],
      [nearest(lane), []],
      [lane, []],
      [beside, face],
    ],
    true
  );
})();
