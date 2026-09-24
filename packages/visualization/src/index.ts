// The 3D model of the Lochmühle: the data it is built from, the ground cut to
// its seam, what stands on it, a scene that renders it all, and the views of
// it baked for the site.
export * from './bake/occlusion.js';
export * from './bake/prefab.js';
export * from './bake/views.js';
export * from './data/brushes.js';
export * from './data/data.js';
export * from './data/points.js';
export * from './models/buildings/buildings.js';
export * from './models/buildings/footprint.js';
export { LANDFILL_GROUND } from './models/seam/fills.js';
export * from './models/seam/landfill.js';
export { pathOf, pickByKey, SEAM_PICKS, seamNetwork, tracedSeams } from './models/seam/seam.js';
export { createCulvert, createDeck } from './models/structures/decks.js';
export type { SeamEdge, SeamHandle } from './models/structures/measures.js';
export { createPavilion } from './models/structures/pavilion.js';
export { createRailings, unknownHandles } from './models/structures/railings.js';
export { createStairs } from './models/structures/stairs.js';
export { createBrook, createWays, heightAt } from './models/terrain/ground.js';
export { terrainTint } from './models/terrain/terrain.drawn.js';
export {
  BASE_ELEVATION,
  elevationAt,
  TERRAIN_RADIUS,
  YARD_MARGIN,
} from './models/terrain/terrain.field.js';
export { buildTerrain, createTerrain } from './models/terrain/terrain.js';
export { createTrees } from './models/terrain/trees.js';
export * from './scene/palette.js';
export * from './scene/scene.js';
export { dispose } from './utils/mesh.utils.js';
