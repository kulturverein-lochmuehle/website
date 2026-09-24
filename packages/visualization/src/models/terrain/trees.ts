import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Object3D,
  Quaternion,
  TetrahedronGeometry,
  Vector3,
} from 'three';

import type { Point } from '../../data/data.js';
import { TREE_TOPS } from '../../data/trees.baked.js';
import type { Palette } from '../../scene/palette.js';
import { contains, distanceToPath, once, random } from '../../utils/geometry.utils.js';
import { distanceToBuildings, YARD_CENTER } from '../buildings/footprint.js';
import { FILLS, LANDFILL_GROUND } from '../seam/fills.js';
import { pickByKey } from '../seam/seam.js';
import { CROSSING, MILL_ROAD_DECK, MILL_SIDE_DECK } from '../structures/crossings.js';
import { gardenShrubs } from '../structures/garden.js';
import { HUT } from '../structures/hut.js';
import { PAVILION_AT } from '../structures/pavilion.js';
import { BROOK_LINE, heightAt } from './ground.js';
import { DRAWN_GROUND } from './terrain.drawn.js';
import { BROOK_WIDTH, insideTerrain, ROADS } from './terrain.field.js';
import type { TreeDetail } from './tree.kit.js';
import {
  ALDER,
  BEECH,
  OAK,
  SAPLING,
  SHRUB_SHAPES,
  shrubShapes,
  spruceShape,
  TREE_SHAPES,
  treeShapes,
} from './tree.kit.js';

/**
 * The woods, stood where the survey's scans have their trees: every top of the
 * canopy (`TREE_TOPS`, from `data:trees`) is one, as tall as the scan has it
 * and with the crown it has room for. So they stand as close to the houses,
 * the pavilion and the road as the real ones do.
 */
/**
 * The kinds the photographs of the valley show. Beech and oak grow in a close
 * stand and reach for the light, so their stems stand bare for well over half
 * their height and the crown is only the top of the tree; the alders by the
 * brook fork low under a round crown; the young trees on the meadow are thin.
 * Their shapes are the kit's (`tree.kit.ts`), their sizes the scan's.
 */
/**
 * How far from the yard the trees and shrubs are drawn in full: past this they
 * take their far shapes. The line is spread 15m either way tree by tree, so
 * no ring shows where it runs.
 */
const NEAR = { reach: 120, spread: 15 };

/** Whether a tree or a shrub is drawn in full, its spread read off its turn. */
const near = ([x, y]: Point, turn: number) =>
  Math.hypot(x - YARD_CENTER[0], y - YARD_CENTER[1]) <
  NEAR.reach + (((turn * 53) % 1) * 2 - 1) * NEAR.spread;

/**
 * Which kind a top is: under this height a young tree, and within this reach
 * of the brook an alder - the scan cannot tell a beech from an oak, so of the
 * rest three in ten are oaks, by a hash of where they stand. A young tree's
 * crown is no wider than `youngCrown` its height: in the open the scan reads
 * the grass round it into its crown.
 */
const SPECIES = { young: 8, alder: 7, youngCrown: 0.45 };

/**
 * The Christmas tree, a spruce put up for the winter only, on the terrace
 * inside the stairs' U: this far in off the U's inner wall, from the middle of
 * the wall's top between the two handles - on the side the fill lies - so its
 * lowest tier hangs out over the railing, and this tall. Green, whatever the
 * weather: no snow lies on it. Decorated later with the season's lighting.
 */
const CHRISTMAS_TREE = {
  between: ['stairs:u-back-end-inside:top', 'stairs:u-inside:top'],
  // the railing runs on that line: the stem stands 30cm off it
  inward: 0.42,
  height: 6.4,
  crown: 0.28,
} as const;

/** Where the Christmas tree stands, from the handles it is set out by. */
const christmasTree = once((): Point | undefined => {
  const [a, b] = CHRISTMAS_TREE.between.map(key => pickByKey(key)?.at);
  if (a === undefined || b === undefined) {
    return undefined;
  }
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  // square to the wall, turned towards the fill: from the first handle to
  // the second the U's inside is on the left
  const [nx, ny] = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
  return [
    (a[0] + b[0]) / 2 + nx * CHRISTMAS_TREE.inward,
    (a[1] + b[1]) / 2 + ny * CHRISTMAS_TREE.inward,
  ];
});

/** The kinds of tree the valley is drawn with, and which keep their crowns in winter. */
export type Species = 'beech' | 'oak' | 'alder' | 'spruce' | 'sapling';
const EVERGREEN: Species[] = ['spruce'];

/**
 * The seasons the woods can be drawn in. In spring and autumn the broadleaves
 * take the palette's colour for it, in winter they stand bare - the spruce
 * stays as it is all year.
 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * A crown's colour: the season's leaf colour, darkened by itself towards the
 * tone the tree leans to by its own share - the hills' for the canopy, the
 * bark's for what stands in its shade. Kept as the share, so a season can lay
 * a colour of its own on the same variety.
 */
interface Shade {
  toward: 'hills' | 'trunk';
  share: number;
}

const tint = (leaf: Color, palette: Palette, { toward, share }: Shade) =>
  leaf.clone().multiply(leaf.clone().lerp(palette[toward], share));

/** A tree as it is stood: where, how tall, how wide, which shape and shade. */
interface Stood {
  point: Point;
  height: number;
  crown: number;
  turn: number;
  shape: number;
  near: boolean;
  shade: Shade;
  /** The ground it stands on, where that is not the terrain's own: a deck. */
  ground?: number;
}

/** Three trees in ten are oaks, the rest beech. */
const OAKS = 0.3;

/**
 * The understory: a shrub under this share of the canopy's trees, somewhere
 * under the crown, between these heights - what fills the wood between the
 * stems in the photographs, where the slope would otherwise show bare.
 */
const BUSH = { share: 0.55, from: 1.5, to: 4.5 };

/**
 * What a top is not taken for a tree on: a roof, a deck, the pavilion's roof or
 * the hut's, the road or the water. Within this reach of a wall a top is the
 * roof's; a tree standing there in the scan stands clear of it here.
 */
const KEEP_OFF = { wall: 1.5, pavilion: 2.8, spruce: 2, road: 1, brook: 0.3, deck: 1.5 };

/**
 * Trees the scan does not have, set on the bench at a handle: where they
 * stand, how tall, how wide their crowns, and what they are. They stand where
 * they are put - on a dump too, where a tree the scan has is moved off it -
 * and nothing is kept clear round them. The big one on the pavilion's
 * terrace, 246 on the bench: the scan merged it into its neighbours' crowns.
 * One the scan has but that stands elsewhere is moved: the scan's is taken
 * out where it was (`from`) - the young tree by the swinging seat, which
 * swapped places with the table.
 */
export const SET_TREES: {
  at: string;
  height: number;
  crown: number;
  species: 'beech' | 'oak' | 'sapling';
  from?: Point;
}[] = [
  { at: 'point:27', height: 20, crown: 5.5, species: 'oak' },
  { at: 'point:109', height: 4.9, crown: 2.2, species: 'sapling', from: [-3.5, 20.5] },
  { at: 'point:142', height: 4.5, crown: 1.6, species: 'sapling' },
];

/** How near a scanned tree's top must be to where one was moved from, to be the one moved. */
const MOVED_FROM = 0.5;

/** The least share of a tree's height its stem takes, however wide its crown. */
const STEM_LEAST = 0.25;

/**
 * A dump deeper than this is made ground: no shrub grows on it, and a tree the
 * scan has on it is moved out to its edge, looked for this far round in steps.
 */
const ON_FILL = 0.05;
const OFF_FILL = { reach: 8, step: 0.25 };

/** A number between nought and one that stays with a point. */
const hashed = ([x, y]: Point, salt: number) => {
  const value = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
};

/**
 * The mill stands in the woods, and the woods are most of what the valley looks
 * like - so they are drawn as instanced meshes rather than a few thousand
 * objects. Trunk, crown and shrub are the simplest shapes that still read.
 */
export function createTrees(palette: Palette): Group {
  const next = random(1400); // the year the mill was first mentioned
  const group = new Group();
  group.name = 'trees';

  // the yard and the ways stay clear, nothing grows where people drive, and
  // nothing stands in the brook - on its bank is close enough
  const pavilion = PAVILION_AT()?.middle;
  const christmas = christmasTree();
  const decks = [MILL_ROAD_DECK, MILL_SIDE_DECK, CROSSING.plate];
  const clear = (point: Point) =>
    insideTerrain(point, 8) &&
    distanceToBuildings(point) > KEEP_OFF.wall &&
    Math.hypot(point[0] - HUT.at[0], point[1] - HUT.at[1]) > HUT.clear &&
    (pavilion === undefined ||
      Math.hypot(point[0] - pavilion[0], point[1] - pavilion[1]) > KEEP_OFF.pavilion) &&
    (christmas === undefined ||
      Math.hypot(point[0] - christmas[0], point[1] - christmas[1]) > KEEP_OFF.spruce) &&
    decks.every(
      deck =>
        !contains(deck, point) && distanceToPath([...deck, deck[0] as Point], point) > KEEP_OFF.deck
    ) &&
    distanceToPath(BROOK_LINE, point) > BROOK_WIDTH / 2 + KEEP_OFF.brook &&
    ROADS.every(({ points, width }) => distanceToPath(points, point) > width / 2 + KEEP_OFF.road);

  const ground = LANDFILL_GROUND();
  // how deep a dump lies on the ground here: none off it
  const drawn = DRAWN_GROUND();
  const filled = (x: number, y: number) =>
    Math.max((ground(x, y) ?? 0) - (drawn(x, y) ?? ground(x, y) ?? 0), 0);
  // a tree the scan has on a dump grew on the slope the dump was piled against:
  // it stands at the dump's edge, the nearest point where the fill runs out
  // unless the dump is a terrace laid round them, which they stand on
  const terraces = FILLS.filter(({ holdsTrees }) => holdsTrees === true).map(({ ring }) =>
    ring.flatMap(key => {
      const at = pickByKey(key)?.at;
      return at === undefined ? [] : [at];
    })
  );
  const offFill = (point: Point): Point => {
    if (filled(...point) < ON_FILL || terraces.some(ring => contains(ring, point))) {
      return point;
    }
    const found = Array.from({ length: Math.round(OFF_FILL.reach / OFF_FILL.step) }, (_, ring) =>
      Array.from({ length: 24 }, (_, k): Point => {
        const [angle, out] = [(k / 24) * Math.PI * 2, (ring + 1) * OFF_FILL.step];
        return [point[0] + Math.cos(angle) * out, point[1] + Math.sin(angle) * out];
      }).find(at => filled(...at) < ON_FILL)
    ).find(at => at !== undefined);
    return found ?? point;
  };

  const set = SET_TREES.flatMap(({ at, height, crown, species }) => {
    const point = pickByKey(at)?.at;
    if (point === undefined) {
      return [];
    }
    const turn = hashed(point, 1);
    return [
      {
        point,
        height,
        crown,
        species: species as Species,
        turn: turn * Math.PI * 2,
        shape: Math.floor(hashed(point, 3) * TREE_SHAPES),
        near: near(point, turn),
        shade: { toward: 'hills', share: next() * 0.35 } as Shade,
        ground: ground(...point) ?? heightAt(...point),
      },
    ];
  });

  const moved = SET_TREES.flatMap(({ from }) => (from === undefined ? [] : [from]));
  const scanned = TREE_TOPS.flatMap(([x, y, height, crown]) => {
    if (moved.some(([mx, my]) => Math.hypot(mx - x, my - y) < MOVED_FROM)) {
      return [];
    }
    const point = offFill([x, y]);
    if (!clear(point)) {
      return [];
    }
    const turn = hashed(point, 1);
    const species: Species =
      height < SPECIES.young
        ? 'sapling'
        : distanceToPath(BROOK_LINE, point) < BROOK_WIDTH / 2 + SPECIES.alder
          ? 'alder'
          : hashed(point, 2) < OAKS
            ? 'oak'
            : 'beech';
    return [
      {
        point,
        height,
        crown: species === 'sapling' ? Math.min(crown, height * SPECIES.youngCrown) : crown,
        species,
        turn: turn * Math.PI * 2,
        shape: Math.floor(hashed(point, 3) * TREE_SHAPES),
        near: near(point, turn),
        // every tree a shade of its own, a forest of one color reads as a carpet
        shade: { toward: 'hills', share: next() * 0.35 } as Shade,
        // on what the dumps lay on the ground too, where one reaches it
        ground: ground(...point) ?? heightAt(...point),
      },
    ];
  });
  const placed = [...set, ...scanned];

  // the stems and limbs are open at both ends: their feet are in the ground or
  // in the stem, their tops in the crown, so no cap is ever seen. The crowns
  // do not cast shadows: a few hundred of them would cost more than they show
  const bark = new MeshLambertMaterial({ color: palette.trunk, flatShading: true });
  // a limb catches snow along its top, where a roof at its slope would shed it
  bark.userData['snowLies'] = { from: 0.15, whole: 0.45 };
  // white: a crown's colour is all its own, so a season can change it
  const foliage = new MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const axis = new Vector3(0, 1, 0);

  // one pair of instanced meshes a shape, near and far, holding every tree
  // drawn with it; a shape is a unit tall and a crown's radius across, so a
  // tree is scaled by its height up and by its crown's radius across
  //
  // each mesh says what it holds, for the seasons to come: a winter strips the
  // crowns of the broadleaves and leaves the spruce's, an autumn recolours them
  const stand = (species: Species, details: TreeDetail[], trees: Stood[]) =>
    details.flatMap((detail, shape) =>
      ([true, false] as const).flatMap(full => {
        const { stem, wood, crown, twigs, top } = full ? detail.near : detail.far;
        const these = trees.filter(tree => tree.shape === shape && tree.near === full);
        if (these.length === 0) {
          return [];
        }
        const stems = new InstancedMesh(stem, bark, these.length);
        const limbs = new InstancedMesh(wood, bark, these.length);
        const crowns = new InstancedMesh(crown, foliage, these.length);
        // the winter's twigs are there all year, hidden while the crown is on
        const bare = twigs === undefined ? undefined : new InstancedMesh(twigs, bark, these.length);
        if (bare !== undefined) {
          bare.visible = false;
        }
        const detailed = full ? 'near' : 'far';
        const parts: [InstancedMesh, string, string][] = [
          [stems, 'stem', 'wood'],
          [limbs, 'limbs', 'wood'],
          [crowns, 'crown', 'crown'],
          ...(bare === undefined
            ? []
            : [[bare, 'twigs', 'twigs'] as [InstancedMesh, string, string]]),
        ];
        parts.forEach(([mesh, name, part]) => {
          mesh.name = `trees:${species}:${name}:${detailed}:${shape}`;
          mesh.userData = { species, part, evergreen: EVERGREEN.includes(species) };
        });
        crowns.userData['shades'] = these.map(({ shade }) => shade);
        these.forEach(({ point: [x, y], height, crown: wide, turn, shade, ground }, at) => {
          const foot = ground ?? heightAt(x, y);
          // the crown as wide as the scan has it, unless that leaves the stem
          // less than a quarter of the tree: then the crown is smaller
          const radius = Math.min(wide, (height * (1 - STEM_LEAST)) / top);
          const reach = height - top * radius;
          rotation.setFromAxisAngle(axis, turn);
          matrix.compose(new Vector3(x, foot, -y), rotation, new Vector3(radius, reach, radius));
          stems.setMatrixAt(at, matrix);
          matrix.compose(
            new Vector3(x, foot + reach, -y),
            rotation,
            new Vector3(radius, radius, radius)
          );
          limbs.setMatrixAt(at, matrix);
          bare?.setMatrixAt(at, matrix);
          crowns.setMatrixAt(at, matrix);
          crowns.setColorAt(at, tint(palette.foliage, palette, shade));
        });
        return parts.map(([mesh]) => mesh);
      })
    );

  const shapes: Record<Exclude<Species, 'spruce'>, TreeDetail[]> = {
    beech: treeShapes(BEECH, 1400),
    oak: treeShapes(OAK, 1401),
    alder: treeShapes(ALDER, 1404),
    sapling: treeShapes(SAPLING, 1405),
  };
  const woods = (Object.entries(shapes) as [Species, TreeDetail[]][]).flatMap(
    ([species, details]) =>
      stand(
        species,
        details,
        placed.filter(tree => tree.species === species)
      )
  );

  // what the deck and the dumps put on the ground is where these stand
  const standing = ({ at, height }: { at: Point; height: number }, index: number): Stood => ({
    point: at,
    height,
    crown: height * CHRISTMAS_TREE.crown,
    turn: index * 2.4,
    shape: 0,
    near: true,
    shade: { toward: 'trunk', share: 0.3 },
    ground: ground(at[0], at[1]) ?? heightAt(at[0], at[1]),
  });

  // the Christmas tree stands in winter only, and is put away until then
  const christmasMeshes = stand(
    'spruce',
    [spruceShape()],
    christmas === undefined ? [] : [standing({ at: christmas, height: CHRISTMAS_TREE.height }, 0)]
  );
  // a crown of its own that snow does not settle on - drawn half white it read
  // as a tree left out, not one put up
  const evergreen = foliage.clone();
  evergreen.userData['snowless'] = true;
  christmasMeshes.forEach(mesh => {
    if (mesh.userData['part'] === 'crown') {
      mesh.material = evergreen;
    }
    mesh.userData['season'] = 'winter';
    mesh.name = mesh.name.replace('trees:spruce:', 'trees:christmas-tree:');
    mesh.visible = false;
  });
  const meshes = [...woods, ...christmasMeshes];

  // under the canopy's trees, somewhere under the crown, never in the open -
  // and the garden's, set where they grow
  const gardened = gardenShrubs().map(({ point, height }) => ({
    point,
    height,
    turn: next() * Math.PI * 2,
  }));
  const bushes = placed
    .filter(({ species }) => species !== 'sapling')
    .flatMap(({ point: [x, y], crown }) => {
      const [take, angle, out, height, turn] = [next(), next(), next(), next(), next()];
      const point: Point = [
        x + Math.cos(angle * Math.PI * 2) * crown * (0.3 + out * 0.6),
        y + Math.sin(angle * Math.PI * 2) * crown * (0.3 + out * 0.6),
      ];
      return take < BUSH.share && clear(point) && filled(...point) < ON_FILL
        ? [{ point, height: BUSH.from + height * (BUSH.to - BUSH.from), turn: turn * Math.PI * 2 }]
        : [];
    })
    .concat(gardened);
  const shaped = bushes.map(bush => ({
    ...bush,
    shape: Math.floor((((bush.turn / (Math.PI * 2)) * 97) % 1) * SHRUB_SHAPES),
    near: near(bush.point, bush.turn / (Math.PI * 2)),
  }));
  const kinds = shrubShapes(1402).flatMap((detail, shape) =>
    ([true, false] as const).map(full => {
      const count = shaped.filter(bush => bush.shape === shape && bush.near === full).length;
      const detailed = full ? 'near' : 'far';
      const mesh = new InstancedMesh(full ? detail.near : detail.far, foliage, count);
      mesh.name = `trees:shrub:crown:${detailed}:${shape}`;
      mesh.userData = { species: 'shrub', part: 'crown', evergreen: false, shades: [] };
      // bare in winter, the way the broadleaves are: hidden until then
      const twigs = new InstancedMesh(full ? detail.nearTwigs : detail.farTwigs, bark, count);
      twigs.name = `trees:shrub:twigs:${detailed}:${shape}`;
      twigs.userData = { species: 'shrub', part: 'twigs', evergreen: false };
      twigs.visible = false;
      return { shape, full, mesh, twigs, placed: 0 };
    })
  );

  // a shrub is a lump sitting on the ground, as wide as it is tall. Its
  // underside rises from the bottom vertex at about 24 degrees and the valley's
  // sides are steeper than that, so it is not stood on the ground at its foot:
  // it is sunk until its underside meets the lowest ground under the inner half
  // of it, which is where a gap would show on the downhill side. A shrub of
  // lumps is sunk further: its underside rises between them as well
  shaped.forEach(({ point: [x, y], height, turn, shape, near: full }) => {
    const kind = kinds.find(one => one.shape === shape && one.full === full);
    if (kind === undefined) {
      return;
    }
    rotation.setFromAxisAngle(axis, turn);
    const radius = height / 2 / 0.85;
    const lowest = Math.min(
      ...Array.from({ length: 8 }, (_, step) => {
        const angle = (step / 8) * Math.PI * 2;
        const reach = radius * 0.45;
        const [ax, ay] = [x + Math.cos(angle) * reach, y + Math.sin(angle) * reach];
        return ground(ax, ay) ?? heightAt(ax, ay);
      })
    );
    const middle = Math.min(
      (ground(x, y) ?? heightAt(x, y)) + height / 2 - radius / 3,
      lowest + radius * (full ? 0.35 : 0.6)
    );
    matrix.compose(new Vector3(x, middle, -y), rotation, new Vector3(radius, radius, radius));
    kind.mesh.setMatrixAt(kind.placed, matrix);
    kind.twigs.setMatrixAt(kind.placed, matrix);
    // the undergrowth is darker than the canopy, it stands in its shade
    const shade: Shade = { toward: 'trunk', share: 0.2 + next() * 0.2 };
    (kind.mesh.userData['shades'] as Shade[]).push(shade);
    kind.mesh.setColorAt(kind.placed, tint(palette.foliage, palette, shade));
    kind.placed += 1;
  });

  const flowers = createFlowers(palette, placed, clear, filled);
  return group.add(...meshes, ...kinds.flatMap(({ mesh, twigs }) => [mesh, twigs]), flowers);
}

/**
 * The meadows' flowers in spring, near the yard: in patches on the open
 * ground - where no crown stands over it, and nothing is built, laid or piled
 * - a patch every so often on a grid, some of them left out so they gather,
 * each a few flowers close together. A flower is a small tetrahedron on the
 * grass, the daisies white, the dandelions yellow, a few violets.
 */
const FLOWERS = {
  reach: 120,
  step: 2,
  patches: 0.35,
  per: [3, 6],
  spread: 0.45,
  size: 0.09,
  crownOff: 1,
} as const;

function createFlowers(
  palette: Palette,
  placed: { point: Point; crown: number }[],
  clear: (point: Point) => boolean,
  filled: (x: number, y: number) => number
): InstancedMesh {
  const next = random(1406);
  const [cx, cy] = YARD_CENTER;
  const steps = Math.floor((FLOWERS.reach * 2) / FLOWERS.step);
  const open = (point: Point) =>
    clear(point) &&
    filled(...point) < ON_FILL &&
    placed.every(
      ({ point: [x, y], crown }) =>
        Math.hypot(x - point[0], y - point[1]) > crown + FLOWERS.crownOff
    );
  const flowers = Array.from({ length: steps * steps }, (_, index) => {
    const [x, y] = [
      cx - FLOWERS.reach + (index % steps) * FLOWERS.step + next() * FLOWERS.step,
      cy - FLOWERS.reach + Math.floor(index / steps) * FLOWERS.step + next() * FLOWERS.step,
    ];
    const patch = next() < FLOWERS.patches;
    const count = FLOWERS.per[0] + Math.floor(next() * (FLOWERS.per[1] - FLOWERS.per[0] + 1));
    const kind = next();
    if (!patch || Math.hypot(x - cx, y - cy) > FLOWERS.reach || !open([x, y])) {
      return [];
    }
    return Array.from({ length: count }, () => ({
      point: [
        x + (next() - 0.5) * 2 * FLOWERS.spread,
        y + (next() - 0.5) * 2 * FLOWERS.spread,
      ] as Point,
      // a patch is mostly of one kind: daisies, dandelions, or violets
      color: kind < 0.5 ? palette.snow : kind < 0.85 ? palette.flowerYellow : palette.flowerViolet,
      size: FLOWERS.size * (0.7 + next() * 0.6),
    }));
  }).flat();

  const mesh = new InstancedMesh(
    new TetrahedronGeometry(1),
    new MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    flowers.length
  );
  const matrix = new Matrix4();
  const turn = new Quaternion();
  flowers.forEach(({ point: [x, y], color, size }, index) => {
    turn.setFromAxisAngle(new Vector3(0, 1, 0), next() * Math.PI * 2);
    matrix.compose(
      new Vector3(x, heightAt(x, y) + size * 0.4, -y),
      turn,
      new Vector3(size, size * 0.7, size)
    );
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, color);
  });
  mesh.name = 'trees:flowers:bloom:near:0';
  // there in spring only, and put away until then
  mesh.userData = { species: 'flowers', part: 'bloom', season: 'spring' };
  mesh.visible = false;
  return mesh;
}

/**
 * An autumn crown's colour, no two trees turned alike: a beech somewhere
 * between gold and orange, an oak between orange and rust, an alder still
 * mostly green - it drops its leaves green - and the young trees and the
 * shrubs anywhere from gold to rust. One tree in eight has not turned yet.
 */
const turned = (palette: Palette, species: string, index: number) => {
  const [late, how] = [hashed([index, 1], 5), hashed([index, 2], 6)];
  const { foliage, autumnGold, autumnOrange, autumnRust } = palette;
  if (species === 'alder') {
    return foliage.clone().lerp(autumnGold, how * 0.45);
  }
  if (late < 1 / 8) {
    return foliage.clone().lerp(autumnGold, how * 0.5);
  }
  const [from, to] =
    species === 'beech'
      ? [autumnGold, autumnOrange]
      : species === 'oak'
        ? [autumnOrange, autumnRust]
        : how < 0.5
          ? [autumnGold, autumnOrange]
          : [autumnOrange, autumnRust];
  return from.clone().lerp(to, species === 'beech' || species === 'oak' ? how : (how * 2) % 1);
};

/**
 * Draws the woods in a season: the broadleaves' and the shrubs' crowns in its
 * leaf colour, or gone and their bare wood shown for a winter. The spruce is
 * left as it is.
 */
export function seasonTrees(trees: Object3D, palette: Palette, season: Season): void {
  const leaf = {
    spring: palette.foliageSpring,
    summer: palette.foliage,
    autumn: palette.foliage,
    winter: palette.foliage,
  }[season];
  trees.children.forEach(child => {
    const {
      part,
      species = '',
      evergreen,
      shades,
      season: only,
    } = child.userData as {
      part?: string;
      species?: string;
      evergreen?: boolean;
      shades?: Shade[];
      season?: Season;
    };
    // what stands for one season only - the Christmas tree - is there then
    if (only !== undefined) {
      child.visible = only === season;
      return;
    }
    if (evergreen === true) {
      return;
    }
    if (part === 'twigs') {
      child.visible = season === 'winter';
    }
    // asked by its flag: the editor and the model may each bring their own three
    if (part !== 'crown' || (child as InstancedMesh).isInstancedMesh !== true) {
      return;
    }
    const crowns = child as InstancedMesh;
    crowns.visible = season !== 'winter';
    (shades ?? []).forEach((shade, index) =>
      crowns.setColorAt(
        index,
        tint(season === 'autumn' ? turned(palette, species, index) : leaf, palette, shade)
      )
    );
    if (crowns.instanceColor !== null) {
      crowns.instanceColor.needsUpdate = true;
    }
  });
}
