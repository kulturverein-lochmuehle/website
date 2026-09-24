import '../viewport/viewport.component.js';

import type { BrushTool, Stroke } from '@kvlm/visualization';
import { html, LitElement, nothing, unsafeCSS } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';

import type { EditorLayer } from '../../scene/editor.scene.js';
import type { EditorViewport } from '../viewport/viewport.component.js';
import styles from './editor.component.css?inline&lit';

/** The camera is three numbers, so the controls are built from three rows. */
const CONTROLS = [
  // the compass has no ends, dragging past north continues at south
  { property: 'azimuth', label: 'Azimuth', min: 0, max: 360, value: 340, wraps: true },
  { property: 'elevation', label: 'Elevation', min: 5, max: 89, value: 28, wraps: false },
  { property: 'span', label: 'Span', min: 8, max: 600, value: 200, wraps: false },
] as const;

/** And what can be switched off while the model is being worked on. */
const LAYERS: { property: EditorLayer; label: string }[] = [
  { property: 'trees', label: 'Trees' },
  { property: 'roads', label: 'Roads' },
  { property: 'walls', label: 'Walls' },
  { property: 'decks', label: 'Decks' },
  { property: 'houses', label: 'Houses' },
  { property: 'seam', label: 'Seam' },
  { property: 'terrain', label: 'Terrain' },
];

/** One button a tool, the one in hand pressed; off hands a drag back to the view. */
const TOOLS: { value: BrushTool | 'point' | ''; title: string }[] = [
  { value: '', title: 'a drag moves the view' },
  ...(['raise', 'lower', 'flatten', 'smooth'] as const).map(value => ({
    value,
    title: `${value} - shift puts it down, to drag the view`,
  })),
  {
    value: 'point',
    title: 'a click sets a reference point, a drag up or down lifts it first - shift puts it down',
  },
];

/** The brush's reach and strength, each a slider. */
const BRUSH = [
  { property: 'radius', label: 'Radius', min: 0.5, max: 10, step: 0.25, value: 2 },
  { property: 'strength', label: 'Strength', min: 0.05, max: 1, step: 0.05, value: 0.3 },
] as const;

/** Dragging with the right button turns the camera: sideways the compass, up and down the horizon. */
const DRAG = { azimuth: 0.4, elevation: 0.3 };

/** How far a wheel notch counted in lines scrolls, in pixels. */
const LINE_HEIGHT = 16;

type Property = (typeof CONTROLS)[number]['property'];
type Placed = [x: number, y: number, level: number];

/** A handle as the viewport reports it picked. */
interface Handle {
  index: number;
  /** Its name, which the source refers to it by: the number is only today's. */
  key: string;
  at: [x: number, y: number];
  level: number;
  edge: string;
}
interface Picked {
  trace: number[];
  seams: number[][];
  handles: Handle[];
}

/**
 * The editor survives a reload with the view it was left in, which is what
 * makes it usable while the model is being worked on. Session storage, not
 * local: a second tab is a second view, and closing it forgets.
 */
const STORED = {
  camera: 'kvlm-editor-camera',
  brush: 'kvlm-editor-brush',
  points: 'kvlm-editor-points',
} as const;

const load = <T extends object>(key: string): Partial<T> => {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? '{}') as Partial<T>;
  } catch {
    return {};
  }
};

const save = (key: string, value: unknown): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // a private window may refuse to store - the editor still works
  }
};

/** What was picked, ready to be pasted back into the source. */
function readout({ trace, seams, handles }: Picked): string {
  if (handles.length === 0) {
    return '// nothing picked';
  }
  const numbers = (path: number[]) => path.map(index => index + 1).join(', ');
  return [
    seams.length === 0
      ? '// no seam closed yet'
      : `const SEAMS = [\n${seams.map(seam => `  [${numbers(seam)}],`).join('\n')}\n];`,
    ...(trace.length === 0 ? [] : [`// open: ${numbers(trace)}`]),
    // and each as the coordinates it is written into the source with, for
    // SEAMS or KEPT - FILLS and RAILINGS take the names
    ...seams.map(seam =>
      [
        `// ${numbers(seam)}`,
        '[',
        ...seam.flatMap(index => {
          const handle = handles.find(one => one.index === index);
          return handle === undefined
            ? []
            : [`  [${handle.at[0].toFixed(4)}, ${handle.at[1].toFixed(4)}, '${handle.edge}'],`];
        }),
        '],',
      ].join('\n')
    ),
    ...[...handles]
      .sort((one, other) => one.index - other.index)
      .map(
        ({ index, key, at, edge }) =>
          `// ${String(index + 1).padStart(3)}  ${edge.padEnd(4)}  ` +
          `${at[0].toFixed(2)}, ${at[1].toFixed(2)}  '${key}'`
      ),
  ].join('\n');
}

/**
 * The editor of the Lochmühle's 3D model: the viewport, and around it the
 * camera, the layers, the seam being picked, the landfill brush and the
 * reference points - each kept across a reload, and each copied out in the
 * form it is written into the source with.
 */
@customElement('kvlm-editor')
export class Editor extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  @query('kvlm-editor-viewport')
  private readonly viewport!: EditorViewport;

  /**
   * The exact camera values. A range input snaps whatever is written to it to
   * its step, so reading the sliders back would swallow every move smaller
   * than a whole degree or meter - and zoomed in, a wheel notch is exactly
   * that small.
   */
  @state() private camera: Record<Property, number>;
  @state() private layers: Record<EditorLayer, boolean>;
  @state() private picked: Picked = { trace: [], seams: [], handles: [] };
  @state() private tool: BrushTool | 'point' | '';
  @state() private radius: number;
  @state() private strength: number;
  @state() private strokes: Stroke[];
  /** How many dabs each drag laid, so that undo takes the whole drag back. */
  @state() private drags: number[];
  @state() private points: Placed[];
  @state() private failed: string | undefined;

  /** Where the view was walked to, and the picks, kept with the rest of it. */
  #center: [east: number, north: number] | undefined;
  #picks = '';
  #held: { x: number; y: number } | undefined;

  constructor() {
    super();
    const camera = load<Record<string, unknown>>(STORED.camera);
    this.camera = Object.fromEntries(
      CONTROLS.map(({ property, value }) => {
        const kept = camera[property];
        return [property, typeof kept === 'number' ? kept : value];
      })
    ) as Record<Property, number>;
    // what is kept is a number, the way the camera's values are
    this.layers = Object.fromEntries(
      LAYERS.map(({ property }) => [property, camera[property] !== 0])
    ) as Record<EditorLayer, boolean>;
    const center = camera['center'];
    this.#center =
      Array.isArray(center) && center.length === 2 ? (center as [number, number]) : undefined;
    this.#picks = typeof camera['picks'] === 'string' ? camera['picks'] : '';

    const brush = load<{
      tool: string;
      radius: number;
      strength: number;
      strokes: Stroke[];
      drags: number[];
    }>(STORED.brush);
    this.tool = (TOOLS.find(({ value }) => value === brush.tool)?.value ?? '') as typeof this.tool;
    this.radius = brush.radius ?? BRUSH[0].value;
    this.strength = brush.strength ?? BRUSH[1].value;
    this.strokes = Array.isArray(brush.strokes) ? brush.strokes : [];
    this.drags = Array.isArray(brush.drags) ? brush.drags : [];

    const points = load<{ points: Placed[] }>(STORED.points);
    this.points = Array.isArray(points.points) ? points.points : [];
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
      picks: this.viewport.picks,
    });
    save(STORED.brush, {
      tool: this.tool,
      radius: this.radius,
      strength: this.strength,
      strokes: this.strokes,
      drags: this.drags,
    });
    save(STORED.points, { points: this.points });
  }

  /** One writer per camera value, so slider and mouse never disagree. */
  #setCamera(property: Property, value: number): void {
    const control = CONTROLS.find(one => one.property === property);
    if (control === undefined) {
      return;
    }
    const { min, max, wraps } = control;
    const turn = max - min;
    const bounded = wraps
      ? min + ((((value - min) % turn) + turn) % turn)
      : Math.min(Math.max(value, min), max);
    this.camera = { ...this.camera, [property]: bounded };
  }

  #orbitStart(event: PointerEvent): void {
    // only a drag with the right button turns the view: a plain one moves it
    // across the ground, or is the tool's in hand - the viewport's own to do
    if (event.button !== 2) {
      return;
    }
    this.#held = { x: event.clientX, y: event.clientY };
    this.viewport.setPointerCapture(event.pointerId);
  }

  #orbitMove(event: PointerEvent): void {
    if (this.#held === undefined) {
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
    this.#setCamera('azimuth', this.camera.azimuth + dx * DRAG.azimuth);
    this.#setCamera('elevation', this.camera.elevation + dy * DRAG.elevation);
  }

  #orbitEnd(event: PointerEvent): void {
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
    this.#setCamera('span', this.camera.span * Math.exp(pixels * 0.0015));
  }

  #clearPicks(): void {
    this.viewport.picks = '';
    this.picked = { trace: [], seams: [], handles: [] };
  }

  #undo(): void {
    const last = this.drags[this.drags.length - 1];
    if (last === undefined) {
      return;
    }
    this.drags = this.drags.slice(0, -1);
    this.strokes = this.strokes.slice(0, this.strokes.length - last);
  }

  #copy(text: string): void {
    void navigator.clipboard?.writeText(text);
  }

  /** What is copied is meant to go straight into brushes.ts in @kvlm/visualization. */
  get #strokesSource(): string {
    const lines = this.strokes.map(
      stroke =>
        `  [${stroke.map(part => (typeof part === 'string' ? `'${part}'` : String(part))).join(', ')}],`
    );
    return ['export const BRUSHES: Stroke[] = [', ...lines, '];'].join('\n');
  }

  /** And this into points.ts in @kvlm/visualization. */
  get #pointsSource(): string {
    return [
      'export const POINTS: [x: number, y: number, level: number][] = [',
      ...this.points.map(([x, y, level]) => `  [${x}, ${y}, ${level}],`),
      '];',
    ].join('\n');
  }

  #setHeight(index: number, value: number): void {
    if (Number.isFinite(value)) {
      this.points = this.points.map((point, at) =>
        at === index ? [point[0], point[1], value] : point
      );
    }
  }

  override render() {
    return html`
      ${this.failed === undefined ? nothing : html`<p>No 3D view possible: ${this.failed}</p>`}

      <kvlm-editor-viewport
        .azimuth=${this.camera.azimuth}
        .elevation=${this.camera.elevation}
        .span=${this.camera.span}
        .trees=${this.layers.trees}
        .roads=${this.layers.roads}
        .walls=${this.layers.walls}
        .decks=${this.layers.decks}
        .houses=${this.layers.houses}
        .seam=${this.layers.seam}
        .terrain=${this.layers.terrain}
        .brush=${this.tool === '' ? undefined : this.tool}
        .brushRadius=${this.radius}
        .brushStrength=${this.strength}
        .strokes=${this.strokes}
        .points=${this.points}
        @pointerdown=${this.#orbitStart}
        @pointermove=${this.#orbitMove}
        @pointerup=${this.#orbitEnd}
        @pointercancel=${this.#orbitEnd}
        @lostpointercapture=${() => (this.#held = undefined)}
        @contextmenu=${(event: Event) => event.preventDefault()}
        @wheel=${{ handleEvent: (event: WheelEvent) => this.#zoom(event), passive: false }}
        @kvlm-editor-picked=${(event: CustomEvent<Picked>) => (this.picked = event.detail)}
        @kvlm-editor-brushed=${(event: CustomEvent<{ strokes: Stroke[]; dabs: number }>) => {
          this.strokes = event.detail.strokes;
          this.drags = [...this.drags, event.detail.dabs];
        }}
        @kvlm-editor-pointed=${(event: CustomEvent<{ points: Placed[] }>) =>
          (this.points = event.detail.points)}
        @kvlm-editor-viewed=${(event: CustomEvent<{ east: number; north: number }>) => {
          this.#center = [event.detail.east, event.detail.north];
          this.requestUpdate();
        }}
        @kvlm-editor-failed=${(event: CustomEvent<unknown>) => (this.failed = String(event.detail))}
      ></kvlm-editor-viewport>

      <form id="camera" @submit=${(event: Event) => event.preventDefault()}>
        <div id="sliders">
          ${CONTROLS.map(
            ({ property, label, min, max }) => html`
              <label for=${property}>${label}</label>
              <input
                id=${property}
                type="range"
                min=${min}
                max=${max}
                step="1"
                .value=${String(Math.round(this.camera[property]))}
                @input=${(event: Event) =>
                  this.#setCamera(property, Number((event.target as HTMLInputElement).value))}
              >
              <output for=${property}>${Math.round(this.camera[property])}</output>
            `
          )}
        </div>
        <div id="layers">
          ${LAYERS.map(
            ({ property, label }) => html`
              <input
                id=${property}
                type="checkbox"
                .checked=${this.layers[property]}
                @change=${(event: Event) =>
                  (this.layers = {
                    ...this.layers,
                    [property]: (event.target as HTMLInputElement).checked,
                  })}
              >
              <label for=${property}>${label}</label>
            `
          )}
        </div>
      </form>

      <aside id="path">
        <header>
          <strong>Seam</strong>
          <button type="button" @click=${() => this.#copy(readout(this.picked))}>copy</button>
          <button type="button" @click=${this.#clearPicks}>clear</button>
        </header>
        <pre>${readout(this.picked)}</pre>
      </aside>

      <aside id="brush">
        <header>
          <strong>Brush</strong>
          <button type="button" @click=${this.#undo}>undo</button>
          <button type="button" @click=${() => this.#copy(this.#strokesSource)}>copy</button>
          <button
            type="button"
            @click=${() => {
              this.strokes = [];
              this.drags = [];
            }}
          >
            clear
          </button>
        </header>
        <div id="brushes">
          <div id="tools" role="group" aria-label="Tool">
            ${TOOLS.map(
              ({ value, title }) => html`
                <button
                  type="button"
                  title=${title}
                  aria-pressed=${String(this.tool === value)}
                  @click=${() => (this.tool = value)}
                >
                  ${value === '' ? 'off' : value}
                </button>
              `
            )}
          </div>
          ${BRUSH.map(
            ({ property, label, min, max, step }) => html`
              <label for=${property}>${label}</label>
              <input
                id=${property}
                type="range"
                min=${min}
                max=${max}
                step=${step}
                .value=${String(this[property])}
                @input=${(event: Event) =>
                  (this[property] = Number((event.target as HTMLInputElement).value))}
              >
              <output for=${property}>${this[property]}</output>
            `
          )}
        </div>
        <output id="brushed">${this.strokes.length} dabs in ${this.drags.length} drags</output>
        <header>
          <strong>Points</strong>
          <button type="button" @click=${() => this.#copy(this.#pointsSource)}>copy</button>
          <button type="button" @click=${() => (this.points = [])}>clear</button>
        </header>
        <ol id="point-list">
          ${this.points.map(
            ([x, y, level], index) => html`
              <li>
                <strong>P${index + 1}</strong>
                <span>${x.toFixed(2)}, ${y.toFixed(2)}</span>
                <input
                  type="number"
                  step="0.01"
                  title="the height the ground is to have here"
                  .value=${String(level)}
                  @change=${(event: Event) =>
                    this.#setHeight(index, Number((event.target as HTMLInputElement).value))}
                >
                <button
                  type="button"
                  title="take this point away"
                  @click=${() => (this.points = this.points.filter((_, at) => at !== index))}
                >
                  ×
                </button>
              </li>
            `
          )}
        </ol>
      </aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-editor': Editor;
  }
}
