import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';

import type { Point } from '../../data/data.js';
import { TREE_TOPS } from '../../data/trees.baked.js';
import type { Palette } from '../../scene/palette.js';
import { contains, distanceToPath, random } from '../../utils/geometry.utils.js';
import { distanceToBuildings, YARD_CENTER } from '../buildings/footprint.js';
import { LANDFILL_GROUND } from '../seam/fills.js';
import { CROSSING, MILL_ROAD_DECK, MILL_SIDE_DECK } from '../structures/crossings.js';
import { HUT } from '../structures/hut.js';
import { PAVILION_AT } from '../structures/pavilion.js';
import { BROOK_LINE, heightAt } from './ground.js';
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
 * The spruce on the terrace deck, left of the top of the stairs and in front
 * of the pavilion, as the photograph from across the road has it: 3.2m tall
 * against the pavilion's eaves, 2.2m.
 */
const SPRUCES: { at: Point; height: number }[] = [{ at: [26.66, 26.99], height: 3.2 }];

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

/** The least share of a tree's height its stem takes, however wide its crown. */
const STEM_LEAST = 0.25;

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
  const decks = [MILL_ROAD_DECK, MILL_SIDE_DECK, CROSSING.plate];
  const clear = (point: Point) =>
    insideTerrain(point, 8) &&
    distanceToBuildings(point) > KEEP_OFF.wall &&
    Math.hypot(point[0] - HUT.at[0], point[1] - HUT.at[1]) > HUT.clear &&
    (pavilion === undefined ||
      Math.hypot(point[0] - pavilion[0], point[1] - pavilion[1]) > KEEP_OFF.pavilion) &&
    SPRUCES.every(({ at }) => Math.hypot(point[0] - at[0], point[1] - at[1]) > KEEP_OFF.spruce) &&
    decks.every(
      deck =>
        !contains(deck, point) && distanceToPath([...deck, deck[0] as Point], point) > KEEP_OFF.deck
    ) &&
    distanceToPath(BROOK_LINE, point) > BROOK_WIDTH / 2 + KEEP_OFF.brook &&
    ROADS.every(({ points, width }) => distanceToPath(points, point) > width / 2 + KEEP_OFF.road);

  const placed = TREE_TOPS.flatMap(([x, y, height, crown]) => {
    const point: Point = [x, y];
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
      },
    ];
  });

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
  const ground = LANDFILL_GROUND();
  const standing = ({ at, height }: { at: Point; height: number }, index: number): Stood => ({
    point: at,
    height,
    crown: height * 0.3,
    turn: index * 2.4,
    shape: 0,
    near: true,
    shade: { toward: 'trunk', share: 0.3 },
    ground: ground(at[0], at[1]) ?? heightAt(at[0], at[1]),
  });

  const meshes = [...woods, ...stand('spruce', [spruceShape()], SPRUCES.map(standing))];

  // under the canopy's trees, somewhere under the crown, never in the open
  const bushes = placed
    .filter(({ species }) => species !== 'sapling')
    .flatMap(({ point: [x, y], crown }) => {
      const [take, angle, out, height, turn] = [next(), next(), next(), next(), next()];
      const point: Point = [
        x + Math.cos(angle * Math.PI * 2) * crown * (0.3 + out * 0.6),
        y + Math.sin(angle * Math.PI * 2) * crown * (0.3 + out * 0.6),
      ];
      return take < BUSH.share && clear(point)
        ? [{ point, height: BUSH.from + height * (BUSH.to - BUSH.from), turn: turn * Math.PI * 2 }]
        : [];
    });
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
        return heightAt(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
      })
    );
    const middle = Math.min(
      heightAt(x, y) + height / 2 - radius / 3,
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

  return group.add(...meshes, ...kinds.flatMap(({ mesh, twigs }) => [mesh, twigs]));
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
    } = child.userData as {
      part?: string;
      species?: string;
      evergreen?: boolean;
      shades?: Shade[];
    };
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
