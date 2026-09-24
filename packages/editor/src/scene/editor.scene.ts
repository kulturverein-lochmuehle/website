import type { Point, SeamHandle, Stroke } from '@kvlm/visualization';
import {
  direction,
  dispose,
  freezePalette,
  heightAt,
  HousesScene,
  MODEL_PARTS,
  SEAM_PICKS,
  seedFillFaces,
  unpackPart,
  worldTriangles,
} from '@kvlm/visualization';
import type { Object3D } from 'three';
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Raycaster,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
} from 'three';

import {
  createDraft,
  createPicks,
  createSeam,
  createTrace,
  dot,
  markDraft,
  markPicks,
  markTrace,
} from './editor.overlays.js';
import { createPlaces } from './editor.places.js';
import type { OverlayReply, OverlayRequest } from './overlays.worker.js';
import type { PartReply, PartRequest } from './parts.worker.js';

/** A handle that was picked, with the number it carries in the scene. */
export type PickedHandle = SeamHandle & { index: number };

/** The parts of the scene that can be hidden, the places' overlay among them. */
export type EditorLayer =
  'trees' | 'sky' | 'particles' | 'roads' | 'walls' | 'decks' | 'houses' | 'places' | 'terrain';

/**
 * The tool in hand, which says what is drawn over the model to work with:
 * the seam and its handles for the seam, the handles and the place being
 * drawn for a place, the reference points for the point tool.
 */
export type EditorTool = 'navigate' | 'brush' | 'point' | 'seam' | 'place';

/** A corner of a place being drawn: a handle by name, or a point of the plan. */
export type DraftCorner = string | Point;

/**
 * How wide a seam handle is drawn on screen in pixels, and how far it may grow
 * or shrink on the ground to keep to it: a dot that tracked the zoom all the
 * way would swallow the crossing it stands on.
 */
const DOT = { pixels: 13, min: 0.22, max: 0.6 };

/**
 * The point tool's rulers: how far they reach and how finely they are laid,
 * in meters - all the way, or a piece out far bridges a hollow or cuts into
 * a ridge - and the colour of the level ones.
 */
const RULER = { reach: 30, step: 0.2, level: '#00c8e0' };

/** The ghost of a reference point: its label's canvas, and where on it the dot is. */
const GHOST = {
  width: 256,
  height: 64,
  dot: 32,
  scale: 1.6,
  /** How far the ring around it reaches, in handles. */
  reach: 4,
};

/** A see-through dot with how far it is lifted written beside it. */
function ghostLabel(text: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = GHOST.width;
  canvas.height = GHOST.height;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.fillStyle = 'rgb(224 0 122 / 0.55)';
    context.beginPath();
    context.arc(GHOST.dot, GHOST.height / 2, 22, 0, Math.PI * 2);
    context.fill();
    context.font = 'bold 30px sans-serif';
    context.textBaseline = 'middle';
    context.lineWidth = 6;
    context.strokeStyle = '#ffffff';
    context.strokeText(text, GHOST.dot * 2 + 4, GHOST.height / 2 + 2);
    context.fillStyle = '#e0007a';
    context.fillText(text, GHOST.dot * 2 + 4, GHOST.height / 2 + 2);
  }
  return new CanvasTexture(canvas);
}

/** What the editor says it is working on: the model's parts, or an overlay. */
export type EditorTask = 'model' | 'seam' | 'places';

/** How far a task has got, and what it is on; no share when it cannot say. */
export interface EditorProgress {
  share: number | undefined;
  step: string;
}

/**
 * How many workers build the model's parts side by side: the trees alone take
 * seconds, and the rest need not wait for them - but every worker loads the
 * whole of the model's code and data, so not one a core.
 */
const BUILDERS = Math.min(Math.max((globalThis.navigator?.hardwareConcurrency ?? 4) - 2, 1), 4);

/** The parts the places are laid on, which have to stand before they are. */
const PLACES_ON = ['terrain', 'roads', 'decks', 'culvert', 'stairs'];

/** How many points the brush's ring is drawn with, and how far over the ground. */
const RING = { points: 64, over: 0.04 };

/**
 * The model as the editor works on it: the scene, and over it the seam and
 * the handles it is picked out between, what has been picked, the reference
 * points set and the one about to be, the brush's reach - and what lies under
 * a point of the canvas, which is what every tool starts from.
 */
export class EditorScene extends HousesScene {
  /** The dots a seam is picked out between, the seams themselves, and the one
   * still being traced between them. */
  readonly #picks = createPicks();
  readonly #trace = createTrace();
  #chosen: number[] = [];
  #seams: number[][] = [];
  /** The brush's ring. */
  readonly #ring = this.#createRing();
  /** The reference points set on the bench and not written into the source yet. */
  readonly #points = Object.assign(new Group(), { name: 'points' });
  /** Where the next one would be set, with a line down to what it stands over. */
  readonly #ghost = this.#createGhost();
  /** The place being drawn, and its corners. */
  readonly #draft = createDraft();
  #corners: DraftCorner[] = [];
  #tool: EditorTool = 'navigate';

  /**
   * Set up round nothing: the model comes a part at a time, each built in a
   * worker as the layers shown need it, in the order it is built - what is
   * not shown is not built until it is.
   */
  constructor(canvas: HTMLCanvasElement, host: Element) {
    super(canvas, host, null);
    // the seam's network takes seconds to work out, and only its layer needs
    // it: it is drawn the first time that is switched on
    this.#seam.name = 'seam';
    this.#places.name = 'places';
    this.add(
      this.#seam,
      this.#places,
      this.#trace,
      this.#picks,
      this.#points,
      this.#ghost,
      this.#ring,
      this.#draft
    );
    this.setTool('navigate');
    this.setView({});
  }

  /**
   * Takes up a tool: what it works with is drawn, and what the others do is
   * not - the seam's network is worked out the first time the seam is taken
   * up, and let go of if it is put down before it is done.
   */
  setTool(tool: EditorTool): void {
    this.#tool = tool;
    this.setLayer('seam', tool === 'seam');
    this.setLayer('handles', tool === 'seam' || tool === 'place');
    this.setLayer('points', tool === 'point');
    this.setLayer('draft', tool === 'place');
    this.#markHandles();
  }

  /** Marks the handles for the tool in hand: what the seams hold, or the place's corners. */
  #markHandles(): void {
    if (this.#tool === 'place') {
      const corners = this.#corners.flatMap(corner =>
        typeof corner === 'string' ? [SEAM_PICKS.findIndex(({ key }) => key === corner)] : []
      );
      markPicks(this.#picks, corners, []);
    } else {
      markPicks(this.#picks, this.#chosen, this.#seams);
    }
  }

  /** Draws the place being drawn, round its corners. */
  setDraft(corners: DraftCorner[], kind: 'area' | 'spot'): void {
    this.#corners = corners;
    markDraft(this.#draft, corners, kind, (x, y) => this.#draped(x, y));
    this.#markHandles();
    this.viewChanged();
  }

  /** The handle under a point of the canvas, by its number and its name, if the handles are shown. */
  handleAt(x: number, y: number): { index: number; key: string } | undefined {
    if (!this.#picks.visible) {
      return undefined;
    }
    this.camera.updateMatrixWorld();
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(x, y), this.camera);
    const pick = ray.intersectObjects(this.#picks.children, false)[0]?.object.userData['pick'];
    const key = typeof pick === 'number' ? SEAM_PICKS[pick]?.key : undefined;
    return key === undefined ? undefined : { index: pick as number, key };
  }

  /** The corner of its own of the place being drawn under a point of the canvas, by its place in the outline. */
  cornerAt(x: number, y: number): number | undefined {
    if (!this.#draft.visible) {
      return undefined;
    }
    this.camera.updateMatrixWorld();
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(x, y), this.camera);
    const sprites = this.#draft.children.filter(child => child.type === 'Sprite');
    const corner = ray.intersectObjects(sprites, false)[0]?.object.userData['corner'];
    return typeof corner === 'number' ? corner : undefined;
  }

  /** The place drawn under a point of the canvas, if the places are shown. */
  placeAt(x: number, y: number): string | undefined {
    if (!this.#places.visible) {
      return undefined;
    }
    this.camera.updateMatrixWorld();
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(x, y), this.camera);
    const hit = ray
      .intersectObjects(this.#places.children, true)
      .find(({ object }) => object.type === 'Mesh');
    const name = hit?.object.parent?.name;
    return name?.startsWith('place:') === true ? name.slice('place:'.length) : undefined;
  }

  /**
   * The overlays' workers, each started the first time its overlay is asked for: the seam's
   * network and the places take seconds to work out, and worked out on the
   * page they froze it. What it sends back is drawn as it comes.
   */
  readonly #workers = new Map<OverlayRequest['kind'], Worker>();

  /** Told how far a task has got - none once it is done. */
  onProgress?: (task: EditorTask, progress: EditorProgress | undefined) => void;

  /** The workers building the model's parts, and the part each is on. */
  readonly #builders: { worker: Worker; on: string | undefined }[] = [];
  /** The parts in the scene. */
  readonly #arrived = new Set<string>();
  /** The layers shown, which say what is needed. */
  readonly #shown = new Set<string>();
  /**
   * The parts asked for since the readout last stood empty - how far it has
   * got is how many of them are in.
   */
  readonly #batch = new Set<string>();
  #dispatching: ReturnType<typeof setTimeout> | undefined;

  /** Whether the places wait for the parts they are laid on. */
  #placesWaiting = false;

  /**
   * The parts the scene needs now: those of the layers shown, those no layer
   * switches, and what the places are laid on while they wait for it.
   */
  #needed(): Set<string> {
    return new Set([
      ...MODEL_PARTS.filter(
        ({ layers }) => layers.length === 0 || layers.some(layer => this.#shown.has(layer))
      ).map(({ name }) => name),
      ...(this.#placesWaiting ? PLACES_ON : []),
    ]);
  }

  /** The parts on their way, being built or waiting for a worker. */
  #building(): Set<string> {
    return new Set(this.#builders.flatMap(({ on }) => (on === undefined ? [] : [on])));
  }

  /**
   * Weighs what is needed against what is there and on its way: the parts
   * newly needed are asked for, those on their way and not needed any more
   * are let go of - their worker stopped - and the next is handed out. Done
   * once whatever is switched in one go has been said: the layers are set one
   * after the other, and the first is not the first due.
   */
  #weigh(): void {
    this.#dispatching ??= setTimeout(() => {
      this.#dispatching = undefined;
      const needed = this.#needed();
      [...needed].filter(name => !this.#arrived.has(name)).forEach(name => this.#batch.add(name));
      // what was asked for and is not needed any more is let go of
      [...this.#batch].filter(name => !needed.has(name)).forEach(name => this.#batch.delete(name));
      this.#builders
        .filter(({ on }) => on !== undefined && !needed.has(on))
        .forEach(builder => this.#stopBuilder(builder));
      this.#dispatch();
    }, 0);
  }

  /** Hands the parts asked for to the workers free, in the order they are built. */
  #dispatch(): void {
    const order = (name: string) => {
      const at = MODEL_PARTS.findIndex(part => part.name === name);
      const always = MODEL_PARTS[at]?.layers.length === 0;
      return (always ? MODEL_PARTS.length : 0) + at;
    };
    const building = this.#building();
    const waiting = (names: Iterable<string>) =>
      [...names]
        .filter(name => !this.#arrived.has(name) && !building.has(name))
        .sort((a, b) => order(a) - order(b));
    waiting(this.#batch).forEach(name => {
      const builder = this.#builders.find(({ on }) => on === undefined) ?? this.#addBuilder();
      if (builder === undefined) {
        return;
      }
      builder.on = name;
      const request: PartRequest = { kind: 'part', name };
      builder.worker.postMessage(request);
    });
    this.#sayBuilding();
  }

  /** Stops a worker on a part no longer wanted; another is started when one is due. */
  #stopBuilder(builder: { worker: Worker; on: string | undefined }): void {
    builder.worker.terminate();
    this.#builders.splice(this.#builders.indexOf(builder), 1);
  }

  /** Another worker to build with, while there are fewer than `BUILDERS`. */
  #addBuilder(): { worker: Worker; on: string | undefined } | undefined {
    if (this.#builders.length >= BUILDERS) {
      return undefined;
    }
    const worker = new Worker(new URL('./parts.worker.ts', import.meta.url), { type: 'module' });
    const builder = { worker, on: undefined as string | undefined };
    this.#builders.push(builder);
    const palette: PartRequest = { kind: 'palette', palette: freezePalette(this.palette) };
    worker.postMessage(palette);
    if (this.#fills !== undefined) {
      const fills: PartRequest = { kind: 'fills', faces: this.#fills };
      worker.postMessage(fills);
    }
    worker.onmessage = async ({ data }: MessageEvent<PartReply>) => {
      builder.on = undefined;
      if (data.kind === 'error') {
        // asked for again the next time a layer is switched
        this.#batch.delete(data.name);
        this.#dispatch();
        throw new Error(`parts: ${data.name}: ${data.error}`);
      }
      // the dumps the terrain laid, for the page's own landfill and the
      // workers that would otherwise lay them again
      if (data.fills !== undefined && this.#fills === undefined) {
        this.#fills = data.fills;
        seedFillFaces(data.fills);
        const fills: PartRequest = { kind: 'fills', faces: data.fills };
        this.#builders.forEach(({ worker: other }) => other.postMessage(fills));
      }
      // the next one started before this one is put in: that takes a while too
      this.#arrived.add(data.name);
      this.#dispatch();
      await this.addPart(unpackPart(data.packed), data.name);
      this.#landed.add(data.name);
      this.#sayBuilding();
      this.#layPlaces();
      this.render();
    };
    return builder;
  }

  /** The dumps' faces, once the terrain's worker has laid them. */
  #fills: Float64Array | undefined;

  /** The parts not only built but put into the scene. */
  readonly #landed = new Set<string>();

  /** Says how far the parts asked for have got, or that they are all in. */
  #sayBuilding(): void {
    const batch = [...this.#batch];
    const done = batch.filter(name => this.#landed.has(name)).length;
    if (done >= batch.length) {
      this.#batch.clear();
      this.onProgress?.('model', undefined);
      return;
    }
    const building = this.#building();
    const on = batch.filter(name => building.has(name));
    const step = on.length > 0 ? `building ${on.join(', ')}` : 'putting in';
    this.onProgress?.('model', { share: done / batch.length, step });
  }

  /** The overlays being worked out, which a layer switched off stops. */
  readonly #working = new Set<OverlayRequest['kind']>();

  #ask(request: OverlayRequest, transfer: Transferable[] = []): void {
    // said at once, before the worker has even started
    this.onProgress?.(request.kind, { share: undefined, step: 'starting' });
    this.#working.add(request.kind);
    // a worker each, so the one does not wait for the other
    let worker = this.#workers.get(request.kind);
    if (worker === undefined) {
      worker = new Worker(new URL('./overlays.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.#workers.set(request.kind, worker);
      worker.onmessage = ({ data }: MessageEvent<OverlayReply>) => {
        if (data.kind === 'progress') {
          this.onProgress?.(data.layer, { share: data.share, step: data.step });
          return;
        }
        if (data.kind === 'seam' || data.kind === 'places') {
          this.#working.delete(data.kind);
          this.onProgress?.(data.kind, undefined);
        }
        if (data.kind === 'seam') {
          this.#seam.add(...createSeam(data.positions).children);
        } else if (data.kind === 'places') {
          this.#places.add(...createPlaces(data.places).children);
        } else {
          // asked for again the next time either is switched on
          this.#working.clear();
          this.#seamDrawn = this.#seam.children.length > 0;
          this.#placesDrawn = this.#places.children.length > 0;
          this.onProgress?.('seam', undefined);
          this.onProgress?.('places', undefined);
          throw new Error(`overlays: ${data.error}`);
        }
        this.render();
      };
    }
    worker.postMessage(request, transfer);
  }

  /**
   * Stops an overlay being worked out, its layer switched off before it was
   * done: its worker goes, and it is asked for again when switched on.
   */
  #stopOverlay(kind: OverlayRequest['kind']): void {
    if (kind === 'places' && this.#placesWaiting) {
      this.#placesWaiting = false;
      this.#placesDrawn = false;
    }
    if (!this.#working.has(kind)) {
      return;
    }
    this.#working.delete(kind);
    this.#workers.get(kind)?.terminate();
    this.#workers.delete(kind);
    if (kind === 'seam') {
      this.#seamDrawn = false;
    } else {
      this.#placesDrawn = false;
    }
    this.onProgress?.(kind, undefined);
  }

  override dispose(): void {
    this.#workers.forEach(worker => worker.terminate());
    this.#builders.forEach(({ worker }) => worker.terminate());
    clearTimeout(this.#dispatching);
    super.dispose();
  }

  /** Where the seam is drawn, once it is asked for. */
  readonly #seam = new Group();
  #seamDrawn = false;

  /** And the places the events use, drawn the first time they are asked for too. */
  readonly #places = new Group();
  #placesDrawn = false;

  override setLayer(layer: string, visible: boolean): void {
    if (layer === 'seam' && visible && !this.#seamDrawn) {
      this.#seamDrawn = true;
      this.#ask({ kind: 'seam' });
    }
    if (layer === 'places' && visible && !this.#placesDrawn) {
      this.#placesDrawn = true;
      this.#placesWaiting = true;
      this.#layPlaces();
    }
    if ((layer === 'seam' || layer === 'places') && !visible) {
      this.#stopOverlay(layer);
    }
    // what the layer shows, built the first time it is shown - and let go
    // of if it is switched off on the way
    if (this.#shown.has(layer) !== visible) {
      if (visible) {
        this.#shown.add(layer);
      } else {
        this.#shown.delete(layer);
      }
      this.#weigh();
    }
    super.setLayer(layer, visible);
  }

  /** Lays the places on what they lie on, once all of it is in. */
  #layPlaces(): void {
    if (!this.#placesWaiting) {
      return;
    }
    if (!PLACES_ON.every(name => this.#landed.has(name))) {
      // what they lie on asked for, if it is not on its way
      this.#weigh();
      return;
    }
    this.#placesWaiting = false;
    // what the places lie on, as triangles for the worker to lay them on:
    // the ground and what is laid on it - not the houses: the mill's
    // terrace is a place at its own height, and the ground in front of it
    // is the ground, up to its foot
    const parts = ['terrain', 'ways', 'deck', 'crossing-deck', 'stairs']
      .map(name => this.scene.getObjectByName(name))
      .filter((part): part is Object3D => part !== undefined);
    this.scene.updateMatrixWorld(true);
    const triangles = Float32Array.from(parts.flatMap(part => Array.from(worldTriangles(part))));
    this.#ask({ kind: 'places', triangles }, [triangles.buffer]);
  }

  protected override get layers(): Record<string, string[]> {
    return {
      ...super.layers,
      // the point tool's ghost is not among them: whether it shows is the
      // tool's to say, and switching the layer on again would bring it back
      seam: ['seam', 'trace'],
      handles: ['picks'],
      points: ['points'],
      draft: ['draft'],
      places: ['places'],
    };
  }

  #createRing(): LineLoop {
    const ring = new LineLoop(
      new BufferGeometry(),
      new LineBasicMaterial({ color: '#ff00aa', depthTest: false, transparent: true })
    );
    ring.name = 'brush';
    ring.renderOrder = 30;
    ring.visible = false;
    return ring;
  }

  /**
   * Shows the reference points set on the bench, each at its own height and
   * labelled the way the bench lists them. The ones written into the source
   * are handles, and among the rest.
   */
  setPoints(points: [x: number, y: number, level: number][]): void {
    dispose(this.#points);
    this.#points.clear();
    points.forEach(([x, y, level], index) => {
      const sprite = new Sprite(
        new SpriteMaterial({ map: dot('#e0007a', `P${index + 1}`), depthTest: false })
      );
      sprite.position.set(x, level, -y);
      sprite.renderOrder = 23;
      this.#points.add(sprite);
    });
    this.setView({});
  }

  #createGhost(): Group {
    const ghost = new Group();
    ghost.name = 'ghost';
    ghost.visible = false;
    const sprite = new Sprite(new SpriteMaterial({ depthTest: false, transparent: true }));
    // the dot is at the left of its label, and the dot is what stands on the point
    sprite.center.set(GHOST.dot / GHOST.width, 0.5);
    sprite.renderOrder = 24;
    const line = new Line(
      new BufferGeometry(),
      new LineBasicMaterial({ color: '#e0007a', depthTest: false, transparent: true })
    );
    line.renderOrder = 24;
    // and the ring and cross laid over the ground around it, which bend with
    // it - that is what shows the lie of the ground a point is set on
    const draped = new LineBasicMaterial({ color: '#e0007a', depthTest: false, transparent: true });
    const ring = new LineLoop(new BufferGeometry(), draped);
    // and rulers from it over the ground, the compass's and those between,
    // all alike, and - lifted - the same again level at the point's height,
    // in a colour of their own
    const cross = new LineSegments(new BufferGeometry(), draped);
    const between = new LineSegments(new BufferGeometry(), draped);
    const level = new LineBasicMaterial({
      color: RULER.level,
      depthTest: false,
      transparent: true,
    });
    const flat = new LineSegments(new BufferGeometry(), level);
    const flatBetween = new LineSegments(new BufferGeometry(), level);
    [ring, cross, between, flat, flatBetween].forEach(drawn => (drawn.renderOrder = 24));
    ghost.add(sprite, line, ring, cross, between, flat, flatBetween);
    return ghost;
  }

  /**
   * A ruler from a point out to `RULER.reach`, in pieces fine near it and
   * coarser out: laid over the ground, and broken where there is none to lay
   * it on, over a way - or, given a height, level at it until the ground comes
   * up to it and on the ground from there, as a levelled laser's line lies.
   */
  #ruler([x, y]: Point, [dx, dy]: Point, level?: number): number[] {
    const positions: number[] = [];
    let previous: number[] | undefined;
    for (let by = 0; by <= RULER.reach; by += RULER.step) {
      const [px, py] = [x + dx * by, y + dy * by];
      const ground = this.landfill.heightAt(px, py);
      // level, a laser's line: flat until the ground comes up to it, then on it
      const height = level === undefined ? ground : Math.max(level, ground ?? -Infinity);
      const here = height === undefined ? undefined : [px, height + RING.over, -py];
      if (previous !== undefined && here !== undefined) {
        positions.push(...previous, ...here);
      }
      previous = here;
    }
    return positions;
  }

  /** The ground's height at a point of the plan, landfill and all, a hair over it. */
  #draped(x: number, y: number): number {
    return (this.landfill.heightAt(x, y) ?? heightAt(x, y)) + RING.over;
  }

  /**
   * Shows where a reference point would be set, how far over or under the
   * surface it stands over, and a line down to it - or hides it all.
   */
  showGhost(ghost: { at: Point; surface: number; level: number } | undefined): void {
    this.#ghost.visible = ghost !== undefined;
    if (ghost === undefined) {
      return;
    }
    const [sprite, line, ring, cross, between, flat, flatBetween] = this.#ghost.children as [
      Sprite,
      Line,
      LineLoop,
      LineSegments,
      LineSegments,
      LineSegments,
      LineSegments,
    ];
    const { at, surface, level } = ghost;
    const lift = level - surface;
    const lifted = Math.abs(lift) >= 0.005;
    const label = lifted ? `${lift > 0 ? '+' : ''}${lift.toFixed(2)} m` : '';
    // the dot and its height only once it stands off the ground: on it, the
    // cross says where it is, its arms meeting on the spot
    sprite.visible = lifted;
    line.visible = lifted;
    const reach = this.#dotSize() * GHOST.reach;
    const [x, y] = at;
    const around = Array.from({ length: RING.points }, (_, step) => {
      const angle = (step / RING.points) * Math.PI * 2;
      const [px, py] = [x + Math.cos(angle) * reach, y + Math.sin(angle) * reach];
      return [px, this.#draped(px, py), -py];
    }).flat();
    // the rulers from the spot out over the ground, which stay on it with the
    // ring, and - lifted - the same level at the point's height
    const rulers = (angles: number[], height?: number) =>
      angles.flatMap(angle => this.#ruler(at, [Math.sin(angle), Math.cos(angle)], height));
    const compass = [0, 1, 2, 3].map(quarter => (quarter * Math.PI) / 2);
    [
      [ring, around],
      [cross, rulers(compass)],
      [between, rulers(compass.map(angle => angle + Math.PI / 4))],
      [flat, lifted ? rulers(compass, level) : []],
      [
        flatBetween,
        lifted
          ? rulers(
              compass.map(angle => angle + Math.PI / 4),
              level
            )
          : [],
      ],
    ].forEach(([object, positions]) => {
      const drawn = object as LineLoop;
      drawn.geometry.dispose();
      drawn.geometry = new BufferGeometry();
      drawn.geometry.setAttribute('position', new Float32BufferAttribute(positions as number[], 3));
    });
    if (sprite.userData['label'] !== label) {
      sprite.material.map?.dispose();
      sprite.material.map = ghostLabel(label);
      sprite.material.needsUpdate = true;
      sprite.userData['label'] = label;
    }
    sprite.position.set(at[0], level, -at[1]);
    line.geometry.dispose();
    line.geometry = new BufferGeometry();
    line.geometry.setAttribute(
      'position',
      new Float32BufferAttribute([at[0], surface, -at[1], at[0], level, -at[1]], 3)
    );
    this.setView({});
  }

  /** Lays more dabs on, over what is there. */
  addStrokes(strokes: Stroke[]): void {
    strokes.forEach(stroke => this.landfill.dab(stroke));
    this.redrawLandfill();
  }

  /** The point of the ground under a point of the canvas, if the ground is there. */
  groundUnder(x: number, y: number): { at: Point; level: number } | undefined {
    if (this.terrain?.visible !== true) {
      return undefined;
    }
    this.camera.updateMatrixWorld();
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(x, y), this.camera);
    const hit = ray.intersectObject(this.terrain, true)[0];
    if (hit === undefined) {
      return undefined;
    }
    const at: Point = [hit.point.x, -hit.point.z];
    return { at, level: this.landfill.heightAt(...at) ?? hit.point.y };
  }

  /**
   * The point of whatever surface is under a point of the canvas - the ground,
   * a way, a wall, a deck - which is what a reference point can be set on.
   * The trees are looked through, and the debug layers are no surface.
   */
  surfaceUnder(x: number, y: number): { at: Point; level: number; surface: string } | undefined {
    this.camera.updateMatrixWorld();
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(x, y), this.camera);
    const skipped = new Set([
      'trees',
      'seam',
      'picks',
      'trace',
      'points',
      'ghost',
      'brush',
      'lights',
      'draft',
      'places',
    ]);
    const surfaces = this.scene.children.filter(child => child.visible && !skipped.has(child.name));
    const hit = ray
      .intersectObjects(surfaces, true)
      .find(({ object }) => object.type === 'Mesh' && object.visible);
    if (hit === undefined) {
      return undefined;
    }
    // what it is part of, as the scene names its parts
    let part = hit.object;
    while (part.parent !== null && part.parent !== this.scene) {
      part = part.parent;
    }
    return { at: [hit.point.x, -hit.point.z], level: hit.point.y, surface: part.name };
  }

  /** Shows the brush's reach on the ground around a point, or hides it. */
  showBrush(at: Point | undefined, radius: number): void {
    this.#ring.visible = at !== undefined;
    if (at === undefined) {
      return;
    }
    const positions = Array.from({ length: RING.points }, (_, step) => {
      const angle = (step / RING.points) * Math.PI * 2;
      const [x, y] = [at[0] + Math.cos(angle) * radius, at[1] + Math.sin(angle) * radius];
      return [x, (this.landfill.heightAt(x, y) ?? heightAt(x, y)) + RING.over, -y];
    }).flat();
    this.#ring.geometry.dispose();
    this.#ring.geometry = new BufferGeometry();
    this.#ring.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  }

  /** The handles of the seam being traced, in the order they were picked. */
  get chosen(): number[] {
    return [...this.#chosen];
  }

  /** And the seams that are closed and done with. */
  get seams(): number[][] {
    return this.#seams.map(seam => [...seam]);
  }

  /** Every handle spoken for, in full, which is what a seam is written from. */
  get chosenHandles(): PickedHandle[] {
    return [...new Set([...this.#seams.flat(), ...this.#chosen])].flatMap(index => {
      const handle = SEAM_PICKS[index];
      return handle === undefined ? [] : [{ ...handle, at: [...handle.at] as Point, index }];
    });
  }

  /**
   * What lies under a point of the canvas: a handle to pick, or a seam already
   * closed, which is how a finished one is taken up for editing again.
   */
  #under(x: number, y: number): { pick?: number; seam?: number } {
    // hidden handles are not there to be clicked, and the camera has only been
    // pointed, not walked through the scene graph, since the view last changed
    if (!this.#picks.visible) {
      return {};
    }
    this.camera.updateMatrixWorld();
    const ray = new Raycaster();
    // a line is a line: what counts as hitting it has to grow with the view
    ray.params.Line = { threshold: this.view.span * 0.01 };
    ray.setFromCamera(new Vector2(x, y), this.camera);

    const pick = ray.intersectObjects(this.#picks.children, false)[0]?.object.userData['pick'];
    if (typeof pick === 'number') {
      return { pick };
    }
    const seam = ray.intersectObjects(this.#trace.children, false)[0]?.object.userData['seam'];
    return typeof seam === 'number' ? { seam } : {};
  }

  /** Whether a click here would do anything, which is what a cursor is after. */
  hoverAt(x: number, y: number): boolean {
    const { pick, seam } = this.#under(x, y);
    return pick !== undefined || seam !== undefined;
  }

  /** Picks the handle under a point of the canvas, or lets go of it if it was picked. */
  pickAt(x: number, y: number): boolean {
    const { pick: index, seam } = this.#under(x, y);
    // a closed seam is taken up again as the path being traced, so that it can
    // be added to or cut back - but only with nothing else half drawn
    if (seam !== undefined) {
      if (this.#chosen.length > 0) {
        return false;
      }
      this.setPicked(
        this.#seams[seam] ?? [],
        this.#seams.filter((_, order) => order !== seam)
      );
      return true;
    }
    if (index === undefined) {
      return false;
    }
    // back on the handle it started from, a path closes and the seam is done;
    // on one it already holds, that handle is let go of again
    if (index === this.#chosen[0] && this.#chosen.length > 2) {
      this.setPicked([], [...this.#seams, this.#chosen]);
    } else if (this.#chosen.includes(index)) {
      this.setPicked(
        this.#chosen.filter(picked => picked !== index),
        this.#seams
      );
    } else {
      this.setPicked([...this.#chosen, index], this.#seams);
    }
    return true;
  }

  /** Puts the seams and the open path back the way they were, after a reload say. */
  setPicked(trace: number[], seams: number[][]): void {
    const known = (path: number[]) => path.filter(index => SEAM_PICKS[index] !== undefined);
    this.#chosen = known(trace);
    this.#seams = seams.map(known).filter(seam => seam.length > 2);
    this.#markHandles();
    markTrace(this.#trace, this.#chosen, this.#seams);
  }

  /**
   * Moves the point the view is centred on, across the ground and in the frame
   * the camera sees: forward runs away from it, right lies to its right. Debug
   * only - it is how a part of the valley other than the mill is looked at.
   */
  panBy(right: number, forward: number): void {
    // the camera stands off the target along this, so away from it is the other
    // way round, and flattening it keeps the move on the ground
    const heading = direction(this.view.azimuth, 0).setY(0).normalize();
    // the camera's own right hand: the way it looks is the heading turned round,
    // and this is that crossed with up
    const side = new Vector3(heading.z, 0, -heading.x);
    const moved = new Vector3()
      .copy(this.target)
      .addScaledVector(heading, -forward)
      .addScaledVector(side, right);
    this.setView({ center: [moved.x, -moved.z] });
  }

  protected override viewChanged(): void {
    const dots = this.#dotSize();
    [
      ...this.#picks.children,
      ...this.#points.children,
      ...this.#draft.children.filter(child => child.type === 'Sprite'),
    ].forEach(child => child.scale.setScalar(dots));
    // the ghost is read as well as clicked by, so it is drawn a size up
    const ghost = dots * GHOST.scale;
    this.#ghost.children[0]?.scale.set((ghost * GHOST.width) / GHOST.height, ghost, 1);
  }

  /**
   * How big a handle is drawn on the ground: they are there to be clicked,
   * not to cover the model, so they keep the same size on screen whatever
   * width of ground the view takes in.
   */
  #dotSize(): number {
    const wide = (DOT.pixels * this.view.span) / this.size.width;
    return Math.min(Math.max(wide, DOT.min), DOT.max);
  }
}
