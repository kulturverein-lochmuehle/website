// The 3D model of the Lochmühle: the data it is built from, the ground cut to
// its seam, what stands on it, a scene that renders it all, and the views of
// it baked for the site.
export * from './bake/occlusion.js';
export * from './bake/prefab.js';
export { SunShadow } from './bake/shadow.js';
export * from './bake/views.js';
export * from './data/brushes.js';
export * from './data/data.js';
export * from './data/points.js';
export * from './models/buildings/buildings.js';
export * from './models/buildings/footprint.js';
export type { Decoration } from './models/decorations/decorations.js';
export {
  CAMPFIRE,
  DECORATION_KEYS,
  DECORATIONS,
  showDecorations,
} from './models/decorations/decorations.js';
export type { EventSetting, EventType, EventTypeKey } from './models/events/events.js';
export {
  EVENT_TYPE_KEYS,
  EVENT_TYPES,
  eventSetting,
  eventTypeOf,
  seasonOf,
  startIn,
} from './models/events/events.js';
export type { Place, PlaceKey } from './models/places/places.js';
export {
  outlineOf,
  PLACE_KEYS,
  placeOutline,
  PLACES,
  undrawnPlaces,
} from './models/places/places.js';
export { fillFaces, LANDFILL_GROUND, seedFillFaces } from './models/seam/fills.js';
export * from './models/seam/landfill.js';
export { pathOf, pickByKey, SEAM_PICKS, seamNetwork, tracedSeams } from './models/seam/seam.js';
export { createCulvert, createDeck } from './models/structures/decks.js';
export { createHut, HUT } from './models/structures/hut.js';
export type { SeamEdge, SeamHandle } from './models/structures/measures.js';
export { createPavilion } from './models/structures/pavilion.js';
export { createRailings, unknownHandles } from './models/structures/railings.js';
export { createRoadside, DELINEATORS, GRANITE_POSTS } from './models/structures/roadside.js';
export { createStairs } from './models/structures/stairs.js';
export {
  createBrook,
  createMarkings,
  createWays,
  heightAt,
  MARKINGS,
} from './models/terrain/ground.js';
export { DRAWN_GROUND, seasonGround, terrainTint } from './models/terrain/terrain.drawn.js';
export {
  BASE_ELEVATION,
  elevationAt,
  TERRAIN_RADIUS,
  YARD_MARGIN,
} from './models/terrain/terrain.field.js';
export { buildTerrain, createTerrain } from './models/terrain/terrain.js';
export type { Season } from './models/terrain/trees.js';
export { createTrees, seasonTrees } from './models/terrain/trees.js';
export type { CarSpec } from './models/vehicles/cars.js';
export { createCars, standCar } from './models/vehicles/cars.js';
export { createSaab, SAAB_900 } from './models/vehicles/saab.js';
export * from './scene/atmosphere.js';
export * from './scene/lamps.js';
export * from './scene/palette.js';
export * from './scene/parts.js';
export * from './scene/scene.js';
export * from './scene/sky.js';
export * from './scene/snow.js';
export { dispose } from './utils/mesh.utils.js';
