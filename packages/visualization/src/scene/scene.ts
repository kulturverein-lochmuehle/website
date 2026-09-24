import type { Mesh, Object3D } from 'three';
import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';

import { BRUSHES } from '../data/brushes.js';
import type { Point } from '../data/data.js';
import { createBuildings } from '../models/buildings/buildings.js';
import { YARD_CENTER } from '../models/buildings/footprint.js';
import { LANDFILL_GROUND } from '../models/seam/fills.js';
import type { Stroke } from '../models/seam/landfill.js';
import { createLandfill, Landfill } from '../models/seam/landfill.js';
import { createCulvert, createDeck } from '../models/structures/decks.js';
import { createPavilion } from '../models/structures/pavilion.js';
import { createRailings } from '../models/structures/railings.js';
import { createStairs } from '../models/structures/stairs.js';
import { createBrook, createWays, heightAt } from '../models/terrain/ground.js';
import { terrainTint } from '../models/terrain/terrain.drawn.js';
import { BASE_ELEVATION, elevationAt, TERRAIN_RADIUS } from '../models/terrain/terrain.field.js';
import { createTerrain } from '../models/terrain/terrain.js';
import { createTrees } from '../models/terrain/trees.js';
import { dispose } from '../utils/mesh.utils.js';
import type { Palette } from './palette.js';
import { readPalette } from './palette.js';

/** Where the camera stands and how much of the valley it takes in. */
export interface View {
  /** Compass direction the camera looks from, degrees clockwise from north. */
  azimuth: number;
  /** Angle above the horizon in degrees, 90 would be straight down. */
  elevation: number;
  /** Width of the visible ground in meters, the orthographic stand-in for zoom. */
  span: number;
  /** Point of the local grid the view is centred on. */
  center: Point;
}

/** The parts of the scene that can be hidden, each a name the scene knows. */
export type Layer = 'trees' | 'roads' | 'walls' | 'decks' | 'houses' | 'terrain';

/** Looks up the valley from the south west, the way the old drawing did. */
export const DEFAULT_VIEW: View = {
  azimuth: 340,
  elevation: 28,
  span: 200,
  // the mill's yard, not the geocoded address, is what the scene is about
  center: YARD_CENTER,
};

/**
 * The sun stands over the camera's left shoulder and follows it around. A sun
 * fixed to the compass would light the sides the camera cannot see, and the
 * mill would turn into a silhouette on every second view.
 */
export const SUN = { offset: -42, elevation: 48, intensity: 2.4 };

/** The light the shadowed sides get: sky and ground bounce, and a fill all round. */
export const FILL = { hemisphere: 0.5, ambient: 0.9 };

/**
 * Everything that is built of the model, in one group: the ground - with the
 * landfill mesh laid on it, empty until strokes are laid - and all that stands
 * on it. No lights, no camera: what renders it brings those.
 */
export function createModel(palette: Palette): { model: Group; terrain: Mesh; landfill: Mesh } {
  // the brook and the roads are painted onto the terrain, so they need the
  // mesh itself to read their heights off
  const terrain = createTerrain(palette);
  // what is piled on it goes with it, and is hidden with it
  const landfill = createLandfill();
  terrain.add(landfill);
  const model = new Group();
  model.name = 'model';
  model.add(
    terrain,
    createBrook(palette),
    createCulvert(palette),
    createStairs(palette),
    createDeck(palette),
    createWays(palette),
    createTrees(palette),
    createBuildings(palette),
    createPavilion(palette),
    createRailings(palette)
  );
  return { model, terrain, landfill };
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** A compass direction and a height angle as a unit vector in scene space. */
export function direction(azimuth: number, elevation: number): Vector3 {
  const [phi, theta] = [toRadians(azimuth), toRadians(elevation)];
  // azimuth 0 looks from the north, which is -z, and turns towards the east
  return new Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.sin(theta),
    -Math.cos(phi) * Math.cos(theta)
  );
}

/**
 * The Lochmühle as three.js sees it: the terrain from EU-DEM, the outlines from
 * OpenStreetMap, the buildings extruded from those outlines. The scene renders
 * on demand - nothing in it moves, so a render loop would only warm the device.
 */
export class HousesScene {
  protected readonly renderer: WebGLRenderer;
  protected readonly scene = new Scene();
  protected readonly camera = new OrthographicCamera();
  protected readonly target: Vector3;
  protected readonly palette: Palette;
  protected readonly terrain: Mesh;
  /** The ground piled on: what is written into the source, and what is drawn of it. */
  protected landfill = new Landfill(LANDFILL_GROUND());
  protected readonly landfillMesh: Mesh;
  protected size = { width: 1, height: 1 };
  readonly #sun: DirectionalLight;
  #view: View = { ...DEFAULT_VIEW };

  constructor(canvas: HTMLCanvasElement, host: Element) {
    this.palette = readPalette(host);
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearAlpha(0);

    const [x, y] = this.#view.center;
    this.target = new Vector3(x, heightAt(x, y) + 2, -y);

    const { model, terrain, landfill } = createModel(this.palette);
    this.terrain = terrain;
    this.landfillMesh = landfill;
    this.setStrokes([]);

    this.#sun = this.#createSun();
    // the model's parts straight in the scene, where the layers look them up
    this.scene.add(...model.children, this.#createLights());
  }

  get view(): View {
    return { ...this.#view, center: [...this.#view.center] };
  }

  /** Height above sea level under a point of the local grid, for callers who map. */
  static elevationAt(x: number, y: number): number {
    return elevationAt(x, y);
  }

  /** Sea level offset the scene was built around. */
  static get baseElevation(): number {
    return BASE_ELEVATION;
  }

  #createSun(): DirectionalLight {
    // no shadow map: a few thousand trees and three buildings cost more to
    // shadow than the shadows are worth at this scale
    const sun = new DirectionalLight(this.palette.light, SUN.intensity);
    sun.target.position.copy(this.target);
    return sun;
  }

  #createLights(): Group {
    const lights = new Group();
    lights.name = 'lights';
    // sky and ground bounce, they keep the shadowed sides colored instead of black
    const sky = new HemisphereLight(this.palette.sky, this.palette.ground, FILL.hemisphere);
    const fill = new AmbientLight(this.palette.ambient, FILL.ambient);
    lights.add(this.#sun, this.#sun.target, sky, fill);
    return lights;
  }

  /**
   * Which of the scene's groups each layer hides or shows. What belongs
   * together on screen belongs together here: the brook is laid on the ground
   * the way the ways are, so it goes with them, while the walls and the plates
   * are built and are switched on their own - each is in the way of looking at
   * the other.
   */
  protected get layers(): Record<string, string[]> {
    return {
      trees: ['trees'],
      roads: ['ways', 'brook'],
      walls: ['crossing-walls', 'stairs', 'railings'],
      decks: ['crossing-deck', 'deck'],
      houses: ['buildings', 'pavilion'],
      // the ground itself, which is what everything else is fitted to - and
      // what hides a structure while it is being looked at
      terrain: ['terrain'],
    };
  }

  /** Hides or shows a part of the scene. */
  setLayer(layer: string, visible: boolean): void {
    (this.layers[layer] ?? []).forEach(name => {
      const group = this.scene.getObjectByName(name);
      if (group !== undefined) {
        group.visible = visible;
      }
    });
  }

  /** Adds something drawn over the model, which goes when the scene does. */
  protected add(...objects: Object3D[]): void {
    this.scene.add(...objects);
  }

  /** Draws what is piled on again, after it has changed. */
  protected redrawLandfill(): void {
    this.landfillMesh.geometry.dispose();
    this.landfillMesh.geometry = this.landfill.geometry(terrainTint(this.palette));
  }

  /**
   * Lays the landfill on anew: what is written into the source, then whatever
   * strokes are handed on top of it, dab by dab in order.
   */
  setStrokes(strokes: Stroke[]): void {
    this.landfill = new Landfill(LANDFILL_GROUND());
    [...BRUSHES, ...strokes].forEach(stroke => this.landfill.dab(stroke));
    this.redrawLandfill();
  }

  /** The height of the ground at a point of the plan, landfill and all. */
  groundAt(x: number, y: number): number | undefined {
    return this.landfill.heightAt(x, y);
  }

  setView(view: Partial<View>): void {
    this.#view = { ...this.#view, ...view };
    const { azimuth, elevation, span, center } = this.#view;

    const [x, y] = center;
    this.target.set(x, heightAt(x, y) + 2, -y);
    this.#sun.target.position.copy(this.target);

    const aspect = this.size.width / this.size.height;
    const half = span / 2;
    Object.assign(this.camera, {
      left: -half,
      right: half,
      top: half / aspect,
      bottom: -half / aspect,
      near: 0.1,
      far: TERRAIN_RADIUS * 8,
    });
    this.camera.position
      .copy(this.target)
      .add(direction(azimuth, elevation).multiplyScalar(TERRAIN_RADIUS * 2));
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();

    this.#sun.position
      .copy(this.target)
      .add(direction(azimuth + SUN.offset, SUN.elevation).multiplyScalar(TERRAIN_RADIUS));
    this.viewChanged();
  }

  /** Called whenever the view or the size has changed, for what is sized by it. */
  protected viewChanged(): void {
    // nothing drawn here depends on the view beyond the camera itself
  }

  resize(width: number, height: number): void {
    this.size = { width: Math.max(width, 1), height: Math.max(height, 1) };
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.size.width, this.size.height, false);
    this.setView({});
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    dispose(this.scene);
    this.renderer.dispose();
  }
}
