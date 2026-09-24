import { html, isServer, LitElement, unsafeCSS } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

import styles from './scene.component.css?inline&lit';

/** What a baked view's header holds - see `PrefabHeader` in `@kvlm/visualization`. */
interface Header {
  version: 1;
  /** Seen from where its camera stands only, or from anywhere. */
  kind: 'still' | 'free';
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    /** What a free view turns around. */
    pivot: [number, number, number];
    /** How wide it sees, across, in degrees. */
    fov: number;
    near: number;
    far: number;
  };
  groups: {
    doubleSided: boolean;
    offset?: [number, number];
    renderOrder: number;
    vertices: number;
    indices: number;
  }[];
}

/** One group ready to be drawn: its buffers, how many indices, and how. */
interface Batch {
  vao: WebGLVertexArrayObject;
  count: number;
  type: number;
  offset?: [number, number];
  /** Whether its faces are seen from the front only, and culled from behind. */
  culled: boolean;
}

/**
 * How far a drag turns a free view, in degrees a pixel, and how a wheel notch
 * zooms it; how low it may go - never under the ground, whose faces are only
 * drawn from above - and how high, near and far.
 */
const ORBIT = { turn: 0.3, zoom: 0.0015, lowest: 2, highest: 89, nearest: 2, farthest: 900 };

// the colours come baked and in sRGB already, as the canvas takes them: the
// shader only places each corner and hands its colour through
const VERTEX = `#version 300 es
uniform mat4 transform;
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 color;
out vec3 shade;
void main() {
  shade = color;
  gl_Position = transform * vec4(position, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
in vec3 shade;
out vec4 pixel;
void main() {
  pixel = vec4(shade, 1.0);
}`;

const padded = (length: number) => Math.ceil(length / 4) * 4;

type Vec3 = [number, number, number];
const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Vec3): Vec3 => {
  const length = Math.hypot(...a) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};

/**
 * The camera's whole transform, column major as WebGL takes it: looking from
 * its position at its target, up being up, and a perspective as wide across
 * as the view was baked for - so a narrow canvas sees as far to either side,
 * and more above and below.
 */
function transformOf(
  {
    position,
    target,
    fov,
    near,
    far,
  }: Pick<Header['camera'], 'position' | 'target' | 'fov' | 'near' | 'far'>,
  aspect: number
) {
  const back = unit(minus(position, target));
  const right = unit(cross([0, 1, 0], back));
  const up = cross(back, right);
  const across = 1 / Math.tan((fov / 2) * (Math.PI / 180));
  const [x, y] = [across, across * aspect];
  const [a, b] = [(far + near) / (near - far), (2 * far * near) / (near - far)];
  // the projection's rows applied to the view's: the view turns the world to
  // the camera's axes and moves it by its position, the projection squeezes
  const view = [
    [...right, -dot(right, position)],
    [...up, -dot(up, position)],
    [...back, -dot(back, position)],
  ] as [number[], number[], number[]];
  const row = (k: number) => view[k] as number[];
  const rows = [
    row(0).map(value => value * x),
    row(1).map(value => value * y),
    row(2).map((value, column) => value * a + (column === 3 ? b : 0)),
    row(2).map(value => -value),
  ];
  return new Float32Array([0, 1, 2, 3].flatMap(column => rows.map(each => each[column] as number)));
}

/**
 * A view of the Lochmühle baked beforehand: nothing is modelled here, the
 * triangles come in one file as they are to be drawn - a handful of draw
 * calls, one shader of two lines, the light already in their colours - and
 * drawn with WebGL alone, no library to load first. It renders once, and
 * again only when its size changes: nothing in it moves.
 *
 * Without WebGL 2 the element stays empty and says why in an event.
 *
 * @fires kvlm-scene-rendered - Once it has first been drawn, with how long that took.
 * @fires kvlm-scene-failed - When it cannot be drawn.
 */
@customElement('kvlm-scene')
export class Scene extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  /** Where the baked view is loaded from. */
  @property({ type: String, reflect: true })
  src?: string;

  @query('canvas')
  private readonly canvas!: HTMLCanvasElement;

  #observer: ResizeObserver | undefined;
  #loaded: string | undefined;

  override updated(): void {
    if (!isServer && this.src !== undefined && this.src !== this.#loaded) {
      this.#loaded = this.src;
      void this.#show(this.src);
    }
  }

  /** Reads a baked view: its header, and the blocks after it as they lie. */
  static read(buffer: ArrayBuffer): { header: Header; offset: number } {
    if (new TextDecoder().decode(new Uint8Array(buffer, 0, 4)) !== 'KVLM') {
      throw new Error('not a baked view');
    }
    const length = new DataView(buffer).getUint32(4, true);
    const header = JSON.parse(
      new TextDecoder().decode(new Uint8Array(buffer, 8, length))
    ) as Header;
    return { header, offset: 8 + length };
  }

  async #show(src: string): Promise<void> {
    const started = performance.now();
    try {
      const gl = this.canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        // drawn once and left: nothing asks the browser to keep a copy
        preserveDrawingBuffer: false,
      });
      if (gl === null) {
        throw new Error('no WebGL 2');
      }
      // the shader is compiled while the view is still on its way
      const program = this.#program(gl);
      const response = await fetch(src);
      if (!response.ok || response.body === null) {
        throw new Error(`${src}: ${response.status}`);
      }
      // the file is gzipped as it was baked, and unpacked as it comes in
      const buffer = await new Response(
        response.body.pipeThrough(new DecompressionStream('gzip'))
      ).arrayBuffer();
      const { header, offset: start } = Scene.read(buffer);

      let offset = start;
      const batches = header.groups.map((group): Batch => {
        const values = group.vertices * 3;
        const positions = new Float32Array(buffer, offset, values);
        offset += values * 4;
        const colors = new Uint8Array(buffer, offset, values);
        offset += padded(values);
        const wide = group.vertices > 0xffff;
        const indices = wide
          ? new Uint32Array(buffer, offset, group.indices)
          : new Uint16Array(buffer, offset, group.indices);
        offset += padded(group.indices * indices.BYTES_PER_ELEMENT);
        // each index is written as the step from the one before, wrapping round
        for (let at = 1; at < indices.length; at += 1) {
          indices[at] = (indices[at] as number) + (indices[at - 1] as number);
        }

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const position = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, position);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        const color = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, color);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.UNSIGNED_BYTE, true, 0, 0);
        const index = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        return {
          vao,
          count: group.indices,
          type: wide ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
          ...(group.offset === undefined ? {} : { offset: group.offset }),
          culled: !group.doubleSided,
        };
      });

      const transform = gl.getUniformLocation(program, 'transform');
      // where the camera stands and looks: fixed for a still view, turned
      // round its pivot for a free one
      const camera = { ...header.camera };
      const size = { width: 1, height: 1 };
      const draw = () => {
        const ratio = Math.min(window.devicePixelRatio, 2);
        const [width, height] = [
          Math.max(1, Math.round(size.width * ratio)),
          Math.max(1, Math.round(size.height * ratio)),
        ];
        // resizing clears the canvas, so only when it changes
        if (this.canvas.width !== width || this.canvas.height !== height) {
          [this.canvas.width, this.canvas.height] = [width, height];
        }
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.enable(gl.DEPTH_TEST);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);
        gl.uniformMatrix4fv(transform, false, transformOf(camera, width / height));
        // a face seen from behind is never drawn: a still view's bake left
        // those out, a free one's has both sides of a face as faces of their
        // own - only what a still view draws on both sides is not culled
        batches.forEach(({ vao, count, type, offset: pulled, culled }) => {
          if (culled) {
            gl.enable(gl.CULL_FACE);
          } else {
            gl.disable(gl.CULL_FACE);
          }
          if (pulled === undefined) {
            gl.disable(gl.POLYGON_OFFSET_FILL);
          } else {
            gl.enable(gl.POLYGON_OFFSET_FILL);
            gl.polygonOffset(pulled[0], pulled[1]);
          }
          gl.bindVertexArray(vao);
          gl.drawElements(gl.TRIANGLES, count, type, 0);
        });
        gl.bindVertexArray(null);
      };
      const resize = (width: number, height: number) => {
        [size.width, size.height] = [Math.max(width, 1), Math.max(height, 1)];
        draw();
      };
      if (header.kind === 'free') {
        this.#orbit(camera, draw);
      }

      resize(this.clientWidth, this.clientHeight);
      this.dispatchEvent(
        new CustomEvent('kvlm-scene-rendered', {
          detail: {
            milliseconds: performance.now() - started,
            triangles: header.groups.reduce((sum, { indices }) => sum + indices / 3, 0),
            groups: header.groups.length,
          },
          bubbles: true,
        })
      );
      this.#observer?.disconnect();
      this.#observer = new ResizeObserver(([entry]) => {
        const [box] = entry?.contentBoxSize ?? [];
        resize(box?.inlineSize ?? this.clientWidth, box?.blockSize ?? this.clientHeight);
      });
      this.#observer.observe(this);
    } catch (error) {
      this.dispatchEvent(new CustomEvent('kvlm-scene-failed', { detail: error, bubbles: true }));
    }
  }

  /**
   * Lets a free view be turned round its pivot with a drag and brought nearer
   * or farther with the wheel - drawn again once a frame while it moves, and
   * not at all otherwise.
   */
  #orbit(camera: Header['camera'], draw: () => void): void {
    const { pivot } = camera;
    const from = minus(camera.position, pivot);
    let distance = Math.hypot(...from);
    let turn = Math.atan2(from[0], from[2]) * (180 / Math.PI);
    let lift = Math.asin(from[1] / distance) * (180 / Math.PI);
    let frame: number | undefined;
    const place = () => {
      const [t, l] = [turn * (Math.PI / 180), lift * (Math.PI / 180)];
      camera.position = [
        pivot[0] + distance * Math.cos(l) * Math.sin(t),
        pivot[1] + distance * Math.sin(l),
        pivot[2] + distance * Math.cos(l) * Math.cos(t),
      ];
      camera.target = pivot;
      frame ??= requestAnimationFrame(() => {
        frame = undefined;
        draw();
      });
    };
    place();
    // a drag here turns the view, never scrolls the page
    this.style.touchAction = 'none';
    let held: { x: number; y: number } | undefined;
    this.addEventListener('pointerdown', event => {
      held = { x: event.clientX, y: event.clientY };
      this.setPointerCapture(event.pointerId);
    });
    this.addEventListener('pointermove', event => {
      if (held === undefined) {
        return;
      }
      turn -= (event.clientX - held.x) * ORBIT.turn;
      lift = Math.min(
        ORBIT.highest,
        Math.max(ORBIT.lowest, lift + (event.clientY - held.y) * ORBIT.turn)
      );
      held = { x: event.clientX, y: event.clientY };
      place();
    });
    const release = () => (held = undefined);
    this.addEventListener('pointerup', release);
    this.addEventListener('pointercancel', release);
    this.addEventListener(
      'wheel',
      event => {
        event.preventDefault();
        distance = Math.min(
          ORBIT.farthest,
          Math.max(ORBIT.nearest, distance * Math.exp(event.deltaY * ORBIT.zoom))
        );
        place();
      },
      { passive: false }
    );
  }

  /** The one shader everything is drawn with. */
  #program(gl: WebGL2RenderingContext): WebGLProgram {
    const program = gl.createProgram();
    [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT],
    ].forEach(([type, source]) => {
      const shader = gl.createShader(type as number);
      if (shader === null) {
        throw new Error('no shader');
      }
      gl.shaderSource(shader, source as string);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    });
    gl.linkProgram(program);
    if (!(gl.getProgramParameter(program, gl.LINK_STATUS) as boolean)) {
      throw new Error(gl.getProgramInfoLog(program) ?? 'shader failed');
    }
    return program;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#loaded = undefined;
  }

  override render() {
    return html`<canvas role="img" aria-label="Die Lochmühle, von der Straße aus"></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-scene': Scene;
  }
}
