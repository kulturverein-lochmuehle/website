import type { BrushTool, Season, Stroke, View } from '@kvlm/visualization';
import { html, isServer, LitElement, unsafeCSS } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

import type {
  DraftCorner,
  EditorLayer,
  EditorProgress,
  EditorScene,
  EditorTask,
  EditorTool,
  PickedHandle,
} from '../../scene/editor.scene.js';
import styles from './viewport.component.css?inline&lit';

/** What lies under the pointer, for a status bar: where on the plan, how high, on what. */
export interface Cursor {
  at: [x: number, y: number];
  level: number;
  /** The part of the model it is on, as the scene names it. */
  surface: string;
  /** The handle under it, if the handles are shown and one is. */
  handle?: { index: number; key: string } | undefined;
}

/** How far each piece of work off the page's thread has got: the model's parts, the overlays. */
export type Working = Partial<Record<EditorTask, EditorProgress>>;

/** How many frames a second a fire flickers at, when nothing else moves. */
const FLICKER_FPS = 15;

/**
 * The editor's view of the Lochmühle: the model, the seam and its handles over
 * it, and the tools that work on it - picking handles, brushing landfill,
 * setting reference points, and moving the view across the valley.
 *
 * Without WebGL the element stays empty and says why in an event.
 *
 * @cssprop --kvlm-color-spray - Walls, water and the fill light.
 * @cssprop --kvlm-color-brick - The tiled roofs.
 * @cssprop --kvlm-color-turquoise - Windows, foliage and the sun.
 * @cssprop --kvlm-color-grey-dark - The ground the mill stands on.
 * @cssprop --kvlm-color-grey-medium - The hills around the valley.
 */
@customElement('kvlm-editor-viewport')
export class EditorViewport extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  #scene: EditorScene | undefined;
  #observer: ResizeObserver | undefined;

  /**
   * Moves the view across the valley with a plain drag, the ground following
   * the pointer. Debug only - the scene is centred on the mill and this is how
   * somewhere else is looked at while the model is being worked on. A drag with
   * cmd or ctrl held turns the camera instead, which is the page's to do.
   */
  #panning: { x: number; y: number } | undefined;

  /** Moves the view by as far as the pointer went, the ground kept under it. */
  #panTo(event: PointerEvent): void {
    const scene = this.#scene;
    const from = this.#panning;
    if (scene === undefined || from === undefined) {
      return;
    }
    const { span, elevation } = scene.view;
    // a pixel across is span over width on the ground, and one up the screen
    // stretches over more of it the flatter the camera looks
    const perPixel = span / (this.clientWidth || 1);
    const [dx, dy] = [event.clientX - from.x, event.clientY - from.y];
    this.#panning = { x: event.clientX, y: event.clientY };
    scene.panBy(-dx * perPixel, (dy * perPixel) / Math.sin((elevation * Math.PI) / 180));
    scene.render();
  }

  /** Ends a drag of the view, and tells whoever placed the element where it came to rest. */
  #endPanning(): void {
    if (this.#panning === undefined) {
      return;
    }
    this.#panning = undefined;
    // where it came to rest is kept the way the rest of the view is, which
    // whoever placed the element has to hear about to be able to keep it
    const [east, north] = this.#scene?.view.center ?? [];
    Object.assign(this, { east, north });
    if (east !== undefined && north !== undefined) {
      this.dispatchEvent(
        new CustomEvent<{ east: number; north: number }>('kvlm-editor-viewed', {
          detail: { east, north },
          bubbles: true,
        })
      );
    }
  }

  @query('canvas')
  private readonly canvas!: HTMLCanvasElement;

  /** Compass direction the camera looks from, degrees clockwise from north. */
  @property({ type: Number, reflect: true })
  azimuth?: number;

  /** Angle of the camera above the horizon in degrees. */
  @property({ type: Number, reflect: true })
  elevation?: number;

  /** Width of the visible ground in meters, the orthographic stand-in for zoom. */
  @property({ type: Number, reflect: true })
  span?: number;

  /** Point of the local grid the view is centred on, eastwards. */
  @property({ type: Number, reflect: true })
  east?: number;

  /** And the same northwards. Both together, or the scene keeps its own. */
  @property({ type: Number, reflect: true })
  north?: number;

  /** The woods around the valley, on unless they are in the way. */
  @property({ type: Boolean, reflect: true })
  trees = true;

  /** The season the woods are drawn in: in leaf of its colour, or bare in winter. */
  @property({ type: String, reflect: true })
  season: Season = 'summer';

  /** The hour of the clock the sky is set to; none sets the sun for the mill. */
  @property({ attribute: false })
  hour: number | undefined;

  /** How much moon there is at night, nought to one. */
  @property({ type: Number })
  moon = 0.25;
  #shownMoon: number | undefined;

  /** What is put up, by its tags - the strings of lights, a campfire. */
  @property({ attribute: false })
  decorations: string[] = [];
  #shownDecorations: string | undefined;

  /** Whether the street lamps are lit; none leaves it to the hour. */
  @property({ attribute: false })
  lanterns: boolean | undefined;
  #shownLanterns: boolean | undefined | null = null;

  /** Whether the strings of lights are lit; none leaves it to the hour. */
  @property({ attribute: false })
  strings: boolean | undefined;
  #shownStrings: boolean | undefined | null = null;

  /** Whether the fires laid burn. */
  @property({ type: Boolean })
  fires = true;
  #shownFires: boolean | undefined;

  /** Sends a car along the road, down it or up. */
  sendCar(): void {
    this.#scene?.sendCar();
    this.#animate();
  }

  /** Whether the windows are lit; none leaves it to the hour. */
  @property({ attribute: false })
  lights: boolean | undefined;
  #shownLights: boolean | undefined | null = null;

  /** What the scene was last told, so a camera move does not recolour the woods. */
  #shownSeason: Season | undefined;
  #shownHour: number | undefined | null = null;

  /** The season's sky, its sun and its haze; off, the page shows through. */
  @property({ type: Boolean, reflect: true })
  sky = true;

  /** What drifts in the air in autumn and winter. */
  @property({ type: Boolean, reflect: true })
  particles = true;

  /** The roads and the brook, everything laid on the ground rather than built. */
  @property({ type: Boolean, reflect: true })
  roads = true;

  /** The walls at the crossings, where the brook runs under the road. */
  @property({ type: Boolean, reflect: true })
  walls = true;

  /** The plates the road is carried over the brook on. */
  @property({ type: Boolean, reflect: true })
  decks = true;

  /** The three buildings of the Lochmühle. */
  @property({ type: Boolean, reflect: true })
  houses = true;

  /** The ground everything else is fitted to, which can be taken away to look under it. */
  @property({ type: Boolean, reflect: true })
  terrain = true;

  /** The places the events use, laid over the ground - bench only, like the seam. */
  @property({ type: Boolean, reflect: true })
  places = false;

  /**
   * Which of those handles are picked: the closed seams, separated by
   * semicolons, then a bar and the path still being traced. It is an attribute
   * so that whoever placed the element can put the work back the way it was -
   * the element itself only ever writes what was clicked.
   */
  @property({ type: String, reflect: true })
  picks?: string;

  /**
   * The tool in hand, which says what a press does and what is drawn over the
   * model to work with: the seam and its handles for the seam, and so on.
   * Navigating, a drag moves the view - and holding space, whatever is in hand.
   */
  @property({ type: String, reflect: true })
  tool: EditorTool = 'navigate';

  /**
   * What the brush does with the ground. Held while it is dragged, ctrl or cmd
   * turns raising into lowering and back, and shift smooths.
   */
  @property({ type: String, reflect: true })
  mode: BrushTool = 'raise';

  /** The corners of the place being drawn, handles by name or points of the plan. */
  @property({ attribute: false })
  corners: DraftCorner[] = [];

  /** And what it is: an area round its corners, or a spot at its one. */
  @property({ type: String, attribute: 'place-kind' })
  placeKind: 'area' | 'spot' = 'area';
  #shownDraft: { corners: DraftCorner[]; kind: string } | undefined;
  #shownTool: EditorTool | undefined;

  /** Whether space is held, which puts the tool down for as long. */
  #space = false;

  /** The reference points set on the bench so far, shown where they are. */
  @property({ attribute: false })
  points: [x: number, y: number, level: number][] = [];

  /** How far the brush reaches, in meters. */
  @property({ type: Number, reflect: true, attribute: 'brush-radius' })
  brushRadius = 2;

  /** And how strongly it works, from nothing to one. */
  @property({ type: Number, reflect: true, attribute: 'brush-strength' })
  brushStrength = 0.3;

  /**
   * What has been brushed on so far, over what is written into the source, a
   * dab at a time. Written by the element while it is brushed on, and put back
   * by whoever placed it after a reload.
   */
  @property({ attribute: false })
  strokes: Stroke[] = [];

  /** The reference points the scene shows. */
  #shownPoints: [number, number, number][] | undefined;

  /** The strokes the scene has laid on, and how many of them. */
  #laid: { strokes: Stroke[]; count: number } | undefined;

  /** The brush being dragged: the height it flattens to, where it last dabbed, and how many it has. */
  #painting:
    | { level: number; last: [number, number]; dabs: number; pending: Stroke[]; mode: BrushTool }
    | undefined;

  /** Only the properties that are actually set, the scene keeps its defaults. */
  get #view(): Partial<View> {
    const view = { azimuth: this.azimuth, elevation: this.elevation, span: this.span };
    const set = Object.fromEntries(Object.entries(view).filter(([, value]) => value !== undefined));
    return this.east === undefined || this.north === undefined
      ? set
      : { ...set, center: [this.east, this.north] };
  }

  override async firstUpdated() {
    // three.js is worth a request of its own, the rest of the page must not
    // wait for it - and on the server there is no canvas to draw into at all
    if (isServer) {
      return;
    }

    try {
      // the page stays blank meanwhile, the readout saying what it is on
      this.#work({ model: { share: 0, step: 'loading' } });
      const { EditorScene } = await import('../../scene/editor.scene.js');
      // the scene stands at once, round nothing: the model comes in a part at
      // a time, built off the page's thread as its layers are switched on,
      // and says how far it has got with whatever else is being worked out
      this.#scene = new EditorScene(this.canvas, this);
      this.#scene.onmove = () => this.#animate();
      this.#scene.onProgress = (task, progress) => {
        const { [task]: _, ...others } = this.#working;
        this.#work(progress === undefined ? others : { ...others, [task]: progress });
      };
    } catch (error) {
      this.#work({});
      // no WebGL, no scene - whoever placed the element gets to react to it
      this.dispatchEvent(new CustomEvent('kvlm-editor-failed', { detail: error, bubbles: true }));
      return;
    }

    this.#scene.setView(this.#view);
    this.#layStrokes();
    this.#scene.setPoints(this.points);
    this.#shownPoints = this.points;
    const { trace, seams } = this.#picked;
    this.#scene.setPicked(trace, seams);
    this.#showTool();
    // a path put back by attribute is news to whoever set it, too: only the
    // element knows what the handles it names actually are
    this.#report();
    this.#layers.forEach(([layer, visible]) => this.#scene?.setLayer(layer, visible));
    this.#showSeason();
    this.#observer = new ResizeObserver(([entry]) => {
      const [box] = entry?.contentBoxSize ?? [];
      this.#scene?.resize(box?.inlineSize ?? this.clientWidth, box?.blockSize ?? this.clientHeight);
      this.#scene?.render();
    });
    this.#observer.observe(this);
    this.addEventListener('pointerdown', this.#onPointerDown);
    this.addEventListener('pointerup', this.#onPointerUp);
    this.addEventListener('pointermove', this.#onPointerMove);
    this.addEventListener('pointercancel', this.#onPointerCancel);
    this.addEventListener('lostpointercapture', this.#onLostCapture);
    this.addEventListener('pointerleave', this.#onPointerLeave);
    window.addEventListener('keydown', this.#onKey);
    window.addEventListener('keyup', this.#onKey);
    window.addEventListener('blur', this.#onBlur);
  }

  /** What is being worked out, as last said - told whoever placed the element as it changes. */
  #working: Working = {};

  #work(working: Working): void {
    this.#working = working;
    this.dispatchEvent(
      new CustomEvent<Working>('kvlm-editor-working', { detail: working, bubbles: true })
    );
  }

  /** Hands the scene the tool in hand and the place being drawn, if they changed. */
  #showTool(): void {
    const scene = this.#scene;
    if (scene === undefined) {
      return;
    }
    if (this.#shownTool !== this.tool) {
      scene.setTool(this.tool);
      this.#shownTool = this.tool;
    }
    const shown = this.#shownDraft;
    if (shown?.corners !== this.corners || shown.kind !== this.placeKind) {
      scene.setDraft(this.corners, this.placeKind);
      this.#shownDraft = { corners: this.corners, kind: this.placeKind };
    }
    if (this.tool !== 'brush') {
      scene.showBrush(undefined, 0);
    }
    if (this.tool !== 'point') {
      scene.showGhost(undefined);
    }
  }

  /** The parts of the scene the host can switch off, and their current state. */
  get #layers(): [EditorLayer, boolean][] {
    return [
      ['trees', this.trees],
      ['sky', this.sky],
      ['particles', this.particles],
      ['roads', this.roads],
      ['walls', this.walls],
      ['decks', this.decks],
      ['houses', this.houses],
      ['places', this.places],
      ['terrain', this.terrain],
    ];
  }

  /** The picked handles as numbers, which is how the scene keeps them. */
  get #picked(): { trace: number[]; seams: number[][] } {
    const [done = '', open = ''] = (this.picks ?? '').split('|');
    const list = (part: string) =>
      part
        .split(',')
        .filter(handle => handle.trim() !== '')
        .map(Number)
        .filter(Number.isInteger);
    return {
      seams: done
        .split(';')
        .map(list)
        .filter(seam => seam.length > 2),
      trace: list(open),
    };
  }

  /** The same the other way round, which is what the attribute is written from. */
  static picksOf(trace: number[], seams: number[][]): string {
    return `${seams.map(seam => seam.join(',')).join(';')}|${trace.join(',')}`;
  }

  /**
   * A press that went nowhere is a click on a handle, one that travelled was a
   * drag of the camera - the two share the same button, so they are told apart
   * by how far the pointer moved between down and up.
   */
  readonly #pressed = new Map<number, { x: number; y: number }>();

  /**
   * The fingers on the screen, and whether two were down at once since the
   * last were lifted: two zoom and turn the view, the page's to do - what the
   * first began is let go, and nothing is a click until all are lifted.
   */
  readonly #touches = new Set<number>();
  #gestured = false;

  /** Lets go of whatever a press began, for two fingers to take over. */
  #letGo(): void {
    this.#pointing = undefined;
    this.#scene?.showGhost(undefined);
    [...this.#pressed.keys()].forEach(pointer => this.#endPainting(pointer));
    this.#endPanning();
    this.#pressed.clear();
  }

  /** Whether a pointer is a finger lifted off a gesture of two, and so neither a click nor a drag. */
  #offGesture(event: PointerEvent): boolean {
    this.#touches.delete(event.pointerId);
    const gestured = this.#gestured;
    if (this.#touches.size === 0) {
      this.#gestured = false;
    }
    return gestured;
  }

  readonly #onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      this.#touches.add(event.pointerId);
      if (this.#touches.size > 1) {
        this.#gestured = true;
        this.#letGo();
        return;
      }
    }
    if (this.#gestured) {
      return;
    }
    this.#pressed.set(event.pointerId, { x: event.clientX, y: event.clientY });
    // the right button turns the camera, tool in hand or not
    if (EditorViewport.viewing(event)) {
      return;
    }
    const tool = this.#toolFor(event);
    // or shift would start selecting the page's text
    event.preventDefault();
    // a reference point is set where it is pressed, and lifted by dragging
    if (tool === 'point') {
      const hit = this.#surfaceUnder(event);
      if (hit !== undefined) {
        this.#pointing = { at: hit.at, surface: hit.level, y: event.clientY, lift: 0 };
        this.setPointerCapture(event.pointerId);
      }
      return;
    }
    // anything but the brush drags the view: the seam's handles and a place's
    // corners are clicked, which a drag that went nowhere is
    if (tool !== 'brush') {
      this.#panning = { x: event.clientX, y: event.clientY };
      this.setPointerCapture(event.pointerId);
      return;
    }
    const hit = this.#groundUnder(event);
    if (hit === undefined) {
      return;
    }
    this.setPointerCapture(event.pointerId);
    this.#painting = {
      level: hit.level,
      last: hit.at,
      dabs: 0,
      pending: [],
      mode: this.#modeFor(event),
    };
    this.#dab(hit.at);
    this.#flush();
  };

  /** Whatever surface is under the pointer, in the plan, with its height. */
  #surfaceUnder(event: PointerEvent) {
    const box = this.getBoundingClientRect();
    return this.#scene?.surfaceUnder(
      ((event.clientX - box.left) / box.width) * 2 - 1,
      -(((event.clientY - box.top) / box.height) * 2 - 1)
    );
  }

  /**
   * The reference point being set: where it stands, the surface under it, where
   * the press was, and how far it has been lifted off that surface since.
   */
  #pointing: { at: [number, number]; surface: number; y: number; lift: number } | undefined;

  /**
   * Lifts the point being set by as far as the pointer went up the canvas: a
   * pixel is span over width on the screen, and upright on the ground it
   * stands the taller the flatter the camera looks - capped, or looking
   * straight down a pixel would lift it by meters.
   */
  #liftTo(event: PointerEvent): void {
    const pointing = this.#pointing;
    const scene = this.#scene;
    if (pointing === undefined || scene === undefined) {
      return;
    }
    const { span, elevation } = scene.view;
    const perPixel = span / (this.clientWidth || 1);
    const upright = Math.max(Math.cos((elevation * Math.PI) / 180), 0.25);
    pointing.lift = Math.round((((pointing.y - event.clientY) * perPixel) / upright) * 100) / 100;
    scene.showGhost({ ...pointing, level: pointing.surface + pointing.lift });
    scene.render();
  }

  /** Sets the point being set, where it stands and as lifted. */
  #setPoint(): void {
    const pointing = this.#pointing;
    this.#pointing = undefined;
    if (pointing === undefined) {
      return;
    }
    const round = (value: number, by: number) => Math.round(value * by) / by;
    const point: [number, number, number] = [
      round(pointing.at[0], 100),
      round(pointing.at[1], 100),
      round(pointing.surface + pointing.lift, 1000),
    ];
    this.points = [...this.points, point];
    this.dispatchEvent(
      new CustomEvent<{ points: [number, number, number][] }>('kvlm-editor-pointed', {
        detail: { points: this.points },
        bubbles: true,
      })
    );
  }

  /** Whether a press turns the camera: with the right button, the way a map is turned. */
  static viewing(event: PointerEvent): boolean {
    return event.button === 2 || (event.buttons & 2) !== 0;
  }

  /** The tool a press or a move is for: the one in hand, unless space is held - then the view's. */
  #toolFor(_event?: PointerEvent): EditorTool {
    return this.#space ? 'navigate' : this.tool;
  }

  /** What the brush does for a press or a move: its mode, turned round or smoothing while a key is held. */
  #modeFor(event: PointerEvent): BrushTool {
    if (event.shiftKey) {
      return 'smooth';
    }
    if (event.ctrlKey || event.metaKey) {
      return this.mode === 'raise' ? 'lower' : this.mode === 'lower' ? 'raise' : this.mode;
    }
    return this.mode;
  }

  /** Whether a key is typed into a field, which is not the view's to hear. */
  static typing(event: KeyboardEvent): boolean {
    const [target] = event.composedPath();
    return (
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    );
  }

  /** Space held puts the tool down: its ring or ghost goes with it, and a drag moves the view. */
  readonly #onKey = (event: KeyboardEvent) => {
    if (event.key !== ' ' || EditorViewport.typing(event)) {
      return;
    }
    // or the page would scroll, or a focused button be pressed
    event.preventDefault();
    const held = event.type === 'keydown';
    if (held === this.#space) {
      return;
    }
    this.#space = held;
    this.#putDown();
  };

  /** A window left with space held never hears it let go. */
  readonly #onBlur = () => {
    this.#space = false;
  };

  /** With the tool put down, neither its ring nor its ghost stands anywhere. */
  #putDown(): void {
    if (this.#scene === undefined || !this.#space) {
      this.style.cursor = '';
      return;
    }
    this.#scene.showBrush(undefined, 0);
    this.#scene.showGhost(undefined);
    this.style.cursor = 'grab';
    this.#scene.render();
  }

  /**
   * Ends a drag of the brush, however it ended: let go of, cancelled by the
   * system, or found to have no button held any more - a release outside the
   * window is not always heard, and a brush that goes on laying on without a
   * button held is worse than one that stops.
   */
  #endPainting(pointer: number): void {
    const painting = this.#painting;
    if (painting === undefined) {
      return;
    }
    this.#painting = undefined;
    if (this.hasPointerCapture(pointer)) {
      this.releasePointerCapture(pointer);
    }
    // whoever placed the element keeps the strokes, and how many the drag laid
    this.dispatchEvent(
      new CustomEvent<{ strokes: Stroke[]; dabs: number }>('kvlm-editor-brushed', {
        detail: { strokes: this.strokes, dabs: painting.dabs },
        bubbles: true,
      })
    );
  }

  /** Off the canvas, neither the brush's ring nor a point's ghost stands anywhere. */
  readonly #onPointerLeave = () => {
    if (this.#pointing !== undefined || this.#painting !== undefined) {
      return;
    }
    this.#tellCursor(undefined);
    this.#scene?.showGhost(undefined);
    this.#scene?.showBrush(undefined, 0);
    this.#scene?.render();
  };

  readonly #onPointerCancel = (event: PointerEvent) => {
    this.#offGesture(event);
    this.#pressed.delete(event.pointerId);
    // a point is only set by letting go of it
    this.#pointing = undefined;
    this.#scene?.showGhost(undefined);
    this.#endPainting(event.pointerId);
    this.#endPanning();
  };

  // the capture is the page's too, for turning the view: losing it only ends
  // a drag of the brush, the press itself is still the pointer up's to judge
  readonly #onLostCapture = (event: PointerEvent) => {
    this.#endPainting(event.pointerId);
    this.#endPanning();
  };

  /** The ground under the pointer, in the plan, with its height. */
  #groundUnder(event: PointerEvent) {
    const box = this.getBoundingClientRect();
    return this.#scene?.groundUnder(
      ((event.clientX - box.left) / box.width) * 2 - 1,
      -(((event.clientY - box.top) / box.height) * 2 - 1)
    );
  }

  /** One dab of the brush, to the centimeter, so what is copied out lays on the same. */
  #dab([x, y]: [number, number]): void {
    const scene = this.#scene;
    const painting = this.#painting;
    if (scene === undefined || painting === undefined) {
      return;
    }
    const tool = painting.mode;
    const round = (value: number) => Math.round(value * 100) / 100;
    const [at, radius, strength] = [
      [round(x), round(y)],
      round(this.brushRadius),
      round(this.brushStrength),
    ];
    const stroke: Stroke =
      tool === 'flatten'
        ? [tool, at[0] as number, at[1] as number, radius, strength, round(painting.level)]
        : [tool, at[0] as number, at[1] as number, radius, strength];
    this.strokes.push(stroke);
    this.#laid = { strokes: this.strokes, count: this.strokes.length };
    painting.pending.push(stroke);
    painting.last = [x, y];
    painting.dabs += 1;
  }

  /** Lays the dabs on that have gathered, all at once: drawing them is what takes the time. */
  #flush(): void {
    const painting = this.#painting;
    if (painting === undefined || painting.pending.length === 0) {
      return;
    }
    this.#scene?.addStrokes(painting.pending);
    painting.pending = [];
    this.#scene?.render();
  }

  /** Dabs along the way the pointer went, a quarter of the brush apart. */
  #paintTo(to: [number, number]): void {
    const painting = this.#painting;
    if (painting === undefined) {
      return;
    }
    const spacing = Math.max(this.brushRadius / 4, 0.1);
    const [from] = [painting.last];
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    Array.from({ length: Math.floor(length / spacing) }, (_, step) => {
      const share = ((step + 1) * spacing) / length;
      return [from[0] + (to[0] - from[0]) * share, from[1] + (to[1] - from[1]) * share] as [
        number,
        number,
      ];
    }).forEach(at => this.#dab(at));
    this.#flush();
  }

  /**
   * The pointer only changes over something worth clicking. The element carries
   * no cursor of its own for turning the camera: that works everywhere, and a
   * hand over the whole scene says nothing about where the handles are.
   */
  readonly #onPointerMove = (event: PointerEvent) => {
    if (this.#gestured) {
      return;
    }
    if (this.#pointing !== undefined && event.buttons === 0) {
      this.#pointing = undefined;
    }
    if (this.#pointing !== undefined) {
      this.#liftTo(event);
      return;
    }
    const tool = this.#toolFor(event);
    if (this.#painting !== undefined) {
      // the keys held say what the drag does, as they change
      this.#painting.mode = this.#modeFor(event);
    }
    this.#tellCursor(event);
    if ((this.#painting !== undefined || this.#panning !== undefined) && event.buttons === 0) {
      this.#pressed.delete(event.pointerId);
      this.#endPainting(event.pointerId);
      this.#endPanning();
    }
    if (this.#panning !== undefined) {
      this.#panTo(event);
      return;
    }
    // the ghost of the point a click would set, on whatever is under the pointer
    if (tool === 'point' && this.#scene !== undefined) {
      const hit = EditorViewport.viewing(event) ? undefined : this.#surfaceUnder(event);
      this.#scene.showGhost(hit === undefined ? undefined : { ...hit, surface: hit.level });
      this.#scene.render();
      this.style.cursor = hit === undefined ? '' : 'crosshair';
      return;
    }
    // a drag of the brush goes on as it began, space or not
    if (
      (this.#painting !== undefined || tool === 'brush') &&
      this.#scene !== undefined &&
      !EditorViewport.viewing(event)
    ) {
      const hit = this.#groundUnder(event);
      if (hit !== undefined && this.#painting !== undefined) {
        this.#paintTo(hit.at);
      }
      this.#scene.showBrush(hit?.at, this.brushRadius);
      this.#scene.render();
      this.style.cursor = hit === undefined ? '' : 'crosshair';
      return;
    }
    if (this.#pressed.size > 0 || this.#scene === undefined) {
      return;
    }
    const [x, y] = this.#canvasAt(event);
    // a handle to pick, a seam to take up, or a corner to set
    const over =
      tool === 'seam'
        ? this.#scene.hoverAt(x, y)
        : tool === 'place'
          ? this.#scene.handleAt(x, y) !== undefined || this.#scene.cornerAt(x, y) !== undefined
          : false;
    this.style.cursor = over
      ? 'pointer'
      : tool === 'place'
        ? 'crosshair'
        : this.#space
          ? 'grab'
          : '';
  };

  /** Where on the canvas a pointer is, from -1 to 1 either way, up being up. */
  #canvasAt(event: PointerEvent): [number, number] {
    const box = this.getBoundingClientRect();
    return [
      ((event.clientX - box.left) / box.width) * 2 - 1,
      -(((event.clientY - box.top) / box.height) * 2 - 1),
    ];
  }

  /** The frame a look under the pointer is waiting for, and the last pointer it is for. */
  #cursorFrame: number | undefined;
  #cursorEvent: PointerEvent | undefined;

  /**
   * Tells whoever placed the element what is under the pointer - once a frame
   * at most: a look under it is a ray through the whole scene.
   */
  #tellCursor(event: PointerEvent | undefined): void {
    this.#cursorEvent = event;
    this.#cursorFrame ??= requestAnimationFrame(() => {
      this.#cursorFrame = undefined;
      const scene = this.#scene;
      const last = this.#cursorEvent;
      const hit = last === undefined ? undefined : this.#surfaceUnder(last);
      const handle =
        last === undefined || scene === undefined
          ? undefined
          : scene.handleAt(...this.#canvasAt(last));
      const cursor: Cursor | undefined =
        hit === undefined
          ? undefined
          : {
              at: hit.at,
              level: scene?.groundAt(...hit.at) ?? hit.level,
              surface: hit.surface,
              handle,
            };
      this.dispatchEvent(
        new CustomEvent<Cursor | undefined>('kvlm-editor-cursor', { detail: cursor, bubbles: true })
      );
    });
  }

  readonly #onPointerUp = (event: PointerEvent) => {
    if (this.#offGesture(event)) {
      this.#pressed.delete(event.pointerId);
      return;
    }
    const from = this.#pressed.get(event.pointerId);
    this.#pressed.delete(event.pointerId);
    if (this.#painting !== undefined) {
      this.#endPainting(event.pointerId);
      return;
    }
    if (this.#panning !== undefined) {
      this.#endPanning();
      if (this.hasPointerCapture(event.pointerId)) {
        this.releasePointerCapture(event.pointerId);
      }
    }
    // the right button turns the camera, it never picks
    if (event.button === 2) {
      return;
    }
    if (this.#pointing !== undefined) {
      if (this.hasPointerCapture(event.pointerId)) {
        this.releasePointerCapture(event.pointerId);
      }
      this.#setPoint();
      return;
    }
    // a click is the seam's or the place's; anything else's press was a drag
    const tool = this.#toolFor(event);
    const scene = this.#scene;
    if (from === undefined || scene === undefined || (tool !== 'seam' && tool !== 'place')) {
      return;
    }
    if (Math.hypot(event.clientX - from.x, event.clientY - from.y) > 4) {
      return;
    }
    if (tool === 'place') {
      this.#placeClick(event);
      return;
    }
    const hit = scene.pickAt(...this.#canvasAt(event));
    if (!hit) {
      return;
    }
    scene.render();
    this.picks = EditorViewport.picksOf(scene.chosen, scene.seams);
    this.#report();
  };

  /**
   * A click with the place tool: on a handle, it is a corner - or no longer
   * one, if it was; on a corner of its own, that goes; anywhere else on what
   * is there, a corner of its own is set. With alt held, a place drawn is
   * taken up instead, to be drawn again.
   */
  #placeClick(event: PointerEvent): void {
    const scene = this.#scene;
    if (scene === undefined) {
      return;
    }
    const at = this.#canvasAt(event);
    if (event.altKey) {
      const key = scene.placeAt(...at);
      if (key !== undefined) {
        this.dispatchEvent(
          new CustomEvent<{ key: string }>('kvlm-editor-place-picked', {
            detail: { key },
            bubbles: true,
          })
        );
      }
      return;
    }
    const key = scene.handleAt(...at)?.key;
    const corner = scene.cornerAt(...at);
    const round = (value: number) => Math.round(value * 100) / 100;
    const surface =
      key === undefined && corner === undefined ? this.#surfaceUnder(event) : undefined;
    const corners =
      key !== undefined
        ? this.corners.includes(key)
          ? this.corners.filter(one => one !== key)
          : [...this.corners, key]
        : corner !== undefined
          ? this.corners.filter((_, index) => index !== corner)
          : surface !== undefined
            ? [...this.corners, [round(surface.at[0]), round(surface.at[1])] as [number, number]]
            : this.corners;
    if (corners === this.corners) {
      return;
    }
    this.corners = corners;
    this.dispatchEvent(
      new CustomEvent<{ corners: DraftCorner[] }>('kvlm-editor-placed', {
        detail: { corners },
        bubbles: true,
      })
    );
  }

  /** Lays the strokes on anew, if they are not the ones the scene has. */
  #layStrokes(): void {
    const laid = this.#laid;
    if (laid?.strokes === this.strokes && laid.count === this.strokes.length) {
      return;
    }
    this.#scene?.setStrokes(this.strokes);
    this.#laid = { strokes: this.strokes, count: this.strokes.length };
  }

  /** Tells whoever placed the element which handles are picked, and where they lie. */
  #report(): void {
    const scene = this.#scene;
    if (scene === undefined) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<{ trace: number[]; seams: number[][]; handles: PickedHandle[] }>(
        'kvlm-editor-picked',
        {
          detail: { trace: scene.chosen, seams: scene.seams, handles: scene.chosenHandles },
          bubbles: true,
        }
      )
    );
  }

  override updated() {
    if (this.#scene === undefined) {
      return;
    }
    this.#scene.setView(this.#view);
    this.#layStrokes();
    if (this.#shownPoints !== this.points) {
      this.#scene.setPoints(this.points);
      this.#shownPoints = this.points;
    }
    this.#showTool();
    const { trace, seams } = this.#picked;
    if (
      EditorViewport.picksOf(trace, seams) !==
      EditorViewport.picksOf(this.#scene.chosen, this.#scene.seams)
    ) {
      this.#scene.setPicked(trace, seams);
      // put back from outside - an undo - so the handles they are are news too
      this.#report();
    }
    this.#layers.forEach(([layer, visible]) => this.#scene?.setLayer(layer, visible));
    this.#showSeason();
    this.#scene.render();
  }

  #showSeason(): void {
    if (this.#scene !== undefined && this.#shownMoon !== this.moon) {
      this.#scene.setMoon(this.moon);
      this.#shownMoon = this.moon;
    }
    if (this.#scene !== undefined && this.#shownHour !== this.hour) {
      this.#scene.setTime(this.hour);
      this.#shownHour = this.hour;
    }
    if (this.#scene !== undefined && this.#shownSeason !== this.season) {
      this.#scene.setSeason(this.season);
      this.#shownSeason = this.season;
    }
    if (this.#scene !== undefined && this.#shownLanterns !== this.lanterns) {
      this.#scene.setLanterns(this.lanterns);
      this.#shownLanterns = this.lanterns;
    }
    if (this.#scene !== undefined && this.#shownDecorations !== this.decorations.join(',')) {
      this.#scene.setDecorations(this.decorations);
      this.#shownDecorations = this.decorations.join(',');
    }
    if (this.#scene !== undefined && this.#shownStrings !== this.strings) {
      this.#scene.setStrings(this.strings);
      this.#shownStrings = this.strings;
    }
    if (this.#scene !== undefined && this.#shownFires !== this.fires) {
      this.#scene.setFires(this.fires);
      this.#shownFires = this.fires;
    }
    if (this.#scene !== undefined && this.#shownLights !== this.lights) {
      this.#scene.setLights(this.lights);
      this.#shownLights = this.lights;
    }
    this.#animate();
  }

  /** The frame being waited for while the season's drift moves, and when the last one came. */
  #frame: { id: number; last: number } | undefined;

  /**
   * Draws frame by frame while something drifts - autumn's leaves, winter's
   * snow - and not at all otherwise, and never while the page is hidden.
   */
  #animate(): void {
    if (this.#scene?.moving !== true || !this.isConnected) {
      this.#stopAnimating();
      return;
    }
    if (this.#frame !== undefined) {
      return;
    }
    const tick = (now: number) => {
      const scene = this.#scene;
      if (scene?.moving !== true || !this.isConnected) {
        this.#stopAnimating();
        return;
      }
      // a fire alone flickers well enough at a few frames a second, and the
      // whole valley drawn sixty times one was what made the fans turn; the
      // drift wants every frame
      const since = now - (this.#frame?.last ?? now);
      if (!scene.drifting && since < 1000 / FLICKER_FPS) {
        this.#frame = { id: requestAnimationFrame(tick), last: this.#frame?.last ?? now };
        return;
      }
      // a frame after a long wait - a hidden tab - moves on a frame's worth
      const seconds = Math.min(since / 1000, 0.1);
      scene.tick(seconds);
      // what moves casts no shadow: the sun's map is kept as it was drawn
      scene.render(true);
      this.#frame = { id: requestAnimationFrame(tick), last: now };
    };
    this.#frame = { id: requestAnimationFrame(tick), last: performance.now() };
  }

  #stopAnimating(): void {
    if (this.#frame !== undefined) {
      cancelAnimationFrame(this.#frame.id);
    }
    this.#frame = undefined;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#stopAnimating();
    this.removeEventListener('pointerdown', this.#onPointerDown);
    this.removeEventListener('pointerup', this.#onPointerUp);
    this.removeEventListener('pointermove', this.#onPointerMove);
    this.removeEventListener('pointercancel', this.#onPointerCancel);
    this.removeEventListener('lostpointercapture', this.#onLostCapture);
    this.removeEventListener('pointerleave', this.#onPointerLeave);
    window.removeEventListener('keydown', this.#onKey);
    window.removeEventListener('keyup', this.#onKey);
    window.removeEventListener('blur', this.#onBlur);
    if (this.#cursorFrame !== undefined) {
      cancelAnimationFrame(this.#cursorFrame);
    }
    this.#pressed.clear();
    this.#observer?.disconnect();
    this.#scene?.dispose();
    this.#observer = undefined;
    this.#scene = undefined;
  }

  override render() {
    return html`<canvas role="img" aria-label="Die Lochmühle im Lotzebachtal"></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-editor-viewport': EditorViewport;
  }
}
