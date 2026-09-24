---
name: area-indices
description: Work on the 3D Lochmühle scene through its indexed points - the numbered handles on every wall edge, plate and way. Use for any change to packages/visualization or packages/editor: building or reshaping a structure, fitting one to another, and cutting the terrain to them. Whenever something floats, clips, or has to be set out by hand.
---

# Working the Lochmühle scene by its indexed points

Every wall edge, plate corner and way end in the scene carries a number. They
are how the person says where something goes, and how you say where something
went wrong - for structural work as much as for the seam the terrain is cut to.

Read `packages/visualization/SEAM.md` first. It holds the
vocabulary, the bench, the readout format, the constants and what is measured.
`EXAMPLES.md` beside it says where the data comes from.

## The one rule

**Measure, do not look.** Every mistake in this scene so far looked fine on
screen and was wrong by a number: walls standing 13mm through the road, a plate
holding one plane across a 22m triangle, a trace ramping linearly between two
handles 200m apart, structures hanging a metre over the ground.

Build the thing in a throwaway script, raycast it against what it should meet,
print the worst case:

```ts
// /tmp/.../scratch.ts - build what you doubt, aim a ray at what it should touch
import { Raycaster, Vector3 } from 'three';
import { createDeck, createWays } from '<abs path>/packages/visualization/src/index.js';

// a palette stub, since there is no document to read one from
const palette = new Proxy({}, { get: () => new Color('#888888') }) as Palette;
```

```sh
bun run /tmp/.../scratch.ts
```

Two traps: `instanceof Mesh` fails across the two copies of three that bun
resolves, so test `object.type === 'Mesh'`; and sampling only a face's corners
hides everything, because a triangle drawn over a bend stands out of it between
them - sample the inside too.

## Checks before saying it is done

```sh
cd packages/visualization && npx tsc --noEmit && npx eslint . && npm test
cd packages/editor && npx tsc --noEmit && npx eslint . && npm test
cd packages/website && npx astro check
```

`npm test` carries the seam's invariants in `seam.spec.ts`. If a change
makes one fail, the invariant is the thing to argue with, not the test.

## Working with the person

They drive the geometry, the bench is how they say what they want. Expect a
pasted list of handle numbers with coordinates under it - the numbers are
positions in `SEAM_PICKS`, counted afresh, and shift when the model changes.
Translate them to the handles' names (`key`, printed after the coordinates)
before writing them into the source: dumps and railings refer to handles by
name only. Give measurements back: what was wrong, by how much, where, and
what it is now.

A line that stops where nothing on the ground stops is missing data. The road's
own data ended 75m inside the rim, on a bend, because it changes name there and
the fetch picks ways by name. Carrying the line on in its last heading gave a
straight stub off a curve and disturbed ground fanning out from the kink; asking
Overpass what the way is called further on gave the rest of the road. Check the
query before reaching for the geometry.

Numbers name places, never the other way round. A structure that picks its
anchor by a rule of thumb - the northernmost crossing, the first of a list -
holds only until the data grows. Carrying the road out to the rim made the road
and the brook meet again 270m up the valley, and the road wall, the deck strip
and two numbered points went with it. Anchor on a place: the nearest crossing to
the yard, the corner named by role.

Where a decision is theirs - where a hinge sits, which corners move, how a shape
is re-cut - measure it, say what the options cost, and let them pick with the
bench rather than guessing.

## Ground that has already been settled

- The ways are cut into the terrain, not laid on it: they have no lift off it.
  Everything topped out at a carriageway sits `UNDER_ROAD` beneath it.
- Wall feet are buried `WALL_FOOT`, deliberately shallow so the seam pinned to
  them is not dragged down.
- The survey's own lines are the reference. The road's profile does not move to
  suit a plate; the plate follows the road.
- Debug drawing and every tool live in the editor (`packages/editor`), never
  in the model or the site.
- Plan geometry winds counter clockwise to face up, because the scene mirrors
  the grid's y into -z.
