import { HousesScene } from '@kvlm/visualization';
import { html, nothing } from 'lit';

import { cardinal, heading, TOOLS } from '../editor.model.js';
import type { Bench } from './bench.js';

// The bar along the foot: what is under the pointer, how the view stands, and
// what is being worked out off the page's thread.

/** A number to so many places, a minus as one. */
const fixed = (value: number, places: number) => value.toFixed(places).replace('-', '−');

export function footer(bench: Bench) {
  const { cursor, camera, working } = bench;
  const looking = heading(camera.azimuth);
  const tool = TOOLS.find(({ value }) => value === bench.tool);
  return html`
    <footer id="status">
      <span class="cursor">
        ${
          cursor === undefined
            ? html`<span class="quiet">off the model</span>`
            : html`
                <span title="on the local grid, east and north of the mill">
                  ${fixed(cursor.at[0], 2)} E ${fixed(cursor.at[1], 2)} N
                </span>
                <span title="the ground's height in the scene, landfill and all">
                  ${fixed(cursor.level, 2)} m
                </span>
                <span title="above sea level">
                  ${fixed(cursor.level + HousesScene.baseElevation, 1)} m ü. NN
                </span>
                <span class="quiet">${cursor.surface}</span>
                ${
                  cursor.handle === undefined
                    ? nothing
                    : html`<span>#${cursor.handle.index + 1} ${cursor.handle.key}</span>`
                }
              `
        }
      </span>
      <span class="view">
        <span>${tool?.label}</span>
        <span>az ${Math.round(camera.azimuth)}°</span>
        <span>el ${Math.round(camera.elevation)}°</span>
        <span>${Math.round(camera.span)} m</span>
        <span>${Math.round(looking)}° ${cardinal(looking)}</span>
      </span>
      <span class="working" role="status">
        ${Object.entries(working).map(
          ([task, { share, step }]) => html`
            <span title=${`${task}: ${step}`}>
              ${task}: ${step}
              <progress max="1" .value=${share ?? null}></progress>
            </span>
          `
        )}
      </span>
    </footer>
  `;
}

/** Every key the editor listens to, and what it does. */
const KEYS: [keys: string, does: string][] = [
  ...TOOLS.map(({ key, label, title }): [string, string] => [
    key.toUpperCase(),
    `${label}: ${title}`,
  ]),
  ['tool key held', 'that tool for as long, and the one before back when let go'],
  ['click the tool in hand', 'folds its options away, and open again'],
  ['1 – 4', 'the brush’s mode: raise, lower, flatten, smooth'],
  ['⌘/Ctrl held', 'the brush lowers what it raised, and raises what it lowered'],
  ['⇧ held', 'the brush smooths'],
  ['Space held', 'a drag moves the view, whatever is in hand'],
  ['Esc', 'back to navigating, or closes this'],
  ['⌫', 'takes the place’s last corner away'],
  ['⌥ click', 'with the place tool, takes up a place drawn'],
  ['⌥ click a feature', 'shows it alone, and again the rest'],
  ['F', 'frames what the tool in hand has made'],
  ['⌘/Ctrl Z', 'undo'],
  ['⌘/Ctrl ⇧ Z', 'redo'],
  ['Right drag', 'turns the view'],
  ['Wheel', 'zooms'],
  ['?', 'this'],
];

/** The keys, laid over the editor until closed. */
export function shortcuts(close: () => void) {
  return html`
    <dialog id="shortcuts" open @close=${close}>
      <article>
        <header>
          <strong>Keys</strong>
          <button type="button" @click=${close}>close</button>
        </header>
        <dl>
          ${KEYS.map(
            ([keys, does]) =>
              html`<dt><kbd>${keys}</kbd></dt>
                <dd>${does}</dd>`
          )}
        </dl>
      </article>
    </dialog>
  `;
}
