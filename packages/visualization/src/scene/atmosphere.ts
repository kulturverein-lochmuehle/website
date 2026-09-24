import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';

import type { Season } from '../models/terrain/trees.js';
import { random } from '../utils/geometry.utils.js';
import type { Palette } from './palette.js';

/**
 * What drifts through the air in a season, round what is looked at: leaves
 * coming down in autumn, tumbling and swaying as they go, and snow in winter,
 * slower and thicker. Spring and summer have none - spring's is on the ground,
 * the meadows' flowers. Each is a cloud of points that stands in the world,
 * not on the screen: every point has its own place on a grid of boxes laid
 * over the valley, and is drawn in the one box round the view's middle - so
 * moving the view moves past them, and at the box's edge a point steps round
 * to the other side, where the view is going. Fallen through, a point starts
 * again at the top.
 */
export const DRIFT = {
  // a leaf comes down swinging: to and fro in a plane of its own, like a
  // pendulum, dipping through the middle of each swing and lifting a little
  // at its ends - a swing every three seconds or so - and the wind carries it
  // along
  autumn: { count: 380, size: 0.1, fall: 1, sway: 0.9, spin: 2.2, wind: 0.5 },
  winter: { count: 5000, size: 0.025, fall: 0.6, sway: 0.35, spin: 0.7, wind: 0.15 },
} as const;

/** How far a swinging point lifts at the ends of its swing, as a share of the swing. */
export const LIFT = 0.25;

/**
 * How high the box reaches over and under the view's middle, and how wide it
 * is: the span looked at, rounded up to one of these, so a zoom re-scatters
 * the drift only when it steps from one to the next.
 */
export const BOX = { over: 30, under: 12, widths: [40, 80, 160, 320] };

type Drifting = keyof typeof DRIFT;

const drifts = (season: Season): season is Drifting => season in DRIFT;

/** A soft round dot, which a point is drawn as - a leaf as much as a flake from this far. */
function dot(): CanvasTexture {
  const size = 32;
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [size, size];
  const context = canvas.getContext('2d');
  if (context !== null) {
    const fade = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    fade.addColorStop(0, 'rgba(255, 255, 255, 1)');
    fade.addColorStop(0.6, 'rgba(255, 255, 255, 0.9)');
    fade.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = fade;
    context.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The season's drift: a cloud of points to add to the scene, and what moves it on. */
export class Atmosphere {
  readonly points: Points;
  #season: Season = 'summer';
  /** Each point's place in the box, nought to one each way, and its own phase. */
  #seeds: Float32Array = new Float32Array();
  #elapsed = 0;
  readonly #palette: Palette;

  constructor(palette: Palette) {
    this.#palette = palette;
    this.points = new Points(
      new BufferGeometry(),
      new PointsMaterial({
        map: dot(),
        size: 4,
        sizeAttenuation: false,
        transparent: true,
        depthWrite: false,
        vertexColors: true,
        fog: false,
      })
    );
    // each point its own size, as the drift's `driftSize` has it
    (this.points.material as PointsMaterial).onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float driftSize;')
        .replace('gl_PointSize = size;', 'gl_PointSize = size * driftSize;');
    };
    this.points.name = 'atmosphere';
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** Whether the drift is shown at all, whatever the season. */
  get shown(): boolean {
    return this.#shown;
  }

  set shown(shown: boolean) {
    this.#shown = shown;
    this.points.visible = shown && drifts(this.#season);
  }

  #shown = true;

  /** Whether anything drifts: then the scene has to be drawn frame by frame. */
  get moving(): boolean {
    return this.#shown && drifts(this.#season);
  }

  setSeason(season: Season): void {
    this.#season = season;
    this.points.visible = this.#shown && drifts(season);
    if (!drifts(season)) {
      return;
    }
    const { count } = DRIFT[season];
    const next = random(season === 'autumn' ? 1410 : 1411);
    this.#seeds = Float32Array.from({ length: count * 4 }, () => next());
    const colors = Array.from({ length: count }, (_, index) => {
      const pick = this.#seeds[index * 4 + 3] as number;
      const { autumnGold, autumnOrange, autumnRust, snow } = this.#palette;
      const color =
        season === 'winter'
          ? snow
          : pick < 0.4
            ? autumnGold
            : pick < 0.75
              ? autumnOrange
              : autumnRust;
      return new Color().copy(color).toArray();
    }).flat();
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3));
    // no two flakes, and no two leaves, the same size: half to one and a half
    geometry.setAttribute(
      'driftSize',
      new Float32BufferAttribute(
        Array.from({ length: count }, () => 0.5 + next()),
        1
      )
    );
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    this.points.geometry.dispose();
    this.points.geometry = geometry;
  }

  /**
   * Moves the drift on by a time, in seconds, round a middle and across a
   * span, and sizes it by how many pixels a meter is on screen: a leaf is a
   * leaf's size however far out the view is zoomed, and fades rather than
   * shrinking under a pixel.
   */
  tick(seconds: number, middle: Vector3, span: number, pixels: number): void {
    if (!drifts(this.#season)) {
      return;
    }
    this.#elapsed += seconds;
    const { fall, sway, spin, wind, size } = DRIFT[this.#season];
    const material = this.points.material as PointsMaterial;
    // seen from above without perspective every flake is as far as any other:
    // under two pixels it is kept at two, or a zoomed out view shows none
    material.size = Math.max(size * pixels, 2);
    material.opacity = Math.min(0.55 + size * pixels * 0.3, 1);
    const wide = BOX.widths.find(width => width >= span) ?? (BOX.widths.at(-1) as number);
    const high = BOX.over + BOX.under;
    // the world place in the box round the middle: the nearest of the copies
    // of the point that stand a box apart
    const round = (at: number, centre: number) => at - wide * Math.round((at - centre) / wide);
    const position = this.points.geometry.getAttribute('position') as Float32BufferAttribute;
    const seeds = this.#seeds;
    for (let index = 0; index < position.count; index += 1) {
      const [u, v, w, phase] = [0, 1, 2, 3].map(k => seeds[index * 4 + k] as number) as [
        number,
        number,
        number,
        number,
      ];
      // each falls at its own pace, and starts over at the top once through
      const pace = fall * (0.7 + phase * 0.6);
      const down = (((v - (this.#elapsed * pace) / high) % 1) + 1) % 1;
      // to and fro in its own plane, dipping through each swing's middle
      const turn = this.#elapsed * spin + phase * Math.PI * 2;
      const swing = Math.sin(turn) * sway;
      const plane = phase * 37.7;
      position.setXYZ(
        index,
        round(u * wide + Math.cos(plane) * swing + this.#elapsed * wind, middle.x),
        middle.y - BOX.under + down * high + Math.cos(2 * turn) * sway * LIFT,
        round(w * wide + Math.sin(plane) * swing, middle.z)
      );
    }
    position.needsUpdate = true;
  }
}
