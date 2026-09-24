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

Open the bench, take up the **Seam** tool (`S`), and four things are drawn -
while it is in hand, and only then:

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

Then <http://localhost:4322/>.

It is laid out as an editor is: the tools down the left - **Navigate** (`V`),
**Brush** (`B`), **Point** (`P`), **Seam** (`S`), **Place** (`A`) - with the
options of the one in hand beside them - laid out as a panel, folded away by
clicking its tool again - and under them undo, redo and the keys (`?`). A
tool's key tapped takes it up; kept down, it is in hand for as long, and the
tool before comes back when it is let go - as space does for the view. The
strip shows what is in hand for the moment pressed and what comes back
ringed, and the brush's options the mode a held `⇧` or `⌘/Ctrl` makes; the panels down the right - the view, the features, the season and what
is put up for it, the lights - each folded open or shut, the lot as wide as its
edge is dragged; and a bar along the foot with what is under the pointer
(where on the plan, how high, on what, which handle), how the view stands, and
what is being worked out. What a tool works with is drawn while it is in hand:
the seam and the handles for the seam, the handles and the place for a place,
the reference points for the point tool. Every tool's work can be taken back
(`⌘/Ctrl Z`) and brought back again (`⌘/Ctrl ⇧ Z`), step by step across them
all; `F` frames what the tool in hand has made; `Esc` goes back to navigating.

- **Drag** moves the view across the valley, the ground following the pointer;
  a **right button drag** turns the camera; **wheel** zooms. With a tool in
  hand, **space** puts it down for as long as it is held - a drag moves the
  view; a drag already begun goes on as it began. On a touch screen one finger drags as the mouse does, and two
  move the view as a map is moved: spread apart they zoom in, twisted they
  turn the compass with them, moved up or down together they tip the
  horizon - at the right button's rate. Nothing two fingers do is a click.
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
| The trees' tops                     | `TREE_TOPS` in `trees.baked.ts`, from `scripts/fetch-trees.ts`, `npm run data:trees`                       |
| The survey's height models          | `surveyModel()`, `toUtm33()` in `scripts/geosn.ts`, shared by `data:fetch` and `data:trees`                |
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
| `models/structures/hut.ts`        | the A-frame hut up the valley                                                        |
| `utils/mesh.utils.ts`             | `strut()`, `mitred()`, `octagonal()`, `dispose()`                                    |
| `models/terrain/tree.kit.ts`      | the shapes the trees are drawn with                                                  |
| `models/terrain/trees.ts`         | the woods and their understory                                                       |
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

The baked views are compared with the model apart, by `npm run test:views`
(`views.baked.spec.ts`): every view baked afresh and checked byte for byte
against its file, a minute and a half and more, so `npm test` leaves it out.
Run it after changing the model or a view, once the views are baked again.

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
whose top is eased between its edges rather than read off the road. And a
wall under a deck stops the deck's thickness and `UNDER_DECK` under the deck's
top, not at its own - they stood through the decks.

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

On the bridges and the mill's deck, a timber railing laid like a ladder
(`LADDERS`, `LADDER`, `createLadders()` in `models/structures/railings.ts`):
posts 7cm square in every corner of its course (a turn of more than 15°,
`corner`) - turned into it along the bisector, or square with the rails
where the corner is within 20° of a right angle (`squared`) - and at every
handle it passes - the end ones set in alike, their
outer faces 5cm in from the deck's ends (`inset`) - and evenly between those
at most 1.80m apart; a flat hand rail 12 by 3cm with its top 1m over the deck,
flush with the end posts' outer faces, laid in one piece through every point
of its course so it kinks sharp in each corner and follows each curve, mitred
all along (`band()`); a flat beam 6 by 3cm from 10cm up; and between the two
slats 2cm wide along the rail and 3cm deep across it, every 11cm. Each follows the edge of the deck it stands on
the way that edge is set out (`DECK_EDGES`: the mill's two halves and the
southern crossing's plate) - along the road where it follows the road,
straight where it runs straight, round the plate's nose - through the handles
given on it, 15cm in from it (`within`), every corner mitred (`insetLine()`),
and stands on the deck's top (`DECK_TOP`) wherever it is. Where a corner
sharper than a right angle takes that line off the deck, it ends where the
deck does. There are four:

- the southern crossing's south western side, `crossing:13`, `7`, `11`, `3`
  (61, 49, 57, 41 on the bench),
- its north eastern side, `crossing:1`, `5`, `9`, `15` (37, 45, 53, 65),
- the mill's deck by the road, `deck:4`, `16`, `17`, `3` (9, 31, 33, 7),
- and its other half, along the road wall's face and round the plate's nose
  to its corner, `deck:6`, `8`, `0`, `1` (13, 17, 1, 3).

Each stands on a band raised 15cm over the deck (`LEDGE`, `ledge()`): along
the deck's edge from end to end, as wide as the strip between the edge and
the kerb where the edge follows the road - 30cm on the bridges and the mill's
deck, 50cm along the road wall - and 30cm round the plate's nose, level across
and its outer face flush with the deck's edge, in the decks' own concrete. The
railing stands on its top, the posts let 24 to 59mm into it.

## The pavilion

On the terrace deck where the stairs come up (`PAVILION`, `createPavilion()`,
drawn with the houses), from the photographs: eight timber posts 14cm square on
an octagon, 1.2m apart - 1.57m out from its middle, 3.1m across - one side of it
square to the stairs, an eaves beam round their tops and a knee brace from each
post to either beam beside it, 0.45m down the post and 0.45m along the beam -
the two on a side 16cm apart, where at 0.6m they met, each cut level against the
beam's underside and upright on the post's middle (`cutStrut()`) - but
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

## The small house

Lotzebachstraße 27 (`ASIDE_HOUSE`) has no survey drawing: it is measured off
two photographs. One from the playground across the brook shows the wall to the
road square on - 924 pixels for the footprint's 12.41m, and the mill's door
beside it, 2.17m on the elevation, reads the same scale to a few percent. The
other looks down onto the wall to the hillside from the slope above. Eaves 4.1m
over the floor (2.5m of stonework under a 1.6m timbered knee wall), ridge 3m
over the eaves - the 5.6m and 3.6m it had before were never measured. Toward the
road three windows (0.9 x 1.25m), the front door and a flat arch 2.28m wide at
the west end; the east gable a pair astride the eaves line and a small one low
at its far end; the hillside wall one small window high up. Roof windows lie in
the tiles (`skylights`, 1.14 x 1.4m, their middle 1.13m up the slope from the
eaves' edge): three toward the road, two toward the hill. The chimney stands
0.7m in from the east gable, as both photographs show it.

The knee wall toward the road is timbered (`kneeWall`, drawn on its own - the
mill's frame is a different one): thirteen posts about a meter apart from 0.29m
to 12.10m, stone piers at both corners, a sill at 2.63m, a rail through every
panel at 2.88m and a plate at 3.9m, members 12cm, and in each end panel a brace
from under the plate at the end post down onto the rail at the next. The wall
toward the hill is stone to the eaves.

The ground in front of the door lies 14 to 19cm below the floor over the first
meter out, so the door stands on a stone step (`doorstep`, 1.4 x 0.35m), its
top level with the floor and its body run half a meter into the ground. At
the arch the ground stands 11 to 16cm above the floor instead, so the arch
starts on it (`sill`, 0.12m) and keeps its head where the photograph has it.

Its footprint wraps into a rectangle running west to east, the other way round
from the mill's, so its local front faces the hillside and its rear the road -
both measured from the east end. Not done: the west gable (on no photograph)
and what stands against the hillside wall in the middle.

## The A-frame hut

Up the valley, 12m east of the road's middle (`HUT`, `createHut()`, drawn with the
houses): an A-frame whose roof comes down to 0.72m over the ground, 3.74m wide
at its foot and 3.09m to the ridge, 4m deep, over a boarded box 2.67m wide. Its
gable faces south and carries a low door, 0.83 x 1.45m, with the hatch into the
loft above it, 0.75m high on the loft's floor at 1.5m - the one number counted
on site, and what the photograph square on to that gable is scaled by (187
pixels to the meter). The depth comes off the roof: three rows of boards a
meter each from the eaves to the ridge, which is the 3.02m slope the scaled
numbers give, and four along it. No photograph places it well - their cameras scatter over ten
meters - so it stands as it was described: back off the road, against the
tree line, which the survey's canopy has 10m east of the road's middle there;
its eastern foot is half a meter short of it. Nothing grows within 3.5m of its
middle.

A tree house stands in the woods too, its platform about 2m up; four small
previews of it are not enough to set it out, so it is left out.

## The woods

The trees stand where the survey's scans have them. `data:trees`
(`scripts/fetch-trees.ts`) reads the DOM1 less the DGM1 on the survey's meter
grid - how tall whatever stands on the ground is - smooths it once, and takes
every top of it for a tree: at least 2.5m, the highest point within a reach
that grows with the height (2m, to 4.5m for the tallest), with three quarters
of the samples round it at half its height or more, so a power line over a
field is no tree. Its crown reaches to where the canopy drops under 55% of the
top, or 60% of the way to the next top, 1.5m to 6m. That is 1661 tops within
312m of the yard (`TREE_TOPS`, `trees.baked.ts`), heights 12.6m, 21.9m and
31.8m at the tenth, the middle and the ninth tenth - which is what the woods
are drawn from, rather than scattered over OpenStreetMap's woodland, whose
outlines miss the real canopy by tens of meters in places. So the trees stand
as close to the houses, the pavilion and the road as the real ones do: the yard
open, the pavilion among tall trees, as the photographs show, and the meadow
up the valley an open strip 8 to 12m wide east of the road, with its young
trees along the road's edge.

A top is not taken where it cannot be a trunk (`KEEP_OFF`): within 1.5m of a
wall (that is the roof), 2.8m of the pavilion's middle, 2m of the Christmas tree, 1.5m
of a deck's edge or on it, 1m past a road's edge, 0.3m past the brook's, or
within the hut's clearing. What is left is 1455 trees: under 8m a young tree
(105), within 7m of the brook an alder (52), and of the rest three in ten oaks
(388) and the others beech (910) - the scan cannot tell those two apart, so a
hash of where each stands does. A young tree's crown is held to 0.45 its
height: in the open the scan reads the grass round it into it. One young tree
by the brook's railing reaches 0.5m over it, as the one in the photograph does;
no other crown comes within 0.3m of a structure. A tree the scan misses but
that is remembered is set by hand at a handle (`SET_TREES`): the oak by the
pavilion's stairs, 20m high.

The shapes are a kit of their own (`tree.kit.ts`): four shapes a kind, each a
stem forking into a limb per lump and a crown of a leader's lump with others
round it in two tiers, sky between them - beech narrow, oak broad, the alder
forked low into two or three stems under a round crown, the young tree thin
with an open crown; the spruce three stacked cones. A shape is two pieces:
the stem, a unit tall and stretched from the ground to the fork, and the
crown with its limbs and twigs, drawn in crown radii and scaled the same way
every way - so a tall tree with a narrow crown gets a long stem, never a
drawn-out crown. The crown takes the scan's radius unless that leaves the stem
less than a quarter of the tree. Bare from 44% to 78% of the height, 67% in
the middle. 94 to 178 triangles a shape near the yard, where a textured
library tree (ez-tree) is 2,800 cut down and 25,000 as it comes. Only within
120m of the yard (spread 15m either way tree by tree, so no ring shows) is a
tree drawn in full, 337 of them; past that each takes the far form of its own
shape - the leader's lump and one other, one limb into each. Every point of a
beech's or an oak's limbs above the crown's underside lies inside a lump; the
alders' limbs come up into theirs from below, the one place they show before
they reach a lump - by at most 0.18 crown radii; the alders and the young trees
keep their lumps in one tier (`tiers`) under a deeper leader's (`leader`), so
nothing else of them stands bare.

The Christmas tree (`CHRISTMAS_TREE`) is the one tree set by hand, and stands
in winter only: a spruce 6.4m tall, put up on the terrace inside the stairs'
U, 0.42m in off its inner wall from the middle of the wall's top between 97
and 99 - the railing runs on that line, so the stem stands 30cm off it - (`stairs:u-back-end-inside:top`, `stairs:u-inside:top`), on the side the fill
lies, and its lowest tier hangs out over the railing. It stays green: its crown
has a material of its own marked `snowless`, which neither the shader nor the
bake lays snow on - half white it read as a tree left out. Its meshes say
`season: 'winter'` in their `userData`, and every other season puts it away;
the season's decorations and lights are to hang on it.

A dump is made ground (`ON_FILL`, 5cm deep): no shrub grows on it, and a tree
the scan has on one grew on the slope it was piled against, so it is moved out
to the dump's edge, the nearest point where the fill runs out - the one on the
terrace deck is. Every tree stands on what the dumps lay on the ground.

Every broadleaf carries the wood it shows in winter (`twigs` on a shape):
each limb carried on from where it stops inside its lump out to the crown's
skin, thickening less as it goes, and four twigs out of it on the way, each
with one of its own off half way - so a bare crown has the crown's outline,
filled with a fan of lines, and no limb ends where a leaf used to hide it. The
far forms carry on their two limbs, three sided, with one twig each.
It is inside the crown while it is on, so it is hidden and costs a summer's
bake nothing. The shrubs have theirs too: rods out of the ground round the
foot up to each lump's skin, each with one more off half way.

The seasons (`Season`, `seasonTrees()`, `setSeason()` on the scene, the
editor's Season select): in spring the broadleaves' and shrubs' crowns take
`foliageSpring`, fresher and lighter; in autumn each tree turns on its own in
autumn's own colours (`--kvlm-color-autumn-gold`, `-orange`, `-rust` in the
brand's `globals.css`) - a beech between gold and orange, an oak between
orange and rust, an alder mostly still green, since it drops its leaves green,
the young trees and shrubs anywhere between, and one tree in eight not turned
yet; in winter their crowns go and the bare wood shows - 119,000 triangles in
place of the crowns - and snow lies. Summer is the palette's `foliage`, as it
always was. Each crown's own variety is kept as a share (`Shade`, in the
crowns' `userData`), so any season lays its colour on the same variety. The
Christmas tree stands in winter only. Every mesh of the woods is named for what it
holds and says so in its `userData` - `species`, `part` (wood, crown or
twigs) and `evergreen`.

The snow (`prepareSnow()`, `snow.ts`) is laid in the shader of every lit
material, once, when the scene is made: whatever faces up turns
`--kvlm-color-snow`, starting where a face turns 0.35 of the way from upright
to level and whole from 0.7 - the ground, the roads, the roofs, the decks and
the spruce's tiers, while walls, stems and railings keep their colour. It is
one number, nought to one, which a winter sets; it needs no second copy of any
geometry. The brook is left out and runs on; what is drawn unlit, the
windows, takes none.

Under them an understory (`BUSH`): a shrub under 55% of the canopy's trees,
somewhere under the crown, 1.5 to 4.5m - near the yard two or three low lumps
round a taller one, each standing on the foot's line (`shrubShapes()`), far
off a lone lump. A shrub's underside rises at about 24° and the valley's sides
are steeper, so each is sunk until its underside meets the lowest ground under
its inner half - one of lumps further, to 0.35 of its radius over that ground
rather than 0.6, since its underside rises between the lumps too. Of 712, none
shows a gap of more than 6cm there, and half show at least 70% of their
height.

What the woods cost the views, packed: the still one 397 KiB, the path 1103,
the whole model 1945.

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
surface and how far beside it, and set where it is let go of. To move the view, hold space, which puts the tool down. The list keeps every point with its height to edit, and one to take away;
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

For what a dump's ring cannot say, the bench has a brush (`B`), its mode picked
beside it (`1` to `4`): a drag over the ground piles landfill on instead of
moving the view - a right button drag turns the camera, as always, and with
space held the brush is put down, to move the view. Held while dragging,
`⌘/Ctrl` turns raising into lowering and back, and `⇧` smooths. The ring
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
height last, all to the centimeter. The brush's options count them, the editor's undo takes
the last drag back, and a reload keeps them. **copy** gives `export const BRUSHES` to
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

## The views and their seasons

A view is baked in one season (`season` on its `VIEWS` entry), and later in
one light: another season is another view, baked when it is set up and
fetched by the site when it is wanted, as the demo does. `npm run data:views`
sets the woods for each view's season with `seasonTrees()` before baking it,
and in winter lays the snow on the colours in the bake itself
(`bakeView(…, { snow })`), by the same rule the scene's shader lays it
(`snowOn()`, `snowless()`). `views/manifest.json` lists each view's season. The
first three views are summer's. `kvlm-scene` takes a new `src` in place: it
puts the old view away once the new one is in - its buffers given back, its
listeners gone - and a free view keeps where it was turned to, a path view
where it was on its way. The editor starts in summer.

Bark lets snow lie from a tilt of 0.15 and whole from 0.45 (`snowLies` on the
material), not 0.35 and 0.7: a limb and a shrub's rods catch snow along their
tops that a roof at the same slope would shed.

A loop (`loop`, the yard loop's four views) closes its path on itself:
the curve runs on from the last point back to the first, each end's
neighbours the other end's, and the site flies it round and round at an
even pace - a minute for its 150m - rather than there and back.
Each of its points may stand at a height of its own over the ground and
look down by a pitch of its own, eased between them as the eye and the
look are: it starts at a grown-up's eye height in the street, climbs to 6m
round the pavilion on the hill, and comes down to the yard, the workshop's
gate and the mill's front. One loop, four seasons: a winter's evening at
17:00 with the lights on, a spring afternoon at 15:30, a summer's midday
at 13:00, an autumn morning at 9:30. `npm run data:views -- loop` bakes
only the views whose names hold a part given, and keeps the rest.

## The sky

`skyOf()` (`sky.ts`) gives a season's sky from the brand's colours: the spray
blue overhead (`skyDeep`), paled and greyed by the season, paling into the
haze at the horizon - warmer in autumn, white-grey in winter. The sun is set
for the mill rather than by the almanac: the mill's front looks north over the
road (354°, off its footprint) and the workshop's yard side north north east,
and an honest sun over Dresden lights neither for most of the year. So it
stands turned off the mill's front - 40° to the morning side in spring, 30° in
summer, 35° and 30° to the evening side in autumn and winter - falling across
it at a slant and on the workshop with it, and only its height is the
season's: 34° in spring, 52° in summer, a low 17° in autumn, whose long light
through the haze makes the leaves glow, and 13° in winter. The lower it stands the warmer it lights. The
haze takes seven tenths of all it takes 900m off in summer, 700m in spring,
520m in winter and 420m in autumn, and never more than a half to two thirds -
the far rim stays in sight (`hazeAt()`).

Or it is set by the clock (`setTime(hour)`, the editor's Time; `hour` on a
view): the sun where the almanac has it at that hour on the season's day
(`sunAt()` - mid April, the longest day, mid October, the shortest, on the
clocks' time then, Dresden's latitude and longitude), its light rising and
warming towards the horizon, a warm horizon round sunrise and sunset, and
after dark a night sky and the moon opposite the sun, as bright as the moon is
full (`moon`, `setMoon()`, the editor's Moon; a quarter, `MOON`, unless said):
the fill light falls to 5% at new moon and 20% at full, the moon lights at
half its fullness and its shadows are as faint, so the night is dark round the
windows' light, not lit like a full moon's. The editor starts at noon, its
Time slider running minute by minute from 00:00 to 23:59. Without an hour the
sun is the one set for the mill. Windows and lamps switched on by the hour
are to follow.

The street lamps (`STREET_LAMPS`, `streetlamps.ts`, with the roads' layer):
a thin 7m mast, a short arm out over the road's middle and a small head,
shining down in a warm pool - halved 3.5m off, gone by 18m. The first stands
at the mill's east corner (`mill:1:top`, 69 on the bench), the next past its
west end 315m along the road from its northern end, the third at 210m, and on
up the valley every 42m from there; down the road to the south there are
none. They are lit apart from the windows (`setLanterns()`, the editor's
Lanterns; `lanterns` on a view, as the windows' unless said). The two by the
yard cast soft shadows as the pavilion's bulb does; the others do not.

A lantern hangs on the wall beside each of the mill's two street doors and
beside the small house's front door (`doorLanterns`): a round bulb under a
dark round head with a rim, on a short arm, dull by day and lit after dark,
shining out of the wall down and to the sides - the rim keeps it off the wall
above - and brighter than a lit window, being a lamp seen bare.

In winter the road carries wheel tracks (`TRACKS`, `tracks.ts`, with the
roads' layer), the lane none. On a road under snow nobody keeps to a lane:
every car drives down the middle, on the line one would drive it - cut in
towards the inside of each bend, 1.6m for each radian it turns over 16m, at
most 0.9m, smoothed over 13m (`idealLine()`) - and each of eight cars a little
off the last one's, at most 0.3m, wandering 8cm either way. Its wheels are
1.55m apart and 18cm to 24cm wide, and the fresher its tracks the more of the
tarmac they show. They lie on the road's own surface, in snow driven hard and
grey, and take none of the fresh.

Strings of lights run along the terrace's and the stairs' pipe hand rails -
not the timber ones on the bridge and the decks - for summer and winter
(`LIGHT_STRINGS`, shown by season - `userData.seasons`): from post to post,
sagging a little under the rail between, a bulb every half meter, lit with
the windows, every one a faint light of its own (`string`, halved 0.8m off,
gone by 4m, a fourteenth of a bulb's), 65 on the terrace's and the stairs'
rails. The bake shades each with the rails' and the posts' own shadows, from
its middle - small and one of many, its neighbours soften the edge - so the
posts throw their fine overlapping shadows across the steps; the scene lights
with them unshaded (`mapsShadows()`), up to 160 lamps. The street lamps light in `--kvlm-color-lantern`,
more orange than a room's warm white, the wall lanterns as a room does; the shader and
the bake sum the two apart. The bake's lamp shadows look only at the triangles whose
direction from the lamp a ray takes (`binned()`), and test them through a
tree of boxes split where a ray is cheapest to send through it (`Triangles`):
a view's lamps take seconds.

`npm run data:views` bakes the views side by side, a worker a core as the
memory holds, the longest first as the last bake took them (kept in
`node_modules/.cache`) - or, never baked there, as long as the view's own
spec says it takes: a path, a loop, after dark, things put up - and within a path view shares its eyes out across
the workers - each eye sees on its own, so what any saw is kept, in whatever
order they are put together. Nothing comes out different for it: a view is
the same byte for byte baked alone or among the rest. The occlusion's and the
shadows' inner loops make no arrays per pixel or per ray, which halved what
the whole bake costs; all 26 views take a little over a minute. Each worker
registers the loader for the script's types itself, as not every node hands
a worker the flags it was started with; node 26's zlib packs the same bytes a
little tighter, so a bake there rewrites every file unchanged inside. The test that
holds the views to the model bakes them afresh in the browser, three workers
side by side - the workers of a page share one heap, and five ran out of it -
the longest first by the same estimate (`bakeCost()`): a minute and a half.

The editor's scene stands at once, round nothing, and the model comes in a
part at a time (`MODEL_PARTS`): each built in one of a few workers
(`parts.worker.ts`) as the layers shown need it, handed over as plain arrays
(`packPart()`, `unpackPart()`), its shaders compiled before it is put in -
after dark against the lights as they will be once its bulbs shine
(`addPart()`). What no layer switches - the garden, the decorations - comes
with it; what is not shown is not built until it is. A layer switched off
while its parts are on their way stops their workers. The terrain's worker hands the dumps it laid back
(`fillFaces()`), and the page and every worker after take them
(`seedFillFaces()`) instead of laying them again: two seconds each. The
seam's network and the places, seconds of work too, are worked out in
workers of their own once their layer is switched on - the places once the
ground they lie on is in - and stopped if it is switched off before. All of
it says how far it has got in the one readout at the top, which is all the
page shows until the first part is in. The Preview bake says how
far it has got the same way (`progress` on `bakeView()`).

The editor's Preview bake bakes the view as it stands - where the camera
is, the season, the hour, the moon and the lights - as the site's views are
baked (`viewFrom()`, a perspective eye far enough back to see the span, 60°
wide), in a worker off the page's thread, and shows it as the site draws it,
in `kvlm-scene`. The worker builds the model once from its source, so brush
strokes not yet copied into it are left out; the first bake takes the longest.

The editor's Sky and Particles features switch the sky - its colours, its sun
and its haze - and the season's drift off and on, whatever the season.

Its Lights panel switches what lights apart from what is put up: the windows,
the street lamps and the strings of lights each left to the hour or switched
on or off, the fires laid burning or put out - the stones and logs stay -
and the rooms' lights (`licht-*`, which are tags and nothing else). The
Season panel puts up the rest. Strings and fires are the editor's: a view is
baked with them as the hour has them and burning.

The scene draws it (`setSeason()`): the sky as its background, the sun's disc
and its light from where it stands, whichever way the camera turns, and the
haze as fog - thickening past the ground in front, since the editor's camera
sees without perspective. A view is baked with its season's sun lighting it,
and carries the sky in its header; `kvlm-scene` draws the sky behind it - one
triangle over the canvas, coloured by the way each pixel looks, the sun a disc
in a glow - and fades every face into the haze by its distance, as `hazeAt`
has it.

The lights come on after dark (`lightWindows()`, `lightsDue()`, `setLights()`,
the editor's Lights switch; `lights` on a view): six windows in ten have a
light on behind them - which ones is fixed by where they are - the roof
windows too, the doors never; the workshop is one big room (`allLit`), and
every window of its walls is lit - the lean-to's door and its small window
are not, they are the toilet's. Its gate is open (`gateRoom`): the front wall
is drawn on its own, 0.5m thick with the arch cut through it, and behind it
the room, its floor the decks' concrete, dim by day and lit warm after dark,
its light going out through the gate onto the yard as a lamp as wide as the
gate. All in `--kvlm-color-window-lit`, and
each throws its light out (`windowLamps()`, `lamps.ts`), square to its own
wall, onto whatever faces it - the ground in front, a wall across the way. A
window shines softly outwards, strongest straight out and nothing along its
own wall, opening to about 80°, halved 2.2m out per meter of window and gone
by 14m. The open gate throws a cone instead: it starts at the wall under the
gate, as wide as it, and runs out across the yard square to the wall, opening
0.6m either side per meter out, halved 1.1m out per meter of gate and gone by
7m. A roof window lights the sky and throws none. A bare bulb hangs on its flex
from the middle of the pavilion's roof, 35cm under its eaves' line, dull by
day and lit with the windows, shining all round - onto the posts, the rails
and the deck - halved 1.8m off and gone by 9m (`BULB_LAMP`). In the bake every light casts
shadows (`castsShadows()`), and a lamp's light is worked out only where it
counts: each point asks only the lamps whose reach it is in (`lampGrid()`),
a shadow is looked for only where the lamp would light it more than faintly,
and a corner shared by faces alike is lit once. A face is split where a
lamp's light parts across it down to 0.4m, as a sun's edge is down to 1.5m -
a pool of light a few meters round drawn as it falls rather than as wedges
across the ground's big faces. That took a night's preview from about 65s to
about 8s. On the ground a lamp's light is not a corner's colour at all: a corner's
colour smears a shadow's edge over the face, and the ground's faces are
half a meter to meters wide. It is drawn on a lightmap (`LIGHTMAP`) - a grid
of 5cm cells seen from above, 40m round the eyes, day and night, over the ground and what is laid on it (`GROUND_PARTS`:
terrain, dumps, ways, brook, decks, tracks), its heights read off a grid of
their own and the way it faces off them 10cm either side, lit cell by cell
with every lamp's light and shadow. A post's shadow is thinner than a 15cm
cell: read at the cells' middles it came out as a row of cells meeting at
their corners, which the filtering drew as beads. So the cells are 5cm, and
one that differs from a neighbour - by 0.01 and 6% of the brighter - is
read again at four points across it on a turned grid and takes their mean. A face that looks
up and lies uppermost there anywhere - within 30cm, so the terrain under a dump takes
it too, and a face running on under a wall takes it where it is seen, each
corner looked at a little into the face - carries only the sun's light in its corners and an albedo beside
them, and `kvlm-scene` adds the map's light onto it pixel by pixel, where the
bake adds it: to the light, before it is written sRGB. Each cell keeps the
roots of the warm white's and the orange's shares of the most light it holds,
a byte each, so a faint light fades in as fine steps as a bright one. The
walls, and what stands under a roof or a crown, keep the lamps' light in
their corners. Every light's shadow: every point it lights is tested against the
triangles within its reach, the lamp itself left out - softly, from round it,
for the bulb and the street lamps (`softShadows()`), from its middle for a
window, the gate, a lantern and a string's bulb. The editor is for editing:
it draws the lights unshaded and the strings' bulbs light nothing there
(`mapsShadows()`, `litInEditor()`); the Preview bake shows them in full. Their edges are
soft: the scene's map is filtered wide, and the bake counts a bulb as the
ball it is (`size`, 50cm across for the pavilion's), a point lit as much as
it sees of 32 points spread through it - eight first, and the rest only
where those part, on an edge. The triangles round a lamp are sorted
into a tree of boxes (`bvh.ts`), so a ray is tested against the few in the
boxes it passes: the night's preview's lightmap went from 21s to 2s at 15cm
cells, and 5cm cells with their edges read again take about 25s. The map's cells face as the
ground's heights run smoothly between them: read cell by cell, a slope
steps, and the light on it bands along the terrain. A cell whose ground is
hidden under what stands on it - a plinth, a wall, a trunk reaching within
30cm of it (`LIGHTMAP.covered`) - is not lit but takes its open neighbours'
light, or the filtering smears its dark out along the edge in a step each
cell. So the panels
keep it off the rails outside them, and the posts throw their shadows out
across the deck. The scene's shader lights
with it next to the snow (up to 64 lamps), and the bake counts it the same
(`lampLight()`). It lights the place; nothing glows. They are due once the sun is under 3° at the hour set, and
never by the sun set for the mill; the editor's switch starts from that and
can be flipped by hand, until the season or the hour changes. Glass with no
light behind it darkens with the night, to a twentieth of its day's shade - nearly black - and so does a dark room seen through its gate.

A view is baked the same (`setUpView()`): the woods in its season, the
windows lit as its hour and its lights say, the snow laid in winter - and its
shadows, drawn in software (`SunShadow`, `shadow.ts`): every triangle laid on
a grid 4096 cells across square to the sun, each keeping what stands nearest
it; a corner is lit by the share of 25 samples round it that nothing stands
over, spread as wide as the sky's softness, and dimmed as dark as its
strength. A face longer than 3m within 60m of an eye - of the yard, for a free
view - is split in four where its corners' light parts by more than 0.35, down
to 1.5m and three times over, so an edge is drawn where it runs: the views grow
by a quarter for it, the still one to 503 KiB. What drifts in autumn and
winter goes into the header (`drift`) and `kvlm-scene` draws it on the card -
the same seeds, the same box, the same fall - frame by frame while it is on
screen. Two views show them: an autumn afternoon at 16:00 and a winter
evening at 17:00, lit.

The scene's sun casts shadows (`SHADOW`): everything built casts and takes
them, the ground too, so a low sun lays the valley's own side over its
bottom. How dark and soft they are is the sky's (`shadow`): a season's own
strength - summer 0.9, spring 0.85, autumn 0.8, winter 0.55, whose light is
weak and comes much off the sky and the snow - paled a little the lower the
sun (to 0.7 of it under 5°), and softened a little from a hard edge at 35°
up - a tree has to stand on its shadow, or it floats. A shadow map cannot fade a shadow along its length; a
pale soft shadow is what a low sun really throws. The map, 4096 square, covers three quarters of the span either way
round what is looked at, 30m to 220m, which keeps them sharp.

What drifts in a season (`Atmosphere`, `atmosphere.ts`): leaves coming down in
autumn in the autumn colours, 600 of them, coming down steadily, swinging a
little and carried along by the wind, and snow in winter, 5000 flakes,
slower. Each is drawn its own size - a leaf 10cm, a flake 2.5cm, each half to
one and a half of that - by how many pixels a meter is on screen and, in the
site's scene, by how far off it is, fading rather than shrinking under a
pixel; the editor, which sees without perspective, keeps them at two pixels
at least. They stand in the world, not on the screen:
every point has its place on a grid of boxes over the valley - 40m, 80m,
160m or 320m across, the first that takes in the span - and is drawn in the
box round what is looked at, so moving the view moves past them, and a point
steps round to the far side at the box's edge. Fallen through, it starts over
at the top. While anything drifts the editor draws frame by frame (`moving`,
`tick()`), and not otherwise. Spring's is on
the ground: flowers in patches on the open meadows near the yard (`FLOWERS`),
where no crown stands over them and nothing is built, laid or piled - 6350
small tetrahedra, daisies white, dandelions yellow and a few violets
(`--kvlm-color-flower-yellow`, `-violet`), there in spring only.

## The sun's shadows on the ground

The ground's faces are half a meter to meters wide: a post's or a trunk's
shadow read at their corners was gone, the bake showed none at all. So the
lightmap carries the sun too, by day as by night: a third byte a cell, how
much of the sun reaches it, off a sun map of its own drawn from what stands
within 60m of the map (cells of about 5cm), and the rest - the hills, the far
woods - off one of everything further, looked at 2m towards the sun so the
terrain's big faces that reach under the map do not shade the ground they
are. A face that takes the map carries its light as in full shadow; `kvlm-scene`
adds the rest by the pixel: its albedo, the sun's share a shadow takes, how
it faces the sun - its own normal, off the place's derivatives - and the
map's share. A soft edge's samples are held against the surface's own plane
(`lightAt(point, softness, facing)`): a low sun grazes the ground, whose
depth runs away a meter over them, and the fine map read the open ground at
most three quarters lit. The editor's shadows are held off their faces by a
map cell's width along the normal, no longer 4cm - a winter sun threw a
post's shadow 17cm off its foot.

## How the houses sit

Each house stands at one height (`sitting.ts`): the lowest the drawn ground
came to along its walls, just outside them - the mill's measured along its
terrace's street edge, which is its front - and is sunk into the ground
everywhere else. Measured once and written down (mill -0.47m, small house
-0.23m, workshop -0.01m): read again off ground that is held to it, the
ground just past the held edge falls away towards the road, and the mill
sank 2cm with every bake. Every corner of its walls is a handle
(`house:<name>:<n>`) - the workshop's round its lean-to, an L, and the
mill's out round its terrace. The terrace's street edge is a line the
ground is held to, straight at the mill's height: left to itself the ground
rose into the western steps and stood off the corner at the other end. The
mill's deck keeps a meter off it (`TERRACE_FRONT`): its corner at the lane's
end slides on along the lane's end to it, and its corner across the road is
where that line meets the far kerb, so its edge runs square to the terrace
rather than to the road. And the ground is cut out under each house: a
seam traced round its corners (`house`, a kind of handle of its own), held
at the height the ground had at each corner before the cut and eased
straight from one to the next along the walls, and taken away inside - it
came up through the workshop's floor behind the open gate. Read off the
ground as drawn, the corners and the walls between them fed on their own
cut, and every bake came out different; written down, two bakes are one.
Measured: nothing left inside, the ground along the walls 2cm off how it
lay on average and 13cm at most, and nowhere under a house's base but by
1.8cm on the terrace's edge, which the terrace's slab reaches 2cm under.
The editor's sun shadow is held off by 3cm, set in
meters: its depth bias counts against the 600m its map spans, and 0.0004
stood every shadow a quarter of a meter off the wall that cast it.

## What is put up for an event

What is put up for an event rather than there all year is a decoration
(`DECORATIONS`, `decorations.ts`), tagged, and shown only where its tag is
asked for: by a view (`decorations` in its spec) or by the editor's switches
in the sky's panel - never by the season. The strings of lights are one
(`lichterkette-gelaender`): they used to hang in summer and winter by themselves, and
the views baked in those seasons ask for them now, so they came out as they
were. A campfire at each of the places a fire is laid (`feuer-werkstatt`,
`-selbis` - 2m further along the small house's front towards the road than first set, as far off the front, its point 45 moved with it -
`-terrasse`, `-hexenhaus`, `CAMPFIRE`): a ring of stones, six
logs as they were thrown on - each its own length, thickness and lean,
round unevenly, one fallen out across the stones - and a flame of four
tongues that is a light of its own (`fire`: orange, low, soft shadows,
burning whenever it is laid, whatever the lights are). In the editor the
tongues flicker frame by frame, a few waves laid together that never quite
repeat, and the fire's light with them, handed to the shader in its lamp's
width; the bake takes it steady. Flickering, the editor draws at 15 frames a
second and leaves the sun's shadow map as it was - only the fire's own light
changes. At the workshop the bar (`bar-werkstatt`, `BAR`): a 2m table under a
white cloth to the ground, behind it a 1.9m beverage fridge with a glass door,
its bottles standing inside the recess behind the glass, and a smaller white
fridge of 1.6m. And the grill (`grill-werkstatt`, `GRILL`): 1.5m by 0.5m,
0.85m high on four legs, brushed steel, a plate between the legs half way
down, an open trough under a Rost of thin bars along its short side, and the
Glut deep in the trough, 16cm under the bars and 8cm in from its sides - a
glowing bed of coals, some gone to ash, and a light of its own - a fire's, an
eighth as bright (`GRILL.glow`, handed in its width, which the flicker scales
rather than sets), down on the coals, so the trough's sides hold it in and
only a little of it gets out above, through the bars. The workshop's hall lights by a decoration
too (`licht-werkstatt`, the profile's `light`): its gate room and its four
windows lit after dark only while it is up, and dark at night while it is
not - the winter evenings ask for it. And the
Vereinsraum (`licht-vereinsraum`): the lean-to's door stands open onto the lit
room behind, its light going out onto the yard as the gate's does, and its
small window lit - its own light, apart from the hall's; while it is not up
the door is shut and the window dark (`decorationOff`). A decoration that is
not up lights nothing: its lamps are left out of the bake, and in the editor
each lamp knows what it is the light of (`source`) and lights only while
that is shown. The hall's light and the Vereinsraum's are lights of their
own (`ownLight()`): they come on with their tag, whatever the Lights switch
says, as the lanterns do.

The hall is a room of its own (`createGateRoom()`): its box ends at a
partition across the house at the lean-to's inner end (`PARTITION`, 0.2m,
`leanToEnds()` for where that is), the line the places `werkstatt-saal` and
`werkstatt-buehne` part on - the rear wall's corner to the corner inside the
lean-to. It used to run the whole length, so the lit room reached under the
stage and the Vereinsraum. Its floor and walls, lit and dark, end at the same
place (`hallSpan()`), as both are made from the one span. Measured: the room's
nearest face 10cm off that line, half the partition, and nothing of it past.
The stage (`buehne-werkstatt`, `STAGE`) is a platform of boards 40cm high
filling the outline of `werkstatt-buehne` on the Vereinsraum's floor, 0.53m to
0.93m over the ground. It stands inside the house and is seen only with the
walls out of the way.

The benches are beer-tent sets (`SEATING`, `seating.ts`): a table of 2.2m by
0.5m at 0.76m and two benches of 2.2m by 0.25m with their seats at 0.47m,
boards of pale spruce on folding frames of grey steel tube, as the sets are
built: at either end of each board a pair of legs splayed out towards the
ground - 0.40m apart under the table, 0.46m on the ground, a bench's 0.16m
and 0.22m - a tube across them 10cm over the ground, a brace from there up
to the board's underside 0.4m further in, and the batten under the board the
frame folds on. The first try crossed the legs in an X under the boards and
read as trestles, not as a set. They are set out in rows over
an area (`baenke-werkstatt-vorplatz`, `-muehle-vorplatz`,
`-terrasse-pavillon`) along its longest edge, from one corner in steps of
2.7m by 2.3m, each at least 0.6m inside the outline and 0.8m off a fire, the
bar, the grill, the walls, the steps before the lean-to's door, the
pavilion's posts and the ways (`keepout()`). A set stands on whatever lies
under each foot (`surfaceAt()`: the ground, what is piled on it, a deck, or
a way - whichever is highest), each leg as long as that needs and the boards
level at the height of the highest foot; one the ground falls away under by
more than 20cm is left out, and where more would fit than ten the sets are
thinned evenly. Six sets stand before the workshop, six before the mill, nine
on the pavilion's terrace. Measured, each foot raycast down against what the
model draws: 252 feet, worst gap under a tenth of a millimeter, and from each
board's middle 0.9m over the surface a ray down meets the surface and nothing
else, so no set stands through a structure. The first try put sets on the
lane beside the mill's deck, which stands 6cm to 21cm over the ground there
as the road did; the lane is a keep-out now, and `surfaceAt()` knows the
ways' own levels.

Nothing is put out within 2.5m of where a still view's eye stands
(`EYE_CLEAR`): on the pavilion's terrace a figure's head filled the
SOMMERFESTival's picture. There are no figures for now: boxes with a head,
they looked like building blocks rather than people.

At Christmas the A-hut (`weihnacht-hexenhaus`) has a string of warm bulbs
along the four edges of its roof under the gables, from the foot to the ridge
(`hutRoofEdges()`, in the hut's own frame by `onHut()`), hung by the same
`strand()` as the railings' lights and in their group, so the lights switch
puts them out by day and on by night with the others; two bulbs to each of
four steps per edge, each a light of its own. Beside it a fir of 2.1m on the
west side, four tiers, eighteen baubles and a star, 2.8m off the hut's
middle and 4.8m from its campfire (`CHRISTMAS`); and on its door a wreath of
17cm with a bow and three baubles.

## The garden before the small house

On the lawn between the small house's lane and the brook, as the photograph
from the lane between the houses has it (`GARDEN`, `garden.ts`): the old
millstone laid flat with pots round its top, the sandbox by the lane with a
few toys, and down by the brook a table of 2m with a bench either side and the
swinging seat on its two A frames, leant in at the top - and the fire before
the small house to the west, out of the photograph. Each stands at a point of
the bench, 264 to 267 there (`point:46` to `49`), to be moved; the sandbox is
turned square to the lane, the table, its benches and the seat along the
brook (`brookTurn()`), the seat's back to the water and the benches' away
from the table. The sandbox stands level on the slope: its top over its
highest corner, its boards down into the ground at the lowest - the lawn
falls half a meter across it here, where the photograph has it nearly flat.
The shrubs are the woods' own (`GARDEN_SHRUBS`, `gardenShrubs()`) and grow,
turn and go bare with them: the big one by the road (268), the hedge along
the brook behind the seat from one point to the other (269, 270), a shrub
every 1.7m, 1.6m to 2.4m high, and two hydrangeas (271, 272), their white
heads out in summer and autumn. The picnic tables and the seesaw first set
here were not there.

The garden lies on two plateaus, as the photographs have them, not the slope
the scan smoothed through it, split by a dry stone wall (`GARDEN.wall`) - a
plain band as the other walls are, 0.45m thick, standing on the upper
plateau's side of its foot line. It starts at the millstone's socket, its
line through the stone's middle, and runs on along the brook, curving, to
its end (329 on the bench); a second wall turns off there towards 290, level
with the upper plateau for 3m and its top then running down to the lawn at
4.88m (`GARDEN.endWall`), one band with the first, mitred at the corner.

The upper plateau (`FILLS`) is level at 0m, flush with the wall's top, out to
where the ground towards the lane and the hillside comes up to it - and on
past the second wall to 326 and 343, its trees standing on it where they
grew (`holdsTrees`) rather than moved to its edge as on any other dump. Past
the second wall it comes down to the terrain by a bank of its own, along its
edge and along the second wall's sloping top.

The lower lawn sinks along the brook as the road beside it does, its edge
0.65m over the road's level: -0.5m at the millstone to about -1.9m at the
second wall, so the dry wall grows from 0.5m to about 2m. It runs from the
lane's edge east of the millstone and the dry wall's foot out to its edge
over the brook, and ends along the second wall's front, down past its end
to the ground (346, 347) and back by the bank's foot (293) to 290 - its
corners at 290 and 347 rounded by a point either side and one between. Its
ground is lower than the scan's along the wall, so that strip is cut out of
the terrain (`SEAMS`) and the lawn laid in its place; a seam of reference
points reads their heights eased from one to the next - read off the ground
as drawn, it fed on its own cut and rose two meters a bake. From the lawn's
edge a steep bank runs down to its foot 1.6m off the water, ending on the
line from 293 to 290. East, towards the mill, a ramp brings both down onto
the ground. A dump holds every reference point inside it at that point's
own height, so the garden's points stand at the lawns' - left at the old
slope's, they pulled dents into them. The woods' shrubs stand on the filled
ground as the trees do. The swinging seat's four feet lie within 24cm.

The hedge runs along the lower lawn's edge from 270 past 271 to 284, a
shrub every 1.7m; the bank between the stairs' lower wall and the road's
railing (123-127), a strip under 2m wide, has seven small shrubs scattered
from a fixed seed and a young tree at its end by 127 (`SET_TREES`).

## Light in the valley, and autumn's golden hour

The mill lies deep in its valley, and the light down in it goes by how high
the sun stands over the ridges round it (`RIDGE`, 8 degrees), not over the
horizon: evening comes earlier and morning later than the almanac's, and the
lights go on sooner - in autumn from 17:01, in winter from 14:05. The sun set
for the mill, with no hour of the clock, stands over the ridges as it is.

Autumn's low sun is its best light (`GOLDEN`): below 32 degrees it turns a
deep gold and stronger, the fill under it dims and cools to blue, and the
horizon warms, the more the lower it is - and its shadows stay dark and
crisp down low, where the other seasons' pale and soften. The autumn welcome
by day is lit by the sun set for the mill, 13 degrees over the mill's front:
by the clock its late afternoon sun stands behind the mill from there, and
all the view saw of it was shade.

## The places the events use

Every place an event is held is named once in `PLACES` (`places.ts`): an
area - a ring of handle keys round its ground, counter clockwise - or a
spot, one handle where something stands, the campfire before the
workshop's small door. They are drawn on the bench with the Place tool
(`A`): a click on a handle makes it the next corner, a click anywhere else
sets one of its own, a click on a corner takes it away, `⌫` the last one,
and `⌥` click on a place drawn takes it up to be drawn again. Its outline
shows as it would be written, along the road's edge between two corners on
it, and what is wrong with it is said - clockwise, too few corners. **copy**
gives its entry of `PLACES`; a place whose corners are worked out in the
source, a room's, comes back with them written out. An empty outline is one still to draw
(`undrawnPlaces()`), and nothing is shown for it. An event's entry lists
the places it uses; a place can serve several events, and an event use
several places.

## The kinds of events

An event is of a kind (`EVENT_TYPES`, `events.ts`), known by its name - the
chronicle entry's title, the calendar's summary, the whole of it, so the
calendar's "Adventskalender Orga" is no Adventskalender - and set up there
once: the places it is held at and the decorations put up for it. Its
predecessors are of it too: the Frühlingskonzert a Frühlingsfatsche, Mühle,
Markt & Musik a SOMMERFESTival. A kind held in one season is lit in it; the
Feierabend, held nearly every month, in the season its date falls in, by the
months (`seasonOf()`). It is lit at its start: the calendar's time, or the
first time of the clock in the entry's teaser or text (`startIn()`), or where
neither gives one - an entry without, an event of the whole day - its kind's
usual hour. Each kind is baked as a still view in each season it is held
in (`eventViewName()`, `EVENT_EYES`), set up so and seen from where its places
are: the Feierabend from the road before the lean-to's door, the fire in the
middle and the Vereinsraum open behind; the Frühlingsfatsche from nearer the
hall, its gate, the bar, the grill and the fire; the SOMMERFESTival from the
pavilion's terrace, its fire before it and over the road the mill's front;
the Adventskalender before the mill's terrace. The editor sets one up by its
`Event` switch: its season - or the one looked at, for the Feierabend - its
start, its decorations, and the camera turned from where its view looks.
The site reads a setting off an entry or an event
(`event.utils.ts`); every entry in the chronicle is of a kind and starts, as
tested. The view it is shown in is baked for its kind and season - one still
view each, named `<day>-event-<kind>-<season>` (`eventViewName()`) - and the
site finds it by that name (`scene.utils.ts`); where none is baked it shows the
season's view of the mill as it is. What each puts up besides its lights: the Feierabend no benches - they stood
between the fire and the eye; the Frühlingsfatsche the stage and the benches
before the workshop; the SOMMERFESTival the benches before the mill and on the
pavilion's terrace; the Adventskalender the A-hut's Christmas.

## What a view carries, and no more

Measured on the baked files, the positions were most of each: float32
packs poorly, 1.5MB of the summer loop's 2.4MB. They are written on a grid
of 65535 steps across all that is kept - under a centimetre across the
valley, the same grid for every group so that what two share still meets -
each as the step from the vertex before, which lies near it. The lightmap
is filled only in the cells under what the eye was left seeing that takes
it, and two round them for the filtering, cut to their bounds and to the
sun's one byte where no lamp lights: a still view looks at a fifth of the
ground round it. Together a still one went from 870KB to 416KB and the
loops from 2.3-3.1MB to 1.7-2MB, and the lightmap is worked out after what
the eye sees, for those cells only.

The fires have a byte of their own. Their light was summed into the orange
with the street lamps', and once it was baked the two could not be told
apart - a fire's flicker would have flickered the lanterns with it. Where a
view has a fire in it (`burns()`), the lightmap is four bytes a cell, not three:
warm, orange, the sun's and the fires' alone, the last in the orange's colour,
and the orange is the street lamps' only; a file of an older version reads
as it did, for the scene only looks at `channels`. Only the
cells the eye sees are filled, so a fire costs the cells its light reaches and
the zeros in between pack to nothing: the workshop's Feierabend, with its
fire, is 177KB packed. A wall or a house's side carries its light in its
corners, and there the fire's is worked out apart from the rest
(`fireShare()`): a byte a corner, its share of the corner's brightness, written
only for a group a fire lights at all (`fire`), and the shader swings that
share with the ground's. The header is version 4. A fire's tongues are a group
of their own with its foot and height (`flame`): the shader stretches them up
and down with the light and sways them round the foot, the more the higher
up, as the editor moves them - no more bytes for it. Measured on the
Feierabend's winter view: the workshop's wall beside the fire and the ground
before it swing alike, about 4% either way, frame to frame.

## The scenes on the site

The site shows `kvlm-scene` in two places: as the Willkommen section, and
beside or above the text of a chronicle entry, which is given the view of its
event by its own kind and date (`scene.utils.ts`). The view is found by
`eventViewName(type, season)` in the list the bake writes
(`views/manifest.json`), and where it is not baked the fallback is the first still
of that season that is not an event's, else a loop, else no scene at all.

A view is megabytes of WebGL and a couple of hundred KiB to fetch, so the page
does not wait for it: each has a still (`views/<name>.still.webp`, 1600 by 900,
quality 70, some 20-80KB), the first frame of the view, baked by `npm run
data:stills` in `packages/ui` - which opens each view in the component the site
uses, in a headless Chromium with software WebGL, and with less motion asked
for, so nothing drifts or flickers and a path view is where it starts. Run it
after the views are baked; given names it does those alone. The scene's
`poster` shows it at once, `loading="lazy"` leaves the fetching to when the
element is a screen's height from the viewport, and once the first frame is
drawn the canvas fades in over it. The poster is covered, not stretched: in a
shape taller than 16:9 the canvas sees more above and below than the still
shows, which is the one thing the fade has to hide.

Willkommen is the scene and nothing else (`scene="mill"`, the section's
`scenic`): the mill as it is best known, seen coming up the road - from the
road to the north, 13m over it, looking back south at the mill's front, the
stairs and the pavilion on the left, the small house on the right, the
workshop behind. The eye drifts a few meters round that spot and back, once a
minute, over and over (a loop path). It is baked in every season by day
(14:00) and at night (22:00, dark even in June), the night with the fire
before the small house lit (`feuer-selbis`, at the right edge), and once more
for the time before Christmas - from the day after Totensonntag to Epiphany,
in the winter's woods with the lights along the rails and the A-hut's
Christmas up, more to come (`WELCOME_UP`): ten views (`overviewViewName()`,
490KB-1.2MB packed each). All go out with the page and the visitor's own day
and hour at the mill pick one (`kvlm-mill-scene`, once the scene is hydrated -
the router brings the page back without loading it, so each time it is put on
one): Christmas by `christmasTime()` (`advent.utils.ts`: Totensonntag is four
weeks before the fourth Sunday of Advent, the last before the 25th), else the
season by the months; the day while the season's daylight lasts
(`daylight()`), else the night. Without a script, the build's season by day
shows as a still. The agenda follows in a section
of its own, Demnächst. A
first try laid the next event's scene faded under the agenda; it read as a
smudge, neither picture nor background. On a chronicle entry the scene is
the last thing on the page, a section of its own after the text, the whole
screen and nothing over it, as the welcome's is (the section's `scene`, now
the mill's overview or a view of its own). Pinned beside the text, it took
half the page from the words.

The fires flicker on the site as the editor's do - their light on the
ground and on the walls, their tongues flaring and swaying: a few waves laid
together, the light swinging 15% either side of what was baked, drawn at 20 frames a
second - a fire alone needs no more - while the element is on screen. With less
motion asked for the light is as baked, and nothing is drawn but the first
frame.

## Spring, and the clouds

Spring's leaves are a fresh yellow green of their own
(`--kvlm-color-spring-leaf`), not the brand's turquoise lightened, and the
ground greens with new grass (`--kvlm-color-spring-grass`, `seasonGround()`)

- the meadows most, the forest floor too, the yard not - in the bake as in
  the editor. Its sky is the year's clearest blue. Over every season's sky a
  layer of small fair weather clouds, drawn by `kvlm-scene` off noise where a
  ray meets it: a third of the sky in spring, a fifth in summer, more in
  autumn and winter, white where the sun is on them and greyer underneath,
  and as dark as the sky at night. The editor's sky has none.

## The road and the brook, as they look

The colours lean to the real rather than to the brand: they are tokens of
their own in `globals.css`, for a theme to set. The brook is dark, as a brook
in the woods is - a deep slate green where it runs deep
(`--kvlm-color-water`), paler and greyer over the stones at its edges
(`--kvlm-color-water-shallow`) only in a thin strip along either bank
(`ribbonAcross()`), even across the rest rather than graded, and never snowed on. The gravel's brown at its edges
read as dirty water.

The main road is marked along either edge only (`MARKINGS`, the part
`markings`): a 12cm line 30cm inside the edge, a centimetre over the surface
and on a layer of its own over the road's, or the road's depth offset buries
it. At five meters the road is too narrow for a line down the middle. Gone
under the winter's snow, where only the tyres' tracks show.

South of the last bridge, from the far end of its walls, the part
`roadside`: a hewn granite post every 5m between the road and the brook,
75cm high, 15cm square with a low pyramid on top, 35cm off the edge
(`GRANITE_POSTS`); and delineators in pairs across the road (`DELINEATORS`),
as the guidelines have them: 50cm off the edge, a meter high, 50m apart and
closer only in a bend under a radius of 200m - halved, and again under
100m - the radius read off the road's heading 15m either side; the road
winds, and 14 pairs stand along its 300m. A gap takes its radius at its
middle (`gapFrom()`); the first one off the bridge came out twice the next,
the bend easing there, and is halved when it is over 1.5 times the next. A hollow three-sided post, 12cm
across its back and pointed at the road, its top slanted down towards it;
white, with a black band 25cm high 22cm under the top, parallel to it - as
measured off a maker's photograph, by its 180mm reflector - and on the band
an upright oblong reflector, 40 by 180mm, on the face towards the traffic
that has the post on its right, two round ones 60mm across on the other. The meter is
over the road's edge on a verge as level as the road; here the ground falls
30 to 50cm towards the brook, and a meter over the road stood half as tall
again there as across it - so each stands a meter out of its own ground.
Every foot is under the ground as it is drawn - the field's `heightAt()`
stands up to 3m off it here, so what stands on the ground reads
`DRAWN_GROUND()`. The stones stand 1.65m off the water at the least.

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
