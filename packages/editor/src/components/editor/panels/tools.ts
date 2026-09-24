import type { Point } from '@kvlm/visualization';
import { pickByKey, PLACE_KEYS, PLACES } from '@kvlm/visualization';
import type { TemplateResult } from 'lit';
import { html, nothing, svg } from 'lit';

import { clockwise } from '../../../scene/editor.overlays.js';
import type { EditorTool } from '../../../scene/editor.scene.js';
import {
  BRUSH,
  cornerPoint,
  MODES,
  placeSource,
  pointsSource,
  seamSource,
  strokesSource,
  TOOLS,
} from '../editor.model.js';
import type { Bench } from './bench.js';
import { valueOf } from './bench.js';

// The tools down the left, and beside them the options of the one in hand:
// what it is set to, what it has made, and how that is copied out.

/** Each tool's mark, drawn on a 24 unit square. */
const ICONS: Record<EditorTool | 'undo' | 'redo' | 'help', TemplateResult> = {
  navigate: svg`<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />`,
  brush: svg`<path d="M3 18c3-7 6-9 9-9s6 2 9 9" /><circle cx="12" cy="9" r="3" stroke-dasharray="2 2" />`,
  point: svg`<circle cx="12" cy="10" r="3" /><path d="M12 13v8M8 21h8" />`,
  seam: svg`<path d="M4 18l5-9 6 4 5-8" /><circle cx="4" cy="18" r="1.6" /><circle cx="9" cy="9" r="1.6" /><circle cx="15" cy="13" r="1.6" /><circle cx="20" cy="5" r="1.6" />`,
  place: svg`<path d="M5 6l12-2 3 11-9 5-6-6z" stroke-dasharray="3 2" /><circle cx="5" cy="6" r="1.6" /><circle cx="17" cy="4" r="1.6" /><circle cx="20" cy="15" r="1.6" />`,
  undo: svg`<path d="M9 7H4V2M4 7c3-3 6-4 9-4a8 8 0 1 1-8 9" />`,
  redo: svg`<path d="M15 7h5V2M20 7c-3-3-6-4-9-4a8 8 0 1 0 8 9" />`,
  help: svg`<circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V15M12 18v.5" />`,
};

const icon = (name: keyof typeof ICONS) =>
  html`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

/**
 * The strip of tools, and undo, redo and the keys at its foot. The tool in
 * hand is pressed; one held for the moment - space for the view, a tool's key
 * kept down - is pressed instead, and the one it goes back to is ringed.
 */
export function toolStrip(bench: Bench) {
  const { held, returnsTo } = bench;
  const shown = held.tool ?? bench.tool;
  const back = held.tool === undefined ? returnsTo : bench.tool;
  return html`
    <nav id="tools" aria-label="Tools">
      ${TOOLS.map(
        ({ value, label, key, title }) => html`
          <button
            type="button"
            class=${back === value && shown !== value ? 'returns' : ''}
            title=${`${label} (${key.toUpperCase()}, held for a moment) - ${title}${
              value === 'navigate' ? ' - space held, whatever is in hand' : ''
            }${value === bench.tool ? ' - click again to fold its options away' : ''}`}
            aria-label=${label}
            aria-pressed=${String(shown === value)}
            @click=${() => bench.pickTool(value)}
          >
            ${icon(value)}
          </button>
        `
      )}
      <span class="grow"></span>
      <button
        type="button"
        title="Undo (⌘/Ctrl Z)"
        aria-label="Undo"
        ?disabled=${!bench.canUndo}
        @click=${() => bench.undo()}
      >
        ${icon('undo')}
      </button>
      <button
        type="button"
        title="Redo (⌘/Ctrl ⇧ Z)"
        aria-label="Redo"
        ?disabled=${!bench.canRedo}
        @click=${() => bench.redo()}
      >
        ${icon('redo')}
      </button>
      <button
        type="button"
        title="Keys (?)"
        aria-label="Keys"
        @click=${() => bench.showShortcuts()}
      >
        ${icon('help')}
      </button>
    </nav>
  `;
}

/** What can be done with all a tool has made, along the flyout's foot. */
interface Action {
  label: string;
  title?: string;
  run: () => void;
}

/**
 * A flyout as every tool's is laid out: its name as a panel's, then its
 * rows, what it has made, what is wrong with it, what can be done with it,
 * and last what the keys do.
 */
function laidOut(
  title: string,
  {
    rows = nothing,
    made = nothing,
    problems = [],
    actions,
    hint,
  }: {
    rows?: unknown;
    made?: unknown;
    problems?: string[];
    actions: Action[];
    hint: string;
  }
) {
  return html`
    <h2 class="title">${title}</h2>
    <div class="body">
      ${rows === nothing ? nothing : html`<div class="rows">${rows}</div>`} ${made}
      ${
        problems.length === 0
          ? nothing
          : html`<ul class="warnings">
              ${problems.map(problem => html`<li>${problem}</li>`)}
            </ul>`
      }
      <div class="actions">
        ${actions.map(
          ({ label, title: about, run }) =>
            html`<button type="button" title=${about ?? label} @click=${run}>${label}</button>`
        )}
      </div>
      <p class="hint">${hint}</p>
    </div>
  `;
}

function brushFlyout(bench: Bench) {
  const shown = bench.held.mode ?? bench.mode;
  return laidOut('Brush', {
    rows: html`
      <div class="segments full" role="group" aria-label="Mode">
        ${MODES.map(
          ({ value, label }, index) => html`
            <button
              type="button"
              class=${bench.held.mode !== undefined && value === bench.mode ? 'returns' : ''}
              title=${`${label} (${index + 1})`}
              aria-pressed=${String(shown === value)}
              @click=${() => bench.set({ mode: value })}
            >
              ${label}
            </button>
          `
        )}
      </div>
      ${BRUSH.map(
        ({ property, label, min, max, step }) => html`
          <label class="label" for=${`brush-${property}`}>${label}</label>
          <input
            id=${`brush-${property}`}
            type="range"
            min=${min}
            max=${max}
            step=${step}
            .value=${String(bench[property])}
            @input=${(event: Event) => bench.set({ [property]: Number(valueOf(event)) })}
          >
          <output for=${`brush-${property}`}>${bench[property]}</output>
        `
      )}
    `,
    made: html`<p class="count">${bench.strokes.length} dabs in ${bench.drags.length} drags</p>`,
    actions: [
      {
        label: 'copy',
        title: 'copy as BRUSHES',
        run: () => bench.copy(strokesSource([...bench.strokes])),
      },
      { label: 'clear', run: () => bench.clearStrokes() },
    ],
    hint: '⌘/Ctrl held turns raise and lower round, ⇧ smooths, space moves the view.',
  });
}

function pointFlyout(bench: Bench) {
  const points = [...bench.points];
  return laidOut('Point', {
    made: html`
      <ol class="list">
        ${points.map(
          ([x, y, level], index) => html`
            <li>
              <strong>P${index + 1}</strong>
              <span>${x.toFixed(2)}, ${y.toFixed(2)}</span>
              <input
                type="number"
                step="0.01"
                title="the height the ground is to have here"
                .value=${String(level)}
                @change=${(event: Event) => {
                  const value = Number(valueOf(event));
                  if (Number.isFinite(value)) {
                    bench.setPoints(
                      points.map((point, at) => (at === index ? [x, y, value] : point))
                    );
                  }
                }}
              >
              <button
                type="button"
                title="take this point away"
                @click=${() => bench.setPoints(points.filter((_, at) => at !== index))}
              >
                ×
              </button>
            </li>
          `
        )}
      </ol>
      ${points.length === 0 ? html`<p class="count">no points set</p>` : nothing}
    `,
    actions: [
      { label: 'copy', title: 'copy as POINTS', run: () => bench.copy(pointsSource(points)) },
      { label: 'clear', run: () => bench.setPoints([]) },
    ],
    hint: 'A click sets a point, a drag up or down lifts it first.',
  });
}

function seamFlyout(bench: Bench) {
  const source = seamSource(bench.picked);
  return laidOut('Seam', {
    made: html`<pre>${source}</pre>`,
    actions: [
      { label: 'copy', run: () => bench.copy(source) },
      { label: 'clear', run: () => bench.clearPicks() },
    ],
    hint: 'A click picks a handle, back on the first closes the seam; a click on a seam takes it up again.',
  });
}

/** Where a corner stands on the plan. */
const pointOf = (corner: string | Point) => cornerPoint(corner, key => pickByKey(key)?.at);

/** What is wrong with the place being drawn, if anything. */
function warnings(bench: Bench): string[] {
  const { kind, corners, key } = bench.draft;
  const outline = corners.flatMap(corner => {
    const at = pointOf(corner);
    return at === undefined ? [] : [at];
  });
  return [
    ...(key === '' ? ['no key yet'] : []),
    ...(kind === 'spot' && corners.length !== 1 ? ['a spot is one corner'] : []),
    ...(kind === 'area' && corners.length < 3 ? ['an area needs three corners'] : []),
    ...(kind === 'area' && clockwise(outline) ? ['runs clockwise: reverse it'] : []),
    ...(outline.length < corners.length ? ['a handle is unknown'] : []),
  ];
}

function placeFlyout(bench: Bench) {
  const { draft } = bench;
  const field = (name: 'key' | 'title', label: string) => html`
    <label class="label" for=${`place-${name}`}>${label}</label>
    <input
      id=${`place-${name}`}
      class="span"
      .value=${draft[name]}
      @input=${(event: Event) => bench.setDraft({ [name]: valueOf(event) }, false)}
    >
  `;
  return laidOut('Place', {
    rows: html`
      <label class="label" for="place-load">Take up</label>
      <select
        id="place-load"
        class="span"
        @change=${(event: Event) => {
          const select = event.target as HTMLSelectElement;
          bench.loadPlace(select.value);
          select.value = '';
        }}
      >
        <option value="" selected>…</option>
        ${PLACE_KEYS.map(key => html`<option value=${key}>${PLACES[key].title}</option>`)}
      </select>
      ${field('key', 'Key')} ${field('title', 'Title')}
      <label class="label" for="place-where">Where</label>
      <textarea
        id="place-where"
        class="span"
        rows="2"
        .value=${draft.where}
        @input=${(event: Event) => bench.setDraft({ where: valueOf(event) }, false)}
      ></textarea>
      <label class="label" for="place-kind">Kind</label>
      <select
        id="place-kind"
        class="span"
        .value=${draft.kind}
        @change=${(event: Event) =>
          bench.setDraft({ kind: valueOf(event) === 'spot' ? 'spot' : 'area' }, true)}
      >
        <option value="area" ?selected=${draft.kind === 'area'}>area</option>
        <option value="spot" ?selected=${draft.kind === 'spot'}>spot</option>
      </select>
      <label class="label" for="place-level">Level</label>
      <input
        id="place-level"
        class="span"
        type="number"
        step="0.01"
        placeholder="on the ground"
        title="the height it lies at, where that is a floor and not the ground"
        .value=${draft.level === undefined ? '' : String(draft.level)}
        @change=${(event: Event) => {
          const value = valueOf(event);
          bench.setDraft(
            { level: value === '' || !Number.isFinite(Number(value)) ? undefined : Number(value) },
            true
          );
        }}
      >
    `,
    made: html`
      <ol class="list">
        ${draft.corners.map(
          (corner, index) => html`
            <li>
              <strong>${index + 1}</strong>
              <span>
                ${typeof corner === 'string' ? corner : `${corner[0].toFixed(2)}, ${corner[1].toFixed(2)}`}
              </span>
              <button
                type="button"
                title="take this corner away"
                @click=${() =>
                  bench.setDraft({ corners: draft.corners.filter((_, at) => at !== index) }, true)}
              >
                ×
              </button>
            </li>
          `
        )}
      </ol>
      ${draft.corners.length === 0 ? html`<p class="count">no corners set</p>` : nothing}
    `,
    problems: warnings(bench),
    actions: [
      {
        label: 'copy',
        title: 'copy as an entry of PLACES',
        run: () => bench.copy(placeSource(draft)),
      },
      {
        label: 'reverse',
        title: 'the corners the other way round',
        run: () => bench.setDraft({ corners: [...draft.corners].reverse() }, true),
      },
      { label: 'clear', run: () => bench.setDraft({ corners: [] }, true) },
    ],
    hint: 'A click on a handle makes it a corner, anywhere else sets one of its own; a click on a corner takes it away. ⌥ click takes up a place drawn, ⌫ the last corner.',
  });
}

/**
 * The options of the tool in hand, beside the strip, laid out as the panels
 * are - none for navigating, and folded away when its tool is clicked again.
 */
export function flyout(bench: Bench) {
  if (!bench.flyoutOpen) {
    return nothing;
  }
  const body =
    bench.tool === 'brush'
      ? brushFlyout(bench)
      : bench.tool === 'point'
        ? pointFlyout(bench)
        : bench.tool === 'seam'
          ? seamFlyout(bench)
          : bench.tool === 'place'
            ? placeFlyout(bench)
            : undefined;
  return body === undefined
    ? nothing
    : html`<aside id="flyout" aria-label="Tool options">${body}</aside>`;
}
