import type { EventTypeKey, Season } from '@kvlm/visualization';
import { DECORATIONS, EVENT_TYPE_KEYS, EVENT_TYPES, VIEWS } from '@kvlm/visualization';
import type { TemplateResult } from 'lit';
import { html, nothing, svg } from 'lit';

import type { PanelKey, Switch } from '../editor.model.js';
import {
  cardinal,
  clock,
  CONTROLS,
  FEATURES,
  FIRES,
  heading,
  PANELS,
  PUT_UP,
  ROOM_LIGHTS,
  SEASONS,
  SWITCHES,
} from '../editor.model.js';
import type { Bench } from './bench.js';
import { checkedOf, valueOf } from './bench.js';

// The panels down the right: the view, the features shown, the season and
// what is put up for it, and the lights - each folded away on its own.

/** The compass: which way the view looks, north on it wherever north is on the screen. */
function compass(bench: Bench) {
  const looking = heading(bench.camera.azimuth);
  return html`
    <button
      id="compass"
      type="button"
      title="turn the view to look north"
      @click=${() => bench.setCamera('azimuth', 180)}
    >
      <svg viewBox="-50 -50 100 100" aria-hidden="true">
        <circle r="46" />
        <g transform=${`rotate(${-looking})`}>
          <path class="north" d="M0 -26 L6 0 L-6 0 Z" />
          <path class="south" d="M0 26 L6 0 L-6 0 Z" />
          ${(['N', 'E', 'S', 'W'] as const).map(
            (letter, index) => svg`
              <text transform=${`rotate(${index * 90}) translate(0 -37) rotate(${looking - index * 90})`}>
                ${letter}
              </text>
            `
          )}
        </g>
      </svg>
      <output>${Math.round(looking)}° ${cardinal(looking)}</output>
    </button>
  `;
}

function viewPanel(bench: Bench) {
  const [east, north] = bench.center ?? [undefined, undefined];
  const baking =
    bench.preview !== undefined && 'baking' in bench.preview ? bench.preview : undefined;
  return html`
    <div class="view">
      ${compass(bench)}
      <div class="rows">
        ${CONTROLS.map(
          ({ property, label, min, max }) => html`
            <label for=${property}>${label}</label>
            <input
              id=${property}
              type="range"
              min=${min}
              max=${max}
              step="1"
              .value=${String(Math.round(bench.camera[property]))}
              @input=${(event: Event) => bench.setCamera(property, Number(valueOf(event)))}
            >
            <output for=${property}>${Math.round(bench.camera[property])}</output>
          `
        )}
      </div>
    </div>
    <p class="readout">
      centred on
      ${east === undefined ? 'the yard' : `${east.toFixed(1)} E, ${(north ?? 0).toFixed(1)} N`}
    </p>
    <div class="rows">
      <label for="go-to">Go to</label>
      <select
        id="go-to"
        title="a view baked for the site: its camera, its season, its hour and what is put up for it"
        @change=${(event: Event) => {
          const select = event.target as HTMLSelectElement;
          bench.goTo(select.value);
          select.value = '';
        }}
      >
        <option value="" selected>…</option>
        ${Object.entries(VIEWS).map(([name, view]) => html`<option value=${name}>${view.title}</option>`)}
      </select>
    </div>
    <button
      class="wide"
      type="button"
      title="bake this view as the site's views are baked, and show it as the site does - the strings and fires are as the views have them"
      ?disabled=${baking !== undefined}
      @click=${() => bench.bakePreview()}
    >
      ${baking === undefined ? 'Preview bake' : `Baking ${Math.round(baking.share * 100)}%`}
    </button>
    ${
      baking === undefined
        ? nothing
        : html`<progress max="1" .value=${baking.share}></progress>
            <small class="readout">${baking.stage}</small>`
    }
  `;
}

function featuresPanel(bench: Bench) {
  return html`
    <div class="checks" title="⌥ click shows that one alone, and again brings the rest back">
      ${FEATURES.map(
        ({ property, label }) => html`
          <label>
            <input
              type="checkbox"
              .checked=${bench.layers[property]}
              @click=${(event: MouseEvent) => {
                // a solo is the click's, not the box's own toggle
                if (event.altKey) {
                  event.preventDefault();
                  bench.setLayer(property, true, true);
                }
              }}
              @change=${(event: Event) => bench.setLayer(property, checkedOf(event), false)}
            >
            ${label}
          </label>
        `
      )}
    </div>
  `;
}

/** Ticks for what is put up, each by what it is; its tag, what the source calls it, on hover. */
const decorationChecks = (bench: Bench, tags: readonly string[]) => html`
  <div class="checks single">
    ${tags.map(
      tag => html`
        <label title=${`${DECORATIONS[tag as keyof typeof DECORATIONS]} (${tag})`}>
          <input
            type="checkbox"
            .checked=${bench.decorations.includes(tag)}
            @change=${(event: Event) => bench.setDecoration(tag, checkedOf(event))}
          >
          ${DECORATIONS[tag as keyof typeof DECORATIONS]}
        </label>
      `
    )}
  </div>
`;

function seasonPanel(bench: Bench) {
  return html`
    <div class="rows">
      <label for="event">Event</label>
      <select
        id="event"
        title="set up as an event's view is baked: its season, start and decorations"
        @change=${(event: Event) => {
          const select = event.target as HTMLSelectElement;
          bench.setEvent(select.value as EventTypeKey);
          // a pick, not a state: the same one can be picked again
          select.value = '';
        }}
      >
        <option value="" selected>…</option>
        ${EVENT_TYPE_KEYS.map(type => html`<option value=${type}>${EVENT_TYPES[type].title}</option>`)}
      </select>
      <label for="season">Season</label>
      <select
        id="season"
        .value=${bench.season}
        @change=${(event: Event) => bench.setSky(valueOf(event) as Season, bench.hour)}
      >
        ${SEASONS.map(
          ({ value, label }) =>
            html`<option value=${value} ?selected=${value === bench.season}>${label}</option>`
        )}
      </select>
      <label for="hour">Time</label>
      <span class="slider">
        <input
          id="hour"
          type="range"
          min="0"
          max="1439"
          step="1"
          .value=${String(Math.round((bench.hour ?? 12) * 60))}
          @input=${(event: Event) => bench.setSky(bench.season, Number(valueOf(event)) / 60)}
        >
        <output for="hour">${clock(bench.hour)}</output>
      </span>
      <label for="moon">Moon</label>
      <span class="slider">
        <input
          id="moon"
          type="range"
          min="0"
          max="1"
          step="0.05"
          title="how much moon there is at night: new moon to full"
          .value=${String(bench.moon)}
          @input=${(event: Event) => bench.set({ moon: Number(valueOf(event)) })}
        >
        <output for="moon">${Math.round(bench.moon * 100)}%</output>
      </span>
    </div>
    <h3>Put up</h3>
    ${decorationChecks(bench, PUT_UP)}
  `;
}

/** A light's three ways: left to the hour, or switched on or off by hand. */
function switchOf(label: string, value: Switch, title: string, set: (value: Switch) => void) {
  return html`
    <span class="label" title=${title}>${label}</span>
    <span class="segments" role="group" aria-label=${label}>
      ${SWITCHES.map(
        one => html`
          <button type="button" aria-pressed=${String(value === one)} @click=${() => set(one)}>
            ${one}
          </button>
        `
      )}
    </span>
  `;
}

function lightsPanel(bench: Bench) {
  const burning = FIRES.some(tag => bench.decorations.includes(tag));
  return html`
    <div class="rows">
      ${switchOf('Windows', bench.windows, 'the houses’ windows, and the pavilion’s', windows =>
        bench.set({ windows })
      )}
      ${switchOf('Lanterns', bench.lanterns, 'the street lamps', lanterns => bench.set({ lanterns }))}
      ${switchOf('Strings', bench.strings, 'the strings of lights, where they are up', strings =>
        bench.set({ strings })
      )}
    </div>
    <div class="checks">
      <label title=${burning ? 'whether the fires laid burn' : 'no fire is laid'}>
        <input
          type="checkbox"
          .checked=${bench.fires}
          ?disabled=${!burning}
          @change=${(event: Event) => bench.set({ fires: checkedOf(event) })}
        >
        Fires burning
      </label>
      <button
        type="button"
        title="send a car along the road, down it or up - a random one"
        @click=${() => bench.sendCar()}
      >
        Send a car
      </button>
    </div>
    <h3>Rooms</h3>
    ${decorationChecks(bench, ROOM_LIGHTS)}
  `;
}

const BODIES: Record<PanelKey, (bench: Bench) => TemplateResult> = {
  view: viewPanel,
  features: featuresPanel,
  season: seasonPanel,
  lights: lightsPanel,
};

/** The panels down the right, each folded open or shut as it was left. */
export function dock(bench: Bench) {
  return PANELS.map(
    ({ key, label }) => html`
      <details
        class="panel"
        ?open=${bench.open[key]}
        @toggle=${(event: Event) => bench.setOpen(key, (event.target as HTMLDetailsElement).open)}
      >
        <summary>${label}</summary>
        <div class="body">${BODIES[key](bench)}</div>
      </details>
    `
  );
}
