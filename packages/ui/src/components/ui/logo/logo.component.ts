import type { PropertyValues } from 'lit';
import { html, LitElement, nothing, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import styles from './logo.component.css?inline&lit';

/**
 * The brook's course: a line down its middle, from its source to its mouth,
 * worked out off the two banks of its outline - which keeps an even width of
 * 5.15 along it. The brook is drawn as a stroke along this, kept to the
 * banks, and the fill as the same stroke over it - one shape in two colours,
 * the fill run down it rather than swept across.
 */
const COURSE =
  'M0.1 33.4 0.3 33.2 0.9 32.8 2.0 32.6 3.4 33.5 5.4 35.2 8.2 36.4 11.2 36.7 13.8 36.4 16.1 35.8 18.2 35.2 20.1 34.7 21.9 34.6 23.6 34.7 25.1 35.3 26.9 36.3 28.9 37.5 31.0 38.7 33.2 39.6 35.4 40.5 37.7 41.3 40.0 41.9 42.3 42.4 44.6 42.8 46.9 43.1 49.3 43.3 51.6 43.4 54.0 43.3 56.4 43.2 58.8 42.8 61.2 42.4 63.5 41.8 65.8 41.0 68.1 40.1 70.3 38.8 72.4 37.3 74.3 35.4 75.8 33.4 77.1 31.1 78.0 28.7 78.6 26.4 79.0 24.6 79.7 23.4 80.8 22.6 82.2 22.1 83.9 21.9 85.8 21.9 87.7 22.2 89.6 22.8 91.5 23.5 93.6 24.4 95.8 25.3 98.1 26.0 100.6 26.5 103.3 26.6 106.2 26.1 108.8 24.7 110.8 22.7 112.4 20.6 113.5 18.4 114.4 16.3 115.3 14.3 116.2 12.5 117.2 10.9 118.3 9.7 119.5 8.9 121.0 8.5 122.5 8.5 124.0 9.0 125.4 9.8 127.4 11.1 130.3 12.5 132.9 12.6 135.0 12.1 137.0 11.7 139.1 11.4 141.2 11.3 143.3 11.2 145.4 11.3 147.5 11.5 149.6 11.9 151.7 12.3 153.7 12.9 155.7 13.5 157.7 14.3 159.8 15.1 161.8 16.0 163.9 16.9 165.8 17.8 167.9 18.7 170.0 19.7 172.1 20.6 174.2 21.4 176.4 22.2 178.6 23.0 180.8 23.6 183.1 24.2 185.4 24.7 187.7 25.2 190.0 25.6 192.3 25.9 194.6 26.1 196.9 26.2 199.3 26.3 201.7 26.3 204.2 26.1 207.0 25.3 209.4 23.6 211.1 21.8 212.4 20.4 213.7 19.4 215.3 18.7 217.0 18.2 219.0 18.0 221.2 17.9 223.4 17.9 225.6 17.9 227.8 18.0 230.0 18.1 232.1 18.3 234.3 18.5 236.6 18.7 239.2 18.8 242.0 18.3 244.2 17.8 245.4 18.1 245.9 18.8 246.2 19.6';

/** As long as the fill takes to fade once it is no longer reporting anything. */
const FADE = 400;

/**
 * @cssprop --kvlm-logo-brook-color - Color of the brook
 * @cssprop --kvlm-logo-typo-color - Color of the typo
 */
@customElement('kvlm-logo')
export class Logo extends LitElement {
  static override readonly styles = styles;

  /**
   * How far something has come, in percent. The brook fills with the colour of
   * the typography along its course to say so, and says nothing while unset.
   */
  @property({ reflect: true, type: Number })
  loaded?: number | null;

  /**
   * The loader alone: the brook without the typography, to fill by `loaded`
   * on its own.
   */
  @property({ reflect: true, type: Boolean, attribute: 'loaded-only' })
  loadedOnly = false;

  /**
   * Where the fill stood when it stopped reporting. It stays there and fades,
   * rather than draining back the way it came.
   */
  #held: number | undefined;
  #fadeTimeout?: ReturnType<typeof setTimeout>;

  /** What is on screen, and whether the next mark is behind it. */
  #shown = 0;
  #backwards = false;

  override willUpdate(changed: PropertyValues<this>) {
    if (changed.has('loaded')) {
      clearTimeout(this.#fadeTimeout);

      // removing the attribute leaves the property at `null`, not `undefined`
      if (this.loaded != null) {
        this.#held = undefined;
      } else {
        // nothing is reported any more: hold the last mark until it has faded,
        // then let it fall back while it cannot be seen doing so
        this.#held = changed.get('loaded') ?? undefined;
        this.#fadeTimeout = setTimeout(() => {
          this.#held = undefined;
          this.requestUpdate();
        }, FADE);
      }
    }

    // the brook never runs backwards. A mark behind the one on screen - a
    // second navigation starting while the first is still filling, or the reset
    // after a fade - is put there in one frame instead of draining to it
    const percent = this.loaded ?? this.#held ?? 0;
    this.#backwards = percent < this.#shown;
    this.#shown = percent;
  }

  override disconnectedCallback() {
    clearTimeout(this.#fadeTimeout);
    super.disconnectedCallback();
  }

  override render() {
    // a percentage on the outside, a factor to scale the clip by on the inside
    const percent = this.loaded ?? this.#held;
    const loaded = percent == null ? undefined : Math.min(1, Math.max(0, percent / 100));
    const filling = this.loaded != null;
    const fading = !filling && this.#held !== undefined;
    const backwards = this.#backwards;

    return html`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="${this.loadedOnly ? '0 4 246.2 42.1' : '0 0 246.2 46.1'}"
        preserveAspectRatio="xMidYMid meet"
        class="${classMap({ filling, fading, backwards })}"
        style="${styleMap({ '---kvlm-logo-loaded': loaded?.toString() })}"
      >
        <defs>
          <path
            id="brook"
            d="M52.2 46c-9.8 0-20.3-2.8-27.8-8.2-1.7-1.3-3.9-.7-7.3.4-4.9 1.5-11.6 3.5-17.1-4.9l4.3-2.8c3.2 5 6.1 4.3 11.3 2.7 3.7-1.1 7.9-2.4 11.8.4A43.5 43.5 0 0 0 66 38.3c6-2.7 9.5-7.1 10.2-13.2a6.2 6.2 0 0 1 3.2-4.8c4.1-2.3 10.7-.4 13.1.8 5.7 2.9 10.1 3.8 13.1 2.7 3.4-1.2 5-5.1 6.6-8.8 1.6-3.7 3.2-7.4 6.6-8.8a8.8 8.8 0 0 1 6.9.6 9.6 9.6 0 0 1 3.5 3.1l.8.9c15.5-5 25.7-.5 36.4 4.4a74.3 74.3 0 0 0 37 8.5c3 0 3.8-1 5.1-2.8 1.6-2.3 4-5.3 10.6-5.5a106.3 106.3 0 0 1 16.6.6c3.5.5 4.5.6 8.6-1l1.9 4.7c-5 2-7 2-11.1 1.5a101.2 101.2 0 0 0-15.8-.6c-4.2 0-5.3 1.4-6.6 3.3-1.5 2-3.6 4.8-9 5-18 .7-29.4-4.4-39.4-9-10.8-4.8-19.3-8.7-33-4.1-3.2 1-5.1-1.4-6.1-2.7a5.7 5.7 0 0 0-1.6-1.6 4 4 0 0 0-3-.4c-1.3.5-2.5 3.2-3.7 5.9-1.8 4.3-4 9.6-9.5 11.6-4.4 1.7-10 .7-17.2-2.9-2-1-6.6-1.9-8.4-.9a1 1 0 0 0-.5 1A21 21 0 0 1 68 43a39.5 39.5 0 0 1-15.9 3Z"
          />
          <clipPath id="banks">
            <use href="#brook" />
          </clipPath>
        </defs>

        <path class="brook" d=${COURSE} clip-path="url(#banks)" />
        <path class="brook--loaded" d=${COURSE} pathLength="100" clip-path="url(#banks)" />
        ${
          this.loadedOnly
            ? nothing
            : svg`
        <path d="M7.8 0h5.1v7l4.2-7h6l-5.5 8.5 6 10.1h-6l-4.6-8v8H7.7Z" />
        <path
          d="M36.7 19.1a9.3 9.3 0 0 1-3.2-.5 7.4 7.4 0 0 1-2.5-1.5 6.7 6.7 0 0 1-1.6-2.3 7.9 7.9 0 0 1-.6-3.2V0h5.1v11.9a2.8 2.8 0 0 0 .2 1.2 2.2 2.2 0 0 0 .6.8 2.6 2.6 0 0 0 1 .4 3.5 3.5 0 0 0 2 0 2.5 2.5 0 0 0 .8-.4 2.2 2.2 0 0 0 .6-.8 2.8 2.8 0 0 0 .3-1.2V0h5.1v11.6a8 8 0 0 1-.6 3.2 6.8 6.8 0 0 1-1.6 2.3 7.4 7.4 0 0 1-2.5 1.5 9.3 9.3 0 0 1-3.1.5Z"
        />
        <path d="M52.3 0h5.2v14h6l-.6 4.6H52.3Z" />
        <path d="M72.2 4.7h-3.8l.5-4.7h11.9l.5 4.7h-3.9v14h-5.2Z" />
        <path
          d="M94.4 19.1a9.3 9.3 0 0 1-3.2-.5 7.4 7.4 0 0 1-2.5-1.5 6.7 6.7 0 0 1-1.6-2.3 7.9 7.9 0 0 1-.6-3.2V0h5.1v11.9a2.8 2.8 0 0 0 .3 1.2 2.2 2.2 0 0 0 .6.8 2.6 2.6 0 0 0 .8.4 3.5 3.5 0 0 0 2 0 2.5 2.5 0 0 0 1-.4 2.2 2.2 0 0 0 .6-.8 2.8 2.8 0 0 0 .2-1.2V0h5.2v11.6a8 8 0 0 1-.6 3.2A6.8 6.8 0 0 1 100 17a7.4 7.4 0 0 1-2.5 1.5 9.2 9.2 0 0 1-3.1.5Z"
        />
        <path d="M129.2 0h5.4l2.7 10.9L140 0h5.5l-5.2 18.6h-5.8Z" />
        <path d="M150.5 0h11.1l.5 4.7h-6.4V7h5.7v4.4h-5.7V14h6.4l-.5 4.6h-11.1Z" />
        <path d="M190.3 0h11.2l.5 4.7h-6.5V7h5.7v4.4h-5.7V14h6.5l-.5 4.6h-11.2Z" />
        <path d="M209.7 0h5.2v18.6h-5.2Z" />
        <path d="M222.7 0h4.6l6 8.8V0h5.2v18.6h-4.7l-5.9-8.8v8.8h-5.2Z" />
        <path d="M7.8 26.4h5.1v14h6l-.5 4.6H7.8Z" />
        <path
          d="M33.9 45.5a9.8 9.8 0 0 1-4-.7 9.6 9.6 0 0 1-5.1-5.3 10.3 10.3 0 0 1 0-7.6 9.6 9.6 0 0 1 5.1-5.3 10.4 10.4 0 0 1 8 0 9.5 9.5 0 0 1 5 5.3 10.3 10.3 0 0 1 0 7.6 9.5 9.5 0 0 1-5 5.2 9.8 9.8 0 0 1-4 .8Zm0-4.6a4.5 4.5 0 0 0 1.8-.4 4.5 4.5 0 0 0 1.5-1 4.8 4.8 0 0 0 1-1.7 6.4 6.4 0 0 0 0-4.2 4.8 4.8 0 0 0-1-1.7 4.6 4.6 0 0 0-1.5-1 4.6 4.6 0 0 0-3.6 0 4.6 4.6 0 0 0-1.5 1 4.8 4.8 0 0 0-1 1.7 6.4 6.4 0 0 0 0 4.2 4.8 4.8 0 0 0 1 1.7 4.6 4.6 0 0 0 1.5 1 4.4 4.4 0 0 0 1.8.4Z"
        />
        <path
          d="M58.7 45.5a10.3 10.3 0 0 1-4-.7 9.2 9.2 0 0 1-5-5.2 11 11 0 0 1 0-7.8 9.2 9.2 0 0 1 5-5.2 10.3 10.3 0 0 1 4-.7 11.8 11.8 0 0 1 3.5.5 7.3 7.3 0 0 1 3 1.8l-2.6 4.4a6 6 0 0 0-1.9-1.6 4.6 4.6 0 0 0-3.8-.1 4.7 4.7 0 0 0-1.5 1 4.9 4.9 0 0 0-1 1.7 6.4 6.4 0 0 0 0 4.2 4.9 4.9 0 0 0 1 1.7 4.6 4.6 0 0 0 1.5 1 4.5 4.5 0 0 0 1.8.4 4.1 4.1 0 0 0 2.1-.6 5.5 5.5 0 0 0 1.8-1.8l2.8 4.2a6.2 6.2 0 0 1-2.7 2 10.3 10.3 0 0 1-4 .8Z"
        />
        <path d="M70.6 26.4h5.2V33h5.7v-6.7h5.2V45h-5.2v-7.2h-5.7V45h-5.2Z" />
        <path d="M94.4 26.4h5.2l4.6 7.2 4.7-7.2h5.2V45h-5.2v-9.6l-4.7 6.5-4.6-6.5V45h-5.2Z" />
        <path
          d="M129.7 45.5a9.2 9.2 0 0 1-3.1-.5 7.3 7.3 0 0 1-2.5-1.5 6.7 6.7 0 0 1-1.7-2.3 7.9 7.9 0 0 1-.6-3.2V26.4h5.2v11.9a2.9 2.9 0 0 0 .2 1.2 2.2 2.2 0 0 0 .6.8 2.6 2.6 0 0 0 .9.4 3.5 3.5 0 0 0 2 0 2.6 2.6 0 0 0 1-.4 2.2 2.2 0 0 0 .5-.8 2.8 2.8 0 0 0 .2-1.2v-12h5.2V38a7.9 7.9 0 0 1-.6 3.2 6.8 6.8 0 0 1-1.6 2.3 7.3 7.3 0 0 1-2.5 1.5 9.2 9.2 0 0 1-3.2.5Zm-5.4-24.8h4.1v4.1h-4.1Zm6.7 0h4.2v4.1H131Z"
        />
        <path d="M145.4 26.4h5.1V33h5.7v-6.7h5.2V45h-5.2v-7.2h-5.7V45h-5.1Z" />
        <path d="M169.2 26.4h5.2v14h6l-.6 4.6h-10.6Z" />
        <path d="M188 26.4h11.2l.5 4.6h-6.5v2.4h5.7v4.4h-5.7v2.6h6.5l-.5 4.6H188Z" />
        <path
          d="M110 0h7.3a7.4 7.4 0 0 1 2.5.4 6.1 6.1 0 0 1 2 1.2 5.6 5.6 0 0 1 1.4 1.9 6.3 6.3 0 0 1 .2 4.3 4.5 4.5 0 0 1-.7 1.4 4.7 4.7 0 0 1-1 1 7.9 7.9 0 0 1-1.3.7l4.9 7.7h-6l-4-7h-.1v7H110Zm6.2 7.8a3 3 0 0 0 1.7-.5 1.8 1.8 0 0 0 0-2.8 3 3 0 0 0-1.7-.4h-1v3.7Z"
        />
        <path
          d="M169.9 0h7.2a7.4 7.4 0 0 1 2.6.4 6.1 6.1 0 0 1 2 1.2 5.7 5.7 0 0 1 1.4 1.9 6.3 6.3 0 0 1 .2 4.3 4.5 4.5 0 0 1-.7 1.4 4.7 4.7 0 0 1-1 1 7.8 7.8 0 0 1-1.3.7l4.9 7.7h-6l-4-7h-.1v7h-5.2Zm6.2 7.8a3 3 0 0 0 1.7-.5 1.5 1.5 0 0 0 .6-1.4 1.5 1.5 0 0 0-.6-1.4 3 3 0 0 0-1.7-.4h-1v3.7Z"
        />
        `
        }
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-logo': Logo;
  }
}
