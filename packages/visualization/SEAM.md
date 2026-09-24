# The seam, and the bench for working on it

The terrain is a radial mesh sampled from the laser scan. The road, the lane,
the brook, the two crossings and their walls are built from their own lines and
their own heights. Nothing makes the two agree: the ground runs where the scan
says, the structures run where the survey says, and between them the road floats
over a hollow or a hillside stands through a carriageway.

The **seam** is the contract between them - every line the ground has to be held
to, cut into a network a triangulation can carry, with a height for each point.
Cut the terrain to that and the two meet along a line instead of passing through
each other.

The terrain is cut to that network: `buildTerrain()` hands every point and edge
of it to the triangulation, with the rings of the field around them, and the
ground meets every kerb, bank, bed and wall foot on the network's own points.
The rest of this document is mostly about the tooling for drawing the contract.

## What you are looking at

Open the bench, switch the **Seam** layer on, and four things are drawn:

| Drawn                     | What it is                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Magenta lines, washed out | The **network**: every line the ground could be held to, already cut at every crossing so no two lines meet anywhere but at a shared point |
| Numbered dots             | The **handles**: the points a seam may be pinned to                                                                                        |
| Red dashes                | The **trace**: the path being picked, still open                                                                                           |
| Solid red                 | A **seam**: a trace that was closed into a ring                                                                                            |

Handles carry their own number and a colour that says which edge they sit on:

- **red** - the top edge of a wall, where it is topped out at the carriageway
- **blue** - its foot, where it goes into the ground
- **amber** - a way's own surface: where a carriageway ends, where a wall crosses
  it, and where two ways cross each other
- **teal-blue** - the brook's banks, at the height its water stands
- **deep blue** - its bed, under them. A road is held **up** to, a bed is held
  **down** to: it never asks the ground to rise, or a channel the valley already
  cut deeper would be filled back in. The banks do stand at the water's surface,
  0.17m to 0.81m over the ground as the field has it - that is the bank itself,
  the ground rising to meet the water rather than the brook floating over it
- **green** while being traced, **teal** once part of a closed seam

The dots sit exactly on the edges they name, not above them. A wall's red dot is
on its arris, its blue dot on the line where it enters the ground.

## Working the bench

The bench is the editor, an app of its own in `packages/editor`:

```sh
bun run --filter @kvlm/editor dev    # or bun run dev in the repo root, for all
```

Then <http://localhost:5173/>.

- **Drag** moves the view across the valley, the ground following the pointer;
  a **right button drag** turns the camera; **wheel** zooms. With a tool in
  hand, **shift** puts it down for as long as it is held - a drag moves the
  view and a click picks a handle as with none; a drag already begun goes on
  as it began.
- **Click a handle** to add it to the trace. Click it again to let it go.
- **Click the first handle again** to close the trace into a seam. It turns
  solid and the next click starts a new one.
- **Click a closed seam's line** to take it up again for editing. It only does
  that with nothing else half drawn.
- **copy** puts the readout on the clipboard, **clear** throws it all away.
- **Terrain** takes the ground away, which is how a structure standing in it is
  looked at: the walls and plates are built, the ground is not, and whichever of
  the two is in the way can go. **Walls** and **Decks** do the same for the
  crossings' walls and plates, and **Roads** takes the brook along with the ways,
  since both are laid on the ground rather than built.

The camera, the walked centre, the layer switches and everything picked survive a
reload. It is session storage, so a second tab is a second bench.

The trace follows the **edges between** the handles rather than hopping straight:
first along a line both handles sit on, else through the network, and straight
across when there is no way at all or only one more than `ROUTE_DETOUR` times the
distance round - the two banks at the brook's end are 2.4m apart and joined
through the network by a way 668m long. Its height is read off the edges at
every step - a leg from a wall top to a wall foot walks down the wall face, a leg
along the road rides the carriageway over every bend of the valley.

## The readout

The panel on the right prints what to paste back:

```ts
const SEAMS = [[3, 18, 44, 9]];
// open: 61, 62
//   3  top   19.17, 15.30
//   9  foot  20.90,  8.81
//  18  foot  24.08, 19.55
//  44  road  27.90, 20.80
```

Under that, every closed seam again as the coordinates it is written into the
source with - `[x, y, 'edge']` a line - ready for `SEAMS` or `KEPT`.

The numbers are handle numbers, one based, counted afresh every time: they
are positions in `SEAM_PICKS`, so adding a corner or a way renumbers everything
after it. They are for saying which handle on the bench, today. What the
source refers to a handle by is its name (`key`), which stays whatever it is
numbered and wherever it is moved: the list it comes from and its name there
(`stairs:u-corner:top`), its place in a list of survey marks (`deck:3:foot`)
or of the points set on the bench (`point:7`), or, for one worked out where two
lines cross, where that is, to the centimeter (`road:27.91,21.72`). The readout
gives each picked handle's name after its coordinates; the dumps (`FILLS`) and
the railings (`RAILINGS`) are written down by name. The coordinates are what a
seam is written with (`SEAMS`, `KEPT`).

## Where it lives

Everything below is in `packages/visualization/src`, in the module the list
of modules under the table gives; what is marked _editor_ is in
`packages/editor/src`.

| Thing                               | Name                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The kerbs of every way              | `WAY_KERBS`                                                                                                |
| The banks and bed of the brook      | `WATER_EDGES`                                                                                              |
| The lines every wall is drawn along | `CULVERT.runs`, `CULVERT.marks`, `DECK_MARKS`                                                              |
| The network                         | `SEAM` (points, edges, heights, walls), from `MODEL_LINES` through `planarise()`                           |
| The seams traced and agreed         | `SEAMS` (coordinates), `TRACED`, `tracedSeams()`                                                           |
| The network the ground holds        | `CUT`: the model's lines and the traced seams together; `HELD`: that, without what lies inside kept ground |
| Ground kept, not cut                | `KEPT`, `KEEPS`                                                                                            |
| Its debug drawing                   | `seamNetwork()`; _editor_ `createSeam()` in `editor.overlays.ts`                                           |
| The handles                         | `SEAM_PICKS`, `pickByKey()`; _editor_ `createPicks()`, `markPicks()`                                       |
| The height of each edge             | `LEVEL_OF`                                                                                                 |
| The ground cut to the network       | `buildTerrain()`                                                                                           |
| The ground as the scene gets it     | `createTerrain()`, from `terrain.baked.ts`                                                                 |
| The bake                            | `scripts/bake-terrain.ts`, `npm run data:terrain`                                                          |
| The traced seams                    | `pathOf()`, `tracked()`; _editor_ `createTrace()`, `markTrace()`                                           |
| Picking and hovering                | _editor_ `EditorScene.pickAt()`, `hoverAt()`, `setPicked()` in `editor.scene.ts`                           |
| The dumps                           | `FILLS` (handle names), `FILLED`, `createFills()`                                                          |
| The ground a brush piles onto       | `LANDFILL_GROUND`: the terrain as baked and the dumps, whichever is higher                                 |
| Reference points                    | `POINTS` in `points.ts`; handles of their own (`point`), fixed heights in `FILLED`                         |
| Setting them                        | _editor_ `EditorScene.setPoints()`, `surfaceUnder()`                                                       |
| The brushes                         | `Landfill`, `createLandfill()` in `landfill.ts`; the strokes in `brushes.ts` (`BRUSHES`)                   |
| Brushing                            | `HousesScene.setStrokes()`; _editor_ `EditorScene.addStrokes()`, `groundUnder()`, `showBrush()`            |
| The editor itself                   | _editor_ `editor.component.ts` (panels), `viewport.component.ts` (tools), `editor.scene.ts`                |

The model's modules, each importing only from those above it - the one knot
of lines that shape the ground, which cannot be pulled apart, is `models/terrain/ground.ts`.
The data they are built from is in `data/`, the buildings in `models/buildings/`, the
scene in `scene/` and the bake of the site's views in `bake/`:

| Module                            | What it holds                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `utils/geometry.utils.ts`         | plane geometry: lines, rings, distances, `once`                                      |
| `models/terrain/terrain.field.ts` | the height field, the yard, the ways' corridors, the rim                             |
| `models/structures/measures.ts`   | the measures things are set out by (`STAIRS`, `RAIL`, …), the seam's types, `SEAMS`  |
| `models/terrain/surfaces.ts`      | bands laid over the ground, the slabs of the decks, the layers they stack in         |
| `models/terrain/terrain.drawn.ts` | the baked terrain unpacked (`DRAWN_GROUND`), tinted                                  |
| `models/terrain/ground.ts`        | heights, brook, ways, road wall and terrace, the water's edges, `LEVEL_OF`, `eased`  |
| `models/structures/crossings.ts`  | the two crossings and the mill's deck, from their numbered points                    |
| `models/structures/stairs.ts`     | the stairs, the walls beside them, the pillar stairs (`STAIRS_PLAN`, `STAIRS_MARKS`) |
| `models/seam/seam.ts`             | the network, `SEAM_PICKS`, tracing, the traced seams, `CUT`, `HELD`                  |
| `models/structures/decks.ts`      | the decks and plates over the crossings, the walls under them                        |
| `models/seam/fills.ts`            | the dumps (`FILLS`), `FILLED`, `LANDFILL_GROUND`                                     |
| `models/terrain/terrain.ts`       | `buildTerrain()`, `createTerrain()`                                                  |
| `models/structures/pavilion.ts`   | the pavilion and its dent                                                            |
| `utils/mesh.utils.ts`             | `strut()`, `mitred()`, `octagonal()`, `dispose()`                                    |
| `models/terrain/trees.ts`         | the woods                                                                            |
| `models/structures/railings.ts`   | the railings (`RAILINGS`, `RAILING`)                                                 |

The viewport keeps the picked seams in its `picks` attribute - closed seams
separated by semicolons, then a bar, then the path still open:
`3,18,44;12,13,14|61,62`. That is how a reload puts them back, and how a page
can be opened with a seam already drawn.

The whole debug layer lives in the editor only: the model and its plain scene
(`HousesScene`) carry none of it, so nothing a reader of the site meets does.

## Numbers worth turning

| Constant                         | What it decides                                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `UNDER_ROAD`                     | How far everything the road is laid on sits under it. 2cm, with 9mm to spare at the worst place measured                                  |
| `WALL_FOOT`                      | How far a wall is carried below what it stands on. Raised to 9cm so the seam is not dragged under                                         |
| `WALL_STEP`                      | How short a step a wall is drawn in, so its top follows the road's bends                                                                  |
| `SLAB_CELL`                      | How finely a plate is cut up, for the same reason                                                                                         |
| `PICK_SPACING`                   | How close two handles may sit before one dot stands for both                                                                              |
| `SEAM_SNAP`                      | How far apart two points of the network are still the same point                                                                          |
| `SEAM_TO_WALL`                   | How far the seam is let down towards a wall's foot where it meets one                                                                     |
| `ON_ROUTE`                       | How far a handle may lie off a line and still be traced along it                                                                          |
| `TO_NETWORK`                     | How far a handle may lie from the network and still be routed through it                                                                  |
| `ROUTE_DETOUR`                   | How much longer than straight across a way through the network may be and still be taken                                                  |
| `SEAM_FOUND`                     | How far a handle may have moved and still be the one a traced seam names                                                                  |
| `CARRIAGEWAY_REACH`              | How far past a kerb the raster looks for carriageway; which side a triangle is on is then the distance to the way's middle                |
| `CROSSING_ON`                    | How far on along the road from the water the second crossing's walls turn off                                                             |
| `CROSSING_REACH`                 | How far from the second crossing a bank's pass under a kerb is taken for one of its points                                                |
| `KEEP_CELL`                      | How finely kept ground is filled in with points of the height field                                                                       |
| `SEAM_STEP`                      | How wide a traced step from a wall's foot to its top is drawn in the ground                                                               |
| `SEAM_ALONG`                     | How far off each other's direction two pieces may run and still be taken for the same line                                                |
| `SEAM_PASSES`                    | How many times over the lines are cut at their crossings before the network gives up                                                      |
| `RIM_MARGIN`                     | How far inside the rim everything laid on the ground stops. One margin for the bands, the held lines and the strip the road is cut out of |
| `NEEDLE_LENGTH` / `NEEDLE_WIDTH` | How long and how thin a triangle has to be before the ground throws it away                                                               |
| `RIM_KEEP`                       | How much ground at the rim is never cut away for a road, whatever is laid over it                                                         |
| `FLANK_BEYOND` / `FLANK_STRIDE`  | Where and how thickly points are laid beside a road so the cut has something to work with out where the rings are coarse                  |
| `BROOK_SNAP` / `BROOK_EASE`      | How far the brook may be carried across onto the valley's own bottom, and over how many points that move is smoothed                      |
| `BROOK_SEARCH`                   | How far it still looks across itself for the bottom once it is there                                                                      |
| `FIELD_CLEAR`                    | How far beside a carriageway the ground is allowed to keep its own height                                                                 |
| `SEAM_CLEAR`                     | How close to a line of the seam a point of the field may stand before it is taken out                                                     |
| `DOT` (scene)                    | How big a handle is drawn on screen                                                                                                       |

## Checking the work

`npm test` in `packages/visualization` runs `seam.spec.ts`, which holds the
invariants: handles on both edges of every wall and on the ways, each named
once and every name referred to known, every wall point carried at its top and
at its foot, a planar network around the mill, a trace that follows an edge
rather than hopping, no needles in the ground, a bed that never asks the ground
up, the rim whole, nothing standing through the carriageway around the mill, a
bake that matches the model, and the ways reaching the rim. The editor's own
tests - a dot per handle, a closed path drawn solid - run in `packages/editor`.

Anything else is measured rather than looked at. The pattern is a throwaway
script run against the module:

```ts
// scratch.ts
import { createDeck, createWays } from './packages/visualization/src/index.js';
// build what you doubt, raycast it against what it should meet, print the worst case
```

```sh
bun run scratch.ts
```

Three of these caught things that looked fine on screen: the wall tops standing
13mm through the carriageway, the plates holding a plane across a 22m triangle,
and the road ramping linearly between two handles 200m apart.

## Where it stands

Measured, as of the last change, by vertical rays against the built meshes and
by walking the ground's free edges:

- 107 handles: 33 wall tops, 33 wall feet, 14 on the ways, 12 on the brook's
  banks, 6 on its bed.
- The ground is 24685 vertices and 41775 faces, and nowhere open: sampled every
  half meter out to the rim, every place without ground is under a band or a
  plate.
- The network is planar over the whole valley: 6655 pieces, none crossing and
  none ending on another's middle.
- The lane meets the ground at its kerbs: 5cm outside them the ground lies a
  median **0.02m** under the band, between 0.05m under and 0.03m over. It used
  to hang 1.25m over it, 0.58m at the rim. The road meets it the same way,
  0.01m - except over the kept ground under the mill's crossing, which lies
  1.1m to 1.6m under the bridge, as it should.
- The brook is cut out along its traced seam: 587 of its 607 sections have no
  ground under them, the other 20 lie in the last 12m before either rim
  (`RIM_KEEP`), where the water stands 0.08m over its bed. Its banks meet the
  water's edge: 5cm outside them the ground lies a median 0.00m under it.
- **0 of 93** wall feet hang over the ground.
- Nothing built stands through the road within 80m of the mill: the mill's
  walls and plate keep 17mm clear of it. That plate stood 4.7mm through the road
  at (10.69, 29.27) until it was cut Delaunay: cut from its ring in any order,
  one triangle ran the length of a sag in the road.
- The ground stays under the mill's plate everywhere. It stood through it by
  0.42m where the lane comes in before the mill's seam, and by 12mm along the
  footway behind the road wall before that was cut.
- The ground's free edges within 80m of the mill, sampled every 10cm: 4 of
  10484 samples lie more than 2mm from anything built or laid, all at (18.55,
  20.02) on the footway's seam, 6mm.
  - none on the brook's seam: the ground stays at the water where a wall's foot
    stands under it (see the floors).
  - finer than 2cm: 209 samples of 1.3cm to 1.8cm along the mill's seam from 5
    to 23, against the old deck; and 1.5cm at the second crossing's four ends
    where the plate's edge leaves the kerb - the ground there is at the road and
    the plate 2cm under it.
  - 18 on the second crossing's plate's own edge, 5cm at most.
  - 28 on the mill's seam, 3.9cm at most, against the old deck on the leg over
    the lane's end.
  - one on the brook's, 4.3cm where its bank runs past the wall's end at
    (29.66, 19.31).
  - 219 before the ground under the mill's crossing was kept, the footway behind
    the road wall and the strip past the plate cut, and the carriageway looked
    for past the kerb.
- The carriageway was looked for up to 0.2m short of the kerb, and a triangle
  12cm inside it stood from the brook's bank up to the road's edge. It is looked
  for 0.5m past the kerb now (`CARRIAGEWAY_REACH`), and told apart by the
  distance to the way's middle.
- At the rim the ground is kept whole under the road (`RIM_KEEP`) and stands
  16mm over the band at worst, which the band's polygon offset settles.

## Traced seams

A seam traced on the bench and agreed goes into `SEAMS` by the coordinates the
readout lists under its numbers, since the numbers shift with the model. It is
routed the way the bench draws it, cut in with the model's own lines, and the
ground inside it is taken away - except in the last `RIM_KEEP` meters, as for
the roads. A handle that has moved more than `SEAM_FOUND` is not found and the
seam is not cut, and a test says so.

A seam taken away from under a band only closes if the band's edge is the seam:
set out on their own, the lane's kerbs ended square 0.7m to 0.95m from the
band's mitred corners, and the brook's banks stopped a meter short of the water
at the rim and read their height off the ground beside them, up to 0.35m off
the water's surface. Both are now read off the band's own sections - its
corners, and its height, which is level across.

Thirteen seams so far, and one kept:

```ts
const SEAMS = [
  [75, 76, 78, 77], // the lane, kerb to kerb round its end at the deck
  [95, 97, 98, 96], // the brook, bank to bank, rim to rim
  [4, 3, 76, 78, 5, 69, 23, 19, 7, 34, 26, 2], // the mill's crossing
  [11, 14, 18, 16, 15], // the footway behind the road wall
  [21, 9, 32, 28], // the strip between the kerb and the wing past the plate
  // the second crossing: the four strips between the kerb and its walls
  [55, 39, 41, 57],
  [59, 47, 49, 61],
  [45, 43, 35, 37],
  [53, 51, 63, 65],
  // and its walls' outer faces buried on the slant, foot at the bank to top
  // at the road's end
  [50, 61, 59],
  [58, 41, 39],
  [63, 65, 54],
  [35, 37, 46],
];
```

Where two traced seams disagree on a point, the later one wins: a seam traced
after another is traced to refine it. The last four share each wall's line
with a strip, which holds it at the top; they take the ground on the outer side
down it on the slant instead. Kept ground counts before all of them - it only
fills in, and let it win and the mill's corner at 4 went back to the foot.

The numbers are as they stand now; the seams themselves are written by
coordinates and did not move when the second crossing's points went and the
numbers after 34 closed up.

A seam of two handles has nothing inside it: it cuts nothing, and holds the
ground to the line between them - a wing's end from its top to its foot, say.

The last runs down the road wall's end on the slant, top at the kerb to foot at
the face, so the ground beside it buries half of it, and comes back along the
kerb at the top. Along the kerb at the foot instead - 16 to 12 - it met the kerb's
end at the foot and had to climb there: the ground past the wall's end dipped
0.82m under the kerb 5cm out.

### Two more for the mill's deck

`MILL_MARKS`, numbered after everything else so the rest keep theirs:

| Handles | Point         | Where                                                                    |
| ------- | ------------- | ------------------------------------------------------------------------ |
| 67 / 68 | 6.909, 38.357 | the far kerb, square across the road from 11 - 5.002m at 90.00°          |
| 69 / 70 | 38.756, 7.270 | on the line from 23 to 5, `DECK_OFF` (0.5m) off the road, 1.145m from 23 |

The handles after 66 moved up by four.

9 and 21 stand 1m up the road from 31 and 27, where they stood 1.96m.

### The mill's deck, set out again

The deck read off the map before stood up to 4.4cm under the ground's edge
wherever a seam ran along it - its edges ran straight between its corners and
its heights with them - and its two halves stepped 4mm to 7mm where they met.
It is set out again in its two halves, each on a ring of its own, cut the way
the southern plate is.

The half the road runs over, `MILL_ROAD_DECK`:

```ts
// 67 - 11 - 13 - (road, 0.5m out) - 17 - (road, 0.5m out) - 69 - 23 - 19 - 7
//    - (road, 0.3m out) - 33 - 31 - 9 - 21 - (along the kerb) - 67
//                                             103.71m round, 259.24m²
```

Its top lies 7.7mm to 23.9mm under the road. The half beside it, `MILL_SIDE_DECK`:

```ts
// 17 - 1 - 3 - 76 - 78 - 5 - 69 - (road, 0.5m out) - 17   59.18m round, 110.97m²
```

Its edge is traced handle to handle the way a seam is, lifts and all, so where
the mill's seam runs along it - over the lane's end, 3 to 76 to 78 to 5 - the
ground and the deck hold one height; along 69 to 17 it holds the road's rule,
the same line and height as the road's half. Inside it the lift is eased
across from the edge. 69 went into the mill's seam, on the same line, so that
the seam eases the lift out from 5 the way the deck does.

Where a deck's or a plate's edge lies on a kerb its top is no lower than the
road's edge, the way the ground's is not: 2cm under it by the road's rule, the
ground's edge left the kerb 2cm over the deck's and met it only at the next
corner - thin white wedges beside 19 and 23 at the mill and at the southern
plate's four ends. Inside the kerb the deck stays under the road: 0.09mm under
it 4mm in from the kerb. The side half's edge is stepped every meter like the
seams along it, so it has the ground's own points: every 1.5m, straight between,
it stood up to 7mm off the ground's edge. And each of its points takes its
height from its own leg, eased the way a trace eases it: read off the nearest
point of the whole trace instead, the joint just past 69 took the lift of the
leg back to 5, where the two meet at a sharp angle - a ridge 1cm high, grey on
the bench. What folds are left on the deck are 3mm at most, where it ramps up
the lane's lift at 78 and 5.

The walls under a deck are topped out just under it (`UNDER_DECK`): topped out by
the road's rule, the wall from 1 to 25 stood up to 5.9cm through the side half,
whose top is eased between its edges rather than read off the road.

The mill's decks cut no ground away under them, unlike the southern plate: the
mill's seams already say what goes there, and cut away under the whole deck,
the ground went from under the bridge outside the ring it was kept inside.

Four of its points were set out against a line drawn off the road's middle and
stood off the lines the deck runs along: 17 0.456m off where it should be 0.5m,
33 0.291m, 7 0.296m and 9 0.2986m where they should be 0.3m. They are set out
on the band's own edge now - 17 carried square to the road onto the 0.5m line,
4.4cm, and not walked on along the bank to where the bank is that far off,
which is 2.2m further; 33 carried out from the kerb like the other wings; 7 and
9, which the lane's cut reads before the kerbs exist, written in at their new
places. The road wall's face runs along the same 0.5m line now: along its first
line it stood up to 4cm aside of the footway's seam and its foot 1cm over the
ground. The seams' coordinates are written to the tenth of a millimeter, from
the handles themselves.

A run through points closes back to its first along its last line: left open,
the southern plate's closing leg from 57 to 41 was a chord standing 5.1cm off
the road's line, and this deck's closing leg along the kerb cut 25m² off it.

### Traces keep the shape they were traced to

Deck and plate outlines are not lines a trace is routed along, nor part of the
network a leg is routed through (`ROUTED_LINES`): they came after most of the
seams were traced, and a leg that found one ran along it - the ground kept under
the mill's crossing came out 3.1m shorter round. And a leg is routed through the
network only if that is at most `ROUTE_DETOUR` (2) times the way straight
across: at three, a leg of 1.15m went round by 3.06m and one of 0.53m by 1.33m,
back over the legs before it.

### The stairs

The stairs up from the road beside the mill's deck and the walls beside them,
`STAIRS`, `RETAINING_WALL` and `createStairs`, as counted on site in sections of
the guard rail on the walls, 1.40m each (`RAIL`):

- the stairs: 1.60m wide, 11 steps of a normal 17cm - 1.87m, where the photos'
  2.3m over twelve steps made 19.2cm each - the sixth's tread 55cm deep as a
  landing, the bottom one 25cm - the walls stand a tread that deep back from
  the kerb - and the others 28cm: what the wall beside them leaves, 2 sections
  from the bottom step's tread off the kerb and on one tread more to the top
  step, set in that far. Its railing ends where the 2 sections do, the wall
  running on bare past it to the top step. Their north edge at the road (73) stands
  straight across the road from a point 1m south of the mill's nose (1). Only
  the bottom step reaches out in front of the walls.
- a U at terrace level, level with the top step: 2 sections beside the stairs,
  5 along the road, its face a tread back from the kerb, and 1.5 back into the
  slope at its end.
- an upper wall from the back of that, 9 sections straight north, starting at
  terrace level and going down with the road from there - 54cm by its end:
  the terrace stands behind it, and the ground falls from it to. From its far
  end it bends on into the slope, away from the road, at the height it ends
  at: 1 section turned 45°, then 1.5 turned 45° further, the back on the
  inside of the bend.
- pillar stairs on down from the bend's end, along the road, 11 steps of 15cm
  (`PILLAR_STAIRS`): the top one a stub of the wall, 70cm on, level with its
  top but only a riser deep, the ground up to its underside (114 - 120); the
  others three pillars side by side, 15cm square and 70cm long, 3cm apart,
  each lying 10cm on the one below. They leave the stub square to its face
  (310.6°) and turn 2.4° a step to run with the road at the last (332.5°).
  Eleven risers make 1.65m, and the ground as drawn is 2.64m under the wall's
  top at the foot, so every step leans the same, 8.1°, for the last to lie on
  the ground at its foot. Up the flight they stand clear of the ground as
  drawn - the ground there is still to be traced to them.
- a lower wall on along the road from the U: 2 sections falling straight to 70cm over the
  road, and 6 more at 70cm, following the road.
- all of it 0.25m thick: filled against with ground, it does not show.

Each wall is drawn in half meter pieces along its face, and each piece takes
the coping's height at both its ends: a wall that falls, or follows the road,
runs on the slant, not in steps, and still bends with the road in plan.

The upper wall runs straight, angled so it would stand as far back from the
lower wall's end as the U's end stands from its own start - 2.1m, the U's back
leg - rather than on along the U: turned 5.9° away from the road off the U's
line, a bearing of 310.6°, 12.6m long. It is set a wall's thickness in from the
U's back corner (95), towards the road, so the back leg runs into it and the
corner closes: 1.87m off the lower wall's end, then.

Their handles, read off the plan they are built from (`STAIRS_PLAN`), are
numbered after the mill's, topped out at their own top - a tread's, the
coping's - and footed on the ground as it is drawn (`DRAWN_GROUND`, read off
the bake), not the height field: beside a road the ground is cleared for 4m
and spanned from the kerb, up to 1.25m over the field. A seam traced to one
holds the ground at the height it already has, so the next bake gives it back
the same.

| Handles              | Point                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 71 / 72, 73 / 74     | the stairs at the road, south and north                                                                                               |
| 75 - 82              | the landing's four corners                                                                                                            |
| 83 / 84, 85 / 86     | the stairs' top, south and north                                                                                                      |
| 87 / 88              | the U's face at the road, its corner                                                                                                  |
| 89 / 90              | the U's face at its end along the road                                                                                                |
| 91 / 92              | its back where the legs by the road meet                                                                                              |
| 93 / 94              | its back at the top beside the stairs                                                                                                 |
| 95 / 96, 97 / 98     | the U's end in the slope, outside and inside                                                                                          |
| 99 / 100             | the U's inside where its legs meet at its end - 89's back                                                                             |
| 101 / 102            | the upper wall's face where it starts, off the back leg's face - 95's partner                                                         |
| 103 / 104            | the lower wall's back where it starts, against the back leg - 89's other                                                              |
| 105 / 106, 107 / 108 | the upper wall's far end, face and back                                                                                               |
| 109 / 110, 111 / 112 | the bend's first kink, face and back                                                                                                  |
| 113 / 114, 115 / 116 | the bend's end, face and back, the ground up to the stub                                                                              |
| 117 / 118, 119 / 120 | the stub's end, the pillar stairs' top step, face and back                                                                            |
| 121 / 122, 123 / 124 | the lower wall where it has fallen to 70cm, face and back                                                                             |
| 125 / 126, 127 / 128 | the lower wall's far end, face and back                                                                                               |
| 129 - 146            | the pillar stairs, steps 9 to 1 counted from the bottom: the outer pillars' top corners, the slope's side then the road's, a top only |
| 147 / 148            | the bottom step's foot, the outer pillars' corners, a top only, on the ground                                                         |

Two handles on one edge within `PICK_SPACING` (10cm, under a wall's thickness,
or a wall's face and back are one) are one dot only at one height:
the U's corner is a tread from the stairs' edge, 1.7m over it, and was taken
for it. A wall's point is its top and its foot together, and the top decides.

### The ground's floors

Whatever held a point, the ground is never lower there than a surface it meets:
on a way's edge no lower than its band, on a bank no lower than the water. A
wall's top is set under the road and its foot can stand in the water, and a
seam pinned to either had the ground follow it down, leaving a slit under the
band's edge or a wedge under the water's with nothing in it - 2cm along the kerb
from 39, 9cm and 12cm at the second crossing's corners on the bank, all three of
them white on the bench.

Kept ground has the water for a floor too, just not the kerb over it: the
corner at 28 of the triangle kept past the near wall's end sits at the water,
not 17cm under it at the wall's foot.

On a bank the water decides alone: where a kerb crosses one the road is going
over the water, and lifted to the road the bank climbed to it within a hand's
width beside the wall's end at 28. And kept ground has no floor: it is the
ground under a bridge, and lifted to the kerb over it, it rose 1.5m to the road.

The edge check behind these runs at 2cm, and the one at 39 was 1.8cm: a slit
opening onto the space under a road shows at any height. Run it finer when
something white is reported.

### Kept ground

The opposite of a cutout: a seam in `KEPT` is traced round ground that stays,
whatever runs over it - the ground under a bridge. Inside one nothing is taken
away, not for a carriageway, a plate or another seam; the model's lines that
cross it stop holding the ground there (`HELD` is the cut without them); and the
field is filled in on a grid of `KEEP_CELL` at the height field's own height.
The ring itself holds its traced heights like any other seam.

```ts
const KEPT = [
  [4, 2, 26, 34, 104, 106], // under the mill's crossing, walls' feet to the near bank
  [28, 32, 110], // past the near wall's end, between it and the bank
];
```

Measured inside it every quarter meter: ground everywhere, a median 0.02m off
the height field, -0.08m to 0.11m - the most of it at the ring, where the ground
comes to the walls' feet 9cm under the field and to the water's surface.

A traced seam is the contract, so where it shares a point with the model's own
lines its height wins, over a wall's foot too: the mill's seam runs along the
tops of the plate's far side, and the walls under them would have pulled those
corners down to their feet, two meters.

A seam can climb a wall where it stands - 4 to 3 is the foot and the top of one
corner. The ground holds one height at a point, so the step is laid `SEAM_STEP`
wide and into the wall beside it: the corner keeps the top, which the ground
beyond it meets, and the foot is set along whichever leg runs on a wall - the
one the seam came along, else the one it goes on by - so the face the ground
makes lies in the wall's own. Set beside the wall, it left a sliver of sky under
the corner; with the foot on the corner, the ground past it dipped to the foot.

The traced seams go into the network before the model's lines. A point set down
later is taken together with one already within `SEAM_SNAP`, and a seam's corner
set down after the kerb's end was moved 3.4cm onto it, leaving that much of a
gap between the wall's end and the ground.

The walls take the handles' lifts too (`liftsAlong`), eased between the marks
they run through the way a seam along them eases them. Drawn at the rule, the
wall stood 0.37m under the corner the lane comes up to, and under the ground
held to it.

Each leg is stepped every `WALL_STEP` whichever way it was found, and its height
read off the edges at every step, plus whatever lift a handle stands at off its
edge's rule, eased out towards the next: the corners the lane comes up to (3, 4, 5) stand 0.37m over the rule and the nose (2) 0.10m, and without it the ground
met them there rather than at the dots. A wall line is drawn between its corners, and
the mill's seam follows one 16m from end to end: read at its ends alone, the
ground ran up to 0.19m under the wall's own foot in between.

What the mill's seam turned up in the network itself:

- two lines crossing 5mm short of one's end were not cut, since a crossing
  within a thousandth of a piece's length of its end was let go - on a 5m piece
  that is 5mm. The triangulation folded over the point, and a triangle outside
  the seam was taken away with the inside. A crossing is now cut wherever it
  falls, and a point lying within `SEAM_SNAP` of another line's middle cuts that
  line too.
- that left pieces a few centimeters long, which the doubled check took for
  doubles of whatever line they crossed or carried on from, and dropped: the
  wall line past the mill's crossing broke, and a trace along it went 27m round
  instead of 7m along. A piece is now a double only if it runs along the other
  (`SEAM_ALONG`) and beside it, not beyond its end.

The planar test caught neither: it looked at the mill alone and let the same
thousandth go. It now checks the whole valley, and touching as well as crossing.

## The railings

On the walls, from the photographs (`RAILINGS`, `createRailings()`, drawn with
the walls): round steel pipe 4cm thick, a post at every corner and between them
the guard rail sections as counted on site - each stretch rounded to the nearest
half section (on the wall's middle it runs a little short of its face), the
whole ones even and a half one, where there is one, at the east end - a top
rail 0.95m over the coping and a middle one at 0.5m (`RAILING`), mitred where
they meet (`mitred`) - each piece ends in the plane halving the angle to the
next, so at a corner their edges meet round its outside and nothing stands out
past it - and flat half a pipe past the last post at either end; the posts up
to the top rail's middle, where they end inside it, in
the grey green of the photographs' steel, each pipe turned on its edge
(`roll`) - drawn square, it reads rounder. Each run is given as the pairs of handles on the
face and the back of the wall it stands on, and set on the wall's middle
between them, each post on the coping under it - so it falls with the upper
wall. The first: round the U from beside the stairs' top, along the upper wall
and round its bend - 85/93, 87/91, 89/99, 101/97, 105/107, 109/111, 113/115. The
second: the stairs' open side, its posts set as on site rather than by
sections - on the bottom step half its tread in, on the landing a quarter tread
in from its start and right before the next step's riser (a pipe's thickness
off it), and on the top step half its tread in - each on its tread 6cm in from
the stairs' edge (`inset`), the rails running with the steps and level over the
landing, the top one bent round down into the lowest post - one pipe, as on
site, the bend 15cm round (`bend`). Measured off the photographs, against the steps' known rise (17cm) the
stairs' top rail stands 0.9m over the treads (`stairs`), and against the banner
on the upper wall (3.40m by 1.73m, about 2.45px a cm) the walls' 0.86m to 0.97m
over the coping line, their middle one 0.43m to 0.52m - read off the coping's
front edge, which stands nearer than the posts' feet, so a little short: 0.95m
(`top`) and 0.5m (`middle`).

## The pavilion

On the terrace deck where the stairs come up (`PAVILION`, `createPavilion()`,
drawn with the houses), from the photographs: eight timber posts 14cm square on
an octagon, 1.2m apart - 1.57m out from its middle, 3.1m across - one side of it
square to the stairs, an eaves beam round their tops and a knee brace from each
post to either beam beside it, 0.6m down the post and 0.6m along the beam - but
for the side facing the stairs, which is open. A rail runs between each two
posts 0.8m over its floor (`rail`), but on the sides it is entered from
(`entries`): the one facing the stairs and the one either side of it - told
from the stairs, not the compass, so they stay the entries however it is
turned. Across from them - the side facing away from the stairs and the one
either side of that - a second rail runs 0.1m over the floor (`low`), and a
panel closes the side between the two, in the posts' line from post to post. The posts
stand square in their corners, a face towards the middle. It
stands on an octagonal
socket 0.15m over the deck (`socket`), reaching 0.25m past the posts' outer
faces (`plinth`), its sides down into the ground - that is its floor: the
roof's lower edge stands 2.05m over it (`eaves`), 2.2m over the ground, and the
whole of it 3.98m over the ground. Its roof an octagonal
pyramid at 35°, 45cm past the posts and laid on the beams' outer edges, open
0.35m out from the middle. Under it a mandala of rafters, one over each post:
each straight from 20cm short of the eaves' edge, under the roof, up past the opening, tangent to a circle 0.32m
round the middle rather than through it, all turned the same way, so they lie
on one another round it, and 0.35m on past it - their ends stick up out of the
opening, and the small roof, 0.6m out, sits on them and covers them. It stands on the stairs' line, its near posts 3m off the top step (`from`) - its
middle 4.45m in - at the top step's height, set from the stairs alone.

The slope behind it is dug back for it (`PAVILION_CUT`): flat at the deck's
height out to a meter past the posts' outer faces (`path`), and a bank at 0.8
(`bank`, 39°) from there up to where it meets the slope - the ground no higher
than that anywhere. The bank's foot is rounded over a meter (`toe`), and its
top runs into the slope over 0.4m (`brow`): started at its full slope straight
away and broken off at the slope, it met both in creases. Only up the bank,
though: rounded on the flat too, the ground there sank 7cm under the edges of
the dumps it opens onto, and each stood on it in a step. That is the one place the terrain is cut rather than piled on,
and it is baked into the terrain itself: `buildTerrain` lays a grid of its own
there (`DENT_CELL`, 0.3m), the terrain's own points lying a couple of meters
apart, and holds every point of the field no higher than the dent. To the
north the deck already stands at its height. To the south it opens onto the
deck's extension (`opens`): out to that one's upper edge up the slope (226 -
228), the ground in between blended from the deck's height at the dent to the
edge's own heights at it, so the two meet on the edge; the bank rises from
round all of that. A plane through the dent and the edge's ends fell away
faster than the extension, and left it standing on the cut ground in a ledge.

## Dumps

The terrain as baked is frozen: from here on ground is only ever piled onto
it, the way a site is landfilled. A dump (`FILLS`) is a ring of handles traced
on the bench, written down by the handles' names, and drawn as its own
mesh over the terrain (`fill`, a child of it, tinted the same):

- its edge runs along a wall's coping where two tops in a row are on one face
  or back of the stairs' walls (`FILL_LINES`), on the ground as drawn where two
  feet are, and straight across otherwise. A top and a foot on one point are
  a step up the wall: the top keeps the corner, the foot goes `SEAM_STEP`
  along its other leg.
- inside, a grid of `FILL_GRID` (0.5m) is laid, triangulated to the edge, and
  relaxed `FILL_RELAX` times until every point stands at the mean of its
  neighbours - the smoothest surface the edge allows.
- bloated, if a dump asks for it (`bulge`, in meters): a dome over the relaxed
  surface, relaxed the same way with every point lifted a little over its
  neighbours' mean, nothing along the edge or at a reference point and the
  bulge at its highest - a slope piled up is round, not straight.
- where two dumps share an edge the later runs on into the earlier: every
  point of the later within `FILL_BLEND` (1.5m) of it, off any edge, is
  relaxed together with the earlier's around it - the earlier stays as it was.
  Relaxed both ways, the terrace deck changed round the U when a dump was laid
  on south of it, where nobody had asked it to. The edge itself stays straight between its handles - let go of, it
  sagged between them, and each handle stood in a notch.
  Held on its own, each met the other in a crease; drawn as one mesh, with
  one vertex where two share a point, the shading runs on across it too.
- the terrain's own vertices inside the ring, and points along its edges a
  quarter meter apart, are points of the dump too (`GROUND_VERTICES`). Held
  on the ground at its grid's points alone, a dump ran under the terrain's
  ridges between them, and the terrain showed through its larger faces - by
  15cm once, on a bank beside the stairs. Moving the bank's edge made it worse,
  not better: the dump only reached over more of the ridges.
- bedded, if a dump asks for it (`bedded`): the pillar stairs lying in it are
  held on the ground, five points along each step and five across it a hair
  under its underside (`PILLAR_BED`, `PILLAR_BEDDED`), and the top corners of
  their outer pillars (129 - 148) are held as heights - the ground beside the
  stairs meets each step where it comes out of the slope.
- feathered, if a dump asks for it (`feather`, in meters): where its edge lies
  on the ground and the terrain beyond falls away or stays level
  (`FILL_LOOK`, `FILL_RISING`), the inside eases out onto it over that far,
  rather than meeting it in a crease. Not where the terrain beyond rises: up a
  slope, easing onto the ground inside - far under the stairs there - dug a
  trough between the stairs and the slope.
- beside the stairs from the road, within `STAIRS_BESIDE` (0.3m) of their
  sides, it stands no higher than the tread beside it less `STAIRS_CLEAR`
  (0.1m) - edge and inside alike - so the steps stand out of it along their
  side, whichever of their corners the ring runs by. Their open side only: on
  the other the wall stands, and the terrace behind it was pulled down under
  every tread once.
- where its edge runs on the ground it is laid every `FILL_ON_EDGE` (10cm),
  and the terrain's own points come as near it as half that: a crease of the
  terrain crossing the edge between two of its points poked through by 8cm.
- with an apron, if a dump asks for it (`apron`, in meters): along its outer
  edges - shared with no other dump, bounded by no wall or step - it runs on
  that far out onto the terrain, as far as there is ground to run onto, and
  comes down onto it; only the handles along those edges are held. Held there
  as a line, a dump met the terrain in a seam however it was eased. Outside is
  told by the ring's own winding, and where an outer stretch meets one that is
  not, the edge comes out along the outer one alone; laid on the ground
  between points further apart than `FILL_ON_EDGE`.
- where it lies on the terrain along its edge, it takes the terrain's shading
  on there (`TERRAIN_NORMAL`), eased over into its own within `FILL_SHADE`
  (0.75m): each drawn as its own mesh, the light broke along the edge where the
  two meet at one height. The terrain's shading is worked out from the faces
  that show only (`GROUND_NORMALS`): just inside a dump's edge the terrain
  under it often falls away steeply, and counted, those hidden faces tilted
  the edge's shading into a dark band along it - on the terrain, and taken
  on, on the dump too.
- nowhere is it under the ground it is piled on: each point is at least the
  ground as drawn (`DRAWN_GROUND`), so a dump only ever adds.

It is worked out when the scene is built, from the bake - 50ms for the first.

The first dump, between the upper wall and the lower one: 101, 103, 123, 127,
126, 106, 105 - 21m² in 245 triangles, its edge on the copings to the
millimeter. Between the walls it falls 37° across at the median: the lower
wall's top is up to 1.3m under the upper wall's across 1.9m. At the far end it
drops from the copings to the ground between the two walls' ends.

## Reference points

Where a dump needs more than its edge to go by, set reference points with the
**point** tool on the left. A ring laid over the ground shows where a click
would set one, and rulers run from it 30m out (`RULER`) - north, east, south
and west, and between them, all alike, laid every 20cm all the way - laid over the ground too, so they bend
with it, which is what shows its lie where a dot under the pointer could not.
They break over the ways, where there is no ground to lay them on. Lifted, the
ring and the rulers stay on the ground, and the same rulers again, cyan, run
level at the point's height until the ground comes up to it, and on the ground
from there - a levelled laser's line - so where they meet it shows what the
height lines up with while it is dragged. A click sets it on whatever surface is
under the pointer - ground, a way, a wall, a deck; pressed and dragged up or
down, it is lifted off it first, a dot at its height, a line down to the
surface and how far beside it, and set where it is let go of. To move the view, hold shift, which puts the tool down. The list keeps every point with its height to edit, and one to take away;
a reload keeps them.

**copy** gives `export const POINTS` to paste into `points.ts`
(`[x, y, level]` a point). From there each point is

- a handle, `point`, drawn purple, numbered after every other handle so that
  setting one never renumbers another, a top only - to trace a seam or a dump's
  ring through, at its own height,
- and inside a dump's ring, a height the dump's surface is held at while the
  rest of its inside relaxes, the grid kept half a cell clear of it.

The bench's own points show as `P1`, `P2`, ... until they are in the source;
clear them after, or each is there twice.

## Brushes

For what a dump's ring cannot say, the bench has brushes, on the left: pick a
tool from its buttons, and a drag over the ground piles landfill on instead of
moving the view - a right button drag turns the camera, as always, and with
shift held the brush is put down, to move the view. The ring
shows how far it reaches. A drag ends when the button is let go of, when the
system cancels it, or at the first move without a button held: a release
outside the window is not always heard, and a brush laying on with no button
held was the worse of the two.

- `raise` piles ground on, `lower` takes piled ground away again - never the
  terrain's or a dump's own - `flatten` works towards the height the drag
  started on, `smooth` towards each point's neighbours' mean.
- Radius 0.5m to 10m, strength 0.05 to 1: a raise or lower moves the ground a
  tenth of a meter a dab at full strength, a flatten or smooth that share of
  the way.
- A dab is laid every quarter radius along the drag, each weighed from full in
  the middle to nothing at the rim.

The landfill is a grid of 25cm (`BRUSH_CELL`) over `LANDFILL_GROUND`, drawn
where all four corners of a cell have something piled on and the ground under
it rises less than `BRUSH_CLIFF` (0.3m) across it - a cell over a wall's coping
would run out as a saw tooth.

Every dab is data: `['raise', x, y, radius, strength]`, a flatten with its
height last, all to the centimeter. The panel counts them, undo takes the last
drag back, and a reload keeps them. **copy** gives `export const BRUSHES` to
paste into `brushes.ts`, where they are laid on first; clear the bench's
own after, or they are laid on twice.

The second, the terrace deck behind the stairs' walls: along their backs from
the stub round the U to the stairs' top - 119, 115, 111, 107, 95, 97, 99, 91,
93, 85, 83 - and back across six reference points (203 - 208) where the ground
behind comes up to the walls' tops: off the stairs' top, the U's corner, its
end, twice along the upper wall and past the bend's end, each found marching
away from the road until the ground stands at the coping's height. 146m² in
1323 triangles, 1.8° across at the median and 3.6° at nine in ten - a deck,
+0.527 behind the U going down with the upper wall to -0.010 - and higher only
where the ground itself is. Two reference points on the ground run their edge
along it, as two feet do (`FILL_ON_GROUND`, 2cm).

A first try south of the stairs, bloated by 0.3m, was taken out again: not the
shape wanted there. A second try on points picked for it was taken out again too, to be laid in two
steps. First the terrace deck on south past the stairs' top: 83, across a
shoulder picked at its height (229 - 232), down to the slope (228 - 226) and back
to the deck's far corner 203 - sharing its edge 83 - 203. 14.6m², +0.527 to
+0.62. Then the fill below it: down the stairs' side from their top to the road
(83, 79, 75, 72), along the road (222 - 225) and back up along the shoulder
(228, 232 - 229), which it shares; feathered by 2m, and with an apron of 2m
along the road, so its lifted corner 224 (0.49m) comes down onto the terrain
within 2m rather than hanging over it. 29.4m² with the apron; 7cm to 17cm under
every tread beside the stairs.

The third now, round the bend and the pillar stairs, on the ground the stairs
trace: on from the dump between the walls at its foot (106), up the bend's face
half way (209, 210), up to the stub's underside (211, 212), along the terrace
deck's edge (119 - 208, which it shares and is rounded along), down the slope
beside the stairs where it stands 0.6m over the steps' undersides - 0.4m off
the top one, where it flattens out towards the terrace (213 - 218), so the fill
rises from the stairs into the slope rather than sagging between the two - round the stairs' foot
(147, 148) and back along the ground by the road (219 - 221) to the lower wall's
end (126), sharing the first dump's edge 126 - 106. Bedded, and feathered by 2m.
34m²; every pillar lies on it, half a centimeter in to 2.8cm clear at its very
edge, but the top step, 12.6cm in where it meets the stub's underside.

## The bake

Cutting the ground takes twenty seconds, and it changes only when the model does. So it
is baked: `npm run data:terrain` in `packages/visualization` runs `buildTerrain()` and
writes `terrain.baked.ts` - positions as float32, indices as 16 bit integers
while the vertices fit, both base64. The colours are laid on when the scene is
built, so the palette still drives them; the skirt is told apart by lying lower
than everything else.

The test suite builds the ground afresh and compares: the same counts, and no
position more than a millimeter off. Change anything the seam is built from and
it fails until the bake is run again.

The bake runs under node, not bun. The browser shares node's engine, and with
it the last digit of every sine the rings are laid out by. Even so the indices
differ from the browser's in a couple of hundred places: the rings are circles,
four points of one are as good as cocircular, and which diagonal the cut takes
there is a matter of rounding. The test leaves the indices out for that reason.

The network itself is worked out when first asked for, not on load: the scene
without the bench never needs it again, which took the module's load from 2.5s
to 0.4s under bun.

## Anchoring, and how it broke once

A structure names its anchor by **place**, never by a rule of thumb over a list.
`ROAD_WALL` used to take "the northern one of the two" crossings of road and
brook. Carrying the lines out to the rim made the two meet again 270m up the
valley, that crossing became the northernmost, and the road wall, the deck strip
built from it and two numbered points went with it - a wall drawn across the
hillside. It now takes the crossing nearest the deck's own corner, and crossings
further out than `CULVERT_REACH` get no walls at all.

The same holds for the numbers themselves: they name a place for as long as the
model does not change under them. Quote coordinates when a list has to survive.

Cutting the lines at their crossings has the same character. A point set down on
a crossing is taken together with whatever already lies within `SEAM_SNAP` of it,
which moves the line it was cut into - and a line that moves can come to cross
something it did not cross before. So the cut runs again until nothing crosses
anything, up to `SEAM_PASSES` times. One pass left a crossing a hair from the
deck's own corner, which is exactly the sort of thing a triangulation cannot
hold.

## A short line is missing data, not geometry to invent

The road's data used to stop 75m inside the rim, on a bend. It was tempting to
carry the line on in the heading it ended with, and the result was a straight
stub kinking off a curve, a corridor carved along it and the ground disturbed in
a fan from the kink.

The road had not stopped. **It changes its name**: the Lotzebachstraße becomes
the Talstraße at that bend, and `fetch-data.ts` picks ways by name, so
the second half was never asked for. Both names are now the same road there, the
ways are chained on their shared end as the brook always was, and the data runs
to 346m out - past the rim, with nothing invented. The main road went from 583m
to 723m.

If a line stops where nothing on the ground stops, look at the query before
reaching for the geometry.

## One margin, or none

Everything laid on the ground stops at `RIM_MARGIN`: the bands, the lines the
ground is held to, and the raster that says which strip of field the road is cut
out of. They were three different numbers once - 14m for the held lines, 1m for
the bands, the whole corridor for the raster - and it did not show only because
the road data stopped 75m inside the rim anyway. Carried out to the rim, the
mismatch became a 14m stretch of ground cleared for a road that was neither
drawn there nor held anywhere.

Everything runs to the rim itself - the bands, the kerbs, the brook's banks -
and everything is pulled back onto the ground by `onGround` while it does: a
band and a kerb are both set out from a line, so where one meets the rim at an
angle its outer edge gets there first and would hang over nothing. Cutting the
lines short instead leaves the tarmac ending before the ground does, and the
handles sitting short of the tarmac. `RIM_MARGIN` is nought for that reason;
what keeps its distance from the rim is the road's cut-out, through `RIM_KEEP`.

## Which source wins

Two sources describe the valley, and they disagree. The **laser scan** is a
meter grid; the **OpenStreetMap lines** are drawn on a map by hand. Measured
against each other along the brook, the line runs a median **2.0m to one side**
of the valley's own bottom and **0.50m above** it, and at the far ends 6m above
it, 15m aside.

So the scan wins, and not only on height: **the line is moved onto it**. Each
point of the brook is carried across its own run to the lowest ground within
`BROOK_SNAP`, the offsets smoothed over `BROOK_EASE` points first so the line
keeps its shape instead of hopping from bank to bank wherever the scan is flat.
It now sits a median **0.10m** above the valley's own bottom rather than 0.50m,
with that bottom a median 1.0m aside rather than 2.3m. The line moved a median
1.83m, at most 4.83m.

The moved line is rounded once more at the end, the way the roads are - the move
is eased over a few points, not over the whole run, so it left kinks of its own
in the line everything at the crossings is set out from. One Chaikin pass, not
the three the drawn line gets: each doubles the points and this one is dense
already. Turns along it: median **1.7°**, and one of 64° at (-48, 336), which is
36m outside the rim. At `BROOK_EASE` of 3 there were two of 22° and 31° at
(62.9, 1.3) - in the middle of the second crossing, which is the kind of thing a
structure is then built around.

What reads that line moved with it - and only what reads it. The buildings are
their own footprints and did not move. The deck's seven plate corners and its
kerb are set out from the road and did not move. What moved is what stands in
the water: the road wall's two ends by about 3m, the four points where the banks
tie into the deck by 2.5m to 4.4m, and all sixteen points of the second crossing.
**22 of 30**, a median 2.04m. Done deliberately and before the seam, because a
seam cut to a brook in the wrong place would have to be cut twice.

## A culvert is a pair

Each bank of the brook meets the road's edges at its own two places, and both
crossings here are skew, so those places lie meters apart along the water. Cut
each bank to its own pair and one wall starts where the other has already ended -
at the mill they were staggered by about 4m, which reads as a wall out of line
with the water it stands in. `bankRuns` cuts both banks to the whole of what
either of them covers, so the two walls face each other across the channel:
measured end to end, 2.40m apart at both ends, which is the brook's own width.

Two lines drawn a hand's width apart are the other half of that: where a wall's
tip and the wing carried past it come out doubled, asking where they cross is
asking something the arithmetic cannot answer - two lines that nearly share a
direction cross nowhere in particular, and in single precision they cross
somewhere else again. They are found by how close they lie (`SEAM_DOUBLE`) and
the shorter one goes.

## The mill crossing is down to its points

Its deck and its walls were set out against the brook where it used to run, and
the brook has moved onto the valley's own bottom. Rather than patch a shape that
no longer straddles the water, the drawing is gone: `createDeck` and the two
wall rings at the mill are removed. What stands is the numbered points - the
plate's own corners, the kerb, the road wall's ends and the four bank ties - so
the shape can be cut again from them against the brook as it now runs.

## The second crossing is down to its points too

Its walls and its plate were set out while the brook and the seam were still
being worked out, and half of what went into them was wrong. So it went the
way the mill's did: the walls, the plate and the void under it are gone, and
what stands is four of its sixteen points - those that were right:

| Handles now | Point           |
| ----------- | --------------- |
| 35 / 36     | 58.710, 1.187   |
| 37 / 38     | 58.879, 1.434   |
| 39 / 40     | 66.865, -15.270 |
| 41 / 42     | 66.602, -15.414 |

Those four had been set out against a line drawn off the road's middle rather
than the band's own edge: each pair 0.3m apart, but 41 only 0.204m off the kerb,
37 0.325m, and 35 2.5cm off the kerb it was to stand on. They are set out again
the way the rest are: the kerbside ones taken onto the kerb where they were
nearest, and their pairs 0.3m off it square to the road. 35 and 37 moved 2.5cm,
39 and 41 9.6cm. A pair 0.3m apart says nothing about how far either is from
the road - measure against the line itself.

The other twelve went, and with them the road handles where a kerb crossed one
of its walls and three on the water. The handles after 34 closed up: 109 of
them became 74.

It is being set out again from new points, `CROSSING_MARKS`: where each bank
passes under an edge of the road, and beside each the point where that bank has
come `BANK_WALL_OVER` off the road - walked along the bank, not carried out
square to the kerb, since the wall that ends there stands in the water and the
crossing is skew. Measured: every point on its bank to the hundredth of a
millimeter, the crossings on their kerbs, and the others 0.3000m off them,
0.41m to 0.72m along the bank from the crossing.

| Handles now | Point           | Where                                                       |
| ----------- | --------------- | ----------------------------------------------------------- |
| 43 / 44     | 60.347, 0.038   | a bank under a kerb                                         |
| 45 / 46     | 60.294, 0.446   | that bank, 0.3m off it                                      |
| 47 / 48     | 61.440, -7.144  | a bank under a kerb                                         |
| 49 / 50     | 61.518, -7.675  | that bank, 0.3m off it                                      |
| 51 / 52     | 63.091, -2.013  | the other bank under a kerb                                 |
| 53 / 54     | 63.028, -1.585  | that bank, 0.3m off it                                      |
| 55 / 56     | 64.346, -10.955 | the other bank under a kerb                                 |
| 57 / 58     | 64.432, -11.673 | that bank, 0.3m off it                                      |
| 59 / 60     | 60.680, -6.494  | the south-western kerb, `CROSSING_ON` up the road from 47   |
| 61 / 62     | 60.484, -6.722  | that, 0.3m off the road square to it                        |
| 63 / 64     | 63.866, -2.644  | the north-eastern kerb, `CROSSING_ON` down the road from 51 |
| 65 / 66     | 64.062, -2.416  | that, 0.3m off the road square to it                        |

The last two pairs are where the walls along the road turn off: a meter on from
where the water passes under a kerb, away from the crossing - up the road on the
south-western kerb, down it on the north-eastern - measured along the kerb, and
a wing's width out from it square to the road. Which way along a kerb is north
is read off the kerb. Measured: both on their kerbs to the thousandth of a
millimeter, 1.0000m along them from 47 and 51, and their pairs 0.3000m off at
90.00°.

The handles after them moved up by twenty-four: 74 became 98.

The two walls are run along the lines their points were set out on - the kerb
carried 0.3m out along the road, and the water's own bank in, under the road and
out again:

```ts
// 39 - 41 - (road, 0.3m out) - 57 - (bank) - 55 - (bank, under the road) - 51
//    - (bank) - 53 - (road, 0.3m out) - 65 - 63                  16.44m
// 59 - 61 - (road, 0.3m out) - 49 - (bank) - 47 - (bank, under the road) - 43
//    - (bank) - 45 - (road, 0.3m out) - 37 - 35                  11.95m
```

Its plate is a ring along the outside of both kerbs, past the walls, and
straight across the road where the walls turn off it:

```ts
// 41 - 39 - 63 - 65 - (road, 0.3m out) - 53 - 45 - 37 - 35 - 59 - 61
//    - (road, 0.3m out) - 49 - 57 - 41            39.26m round, 44.23m²
```

It covers the carriageway and the four strips between the kerbs and the walls,
which are cut out of the ground to be covered by it, and it is cut out of the
ground as a plate: nothing stands under it. Its top lies 9mm to 32mm under the
road - 20mm by rule, and the rest the plate's 1.5m cells against the road's 2m
sections.

Where a wall ends on a kerb, and where it crosses one, the kerb gets a handle,
and the water gets one where a bank does: 107 handles now. The walls stand 1.24m
to 1.88m, and under the road they are topped out 14mm to 25mm under it. The seams traced to take the ground into its wings went too -
they blended the ground into walls that are not there any more.

## What the move broke

The brook now crosses the road at (25.86, 18.75); it used to cross a few meters
west of that. The deck's outline was read off a map against the old crossing, so
its corners no longer straddle the water: the near bank now runs _between_ the
deck's acute corner and its kerb, roughly along the carriageway, and no order of
[corner, bank, wall, kerb, corner] closes a ring without running across itself.
All four arrangements were tried.

So two rings are now closed by rule rather than by a fixed order of names, since
which way a bank runs follows the brook:

- the plate over the second crossing took whichever of its two wings' orders
  came out simple, and failing both, its points in the order they stood about
  their own middle. That brought its deck back, for a while - the crossing is
  down to its points now.
- the strip wall at the mill has no simple order left, so **it is not drawn**. A
  gap that says the shape wants re-cutting is worth more than a wall drawn
  across itself.

`DECK_OUTLINE` is the thing to re-cut, from handles picked on the model against
the brook where it now runs.

## Where the water stands

Not on the line it was set out from. The cut goes deeper than the line asks, so
a surface taken from the line floated over its own bed by whatever the
difference happened to be - measured across the channel, the ground lay 0.62m
under the water at the middle, at the banks, and four and eight meters out: no
bed at all, a ribbon over a plain.

The water now stands on the ground it is cut into, `WATER_FILL` deep:
`waterLevel` is the height field itself. The brook sits a median **0.08m** over
the ground, nowhere more than 0.18m, and its banks ask the ground for that same
0.08m and nothing else. The seam will make a lip of it, not an embankment.

What a line asks of the ground, measured over its handles: the road 0.35m to
3.89m **up**, the wall tops -0.20m to 1.59m up, the banks 0.17m to 0.81m up, and
the bed nothing at all - it is clamped to the ground wherever the ground is
already lower. A test holds that last one.

A point of the ground close beside a road is a cliff waiting to happen: it
carries the ground's own height, and where the road runs on a bank the two are
meters apart, so the triangle between them dives under the carriageway's own
edge. Everything within `FIELD_CLEAR` of a kerb is cleared away for that reason -
except on the outermost ring, which is never cleared, or the rim would lose its
shape. **There, and only there**, the ground takes the road's level instead.
Before that rule the road hung 2.53m in the air at the rim; after it, nought.
Applied to every point beside the road rather than to the rim alone, it buried
the crossings: the ground came up to the carriageway for six meters either side
and the walls went under it, a median 0.41m deep.

The last `RIM_KEEP` meters of ground are not cut for the road at all. Out there
one triangle of the ground is wider than the carriageway, and a triangle is
dropped whole: taking one away opened a notch in the rim the size of the
triangle, not the size of the road, which the skirt showed through as a pale
wedge. The band is laid over whole ground instead - by then the corridor has
carved it to the road's own level anyway, and what is left is a millimeter,
which the band's polygon offset settles.

Out past `FLANK_BEYOND` the rings are six to ten meters apart, and between a
held edge and the next ring the cut has nothing to work with: it fills the gap
with needles, triangles a hundred meters long and a hand wide, each carrying its
three corners' heights across everything between them. Hence the points laid
beside the road out there, and `needle()` as a net under it: a triangle longer
than `NEEDLE_LENGTH` with less than `NEEDLE_WIDTH` of ground across it is thrown
away. Dropping one leaves a slit of its own size - a few square meters, a
hand wide - which is why the points come first and the net second.

## What is not done

- Three seams are traced and cut: the lane, the brook and the mill's crossing.
  The rest of the ground is still held to the model's own lines, which the
  traced ones are cut in with rather than put in place of: where a traced seam
  runs along a kerb or a bank, both are the same line at the same height, and
  what the seam adds is its closing edges and the ground taken away inside it.
- The mill's plate is the old hand-read outline and not what the seam round it
  was traced to: the ground's edge on the mill's seam stands up to 3.9cm off it,
  on the leg over the lane's end. It wants re-cutting from handles, and the lane
  meets it 0.18m to 0.52m too high, which needs a hinge point so the plate can
  ramp up to the lane without standing through the road.
- Where the second crossing's plate leaves a kerb, the ground is at the road
  and the plate 2cm under it, for the first 0.3m of its edge - raise the plate's
  rim to the road outside the carriageway if it shows.
