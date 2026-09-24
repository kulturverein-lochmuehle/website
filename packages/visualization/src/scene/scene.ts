import type { Light, Mesh, Object3D } from 'three';
import {
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  OrthographicCamera,
  PCFShadowMap,
  PointLight,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';

import { BRUSHES } from '../data/brushes.js';
import type { Point } from '../data/data.js';
import { lightWindows, ownLight, windowLamps } from '../models/buildings/buildings.js';
import { YARD_CENTER } from '../models/buildings/footprint.js';
import { showDecorations } from '../models/decorations/decorations.js';
import { LANDFILL_GROUND } from '../models/seam/fills.js';
import type { Stroke } from '../models/seam/landfill.js';
import { Landfill } from '../models/seam/landfill.js';
import { showSeasonal } from '../models/structures/streetlamps.js';
import { heightAt } from '../models/terrain/ground.js';
import { seasonGround, terrainTint } from '../models/terrain/terrain.drawn.js';
import { BASE_ELEVATION, elevationAt, TERRAIN_RADIUS } from '../models/terrain/terrain.field.js';
import type { Season } from '../models/terrain/trees.js';
import { seasonTrees } from '../models/terrain/trees.js';
import { Traffic } from '../models/vehicles/traffic.js';
import { dispose } from '../utils/mesh.utils.js';
import { Atmosphere } from './atmosphere.js';
import type { Lamp } from './lamps.js';
import { lampStrength, litInEditor, mapsShadows, orange, ROUND_LAMPS } from './lamps.js';
import type { Palette } from './palette.js';
import { readPalette } from './palette.js';
import { buildPart, MODEL_PARTS } from './parts.js';
import type { Sky } from './sky.js';
import { lightsDue, MOON, skyOf, sunDirection } from './sky.js';
import type { Snow } from './snow.js';
import { prepareSnow } from './snow.js';

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
 * The sun's shadows: its map's size, how far round what is looked at they are
 * drawn - a share of the span, within bounds, in meters either way - and how
 * far they are held off the faces that cast them, so none shadows itself: a
 * depth in meters, and along the face's normal as many of the map's cells. A
 * fixed 4cm held a winter sun's shadow 17cm off the post that cast it; a cell
 * is 1.5cm close up. The map counts its depth bias against the whole depth it
 * spans - 600m - so it is set from meters: the 0.0004 it was stood every
 * shadow a quarter of a meter off the wall that cast it.
 */
const SHADOW = { map: 4096, share: 0.75, least: 30, most: 220, bias: 0.03, normalBias: 1 };

/** How brightly a bulb and a street lamp light, in the scene's own units, for each of the lamps' strength. */
const BULB_INTENSITY = 1.6;
const STREET_INTENSITY = 9;

/** What carries lights: its windows, bulbs and lanterns lit and put out together. */
const LIT = ['buildings', 'pavilion', 'streetlamps', 'strings'];

/** The light the shadowed sides get: sky and ground bounce, and a fill all round. */
export const FILL = { hemisphere: 0.5, ambient: 0.9 };

/**
 * Everything that is built of the model, in one group: the ground - with the
 * landfill mesh laid on it, empty until strokes are laid - and all that stands
 * on it. No lights, no camera: what renders it brings those.
 */
export function createModel(palette: Palette): Built {
  const steps = modelSteps(palette);
  steps.forEach(({ make }) => make());
  return steps.built();
}

/**
 * The ground the landfill is piled onto, worked out the first time it is
 * asked for, not when a scene is set up: the dumps under it take seconds to
 * lay, and a scene whose model comes from elsewhere may be handed them first.
 */
const landfillGround = (x: number, y: number) => LANDFILL_GROUND()(x, y);

/** What the model is built into: the whole, and the parts the scene keeps hold of. */
export interface Built {
  model: Group;
  terrain: Mesh;
  landfill: Mesh;
}

/** What building the model has got to, and what it is on. */
export type Building = (done: number, of: number, step: string) => void;

/**
 * The same, a part at a time, handing the page back between them - so what
 * waits for it can say how far it has got instead of freezing.
 */
export async function buildModel(palette: Palette, building?: Building): Promise<Built> {
  const steps = modelSteps(palette);
  for (const [index, { step, make }] of steps.entries()) {
    building?.(index, steps.length, step);
    // said before it is built, and drawn: yielded to the next frame and past
    // it, since what starts in a frame's own callback holds its drawing up
    await new Promise(resolve =>
      // on a page; in a worker there is nothing to draw
      typeof document !== 'undefined'
        ? requestAnimationFrame(() => setTimeout(resolve, 0))
        : setTimeout(resolve, 0)
    );
    make();
  }
  building?.(steps.length, steps.length, 'done');
  return steps.built();
}

/** Whether an object is shown, all the way up; none - no object - counts as shown. */
function shownFrom(object: Object3D | undefined): boolean {
  for (let at: Object3D | null = object ?? null; at !== null; at = at.parent) {
    if (!at.visible) {
      return false;
    }
  }
  return true;
}

/** The model's parts in the order they are built, each named for what it is. */
function modelSteps(palette: Palette) {
  const parts = new Map<string, Object3D>();
  const steps = MODEL_PARTS.map(({ name }) => ({
    step: name,
    make: () => void buildPart(name, palette, parts),
  }));
  return Object.assign(steps, {
    built: (): Built => {
      const model = new Group();
      model.name = 'model';
      model.add(...parts.values());
      const terrain = parts.get('terrain') as Mesh;
      return { model, terrain, landfill: terrain.getObjectByName('landfill') as Mesh };
    },
  });
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
  /** The ground, once it is built: the model may come a part at a time. */
  protected terrain: Mesh | undefined;
  /** The ground piled on: what is written into the source, and what is drawn of it. */
  protected landfill = new Landfill(landfillGround);
  protected landfillMesh: Mesh | undefined;
  protected size = { width: 1, height: 1 };
  readonly #sun: DirectionalLight;
  readonly #sunDisc: Sprite;
  readonly #atmosphere: Atmosphere;
  /** The sky's and the ground's bounce and the fill all round, dimmed by night. */
  #fills: [HemisphereLight, AmbientLight] | undefined;
  #season: Season = 'summer';
  /** The hour of the clock the sky is set to, or none: then the sun is set for the mill. */
  #hour: number | undefined;
  #moon = MOON;
  /** Whether the sky is drawn - its colours, its sun, its haze - or left clear. */
  #skyShown = true;
  /** Whether the windows are lit; none leaves it to the hour. */
  #lights: boolean | undefined;
  /** Whether the street lamps are lit; none leaves it to the hour. */
  #lanterns: boolean | undefined;
  /** Whether the strings of lights are lit; none leaves it to the hour, as the windows are. */
  #strings: boolean | undefined;
  /** Whether the fires laid burn: they do, unless put out. */
  #fires = true;
  /**
   * Every lamp, those of each part kept in the order the parts are built -
   * the shader lights so many only, the first - and the bulbs of those that
   * throw shadows.
   */
  #lamps: Lamp[] = [];
  #lampsOf: { order: number; lamps: Lamp[] }[] = [];
  readonly #bulbs: PointLight[] = [];
  /** Which layers were last said to be shown, for the parts that come after. */
  readonly #layersShown = new Map<string, boolean>();
  #view: View = { ...DEFAULT_VIEW };
  readonly #snow: Snow;
  #sky: Sky;
  #disposed = false;
  /** The cars that drive the road, once the cars are placed. */
  #traffic: Traffic | undefined;
  /** Called when something starts moving by itself that was still, for the loop that draws it to start again. */
  onmove: (() => void) | undefined;
  /** Whether the sun's shadows are to be drawn again on the next frame, though only something moved. */
  #shadowsStale = false;

  /**
   * Set up round a model built already, or one built here and now - or, given
   * none (`null`), round nothing yet: the parts are added as they are built.
   */
  constructor(canvas: HTMLCanvasElement, host: Element, built?: Built | null) {
    this.palette = readPalette(host);
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearAlpha(0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    const [x, y] = this.#view.center;
    this.target = new Vector3(x, heightAt(x, y) + 2, -y);

    this.#sky = skyOf(this.palette, 'summer');
    this.#sun = this.#createSun();
    this.#sunDisc = this.#createSunDisc();
    this.#atmosphere = new Atmosphere(this.palette);
    this.scene.add(this.#createLights(), this.#sunDisc, this.#atmosphere.points);
    // nothing lit to lay snow on yet: each part is covered as it is placed
    this.#snow = prepareSnow(
      this.scene,
      this.palette.snow,
      this.palette.windowLit,
      this.palette.lantern
    );
    // the model's parts straight in the scene, where the layers look them up
    const { model } = built === null ? { model: undefined } : (built ?? createModel(this.palette));
    [...(model?.children ?? [])].forEach((part, order) => {
      this.#prepare(part, order);
      this.#place(part);
    });
    this.setStrokes([]);
    // not placed yet: a subclass's own fields are not there while this runs,
    // and the first view it is given places the sun and the haze
    this.#showSky(false);
  }

  /**
   * Readies a part of the model for the scene before it is in it: its
   * shadows, its snow, its lamps and the bulbs of those that throw shadows.
   */
  #prepare(part: Object3D, order: number): void {
    // everything built casts a shadow and takes one, the ground included: a
    // low sun lays the valley's own side over its bottom - except what the
    // bulbs hang from and are made of, which throws none of its own
    part.traverse(object => {
      if ((object as Mesh).isMesh === true) {
        object.castShadow = object.userData['lamp'] !== true;
        object.receiveShadow = true;
      }
    });
    this.#snow.cover(part);
    // every opening and bulb that lights, the pavilion's too
    // every lamp, the decorations' too, which light only while they are up
    const lamps = windowLamps(part, true);
    this.#lampsOf = [...this.#lampsOf, { order, lamps }].sort((a, b) => a.order - b.order);
    this.#lamps = this.#lampsOf.flatMap(({ lamps: theirs }) => theirs);
    this.#bulbs.push(...lamps.filter(mapsShadows).map(lamp => this.#createBulb(lamp)));
  }

  /** Puts a readied part into the scene, and its bulbs with it. */
  #place(part: Object3D): void {
    this.scene.add(part);
    this.#bulbs.filter(bulb => bulb.parent === null).forEach(bulb => this.scene.add(bulb));
    if (part.name === 'cars') {
      this.#traffic?.dispose();
      this.#traffic = new Traffic(part as Group, this.palette, () => this.onmove?.());
      this.#showLights();
    }
    if (part.name === 'terrain') {
      this.terrain = part as Mesh;
      this.landfillMesh = part.getObjectByName('landfill') as Mesh | undefined;
    }
  }

  #createBulb(lamp: Lamp): PointLight {
    const { at, kind } = lamp;
    const round = kind === 'street' ? ROUND_LAMPS.street : ROUND_LAMPS.bulb;
    const bulb = new PointLight(
      orange(lamp) ? this.palette.lantern : this.palette.windowLit,
      0,
      round.gone,
      2
    );
    bulb.userData['intensity'] = kind === 'street' ? STREET_INTENSITY : BULB_INTENSITY;
    bulb.userData['lamp'] = lamp;
    bulb.position.set(...at);
    bulb.castShadow = true;
    bulb.shadow.autoUpdate = false;
    bulb.shadow.mapSize.set(512, 512);
    bulb.shadow.camera.near = 0.15;
    bulb.shadow.camera.far = round.gone;
    bulb.shadow.bias = -0.002;
    // soft at the edges, as a bulb's are - it is not a point
    bulb.shadow.radius = 6;
    bulb.shadow.blurSamples = 16;
    bulb.visible = false;
    return bulb;
  }

  /**
   * Adds a part of the model built since, by the name `MODEL_PARTS` gives it:
   * readied as the ones built with the scene were, its shaders compiled
   * before it is put in - not on the first frame that draws it - and then
   * drawn in the season, the light and the layers the scene is in.
   */
  async addPart(part: Object3D, name: string): Promise<void> {
    this.#prepare(
      part,
      MODEL_PARTS.findIndex(candidate => candidate.name === name)
    );
    const trees = part.getObjectByName('trees');
    if (trees !== undefined) {
      seasonTrees(trees, this.palette, this.#season);
    }
    const terrain = part.getObjectByName('terrain');
    if (terrain !== undefined) {
      seasonGround(terrain, this.palette, this.#season);
    }
    await this.renderer.compileAsync(part, this.camera, this.scene);
    if (this.#disposed) {
      return;
    }
    this.#place(part);
    if (terrain !== undefined) {
      this.redrawLandfill();
    }
    showSeasonal(this.scene, this.#season);
    showDecorations(this.scene, this.#decorations);
    this.#layersShown.forEach((visible, layer) => this.#showLayer(layer, visible));
    // a bulb switched on is a light more, and every shader is made again for
    // it on the next frame - seconds held up after dark: made beforehand,
    // against the lights as they will be, they are only looked up then
    const { shines } = this.#lampsLit();
    const shining = this.#bulbs.filter(bulb => shines(bulb));
    if (shining.some(bulb => !bulb.visible)) {
      const stage = new Scene();
      stage.fog = this.scene.fog;
      const lights: Light[] = [];
      this.scene.traverseVisible(object => {
        if ((object as Light).isLight === true && !this.#bulbs.includes(object as PointLight)) {
          lights.push(object as Light);
        }
      });
      stage.add(
        ...[...lights, ...shining].map(light => Object.assign(light.clone(), { visible: true }))
      );
      await this.renderer.compileAsync(this.scene, this.camera, stage);
      if (this.#disposed) {
        return;
      }
    }
    this.#showLights();
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
    const sun = new DirectionalLight(this.#sky.sun.color, this.#sky.sun.intensity);
    sun.target.position.copy(this.target);
    // the shadows are drawn round what is looked at, not over the whole
    // valley: a map this size over the view's own span keeps them sharp
    sun.castShadow = true;
    sun.shadow.mapSize.set(SHADOW.map, SHADOW.map);
    return sun;
  }

  /** The sun seen in the sky: a glow round a bright core, drawn over everything behind it. */
  #createSunDisc(): Sprite {
    const size = 128;
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = [size, size];
    const context = canvas.getContext('2d');
    if (context !== null) {
      const glow = context.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2
      );
      glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
      glow.addColorStop(0.18, 'rgba(255, 255, 255, 1)');
      glow.addColorStop(0.3, 'rgba(255, 255, 255, 0.35)');
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, size, size);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    const disc = new Sprite(
      new SpriteMaterial({ map: texture, fog: false, depthWrite: false, transparent: true })
    );
    disc.name = 'sun';
    return disc;
  }

  /**
   * The season's sky: the background running from its horizon up to its
   * zenith, the haze the far valley fades into, and the sun - its light, its
   * colour and where it stands, which is where its disc is drawn.
   */
  #showSky(place = true): void {
    const { zenith, horizon, haze, sun } = this.#sky;
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = [2, 256];
    const context = canvas.getContext('2d');
    if (context !== null) {
      const gradient = context.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, `#${zenith.getHexString()}`);
      gradient.addColorStop(1, `#${horizon.getHexString()}`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, 2, 256);
    }
    const background = new CanvasTexture(canvas);
    background.colorSpace = SRGBColorSpace;
    (this.scene.background as CanvasTexture | null)?.dispose?.();
    // with the sky switched off, the page shows through and nothing is hazed
    this.scene.background = this.#skyShown ? background : null;
    this.scene.fog = this.#skyShown ? new Fog(haze, 0, 1) : null;
    this.#sunDisc.visible = this.#skyShown;
    this.#sun.color.copy(sun.color);
    this.#sun.intensity = sun.intensity;
    this.#sun.shadow.intensity = this.#sky.shadow.strength;
    this.#sun.shadow.radius = this.#sky.shadow.softness;
    const [bounce, all] = this.#fills ?? [];
    if (bounce !== undefined && all !== undefined) {
      bounce.intensity = FILL.hemisphere * this.#sky.fill;
      bounce.color.copy(this.palette.sky).multiply(this.#sky.fillTint);
      bounce.groundColor.copy(this.palette.ground).multiply(this.#sky.fillTint);
      all.intensity = FILL.ambient * this.#sky.fill;
      all.color.copy(this.palette.ambient).multiply(this.#sky.fillTint);
    }
    this.#showLights();
    // the moon a smaller, paler disc than the sun
    this.#sunDisc.userData['size'] = sun.body === 'moon' ? 0.06 : 0.12;
    (this.#sunDisc.material as SpriteMaterial).color.copy(sun.color).lerp(horizon, 0.1);
    if (place) {
      this.setView({});
    }
  }

  #createLights(): Group {
    const lights = new Group();
    lights.name = 'lights';
    // sky and ground bounce, they keep the shadowed sides colored instead of black
    const sky = new HemisphereLight(this.palette.sky, this.palette.ground, FILL.hemisphere);
    const fill = new AmbientLight(this.palette.ambient, FILL.ambient);
    this.#fills = [sky, fill];
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
      roads: ['ways', 'markings', 'brook', 'streetlamps', 'roadside', 'tracks'],
      walls: ['crossing-walls', 'stairs', 'railings'],
      decks: ['crossing-deck', 'deck'],
      houses: ['buildings', 'pavilion', 'hut', 'strings'],
      // the ground itself, which is what everything else is fitted to - and
      // what hides a structure while it is being looked at
      terrain: ['terrain'],
    };
  }

  /** Hides or shows a part of the scene. */
  setLayer(layer: string, visible: boolean): void {
    // the sky and what drifts in it are the season's, and come and go with it:
    // the switch only says whether they are shown at all
    if (layer === 'sky') {
      this.#skyShown = visible;
      this.#showSky();
      return;
    }
    if (layer === 'particles') {
      this.#atmosphere.shown = visible;
      return;
    }
    this.#layersShown.set(layer, visible);
    this.#showLayer(layer, visible);
  }

  #showLayer(layer: string, visible: boolean): void {
    (this.layers[layer] ?? []).forEach(name => {
      const group = this.scene.getObjectByName(name);
      if (group !== undefined) {
        // what is put up for some seasons only stays away in the others
        const seasons = group.userData['seasons'] as string[] | undefined;
        group.visible = visible && (seasons === undefined || seasons.includes(this.#season));
      }
    });
  }

  /**
   * Draws the model in a season: the woods in leaf of its colour, or bare and
   * under snow for a winter, the ground and the roofs with them.
   */
  setSeason(season: Season): void {
    const trees = this.scene.getObjectByName('trees');
    if (trees !== undefined) {
      seasonTrees(trees, this.palette, season);
    }
    const terrain = this.scene.getObjectByName('terrain');
    if (terrain !== undefined) {
      seasonGround(terrain, this.palette, season);
    }
    this.#snow.set(season === 'winter' ? 1 : 0);
    this.#season = season;
    showSeasonal(this.scene, season);
    this.#sky = skyOf(this.palette, season, this.#hour, this.#moon);
    this.#atmosphere.setSeason(season);
    this.#showSky();
  }

  /**
   * Sets the sky to an hour of the clock on the season's day - the sun, or
   * the moon after dark, where the almanac has it - or, with none, back to the
   * sun set for the mill.
   */
  setTime(hour: number | undefined): void {
    this.#hour = hour;
    this.#sky = skyOf(this.palette, this.#season, hour, this.#moon);
    this.#showSky();
  }

  /** How much moon there is at night, nought at new moon to one at full. */
  setMoon(moon: number): void {
    this.#moon = moon;
    this.#sky = skyOf(this.palette, this.#season, this.#hour, moon);
    this.#showSky();
  }

  /** Puts up the decorations named, and takes the others down. */
  setDecorations(up: readonly string[]): void {
    this.#decorations = [...up];
    showDecorations(this.scene, this.#decorations);
    this.#showLights();
  }

  #decorations: string[] = [];

  /** Switches the street lamps on or off, or with none leaves them to the hour. */
  setLanterns(lanterns: boolean | undefined): void {
    this.#lanterns = lanterns;
    this.#showLights();
  }

  /** Switches the strings of lights on or off, or with none leaves them to the hour. */
  setStrings(strings: boolean | undefined): void {
    this.#strings = strings;
    this.#showLights();
  }

  /** Sends a car along the road, down it or up. */
  sendCar(): void {
    this.#traffic?.send();
  }

  /** Lets the fires laid burn, or puts them out: the stones and logs stay, the flame goes. */
  setFires(burning: boolean): void {
    this.#fires = burning;
    this.#showLights();
  }

  /** Switches the lights on or off, or with none leaves them to the hour: on once it is dark. */
  setLights(lights: boolean | undefined): void {
    this.#lights = lights;
    this.#showLights();
  }

  #showLights(): void {
    const { on, lanterns, strength, lit, shines, strings } = this.#lampsLit();
    LIT.forEach(name => {
      const lit = this.scene.getObjectByName(name);
      if (lit !== undefined) {
        const switched = name === 'streetlamps' ? lanterns : name === 'strings' ? strings : on;
        lightWindows(lit, this.palette, switched, this.#sky.day);
      }
    });
    // a fire put out is its stones and logs
    this.scene.traverse(object => {
      if (object.name === 'flame') {
        object.visible = this.#fires;
      }
    });
    this.#traffic?.setLights(lanterns);
    // the shader lights the ones that cast no shadows; the bulbs are the
    // scene's own lights, with a shadow map each, drawn again only when
    // something about them changes - nothing near them moves
    this.#snow.setLamps(
      this.#lamps.filter(lamp => !mapsShadows(lamp) && litInEditor(lamp) && lit(lamp)),
      strength
    );
    this.#bulbs.forEach(bulb => {
      bulb.intensity = lit(bulb.userData['lamp'] as Lamp)
        ? strength * (bulb.userData['intensity'] as number)
        : 0;
      bulb.visible = shines(bulb);
      bulb.shadow.needsUpdate = true;
    });
  }

  /** Which lamps are lit now, how strongly, and which of the bulbs shine for it. */
  #lampsLit() {
    const due = lightsDue(this.#season, this.#hour);
    const on = this.#lights ?? due;
    const lanterns = this.#lanterns ?? due;
    // the light they throw out, the more the darker it is round them
    const strength = lampStrength(this.#sky.day);
    // a fire burns whenever it is laid; the rest as they are switched - and
    // only what is up: a decoration not put up lights nothing
    const strings = this.#strings ?? on;
    const lit = (lamp: Lamp) =>
      shownFrom(lamp.source) &&
      (lamp.kind === 'fire'
        ? this.#fires
        : ownLight(lamp.source)
          ? true
          : lamp.kind === 'street'
            ? lanterns
            : lamp.kind === 'string'
              ? strings
              : on);
    const shines = (bulb: PointLight) => lit(bulb.userData['lamp'] as Lamp) && strength > 0;
    return { on, lanterns, strength, lit, shines, strings };
  }

  /** Whether something in the scene moves by itself, and it wants drawing frame by frame. */
  get moving(): boolean {
    return this.#atmosphere.moving || this.#flames().length > 0 || this.#traffic?.driving === true;
  }

  /** The tongues of the fires that are up, which flicker. */
  #flames(): Mesh[] {
    const tongues: Mesh[] = [];
    this.scene.getObjectByName('decorations')?.traverseVisible(object => {
      if (object.userData['flame'] !== undefined) {
        tongues.push(object as Mesh);
      }
    });
    return tongues;
  }

  #burnt = 0;

  /** Moves on what moves by itself - the season's drift - by a time, in seconds. */
  tick(seconds: number): void {
    // how many pixels a meter is across on screen, which the drift is sized by
    const { span } = this.#view;
    const aspect = this.size.width / this.size.height;
    const pixels = (this.size.height * this.renderer.getPixelRatio()) / (span / aspect);
    this.#atmosphere.tick(seconds, this.target, span, pixels);
    this.#traffic?.tick(seconds);
    if (this.#traffic?.dirty === true) {
      this.#traffic.dirty = false;
      this.#shadowsStale = true;
    }
    // the fires: every tongue its own height and sway, a few waves laid
    // together that never quite repeat, and the light with the flames
    this.#burnt += seconds;
    const t = this.#burnt;
    const wave = (phase: number) =>
      0.55 * Math.sin(t * 7.3 + phase) +
      0.3 * Math.sin(t * 13.1 + phase * 1.7) +
      0.15 * Math.sin(t * 23.7 + phase * 2.3);
    const flames = this.#flames();
    flames.forEach(tongue => {
      const { phase, lean } = tongue.userData['flame'] as { phase: number; lean: number };
      const high = 1 + 0.22 * wave(phase);
      tongue.scale.set(1 - 0.08 * wave(phase + 2), high, 1 - 0.08 * wave(phase + 4));
      tongue.rotation.set(lean * wave(phase + 1) * 0.6, 0, lean * wave(phase + 3) * 0.6);
    });
    if (flames.length > 0) {
      this.#snow.flicker(fire => 0.85 + 0.15 * wave(fire * 3.1));
    }
  }

  /** Adds something drawn over the model, which goes when the scene does. */
  protected add(...objects: Object3D[]): void {
    this.scene.add(...objects);
  }

  /** Draws what is piled on again, after it has changed. */
  protected redrawLandfill(): void {
    if (this.landfillMesh === undefined) {
      return;
    }
    this.landfillMesh.geometry.dispose();
    this.landfillMesh.geometry = this.landfill.geometry(terrainTint(this.palette, this.#season));
  }

  /**
   * Lays the landfill on anew: what is written into the source, then whatever
   * strokes are handed on top of it, dab by dab in order.
   */
  setStrokes(strokes: Stroke[]): void {
    this.landfill = new Landfill(landfillGround);
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

    // the sun stands where the season has it, whichever way the camera turns
    const toSun = sunDirection(this.#sky);
    this.#sun.position.copy(this.target).addScaledVector(toSun, TERRAIN_RADIUS);
    const reach = Math.min(Math.max(span * SHADOW.share, SHADOW.least), SHADOW.most);
    Object.assign(this.#sun.shadow.camera, {
      left: -reach,
      right: reach,
      top: reach,
      bottom: -reach,
      near: 1,
      far: TERRAIN_RADIUS * 2,
    });
    this.#sun.shadow.camera.updateProjectionMatrix();
    this.#sun.shadow.normalBias = ((reach * 2) / SHADOW.map) * SHADOW.normalBias;
    this.#sun.shadow.bias = -SHADOW.bias / (TERRAIN_RADIUS * 2 - 1);
    this.#sunDisc.position.copy(this.target).addScaledVector(toSun, TERRAIN_RADIUS * 1.5);
    this.#sunDisc.scale.setScalar(span * ((this.#sunDisc.userData['size'] as number) ?? 0.12));
    // the haze thickens with the distance past the ground in front, as far as
    // the camera stands back from it - this camera sees without perspective
    if (this.scene.fog instanceof Fog) {
      const back = TERRAIN_RADIUS * 2;
      this.scene.fog.near = back - span / 2;
      this.scene.fog.far = back + this.#sky.hazeReach / this.#sky.hazeMost;
    }
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

  /**
   * Draws the scene; `moved` alone - a frame of what moves by itself, the
   * drift or a fire's flames, none of which casts a shadow - keeps the sun's
   * shadow map as it was drawn last, rather than drawing it all again: at
   * 4096 cells a side, every frame, it was most of what a flickering fire cost.
   */
  render(moved = false): void {
    this.renderer.shadowMap.autoUpdate = !moved || this.#shadowsStale;
    this.#shadowsStale = false;
    this.renderer.render(this.scene, this.camera);
    this.renderer.shadowMap.autoUpdate = true;
  }

  /** Whether the drift moves - wanting every frame - rather than a fire alone, which a few a second do for. */
  get drifting(): boolean {
    return this.#atmosphere.moving || this.#traffic?.driving === true;
  }

  /** Compiles every shader the scene draws with before the first frame, without holding the page. */
  async prepare(): Promise<void> {
    await this.renderer.compileAsync(this.scene, this.camera);
    // and one frame drawn: the shadow maps' own programs are only made the
    // first time they are drawn with, and made then they held up the first
    // frame the page showed - under the last part built, as if that were slow
    this.render();
  }

  dispose(): void {
    this.#disposed = true;
    this.#traffic?.dispose();
    dispose(this.scene);
    this.renderer.dispose();
  }
}
