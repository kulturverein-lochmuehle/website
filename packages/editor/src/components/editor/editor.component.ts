import '@kvlm/ui/components/ui/scene/scene.component.js';
import '../viewport/viewport.component.js';

import type { BrushTool, EventTypeKey, Point, Season, Stroke, ViewSpec } from '@kvlm/visualization';
import {
  DECORATIONS,
  EVENT_TYPES,
  eventViewName,
  lightsDue,
  MOON,
  pickByKey,
  PLACES,
  VIEWS,
} from '@kvlm/visualization';
import { html, LitElement, nothing, unsafeCSS } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';

import type { DraftCorner, EditorLayer, EditorTool } from '../../scene/editor.scene.js';
import type { Cursor, EditorViewport, Working } from '../viewport/viewport.component.js';
import styles from './editor.component.css?inline&lit';
import type { Draft, PanelKey, Picked, Placed, Property, Step, Switch } from './editor.model.js';
import {
  BRUSH,
  CONTROLS,
  cornerPoint,
  DOCK,
  DRAG,
  EMPTY_DRAFT,
  FEATURES,
  HISTORY,
  LINE_HEIGHT,
  load,
  MODES,
  PANELS,
  save,
  SEASONS,
  STORED,
  switched,
  SWITCHES,
  TOOLS,
} from './editor.model.js';
import type { Bench, Preview, Settings } from './panels/bench.js';
import { dock } from './panels/dock.js';
import { footer, shortcuts } from './panels/footer.js';
import panelStyles from './panels/panels.css?inline&lit';
import { flyout, toolStrip } from './panels/tools.js';

/** How long a tool's key is kept down before letting it go hands the tool before back, in milliseconds. */
const SPRING = 300;

/** A switch as it was kept, or left to the hour. */
const switchFrom = (kept: unknown): Switch => SWITCHES.find(one => one === kept) ?? 'auto';

/**
 * The editor of the Lochmühle's 3D model, laid out as an editor is: the tools
 * down the left with the options of the one in hand beside them, the viewport,
 * the panels down the right - the view, the features, the season and the
 * lights - and a bar along the foot with what is under the pointer. Each
 * tool's work is kept across a reload, can be taken back step by step, and is
 * copied out in the form it is written into the source with.
 */
@customElement('kvlm-editor')
export class Editor extends LitElement implements Bench {
  static override readonly styles = [unsafeCSS(styles), unsafeCSS(panelStyles)];

  @query('kvlm-editor-viewport')
  private readonly viewport!: EditorViewport;

  /**
   * The exact camera values. A range input snaps whatever is written to it to
   * its step, so reading the sliders back would swallow every move smaller
   * than a whole degree or meter - and zoomed in, a wheel notch is exactly
   * that small.
   */
  @state() camera: Record<Property, number>;
  @state() layers: Record<EditorLayer, boolean>;
  @state() season: Season;
  @state() hour: number | undefined;
  @state() moon: number;
  @state() windows: Switch;
  @state() lanterns: Switch;
  @state() strings: Switch;
  @state() fires: boolean;
  /** What is put up, by its tags: the decorations the views are baked with, the rooms' lights among them. */
  @state() decorations: string[] = [];
  @state() picked: Picked = { trace: [], seams: [], handles: [] };
  @state() tool: EditorTool;
  @state() mode: BrushTool;
  @state() radius: number;
  @state() strength: number;
  @state() strokes: Stroke[];
  /** How many dabs each drag laid, so that undo takes the whole drag back. */
  @state() drags: number[];
  @state() points: Placed[];
  @state() draft: Draft;
  @state() open: Record<PanelKey, boolean>;
  @state() cursor: Cursor | undefined;
  @state() working: Working = {};
  @state() preview: Preview | undefined;
  @state() private failed: string | undefined;
  @state() private width: number;
  @state() private keys = false;
  @state() held: { tool?: EditorTool | undefined; mode?: BrushTool | undefined } = {};
  @state() returnsTo: EditorTool | undefined;
  @state() flyoutOpen: boolean;
  /** A tool's key kept down: which, the tool before it, and since when. */
  #spring: { key: string; from: EditorTool; at: number } | undefined;
  /** Whether space is down. */
  #space = false;
  /** What undo takes back, and what redo brings back again. */
  @state() private past: Step[] = [];
  @state() private future: Step[] = [];
  #worker: Worker | undefined;

  /** Where the view was walked to, and the picks, kept with the rest of it. */
  #center: [east: number, north: number] | undefined;
  #picks = '';
  #held: { x: number; y: number } | undefined;
  /** The features as they were before one was shown alone. */
  #solo: Record<EditorLayer, boolean> | undefined;

  constructor() {
    super();
    const camera = load<Record<string, unknown>>(STORED.camera);
    this.camera = Object.fromEntries(
      CONTROLS.map(({ property, value }) => {
        const kept = camera[property];
        return [property, typeof kept === 'number' ? kept : value];
      })
    ) as Record<Property, number>;
    // what is kept is a number, the way the camera's values are, and what was
    // never kept is on - but for the places: they are the bench's, and a
    // first look at the model should not start with them
    this.layers = Object.fromEntries(
      FEATURES.map(({ property }) => [
        property,
        camera[property] === undefined ? property !== 'places' : camera[property] !== 0,
      ])
    ) as Record<EditorLayer, boolean>;
    this.season = SEASONS.find(({ value }) => value === camera['season'])?.value ?? 'summer';
    // noon, unless another hour was kept
    this.hour = typeof camera['hour'] === 'number' ? camera['hour'] : 12;
    this.moon = typeof camera['moon'] === 'number' ? camera['moon'] : MOON;
    this.windows = switchFrom(camera['windows']);
    this.lanterns = switchFrom(camera['lanterns']);
    this.strings = switchFrom(camera['strings']);
    this.fires = camera['fires'] !== false;
    this.decorations = Array.isArray(camera['decorations'])
      ? (camera['decorations'] as unknown[]).filter(
          (tag): tag is string => typeof tag === 'string' && tag in DECORATIONS
        )
      : [];
    const center = camera['center'];
    this.#center =
      Array.isArray(center) && center.length === 2 ? (center as [number, number]) : undefined;
    this.#picks = typeof camera['picks'] === 'string' ? camera['picks'] : '';

    const brush = load<{
      tool: string;
      mode: string;
      radius: number;
      strength: number;
      strokes: Stroke[];
      drags: number[];
    }>(STORED.brush);
    // a brush's mode was a tool of its own once, and none was navigating
    const mode = MODES.find(({ value }) => value === brush.mode || value === brush.tool);
    this.mode = mode?.value ?? 'raise';
    this.tool =
      TOOLS.find(({ value }) => value === brush.tool)?.value ??
      (MODES.some(({ value }) => value === brush.tool) ? 'brush' : 'navigate');
    this.radius = brush.radius ?? BRUSH[0].value;
    this.strength = brush.strength ?? BRUSH[1].value;
    this.strokes = Array.isArray(brush.strokes) ? brush.strokes : [];
    this.drags = Array.isArray(brush.drags) ? brush.drags : [];

    const points = load<{ points: Placed[] }>(STORED.points);
    this.points = Array.isArray(points.points) ? points.points : [];
    this.draft = { ...EMPTY_DRAFT, ...load<Draft>(STORED.place) };

    const layout = load<{
      open: Partial<Record<PanelKey, boolean>>;
      width: number;
      flyout: boolean;
    }>(STORED.layout);
    this.open = Object.fromEntries(
      PANELS.map(({ key }) => [key, layout.open?.[key] ?? true])
    ) as Record<PanelKey, boolean>;
    this.width = typeof layout.width === 'number' ? layout.width : DOCK.value;
    this.flyoutOpen = layout.flyout !== false;
  }

  get center(): [east: number, north: number] | undefined {
    return this.#center;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this.#onKey);
    window.addEventListener('keyup', this.#onKeyUp);
    window.addEventListener('blur', this.#onBlur);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.#onKey);
    window.removeEventListener('keyup', this.#onKeyUp);
    window.removeEventListener('blur', this.#onBlur);
    this.#worker?.terminate();
  }

  override firstUpdated(): void {
    // the viewport takes the picks and where the view was walked to once, the
    // rest it is handed on every render
    this.viewport.picks = this.#picks;
    if (this.#center !== undefined) {
      [this.viewport.east, this.viewport.north] = this.#center;
    }
  }

  override updated(): void {
    save(STORED.camera, {
      ...this.camera,
      ...Object.fromEntries(Object.entries(this.layers).map(([key, on]) => [key, on ? 1 : 0])),
      center: this.#center,
      season: this.season,
      hour: this.hour,
      moon: this.moon,
      windows: this.windows,
      lanterns: this.lanterns,
      strings: this.strings,
      fires: this.fires,
      decorations: this.decorations,
      picks: this.#picks,
    });
    save(STORED.brush, {
      tool: this.tool,
      mode: this.mode,
      radius: this.radius,
      strength: this.strength,
      strokes: this.strokes,
      drags: this.drags,
    });
    save(STORED.points, { points: this.points });
    save(STORED.place, this.draft);
    save(STORED.layout, { open: this.open, width: this.width, flyout: this.flyoutOpen });
  }

  sendCar(): void {
    this.viewport.sendCar();
  }

  set(settings: Partial<Settings>): void {
    Object.assign(this, settings);
  }

  setTool(tool: EditorTool): void {
    this.tool = tool;
  }

  pickTool(tool: EditorTool): void {
    if (tool === this.tool) {
      this.flyoutOpen = !this.flyoutOpen;
      return;
    }
    this.tool = tool;
    this.flyoutOpen = true;
  }

  setOpen(panel: PanelKey, open: boolean): void {
    if (this.open[panel] !== open) {
      this.open = { ...this.open, [panel]: open };
    }
  }

  setDecoration(tag: string, up: boolean): void {
    this.decorations = up
      ? [...new Set([...this.decorations, tag])]
      : this.decorations.filter(one => one !== tag);
  }

  /**
   * Switches a feature, or - solo - shows it alone, and the next time the
   * rest again as they were.
   */
  setLayer(layer: EditorLayer, visible: boolean, solo: boolean): void {
    if (!solo) {
      this.#solo = undefined;
      this.layers = { ...this.layers, [layer]: visible };
      return;
    }
    const alone = Object.entries(this.layers).every(([key, on]) => on === (key === layer));
    if (alone && this.#solo !== undefined) {
      this.layers = this.#solo;
      this.#solo = undefined;
      return;
    }
    this.#solo = this.layers;
    this.layers = Object.fromEntries(
      Object.keys(this.layers).map(key => [key, key === layer])
    ) as Record<EditorLayer, boolean>;
  }

  /**
   * An event's scene, as its view is baked: its season - its own, or the one
   * looked at now for what is held all the year round - its start and what
   * is put up for it, and the camera turned from where its view looks.
   */
  setEvent(type: EventTypeKey): void {
    const { season } = EVENT_TYPES[type] as { season?: Season };
    const view = (VIEWS as Record<string, ViewSpec>)[eventViewName(type, season ?? this.season)];
    if (view === undefined) {
      return;
    }
    this.setSky(view.season, view.hour);
    this.decorations = [...(view.decorations ?? [])];
    // stood where its eye is, seen from what it looks at
    const [east, north] = view.look;
    const bearing = (Math.atan2(view.eye[0] - east, view.eye[1] - north) * 180) / Math.PI;
    this.setCamera('azimuth', bearing);
    this.setCamera('elevation', 12);
    this.setCamera('span', 40);
    this.#centre([east, north]);
  }

  /**
   * A view baked for the site, as near as the editor's camera comes to it:
   * looking at what it looks at from where its eye is, as steeply as it looks
   * down and as wide as it sees there - in its season, at its hour, with its
   * lights and what is put up for it.
   */
  goTo(name: string): void {
    const view = (VIEWS as Record<string, ViewSpec>)[name];
    if (view === undefined) {
      return;
    }
    this.setSky(view.season, view.hour);
    this.moon = view.moon ?? MOON;
    this.decorations = [...(view.decorations ?? [])];
    const lit = (on: boolean | undefined): Switch =>
      on === undefined ? 'auto' : on ? 'on' : 'off';
    this.windows = lit(view.lights);
    this.lanterns = lit(view.lanterns ?? view.lights);
    const [east, north] = view.look;
    const distance = Math.hypot(view.eye[0] - east, view.eye[1] - north);
    const bearing = (Math.atan2(view.eye[0] - east, view.eye[1] - north) * 180) / Math.PI;
    this.setCamera('azimuth', bearing);
    this.setCamera('elevation', -view.pitch);
    this.setCamera('span', 2 * distance * Math.tan(((view.fov / 2) * Math.PI) / 180));
    this.#centre([east, north]);
  }

  /** Moves what the view is centred on. */
  #centre(center: [number, number]): void {
    this.#center = center;
    [this.viewport.east, this.viewport.north] = center;
    this.requestUpdate();
  }

  /** A new season or hour. */
  setSky(season: Season, hour: number | undefined): void {
    this.season = season;
    this.hour = hour;
  }

  /** One writer per camera value, so slider and mouse never disagree. */
  setCamera(property: Property, value: number): void {
    const control = CONTROLS.find(one => one.property === property);
    if (control === undefined || !Number.isFinite(value)) {
      return;
    }
    const { min, max, wraps } = control;
    const turn = max - min;
    const bounded = wraps
      ? min + ((((value - min) % turn) + turn) % turn)
      : Math.min(Math.max(value, min), max);
    this.camera = { ...this.camera, [property]: bounded };
  }

  /** The work of every tool as it stands, for undo to come back to. */
  #step(): Step {
    return {
      strokes: [...this.strokes],
      drags: [...this.drags],
      points: [...this.points],
      picks: this.#picks,
      draft: this.draft,
    };
  }

  /** Remembers how things stood before a step, which makes what redo had stale. */
  #remember(step: Step = this.#step()): void {
    this.past = [...this.past, step].slice(-HISTORY);
    this.future = [];
  }

  /** Puts the work of every tool back as it was at a step. */
  #restore({ strokes, drags, points, picks, draft }: Step): void {
    this.strokes = strokes;
    this.drags = drags;
    this.points = points;
    this.draft = draft;
    this.#picks = picks;
    this.viewport.picks = picks;
  }

  undo(): void {
    const step = this.past[this.past.length - 1];
    if (step === undefined) {
      return;
    }
    this.future = [...this.future, this.#step()];
    this.past = this.past.slice(0, -1);
    this.#restore(step);
  }

  redo(): void {
    const step = this.future[this.future.length - 1];
    if (step === undefined) {
      return;
    }
    this.past = [...this.past, this.#step()];
    this.future = this.future.slice(0, -1);
    this.#restore(step);
  }

  clearStrokes(): void {
    this.#remember();
    this.strokes = [];
    this.drags = [];
  }

  clearPicks(): void {
    this.#remember();
    this.#picks = '';
    this.viewport.picks = '';
    this.picked = { trace: [], seams: [], handles: [] };
  }

  setPoints(points: Placed[]): void {
    this.#remember();
    this.points = points;
  }

  /** Changes the place being drawn; a step undo comes back to, unless it is typed. */
  setDraft(draft: Partial<Draft>, step: boolean): void {
    if (step) {
      this.#remember();
    }
    this.draft = { ...this.draft, ...draft };
  }

  /** Takes up a place drawn, to be drawn again. */
  loadPlace(key: string): void {
    const place = PLACES[key as keyof typeof PLACES];
    if (place === undefined) {
      return;
    }
    this.#remember();
    const { title, where, kind, outline } = place;
    const level = 'level' in place ? place.level : undefined;
    this.draft = { key, title, where, kind, level, corners: [...outline] };
  }

  /**
   * Centres the view on what the tool in hand has made, and takes in all of
   * it: the seam's handles, the points, the place's corners or the dabs -
   * navigating, every one of them.
   */
  frame(): void {
    const handles = this.picked.handles.map(({ at }) => at);
    const points = this.points.map(([x, y]): Point => [x, y]);
    const corners = this.draft.corners.flatMap(corner => {
      const at = cornerPoint(corner, key => pickByKey(key)?.at);
      return at === undefined ? [] : [at];
    });
    const dabs = this.strokes.map(([, x, y]): Point => [x, y]);
    const all: Record<EditorTool, Point[]> = {
      seam: handles,
      point: points,
      place: corners,
      brush: dabs,
      navigate: [...handles, ...points, ...corners, ...dabs],
    };
    const framed = all[this.tool];
    if (framed.length === 0) {
      return;
    }
    const xs = framed.map(([x]) => x);
    const ys = framed.map(([, y]) => y);
    const [left, right, bottom, top] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    ];
    this.setCamera('span', Math.max(right - left, top - bottom) * 1.6 + 10);
    this.#centre([(left + right) / 2, (bottom + top) / 2]);
  }

  showShortcuts(): void {
    this.keys = true;
  }

  /** Whether a key is typed into a field, which is not the editor's to hear. */
  static typing(event: KeyboardEvent): boolean {
    const [target] = event.composedPath();
    return (
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    );
  }

  /**
   * What is held for the moment, shown on the tools as the viewport does it:
   * space the view's tool, and with the brush in hand ⇧ its smoothing, ⌘ or
   * ctrl raising and lowering turned round.
   */
  #hold(event: KeyboardEvent): void {
    const turned =
      (event.metaKey || event.ctrlKey) && (this.mode === 'raise' || this.mode === 'lower');
    const mode =
      this.tool !== 'brush' || this.#space
        ? undefined
        : event.shiftKey
          ? 'smooth'
          : turned
            ? this.mode === 'raise'
              ? 'lower'
              : 'raise'
            : undefined;
    const tool = this.#space ? 'navigate' : undefined;
    if (this.held.tool !== tool || this.held.mode !== mode) {
      this.held = { tool, mode };
    }
  }

  /** A window left with keys held never hears them let go. */
  readonly #onBlur = () => {
    this.#space = false;
    this.#spring = undefined;
    this.returnsTo = undefined;
    this.held = {};
  };

  /**
   * A key let go: space, a modifier - and a tool's key that was kept down,
   * which hands the tool before it back, as a tool held for the moment does.
   * Tapped, the tool it took up stays.
   */
  readonly #onKeyUp = (event: KeyboardEvent) => {
    if (event.key === ' ') {
      this.#space = false;
    }
    this.#hold(event);
    const spring = this.#spring;
    if (spring === undefined || event.key.toLowerCase() !== spring.key) {
      return;
    }
    this.#spring = undefined;
    this.returnsTo = undefined;
    if (performance.now() - spring.at > SPRING) {
      this.tool = spring.from;
    }
  };

  /** The keys: the tools, the brush's modes, undo and redo, framing and the rest. */
  readonly #onKey = (event: KeyboardEvent) => {
    if (Editor.typing(event)) {
      return;
    }
    if (event.key === ' ') {
      this.#space = true;
    }
    this.#hold(event);
    const key = event.key.toLowerCase();
    const command = event.metaKey || event.ctrlKey;
    if (command && (key === 'z' || key === 'y')) {
      event.preventDefault();
      if (key === 'y' || event.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }
    if (command || event.altKey) {
      return;
    }
    if (event.key === 'Escape') {
      if (this.keys) {
        this.keys = false;
      } else {
        this.tool = 'navigate';
      }
      return;
    }
    if (event.key === '?') {
      this.keys = !this.keys;
      return;
    }
    const tool = TOOLS.find(one => one.key === key);
    if (tool !== undefined) {
      // kept down, it repeats: the tool was taken up at the first
      if (!event.repeat && tool.value !== this.tool) {
        this.#spring = { key, from: this.tool, at: performance.now() };
        this.returnsTo = this.tool;
        this.tool = tool.value;
      }
      return;
    }
    const mode = MODES[Number(event.key) - 1];
    if (this.tool === 'brush' && mode !== undefined) {
      this.mode = mode.value;
      return;
    }
    if (key === 'f') {
      this.frame();
      return;
    }
    if (
      this.tool === 'place' &&
      (event.key === 'Backspace' || event.key === 'Delete') &&
      this.draft.corners.length > 0
    ) {
      event.preventDefault();
      this.setDraft({ corners: this.draft.corners.slice(0, -1) }, true);
    }
  };

  /** The fingers on the view, where each is, and the pair's spread, twist and middle when last moved. */
  readonly #fingers = new Map<number, { x: number; y: number }>();
  #pinch: { spread: number; twist: number; middle: number } | undefined;

  /** The two fingers' spread, the way the line between them points, in degrees, and how high their middle is. */
  #pair(): { spread: number; twist: number; middle: number } | undefined {
    const [a, b] = [...this.#fingers.values()];
    if (a === undefined || b === undefined) {
      return undefined;
    }
    return {
      spread: Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1),
      twist: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      middle: (a.y + b.y) / 2,
    };
  }

  /**
   * Two fingers move the view as a map is: spread apart they zoom in, turned
   * they turn the compass with them, and moved up or down together they tip
   * the horizon - one finger is the viewport's, as a plain drag is.
   */
  #touch(event: PointerEvent): boolean {
    if (event.pointerType !== 'touch') {
      return false;
    }
    if (event.type === 'pointerdown') {
      this.#fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.#pinch = this.#fingers.size === 2 ? this.#pair() : undefined;
      return this.#fingers.size > 1;
    }
    if (!this.#fingers.has(event.pointerId)) {
      return false;
    }
    if (event.type !== 'pointermove') {
      this.#fingers.delete(event.pointerId);
      this.#pinch = this.#fingers.size === 2 ? this.#pair() : undefined;
      return true;
    }
    this.#fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const now = this.#pair();
    const was = this.#pinch;
    if (now === undefined || was === undefined) {
      return this.#fingers.size > 1;
    }
    // the turn the short way round, across the line where the angle wraps
    const turned = ((now.twist - was.twist + 540) % 360) - 180;
    this.setCamera('span', this.camera.span * (was.spread / now.spread));
    this.setCamera('azimuth', this.camera.azimuth - turned);
    this.setCamera('elevation', this.camera.elevation + (now.middle - was.middle) * DRAG.elevation);
    this.#pinch = now;
    return true;
  }

  #orbitStart(event: PointerEvent): void {
    if (this.#touch(event)) {
      return;
    }
    // only a drag with the right button turns the view: a plain one moves it
    // across the ground, or is the tool's in hand - the viewport's own to do
    if (event.button !== 2) {
      return;
    }
    this.#held = { x: event.clientX, y: event.clientY };
    this.viewport.setPointerCapture(event.pointerId);
  }

  #orbitMove(event: PointerEvent): void {
    if (this.#touch(event) || this.#held === undefined) {
      return;
    }
    // a release outside the window is not always heard: a move with no button
    // held is the end of the drag, whatever was missed
    if (event.buttons === 0) {
      this.#orbitEnd(event);
      return;
    }
    const [dx, dy] = [event.clientX - this.#held.x, event.clientY - this.#held.y];
    this.#held = { x: event.clientX, y: event.clientY };
    this.setCamera('azimuth', this.camera.azimuth + dx * DRAG.azimuth);
    this.setCamera('elevation', this.camera.elevation + dy * DRAG.elevation);
  }

  #orbitEnd(event: PointerEvent): void {
    this.#touch(event);
    this.#held = undefined;
    if (this.viewport.hasPointerCapture(event.pointerId)) {
      this.viewport.releasePointerCapture(event.pointerId);
    }
  }

  /** The wheel scales the visible ground: a notch zooms by a share of the span. */
  #zoom(event: WheelEvent): void {
    event.preventDefault();
    const pixels =
      event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? event.deltaY : event.deltaY * LINE_HEIGHT;
    this.setCamera('span', this.camera.span * Math.exp(pixels * 0.0015));
  }

  /** The panels' edge being dragged: where the drag started, and how wide they were. */
  #resizing: { x: number; width: number } | undefined;

  #resizeStart(event: PointerEvent): void {
    this.#resizing = { x: event.clientX, width: this.width };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  #resizeMove(event: PointerEvent): void {
    if (this.#resizing === undefined) {
      return;
    }
    // the edge is the panels' left one: dragged left, they grow
    const width = this.#resizing.width - (event.clientX - this.#resizing.x);
    this.width = Math.round(Math.min(Math.max(width, DOCK.least), DOCK.most));
  }

  #resizeEnd(): void {
    this.#resizing = undefined;
  }

  /**
   * Bakes the view as it is - where the camera stands, the season, the hour,
   * the moon and the lights - as the site's views are baked, and shows it
   * drawn as the site draws it. The model is built from its source: brush
   * strokes not yet copied into it are not in it.
   */
  bakePreview(): void {
    this.#closePreview();
    this.preview = { baking: true, share: 0, stage: 'starting' };
    this.#worker ??= new Worker(new URL('../../preview/preview.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.#worker.onmessage = ({
      data,
    }: MessageEvent<{
      packed?: ArrayBuffer;
      error?: string;
      progress?: number;
      stage?: string;
    }>) => {
      if (data.progress !== undefined) {
        this.preview = { baking: true, share: data.progress, stage: data.stage ?? '' };
        return;
      }
      this.preview =
        data.packed === undefined
          ? { error: data.error ?? 'no bake' }
          : { src: URL.createObjectURL(new Blob([data.packed])) };
    };
    // what is left to the hour is baked as the hour has it
    const due = lightsDue(this.season, this.hour);
    this.#worker.postMessage({
      center: [this.viewport.east ?? 0, this.viewport.north ?? 0],
      azimuth: this.camera.azimuth,
      elevation: this.camera.elevation,
      span: this.camera.span,
      season: this.season,
      hour: this.hour,
      moon: this.moon,
      lights: switched(this.windows) ?? due,
      lanterns: switched(this.lanterns) ?? due,
      decorations: this.decorations,
    });
  }

  #closePreview(): void {
    if (this.preview !== undefined && 'src' in this.preview) {
      URL.revokeObjectURL(this.preview.src);
    }
    this.preview = undefined;
  }

  copy(text: string): void {
    void navigator.clipboard?.writeText(text);
  }

  override render() {
    return html`
      <div id="layout" style=${`--dock: ${this.width}px`}>
        ${toolStrip(this)}
        <main id="stage">
          <kvlm-editor-viewport
            .azimuth=${this.camera.azimuth}
            .elevation=${this.camera.elevation}
            .span=${this.camera.span}
            .trees=${this.layers.trees}
            .sky=${this.layers.sky}
            .particles=${this.layers.particles}
            .season=${this.season}
            .hour=${this.hour}
            .moon=${this.moon}
            .lights=${switched(this.windows)}
            .lanterns=${switched(this.lanterns)}
            .strings=${switched(this.strings)}
            .fires=${this.fires}
            .decorations=${this.decorations}
            .roads=${this.layers.roads}
            .walls=${this.layers.walls}
            .decks=${this.layers.decks}
            .houses=${this.layers.houses}
            .places=${this.layers.places}
            .terrain=${this.layers.terrain}
            .tool=${this.tool}
            .mode=${this.mode}
            .brushRadius=${this.radius}
            .brushStrength=${this.strength}
            .strokes=${this.strokes}
            .points=${this.points}
            .corners=${this.draft.corners}
            .placeKind=${this.draft.kind}
            @pointerdown=${this.#orbitStart}
            @pointermove=${this.#orbitMove}
            @pointerup=${this.#orbitEnd}
            @pointercancel=${this.#orbitEnd}
            @lostpointercapture=${() => (this.#held = undefined)}
            @contextmenu=${(event: Event) => event.preventDefault()}
            @wheel=${{ handleEvent: (event: WheelEvent) => this.#zoom(event), passive: false }}
            @kvlm-editor-picked=${(event: CustomEvent<Picked>) => {
              // what the viewport picked is news only if it changed the picks
              const picks = this.viewport.picks ?? '';
              if (picks !== this.#picks) {
                this.#remember({ ...this.#step(), picks: this.#picks });
                this.#picks = picks;
              }
              this.picked = event.detail;
            }}
            @kvlm-editor-brushed=${(event: CustomEvent<{ strokes: Stroke[]; dabs: number }>) => {
              const { strokes, dabs } = event.detail;
              // the drag laid its dabs onto the very list kept: before it, it was shorter
              this.#remember({ ...this.#step(), strokes: strokes.slice(0, strokes.length - dabs) });
              this.strokes = strokes;
              this.drags = [...this.drags, dabs];
            }}
            @kvlm-editor-pointed=${(event: CustomEvent<{ points: Placed[] }>) => {
              this.#remember();
              this.points = event.detail.points;
            }}
            @kvlm-editor-placed=${(event: CustomEvent<{ corners: DraftCorner[] }>) =>
              this.setDraft({ corners: event.detail.corners }, true)}
            @kvlm-editor-place-picked=${(event: CustomEvent<{ key: string }>) =>
              this.loadPlace(event.detail.key)}
            @kvlm-editor-cursor=${(event: CustomEvent<Cursor | null>) =>
              // off the model, the event carries none - which it hands on as null
              (this.cursor = event.detail ?? undefined)}
            @kvlm-editor-working=${(event: CustomEvent<Working>) => (this.working = event.detail)}
            @kvlm-editor-viewed=${(event: CustomEvent<{ east: number; north: number }>) => {
              this.#center = [event.detail.east, event.detail.north];
              this.requestUpdate();
            }}
            @kvlm-editor-failed=${(event: CustomEvent<unknown>) =>
              (this.failed = String(event.detail))}
          ></kvlm-editor-viewport>
          ${flyout(this)}
          ${
            this.failed === undefined
              ? nothing
              : html`<p id="failed">No 3D view possible: ${this.failed}</p>`
          }
        </main>
        <div
          id="resize"
          role="separator"
          aria-orientation="vertical"
          title="drag to make the panels wider or narrower"
          @pointerdown=${this.#resizeStart}
          @pointermove=${this.#resizeMove}
          @pointerup=${this.#resizeEnd}
          @pointercancel=${this.#resizeEnd}
        ></div>
        <div id="dock">${dock(this)}</div>
        ${footer(this)}
      </div>

      ${
        this.preview === undefined || 'baking' in this.preview
          ? nothing
          : html`
              <div id="baked">
                ${
                  'src' in this.preview
                    ? html`<kvlm-scene src=${this.preview.src}></kvlm-scene>`
                    : html`<p>No bake: ${this.preview.error}</p>`
                }
                <button type="button" @click=${this.#closePreview}>close</button>
              </div>
            `
      }
      ${this.keys ? shortcuts(() => (this.keys = false)) : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-editor': Editor;
  }
}
