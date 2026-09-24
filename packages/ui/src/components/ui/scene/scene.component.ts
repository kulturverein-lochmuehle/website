import '../logo/logo.component.js';

import { html, isServer, LitElement, nothing, unsafeCSS } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import styles from './scene.component.css?inline&lit';

/** What a baked view's header holds - see `PrefabHeader` in `@kvlm/visualization`. */
interface Header {
  version: 2 | 3 | 4;
  /** The grid the positions are written on: its least corner, and a step each way. */
  grid: { origin: Vec3; step: Vec3 };
  /** Seen from where its camera stands, from along a path, or from anywhere. */
  kind: 'still' | 'path' | 'free';
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    /** What a free view turns around. */
    pivot: [number, number, number];
    /** Where a path view's camera is along its way, a step a meter. */
    path?: { position: [number, number, number]; target: [number, number, number] }[];
    /** Whether the way closes on itself, to be flown round and round. */
    loop?: boolean;
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
    /** Lit by the lamps off the lightmap: an albedo a corner follows its colours. */
    mapped?: boolean;
    /** Laid over what is under it, drawn in its turn without hiding anything by its depth. */
    decal?: boolean;
    /** Lit by a fire: a byte a corner follows, the fire's share of its light, to flicker. */
    fire?: boolean;
    /** A fire's tongues: the middle of its foot and how high they reach, to sway. */
    flame?: [number, number, number, number];
    /** A car written at the origin, nose to +x: put on the road by its pose, and moved. */
    vehicle?: { id: string; behind: number; ahead: number; steer?: Vec3 };
  }[];
  /** The cars that drive the road: the ways they take, one for each direction, their pace, and the seconds between two cars. */
  vehicles?: {
    routes: Vec3[][];
    /** At night: where each car's headlamps are, and the cone they throw. */
    lamps?: {
      cars: Record<string, { nose: number; apart: number }>;
      height: number;
      reach: number;
      angle: number;
      penumbra: number;
      dip: number;
      baked: number;
    };
    speed: number;
    every: [number, number];
    /** Each car's length and width, to lay its shadow under it. */
    sizes?: Record<string, { length: number; width: number }>;
    /** In the snow, the tracks the cars leave: see `PrefabHeader` in `@kvlm/visualization`. */
    marks?: { tilts: number[][]; tint: Vec3; tyre: number; life: number };
  };
  /** The lamps' light and the sun's shadows on the ground, a grid seen from above: see `PrefabHeader` in `@kvlm/visualization`. */
  lightmap?: {
    origin: [number, number];
    cell: number;
    width: number;
    depth: number;
    /** Three bytes a cell - the lamps' warm and orange, and the sun's - or the sun's alone; four where a fire burns: its light apart, to flicker. */
    channels: 1 | 3 | 4;
    most: number;
    warm: Vec3;
    orange: Vec3;
    /** The share of the sun's light a shadow takes, and the way towards the sun. */
    sun: Vec3;
    toward: Vec3;
  };
  /** What drifts through the air: autumn's leaves, winter's snow. */
  drift?: {
    count: number;
    size: number;
    fall: number;
    sway: number;
    spin: number;
    wind: number;
    colors: Vec3[];
  };
  /** The season's sky behind it and the haze in it, from views baked with one. */
  sky?: {
    zenith: Vec3;
    horizon: Vec3;
    sun: Vec3;
    sunColor: Vec3;
    hazeReach: number;
    hazeMost: number;
    /** The clouds: how much of the sky they cover, and their colours lit and underneath, in sRGB. */
    clouds?: { cover: number; lit: Vec3; shade: Vec3 };
  };
}

/** One group ready to be drawn: its buffers, how many indices, and how. */
interface Batch {
  vao: WebGLVertexArrayObject;
  /** What it holds on the card, given back when another view takes its place. */
  buffers: WebGLBuffer[];
  count: number;
  type: number;
  offset?: [number, number];
  /** Whether its faces are seen from the front only, and culled from behind. */
  culled: boolean;
  /** Whether it is drawn over what is under it without writing its depth. */
  decal: boolean;
  /** Whether it takes the lamps' light off the lightmap. */
  mapped: boolean;
  /** A fire's tongues, swayed round its foot. */
  flame?: [number, number, number, number];
  /** A car's: which, and where its axles are, from its middle. */
  vehicle?: { id: string; behind: number; ahead: number; steer?: Vec3 };
}

/**
 * How far a drag turns a free view, in degrees a pixel, and how a wheel notch
 * zooms it; how low it may go - never under the ground, whose faces are only
 * drawn from above - and how high, near and far.
 */
const ORBIT = { turn: 0.3, zoom: 0.0015, lowest: 2, highest: 89, nearest: 2, farthest: 900 };

// the colours come baked and in sRGB already, as the canvas takes them: the
// shader only places each corner and hands its colour through, faded into the
// haze by how far off it is - the way the model's scene fades it (`hazeAt`).
// A fire's tongues are the one thing that moves: taller and shorter as its
// light flickers, and swaying round its foot the more the higher up
const VERTEX = `#version 300 es
uniform mat4 transform;
uniform bool flame;
uniform mat4 model;
uniform vec4 flameAt;
uniform float flicker;
uniform float time;
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 color;
layout(location = 2) in vec3 albedo;
layout(location = 3) in float fireShare;
out vec3 shade;
out vec3 under;
out vec3 place;
out float share;
void main() {
  vec3 at = (model * vec4(position, 1.0)).xyz;
  if (flame) {
    vec3 off = at - flameAt.xyz;
    float up = clamp(off.y / flameAt.w, 0.0, 1.0);
    float phase = flameAt.x * 1.7 + flameAt.z * 2.3;
    off.y *= 1.0 + (flicker - 1.0) * 1.6;
    off.xz *= 1.0 - 0.12 * up * sin(time * 9.0 + phase);
    off.xz += 0.05 * up * up * vec2(sin(time * 3.1 + phase), cos(time * 2.3 + phase * 1.3));
    at = flameAt.xyz + off;
  }
  shade = color;
  under = albedo;
  place = at;
  share = fireShare;
  gl_Position = transform * vec4(at, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 eye;
uniform vec3 haze;
uniform float hazeReach;
uniform float hazeMost;
// the lamps' light and the sun's shadows off the lightmap, for the faces that take it
uniform bool mapped;
uniform sampler2D lightmap;
uniform vec4 mapArea;
uniform float mapMost;
uniform vec3 lampWarm;
uniform vec3 lampOrange;
uniform vec3 sunLit;
uniform bool sunOnly;
// the fires' light, a channel of their own where one burns, and how bright they are just now
uniform bool fires;
uniform float flicker;
uniform vec3 toward;
// a car's headlamps at night: two, where they are, which way they point, the
// cone's cosines - outside and inside - and its reach and strength; a car is not lit by its own
uniform int lampCount;
uniform vec3 lampAt[2];
uniform vec3 lampDir;
uniform vec3 lampColor;
uniform vec4 lampCone;
uniform bool car;
in vec3 shade;
in vec3 under;
in vec3 place;
// how much of a corner's light is a fire's, which flickers with it
in float share;
out vec4 pixel;
vec3 linear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 srgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 color = share > 0.0 ? srgb(clamp(linear(shade) * (1.0 + share * (flicker - 1.0)), 0.0, 1.0)) : shade;
  if (mapped) {
    vec2 at = (place.xz - mapArea.xy) / mapArea.zw;
    // the lamps' two and the sun's, or the sun's alone where no lamp lights
    vec4 read = texture(lightmap, at);
    vec3 stored = sunOnly ? vec3(0.0, 0.0, read.r) : read.rgb;
    vec2 lamps = stored.rg * stored.rg * mapMost;
    float flames = fires ? read.a * read.a * mapMost * flicker : 0.0;
    // the face's own way up, and how much of the sun it gets: the corners
    // carry its light as it is in full shadow
    vec3 up = normalize(cross(dFdx(place), dFdy(place)));
    up *= sign(up.y + 1e-6);
    vec3 sunned = sunLit * max(dot(up, toward), 0.0) * stored.b;
    // added where the bake adds it: to the light, before it is written sRGB
    vec3 lit = linear(shade) + linear(under) * (sunned + lampWarm * lamps.x + lampOrange * (lamps.y + flames)) / 3.14159265;
    color = srgb(clamp(lit, 0.0, 1.0));
  }
  if (lampCount > 0 && !car) {
    vec3 n = normalize(cross(dFdx(place), dFdy(place)));
    // what the light lands on: the ground's own colour, and a guess at the rest's from its dark
    vec3 base = mapped ? linear(under) : mix(linear(color), vec3(0.3), 0.5);
    float reached = 0.0;
    for (int i = 0; i < 2; i++) {
      if (i >= lampCount) break;
      vec3 away = place - lampAt[i];
      float distance = length(away);
      vec3 ray = away / max(distance, 0.001);
      float cone = smoothstep(lampCone.x, lampCone.y, dot(ray, lampDir));
      float fall = 1.0 / (1.0 + 0.12 * distance * distance) * (1.0 - smoothstep(0.6 * lampCone.z, lampCone.z, distance));
      reached += cone * fall * abs(dot(n, ray));
    }
    color = srgb(clamp(linear(color) + base * lampColor * reached * lampCone.w, 0.0, 1.0));
  }
  float far = distance(place, eye) / hazeReach;
  float hazed = hazeMost * (1.0 - exp(-far * far * 1.2));
  pixel = vec4(mix(color, haze, hazed), 1.0);
}`;

// what drifts through the air, a point a leaf or a flake: each has its own
// place in a box, falls through it at its own pace and starts over at the
// top, and stands in the world - the box is laid round where the camera looks,
// and a point steps round to its far side at the box's edge
const DRIFT_VERTEX = `#version 300 es
uniform mat4 transform;
uniform vec3 middle;
uniform float wide;
uniform float time;
uniform vec4 motion;
uniform float size;
uniform float pixels;
layout(location = 0) in vec4 seed;
layout(location = 1) in vec3 color;
out vec3 shade;
out float alpha;
const float OVER = 30.0;
const float UNDER = 12.0;
const float LIFT = 0.25;
void main() {
  float high = OVER + UNDER;
  float pace = motion.x * (0.7 + seed.w * 0.6);
  float down = fract(seed.y - time * pace / high);
  // to and fro in a plane of its own, like a pendulum, dipping through the
  // middle of each swing and lifting a little at its ends
  float turn = time * motion.z + seed.w * 6.2832;
  float swing = sin(turn) * motion.y;
  float plane = seed.w * 37.7;
  vec3 place = vec3(
    seed.x * wide + cos(plane) * swing + time * motion.w,
    middle.y - UNDER + down * high + cos(2.0 * turn) * motion.y * LIFT,
    seed.z * wide + sin(plane) * swing
  );
  place.xz -= wide * floor((place.xz - middle.xz) / wide + 0.5);
  gl_Position = transform * vec4(place, 1.0);
  // a meter's pixels at its distance, from how the projection squeezes it
  // each its own size, half to one and a half; far off it shrinks on under a
  // pixel, fading as it goes rather than staying a dot
  float across = size * (0.5 + fract(seed.w * 7.31)) * pixels / gl_Position.w;
  gl_PointSize = max(across, 1.0);
  alpha = min(across, 1.0);
  shade = color;
}`;

const DRIFT_FRAGMENT = `#version 300 es
precision mediump float;
in vec3 shade;
in float alpha;
out vec4 pixel;
void main() {
  float disc = 1.0 - smoothstep(0.35, 0.5, length(gl_PointCoord - 0.5));
  pixel = vec4(shade, alpha * disc);
  if (pixel.a < 0.01) discard;
}`;

// a driving car's shadow: the light is baked, and a car moves through it, so
// what it casts is laid under it as it goes - a soft patch the size of the
// car, darker under its middle and fading out past its sides, as a car on a
// road is seen to sit in its own shade
const CAR_SHADOW_VERTEX = `#version 300 es
uniform mat4 transform;
uniform mat4 model;
uniform vec2 extent;
out vec2 corner;
void main() {
  corner = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  gl_Position = transform * model * vec4(corner.x * extent.x, 0.03, corner.y * extent.y, 1.0);
}`;

const CAR_SHADOW_FRAGMENT = `#version 300 es
precision mediump float;
uniform float strength;
in vec2 corner;
out vec4 pixel;
void main() {
  // a rounded box: square towards its middle, round at its corners
  float reach = pow(pow(abs(corner.x), 4.0) + pow(abs(corner.y), 4.0), 0.25);
  pixel = vec4(0.0, 0.0, 0.0, strength * (1.0 - smoothstep(0.55, 1.0, reach)));
}`;

/** How dark a car's shadow is under it by day and by night, and how far past its body it reaches. */
const CAR_SHADOW = { day: 0.55, night: 0.3, over: [1.12, 1.35] };

// the tracks a car leaves in the snow, a stretch of one wheel's at a time:
// darkening what is drawn under them by as much as a fresh track keeps of
// the snow's colour - lit as it is lit, by day or by a lamp - and snowed over
// again as they age, half in a track's life and gone in four
const MARK_VERTEX = `#version 300 es
layout(location = 0) in vec4 from;
layout(location = 1) in vec4 to;
uniform mat4 transform;
uniform float now;
uniform float life;
uniform float tyre;
out float across;
out float strength;
void main() {
  float along = float(gl_VertexID & 1);
  across = float((gl_VertexID >> 1) & 1) * 2.0 - 1.0;
  vec2 way = normalize(to.xz - from.xz);
  vec3 at = mix(from.xyz, to.xyz, along) + vec3(-way.y, 0.012, way.x) * vec3(across * tyre / 2.0, 1.0, across * tyre / 2.0);
  float age = now - from.w;
  strength = to.w * exp2(-age / life) * (1.0 - smoothstep(3.0 * life, 4.0 * life, age));
  gl_Position = transform * vec4(at, 1.0);
}`;

const MARK_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec3 tint;
in float across;
in float strength;
out vec4 pixel;
void main() {
  // pressed hardest under the tyre's middle, softer to its sides
  pixel = vec4(mix(vec3(1.0), tint, strength * (1.0 - smoothstep(0.55, 1.0, abs(across)))), 1.0);
}`;

/**
 * How the cars lay their tracks: a stretch every meter, as many kept as
 * that, how far off the line a car runs either side and how its way wanders
 * about that - by how much, over how long - and how fresh a car's tracks are.
 */
const MARKS = {
  step: 1,
  most: 1 << 15,
  aside: 0.25,
  wander: 0.08,
  over: [18, 34],
  fresh: [0.8, 1],
  leave: 0.2,
};

/**
 * A point on a route at a length along it, set off to the right of its way
 * by as much as is asked, and up or down as the road falls there across.
 */
function onRoute(route: Vec3[], tilts: number[] | undefined, along: number, aside: number): Vec3 {
  const last = route.length - 1;
  const clamped = Math.min(Math.max(along, 0), last);
  const index = Math.min(Math.floor(clamped), last - 1);
  const [a, b] = [route[index] as Vec3, route[index + 1] as Vec3];
  const t = clamped - index;
  const reach = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
  // to the right of the way: the scene's z is the plan's y turned over
  const [rx, rz] = [-(b[2] - a[2]) / reach, (b[0] - a[0]) / reach];
  const tilt = (tilts?.[index] ?? 0) + ((tilts?.[index + 1] ?? 0) - (tilts?.[index] ?? 0)) * t;
  return [
    a[0] + (b[0] - a[0]) * t + rx * aside,
    a[1] + (b[1] - a[1]) * t + tilt * aside,
    a[2] + (b[2] - a[2]) * t + rz * aside,
  ];
}

// the sky behind it: one triangle over the whole canvas, each pixel coloured
// by the way it looks - the horizon's colour below, the zenith's overhead, and
// the sun where it stands, a bright disc in a glow
const SKY_VERTEX = `#version 300 es
out vec2 screen;
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
  screen = corner;
  gl_Position = vec4(corner, 0.9999, 1.0);
}`;

const SKY_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 forward;
uniform vec3 right;
uniform vec3 up;
uniform vec2 spread;
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 sun;
uniform vec3 sunColor;
uniform float cover;
uniform vec3 cloudLit;
uniform vec3 cloudShade;
in vec2 screen;
out vec4 pixel;
// value noise, and five octaves of it: soft heaps, as fair weather's clouds are
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float heaps(vec2 p) {
  float sum = 0.0;
  float weight = 0.5;
  for (int octave = 0; octave < 5; octave++) {
    sum += noise(p) * weight;
    p = p * 2.03 + vec2(17.0, 9.0);
    weight *= 0.5;
  }
  return sum;
}
void main() {
  vec3 ray = normalize(forward + screen.x * spread.x * right + screen.y * spread.y * up);
  vec3 color = mix(horizon, zenith, pow(clamp(ray.y, 0.0, 1.0), 0.55));
  float toward = max(dot(ray, sun), 0.0);
  float glow = pow(toward, 180.0) * 0.45 + smoothstep(0.99955, 0.9997, toward);
  color = mix(color, sunColor, clamp(glow, 0.0, 1.0));
  // the clouds on a layer overhead, as the ray meets it: smaller towards the
  // horizon, and gone into the haze there
  if (cover > 0.0 && ray.y > 0.01) {
    vec2 on = ray.xz / ray.y * 2.2;
    float heap = heaps(on);
    float density = smoothstep(1.0 - cover * 0.9, 1.08 - cover * 0.9, heap + 0.18);
    // lit on the sun's side of each heap, greyer where it thickens
    float lit = clamp(0.55 + (heaps(on + sun.xz * 0.08) - heap) * 6.0, 0.0, 1.0);
    vec3 cloud = mix(cloudShade, cloudLit, mix(lit, 1.0, 0.35) * (1.0 - density * 0.25));
    float far = smoothstep(0.01, 0.25, ray.y);
    color = mix(color, cloud, density * far * 0.92);
  }
  pixel = vec4(color, 1.0);
}`;

/** What is drawn where it stands: the model matrix that leaves a point as it is. */
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

type Mat = Float32Array;

/** Two column major matrices multiplied. */
function times(a: Mat, b: Mat): Mat {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += (a[k * 4 + row] as number) * (b[column * 4 + k] as number);
      }
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

/** A front wheel's turn by an angle about the vertical through a point: the matrix to lay before the car's own. */
function turned([x, , z]: Vec3, angle: number): Mat {
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  return new Float32Array([
    c,
    0,
    -s,
    0,
    0,
    1,
    0,
    0,
    s,
    0,
    c,
    0,
    x - (c * x + s * z),
    0,
    z - (-s * x + c * z),
    1,
  ]);
}

/** How finely a car's rear axle is followed: a pose every so many meters of the front's way, worked out in so many steps. */
const TRAIL = { step: 0.5, steps: 5 };

/**
 * The axles' poses as a car drives a line, a pose every `TRAIL.step` of the
 * front axle's way along it up to `last`: the front axle steered along the
 * line, the rear one drawn after it at the wheelbase - never pushed sideways
 * - so it cuts in on the inside of a bend as a real car's does, and how far
 * it runs off the line there. Started straight, as if it came along the
 * line's first way.
 */
function trail(
  at: (along: number) => Vec3,
  last: number,
  base: number
): { front: Vec3; rear: Vec3; off: number }[] {
  const [start, on] = [at(0), at(1)];
  const reach = Math.hypot(on[0] - start[0], on[2] - start[2]) || 1;
  let rear: [number, number] = [
    start[0] - ((on[0] - start[0]) / reach) * base,
    start[2] - ((on[2] - start[2]) / reach) * base,
  ];
  return Array.from({ length: Math.floor(last / TRAIL.step) + 1 }, (_, index) => {
    const along = index * TRAIL.step;
    // the rear axle drawn straight towards where the front one has got to
    Array.from({ length: index === 0 ? 0 : TRAIL.steps }, (__, step) =>
      at(along - TRAIL.step + ((step + 1) * TRAIL.step) / TRAIL.steps)
    ).forEach(front => {
      const span = Math.hypot(front[0] - rear[0], front[2] - rear[1]) || 1;
      rear = [
        front[0] - ((front[0] - rear[0]) / span) * base,
        front[2] - ((front[2] - rear[1]) / span) * base,
      ];
    });
    // how far it is off the line: from the nearest of it round a wheelbase
    // back - and none before the line starts, where it came along it straight
    const off =
      along < base + 1.5
        ? 0
        : Math.min(
            ...Array.from({ length: 61 }, (__, near) => {
              const point = at(along - base - 1.5 + near * 0.05);
              return Math.hypot(point[0] - rear[0], point[2] - rear[1]);
            })
          );
    return { front: at(along), rear: [rear[0], at(along - base)[1], rear[1]], off };
  });
}

/**
 * A car on its route at a length along it, as a car follows a road: its front
 * axle on the line and its rear one where `rearOf` has it drawn after it, the
 * body pointing from the rear one to the front one and pitched to where they
 * stand - the nose up as the road climbs - and its front wheels turned by as
 * much as the road under them turns off the body's way.
 */
function stand(
  at: (along: number) => Vec3,
  rearOf: (front: number) => Vec3,
  travelled: number,
  { behind, ahead }: { behind: number; ahead: number }
): { model: Mat; steer: number } {
  const [rear, front] = [rearOf(travelled + ahead), at(travelled + ahead)];
  // the way the road heads at a length along it, from a short stretch round it
  const heading = (along: number) => {
    const [back, forward] = [at(along - 1.2), at(along + 1.2)];
    return Math.atan2(-(forward[2] - back[2]), forward[0] - back[0]);
  };
  // the body from the rear axle to the front one; its middle set back from the rear along it
  const yaw = Math.atan2(-(front[2] - rear[2]), front[0] - rear[0]);
  const reach = Math.hypot(front[0] - rear[0], front[2] - rear[2]) || 1;
  const middle: Vec3 = [
    rear[0] - ((front[0] - rear[0]) / reach) * behind,
    0,
    rear[2] - ((front[2] - rear[2]) / reach) * behind,
  ];
  const pitch = Math.atan2(front[1] - rear[1], ahead - behind);
  const height = rear[1] + ((front[1] - rear[1]) * -behind) / (ahead - behind);
  const [c, s, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
  // the front wheels turned to the road under them, off the body's way
  const turn = heading(travelled + ahead) - yaw;
  const steer = Math.max(-0.6, Math.min(0.6, Math.atan2(Math.sin(turn), Math.cos(turn))));
  // turned about y, and then about z - column major, as WebGL takes it
  return {
    model: new Float32Array([
      c * cp,
      sp,
      -s * cp,
      0,
      -c * sp,
      cp,
      s * sp,
      0,
      s,
      0,
      c,
      0,
      middle[0],
      height,
      middle[2],
      1,
    ]),
    steer,
  };
}

const padded = (length: number) => Math.ceil(length / 4) * 4;

/**
 * How a fire's light flickers: a few waves laid together that never quite
 * repeat, as the editor's fires have them, between -1 and 1.
 */
const wave = (seconds: number) =>
  0.55 * Math.sin(seconds * 7.3) + 0.3 * Math.sin(seconds * 13.1) + 0.15 * Math.sin(seconds * 23.7);

/** How far a fire's light swings round the brightness it was baked at, and how often a fire alone is drawn, in frames a second. */
const FLAMES = { swing: 0.15, rate: 20 };

/** How wide the drift's box is: the camera's distance from what it looks at, rounded up to one of these. */
const DRIFT_BOX = [40, 80, 160, 320];

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
 * calls, one short shader, the light already in their colours - and drawn
 * with WebGL alone, no library to load first. Behind them the season's sky
 * the view was baked with, its sun, and the haze the distance fades into; in
 * autumn and winter the leaves or the snow drift through it, and where a fire
 * burns its light flickers on the ground and on the walls round it, and its
 * tongues sway and flare - drawn frame by frame while it is on
 * screen, unless less motion is asked for. Otherwise it renders once, and
 * again only when its size changes: nothing in it moves.
 *
 * A `poster` - the view's first frame, baked as an image - shows at once and
 * is faded out when the view has been drawn over it, and with `loading="lazy"`
 * the view is fetched only once the element comes near the screen.
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

  /** An image of the view's first frame, shown until the view is drawn. */
  @property({ type: String })
  poster?: string;

  /** Whether the view is fetched at once, or only when the element comes near the screen. */
  @property({ type: String })
  loading: 'eager' | 'lazy' = 'eager';

  /**
   * Instead of a poster, the logo's brook on the header's gradient, filling as
   * the view comes in - a still frame never quite matched the shape the view
   * takes, and this says what is happening instead.
   */
  @property({ type: Boolean, reflect: true })
  loader = false;

  /**
   * The view's file's size in bytes, as served: what the loader fills against
   * where the host sends no `Content-Length`.
   */
  @property({ type: Number })
  size?: number;

  /** How much of the view's file has come in, in percent, while it is being fetched. */
  @state()
  private fetched: number | undefined;

  /** Whether the view has been drawn, and the poster can give way to it. */
  @state()
  private drawn = false;

  /** What waits for a lazy element to come near the screen, and whether it has. */
  #approach: IntersectionObserver | undefined;
  #arrived = false;

  /**
   * How far along its path a path view's camera is, from its start at nought
   * to its end at one - set by whatever moves it, the page's scroll say.
   */
  @property({ type: Number })
  progress = 0;

  /**
   * How long a path view takes to fly its path there and back, in seconds -
   * over and over, easing out of each end and into the other; round a loop,
   * once round at an even pace, and on round again. Left out, the
   * camera stays where `progress` puts it. Nothing moves for a visitor who
   * asked for less motion, nor while the element is off screen.
   */
  @property({ type: Number })
  autoplay?: number;

  /** Moves a path view's camera to where the progress says, once it is loaded. */
  #follow: ((progress: number) => void) | undefined;

  /** Whether the path view's way closes on itself. */
  #looped = false;

  /** The flight: how far into it, the frame it is waiting for, and what sees whether it is on screen. */
  #flight: {
    elapsed: number;
    frame: number | undefined;
    last: number | undefined;
    seen: boolean;
  } = {
    frame: undefined,
    last: undefined,
    elapsed: 0,
    seen: false,
  };
  #sighting: IntersectionObserver | undefined;
  /** What watches a drifting view come on screen and go. */
  #drifting: IntersectionObserver | undefined;

  @query('canvas')
  private readonly canvas!: HTMLCanvasElement;

  #observer: ResizeObserver | undefined;
  #loaded: string | undefined;

  /**
   * What the view on show holds: its listeners, and its buffers on the card.
   * A new `src` - the same view in another season - puts it away once the new
   * one is ready, so the old one stays on screen while the new one comes.
   */
  #shown: { listeners: AbortController; release: () => void } | undefined;

  /** Where a free view was turned to, kept for the next view shown in its place. */
  #turned: { distance: number; turn: number; lift: number } | undefined;

  override updated(changed: Map<string, unknown>): void {
    if (!isServer && this.src !== undefined && this.src !== this.#loaded) {
      const src = this.src;
      this.#loaded = src;
      void this.#arrive().then(() => (this.#loaded === src ? this.#show(src) : undefined));
    }
    if (changed.has('progress')) {
      this.#follow?.(this.progress);
    }
    if (changed.has('autoplay')) {
      this.#fly();
    }
  }

  /**
   * Flies a path view's camera while it autoplays and is seen: a cosine from
   * one end to the other and back, so it slows into each end, stops, and sets
   * off again - no step anywhere, and none where it comes round. Round a
   * loop there is no end to slow into: on round at an even pace.
   */
  #fly(): void {
    const flight = this.#flight;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const period = (this.autoplay ?? 0) * 1000;
    if (this.#follow === undefined || period <= 0 || still || !flight.seen) {
      if (flight.frame !== undefined) {
        cancelAnimationFrame(flight.frame);
      }
      flight.frame = undefined;
      flight.last = undefined;
      return;
    }
    if (flight.frame !== undefined) {
      return;
    }
    const tick = (now: number) => {
      flight.elapsed += now - (flight.last ?? now);
      flight.last = now;
      const round = flight.elapsed / period;
      this.#follow?.(this.#looped ? round % 1 : (1 - Math.cos(round * Math.PI * 2)) / 2);
      flight.frame = requestAnimationFrame(tick);
    };
    flight.frame = requestAnimationFrame(tick);
  }

  /** Resolves once the element may load its view: at once, or when a lazy one is near the screen. */
  #arrive(): Promise<void> {
    if (this.loading !== 'lazy' || this.#arrived) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      this.#approach?.disconnect();
      // a screen's height ahead: the view is on its way before it is wanted
      this.#approach = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting === true) {
            this.#arrived = true;
            this.#approach?.disconnect();
            resolve();
          }
        },
        { rootMargin: '100% 0px' }
      );
      this.#approach.observe(this);
    });
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
      const program = this.#program(gl, VERTEX, FRAGMENT);
      const skyProgram = this.#program(gl, SKY_VERTEX, SKY_FRAGMENT);
      const driftProgram = this.#program(gl, DRIFT_VERTEX, DRIFT_FRAGMENT);
      const shadowProgram = this.#program(gl, CAR_SHADOW_VERTEX, CAR_SHADOW_FRAGMENT);
      const markProgram = this.#program(gl, MARK_VERTEX, MARK_FRAGMENT);
      const response = await fetch(src);
      if (!response.ok || response.body === null) {
        throw new Error(`${src}: ${response.status}`);
      }
      // the file is gzipped as it was baked, and unpacked as it comes in -
      // counted on its way, for the loader to fill by
      const total = Number(response.headers.get('content-length')) || this.size || undefined;
      let arrived = 0;
      this.fetched = total === undefined ? undefined : 0;
      const counted = response.body.pipeThrough(
        new TransformStream<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>({
          transform: (chunk, controller) => {
            arrived += chunk.byteLength;
            if (total !== undefined) {
              this.fetched = Math.min((arrived / total) * 100, 100);
            }
            controller.enqueue(chunk);
          },
        })
      );
      const buffer = await new Response(
        counted.pipeThrough(new DecompressionStream('gzip'))
      ).arrayBuffer();
      this.fetched = 100;
      // asked for another while this one came: that one is shown, not this
      if (this.#loaded !== src) {
        return;
      }
      this.#shown?.listeners.abort();
      this.#shown?.release();
      const listeners = new AbortController();
      const { header, offset: start } = Scene.read(buffer);

      let offset = start;
      const batches = header.groups.map((group): Batch => {
        const values = group.vertices * 3;
        // on the grid, each the step from the vertex before, wrapping round
        const steps = new Uint16Array(buffer, offset, values);
        offset += padded(values * 2);
        const positions = new Float32Array(values);
        const { origin, step } = header.grid;
        const at = [0, 0, 0];
        for (let value = 0; value < values; value += 1) {
          const axis = value % 3;
          at[axis] = ((at[axis] as number) + (steps[value] as number)) & 0xffff;
          positions[value] =
            (origin[axis] as number) + (at[axis] as number) * (step[axis] as number);
        }
        const colors = new Uint8Array(buffer, offset, values);
        offset += padded(values);
        const albedo = group.mapped === true ? new Uint8Array(buffer, offset, values) : undefined;
        offset += albedo === undefined ? 0 : padded(values);
        const shares =
          group.fire === true ? new Uint8Array(buffer, offset, group.vertices) : undefined;
        offset += shares === undefined ? 0 : padded(group.vertices);
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
        const under = albedo === undefined ? null : gl.createBuffer();
        if (albedo !== undefined && under !== null) {
          gl.bindBuffer(gl.ARRAY_BUFFER, under);
          gl.bufferData(gl.ARRAY_BUFFER, albedo, gl.STATIC_DRAW);
          gl.enableVertexAttribArray(2);
          gl.vertexAttribPointer(2, 3, gl.UNSIGNED_BYTE, true, 0, 0);
        }
        // where no fire lights the group its share is the attribute's default, nought
        const fired = shares === undefined ? null : gl.createBuffer();
        if (shares !== undefined && fired !== null) {
          gl.bindBuffer(gl.ARRAY_BUFFER, fired);
          gl.bufferData(gl.ARRAY_BUFFER, shares, gl.STATIC_DRAW);
          gl.enableVertexAttribArray(3);
          gl.vertexAttribPointer(3, 1, gl.UNSIGNED_BYTE, true, 0, 0);
        }
        const index = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        return {
          vao,
          buffers: [
            position,
            color,
            index,
            ...(under === null ? [] : [under]),
            ...(fired === null ? [] : [fired]),
          ],
          mapped: albedo !== undefined,
          ...(group.flame === undefined ? {} : { flame: group.flame }),
          ...(group.vehicle === undefined ? {} : { vehicle: group.vehicle }),
          count: group.indices,
          type: wide ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
          ...(group.offset === undefined ? {} : { offset: group.offset }),
          culled: !group.doubleSided,
          decal: group.decal === true,
        };
      });

      const transform = gl.getUniformLocation(program, 'transform');
      const at = (shader: WebGLProgram, name: string) => gl.getUniformLocation(shader, name);
      const { sky, drift, lightmap } = header;
      // the lightmap after the groups, a byte or three a cell, filtered between them
      const mapTexture = (() => {
        if (lightmap === undefined) {
          return undefined;
        }
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        const [inner, format] = {
          1: [gl.R8, gl.RED],
          3: [gl.RGB8, gl.RGB],
          4: [gl.RGBA8, gl.RGBA],
        }[lightmap.channels] as [number, number];
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          inner,
          lightmap.width,
          lightmap.depth,
          0,
          format,
          gl.UNSIGNED_BYTE,
          new Uint8Array(buffer, offset, lightmap.width * lightmap.depth * lightmap.channels)
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return texture;
      })();
      // the drift's points: a seed each and a colour, laid out once
      const driftVao = drift === undefined ? undefined : this.#driftPoints(gl, drift);
      const since = performance.now();
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const fires = lightmap?.channels === 4;
      // and whether anything burns at all - the ground, a wall, the tongues - to draw frame by frame
      const burning =
        fires || header.groups.some(({ fire, flame }) => fire === true || flame !== undefined);
      // where the camera stands and looks: fixed for a still view, turned
      // round its pivot for a free one
      const camera = { ...header.camera };
      const size = { width: 1, height: 1 };
      // the cars: one drives at a time, picked at random and sent either way
      // along the road, then another a while after - not for a visitor who
      // asked for less motion
      const traffic = still ? undefined : header.vehicles;
      const cars = [...new Set(batches.flatMap(({ vehicle }) => vehicle?.id ?? []))];
      const clock = () => (performance.now() - since) / 1000;
      // the tracks in the snow, laid as the cars drive: a stretch of one
      // wheel's an instance - its ends, when it was laid and how fresh - the
      // oldest written over once there are more than are kept
      const marks = header.vehicles?.marks;
      const instances = (count: number) => {
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, count * 32, gl.DYNAMIC_DRAW);
        [0, 1].forEach(location => {
          gl.enableVertexAttribArray(location);
          gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 32, location * 16);
          gl.vertexAttribDivisor(location, 1);
        });
        gl.bindVertexArray(null);
        return { vao, buffer };
      };
      // and apart from them, what the driving car has laid since its last
      // whole stretch, up to its wheels: laid only a stretch at a time, the
      // tracks came on behind them in jerks
      const laid =
        marks === undefined
          ? undefined
          : { ...instances(MARKS.most), written: 0, tail: { ...instances(4), count: 0 } };
      /** A car on a route: how far off the line it keeps and wanders, its wheels' track, and how far its tracks are laid. */
      interface Driver {
        route: Vec3[];
        tilts: number[] | undefined;
        off: number;
        phase: number;
        over: number;
        gauge: number;
        fresh: number;
        laid: number;
        /** The axles' poses, a `TRAIL.step` of the front's way apart. */
        poses: { front: Vec3; rear: Vec3; off: number }[];
      }
      const between = ([least, most]: number[]) =>
        (least as number) + Math.random() * ((most as number) - (least as number));
      const driver = (index: number, id: string): Driver => {
        const { behind, ahead } = batches.find(({ vehicle }) => vehicle?.id === id)?.vehicle ?? {
          behind: 0,
          ahead: 1,
        };
        const car: Driver = {
          route: header.vehicles?.routes[index] ?? [],
          tilts: marks?.tilts[index],
          off: (Math.random() * 2 - 1) * MARKS.aside,
          phase: Math.random() * Math.PI * 2,
          over: between(MARKS.over),
          // the body is laid a little wider than its wheels' track
          gauge: (header.vehicles?.sizes?.[id]?.width ?? 1.75) - 0.2,
          fresh: between(MARKS.fresh),
          laid: 0,
          poses: [],
        };
        car.poses = trail(placing(car), car.route.length - 1, ahead - behind);
        return car;
      };
      const aside = (car: Driver, along: number) =>
        car.off + MARKS.wander * Math.sin((along / car.over) * Math.PI * 2 + car.phase);
      /** The axles' way along a car's route: off the line by as much as it keeps. */
      const placing = (car: Driver) => (along: number) =>
        onRoute(car.route, car.tilts, along, aside(car, along));
      /** A car's axles' pose with its front axle at a length along its route. */
      const poseAt = (car: Driver, along: number) => {
        const last = car.poses.length - 1;
        const exact = Math.min(Math.max(along / TRAIL.step, 0), last);
        const index = Math.min(Math.floor(exact), Math.max(last - 1, 0));
        const [a, b] = [car.poses[index], car.poses[index + 1] ?? car.poses[index]] as [
          Driver['poses'][number],
          Driver['poses'][number],
        ];
        const t = exact - index;
        const mix = (p: Vec3, q: Vec3): Vec3 => [
          p[0] + (q[0] - p[0]) * t,
          p[1] + (q[1] - p[1]) * t,
          p[2] + (q[2] - p[2]) * t,
        ];
        return {
          front: mix(a.front, b.front),
          rear: mix(a.rear, b.rear),
          off: a.off + (b.off - a.off) * t,
        };
      };
      /** Lays a car's tracks on from where they end to a length along its route. */
      const lay = (car: Driver, upTo: number, born: number) => {
        if (laid === undefined) {
          return;
        }
        const end = Math.min(upTo, car.route.length - 1);
        const steps = Math.max(0, Math.floor((end - car.laid) / MARKS.step));
        // all four wheels' tracks over a stretch of the front's way: each
        // axle's wheels either side of it, square to the body; the rear ones
        // only where they leave the front ones' - in them, they press no more
        const stretch = (from: number, to: number) => {
          const [one, other] = [poseAt(car, from), poseAt(car, to)];
          const wheels = (pose: typeof one, axle: 'front' | 'rear', side: number): Vec3 => {
            const [f, r] = [pose.front, pose.rear];
            const reach = Math.hypot(f[0] - r[0], f[2] - r[2]) || 1;
            const [rx, rz] = [-(f[2] - r[2]) / reach, (f[0] - r[0]) / reach];
            const at = pose[axle];
            return [
              at[0] + (rx * side * car.gauge) / 2,
              at[1],
              at[2] + (rz * side * car.gauge) / 2,
            ];
          };
          const apart = (one.off + other.off) / 2;
          const leaving = Math.min(Math.max((apart - 0.03) / (MARKS.leave - 0.03), 0), 1);
          return (['front', 'rear'] as const).flatMap(axle =>
            axle === 'rear' && leaving === 0
              ? []
              : [-1, 1].flatMap(side => [
                  ...wheels(one, axle, side),
                  born,
                  ...wheels(other, axle, side),
                  car.fresh * (axle === 'rear' ? leaving * leaving * (3 - 2 * leaving) : 1),
                ])
          );
        };
        const data = new Float32Array(
          Array.from({ length: steps }, (_, step) => car.laid + step * MARKS.step).flatMap(from =>
            stretch(from, from + MARKS.step)
          )
        );
        car.laid += steps * MARKS.step;
        const rest = end - car.laid > 0.01 ? stretch(car.laid, end) : [];
        laid.tail.count = rest.length / 8;
        if (rest.length > 0) {
          gl.bindBuffer(gl.ARRAY_BUFFER, laid.tail.buffer);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(rest));
        }
        const count = data.length / 8;
        const at = laid.written % MARKS.most;
        const first = Math.min(count, MARKS.most - at);
        gl.bindBuffer(gl.ARRAY_BUFFER, laid.buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, at * 32, data, 0, first * 8);
        if (count > first) {
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, first * 8, (count - first) * 8);
        }
        laid.written += count;
      };
      // a car came by a while ago: its tracks half snowed over already
      const routes = header.vehicles?.routes ?? [];
      const seed = cars[Math.floor(Math.random() * cars.length)];
      if (marks !== undefined && routes.length > 0 && seed !== undefined) {
        lay(driver(Math.floor(Math.random() * routes.length), seed), Infinity, -marks.life);
      }
      const trips: {
        trip: { id: string; started: number; car: Driver } | undefined;
        next: number;
      } = { trip: undefined, next: performance.now() + 4000 };
      /** Where a car's front axle has got to on its trip, its tracks laid up to it. */
      const front = (trip: { id: string; started: number }, now: number) =>
        ((now - trip.started) / 1000) * (traffic?.speed ?? 0) +
        (batches.find(({ vehicle }) => vehicle?.id === trip.id)?.vehicle?.ahead ?? 0);
      /** Starts and ends the cars' trips by the clock; whether one is on the road. */
      const advance = (now: number): boolean => {
        if (traffic === undefined || cars.length === 0) {
          return false;
        }
        const { trip } = trips;
        if (trip !== undefined) {
          const length = (trip.car.route.length - 1) / traffic.speed;
          const over = (now - trip.started) / 1000 > length;
          lay(trip.car, over ? Infinity : front(trip, now), clock());
          if (over) {
            trips.trip = undefined;
          }
        }
        if (trips.trip === undefined && now >= trips.next) {
          const index = Math.floor(Math.random() * traffic.routes.length);
          const id = cars[Math.floor(Math.random() * cars.length)];
          if (traffic.routes[index] !== undefined && id !== undefined) {
            trips.trip = { id, started: now, car: driver(index, id) };
          }
          const [least, most] = traffic.every;
          trips.next = now + (least + Math.random() * (most - least)) * 1000;
        }
        return trips.trip !== undefined;
      };
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
        const aspect = width / height;
        if (sky !== undefined) {
          // the sky first, behind everything, and nothing written to the depth
          const back = unit(minus(camera.position, camera.target));
          const right = unit(cross([0, 1, 0], back));
          const across = Math.tan((camera.fov / 2) * (Math.PI / 180));
          gl.useProgram(skyProgram);
          gl.uniform3fv(
            at(skyProgram, 'forward'),
            back.map(value => -value)
          );
          gl.uniform3fv(at(skyProgram, 'right'), right);
          gl.uniform3fv(at(skyProgram, 'up'), cross(back, right));
          gl.uniform2f(at(skyProgram, 'spread'), across, across / aspect);
          gl.uniform3fv(at(skyProgram, 'zenith'), sky.zenith);
          gl.uniform3fv(at(skyProgram, 'horizon'), sky.horizon);
          gl.uniform3fv(at(skyProgram, 'sun'), sky.sun);
          gl.uniform3fv(at(skyProgram, 'sunColor'), sky.sunColor);
          gl.uniform1f(at(skyProgram, 'cover'), sky.clouds?.cover ?? 0);
          gl.uniform3fv(at(skyProgram, 'cloudLit'), sky.clouds?.lit ?? [1, 1, 1]);
          gl.uniform3fv(at(skyProgram, 'cloudShade'), sky.clouds?.shade ?? [1, 1, 1]);
          gl.depthMask(false);
          gl.disable(gl.CULL_FACE);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.depthMask(true);
        }
        gl.useProgram(program);
        const matrix = transformOf(camera, aspect);
        gl.uniformMatrix4fv(transform, false, matrix);
        gl.uniform3fv(at(program, 'eye'), camera.position);
        gl.uniform3fv(at(program, 'haze'), sky?.horizon ?? [1, 1, 1]);
        gl.uniform1f(at(program, 'hazeReach'), sky?.hazeReach ?? 1);
        gl.uniform1f(at(program, 'hazeMost'), sky?.hazeMost ?? 0);
        // a face seen from behind is never drawn: a still view's bake left
        // those out, a free one's has both sides of a face as faces of their
        // own - only what a still view draws on both sides is not culled
        if (lightmap !== undefined && mapTexture !== undefined) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, mapTexture);
          gl.uniform1i(at(program, 'lightmap'), 0);
          gl.uniform4f(
            at(program, 'mapArea'),
            lightmap.origin[0],
            lightmap.origin[1],
            lightmap.width * lightmap.cell,
            lightmap.depth * lightmap.cell
          );
          gl.uniform1f(at(program, 'mapMost'), lightmap.most);
          gl.uniform3fv(at(program, 'lampWarm'), lightmap.warm);
          gl.uniform3fv(at(program, 'lampOrange'), lightmap.orange);
          gl.uniform3fv(at(program, 'sunLit'), lightmap.sun);
          gl.uniform1i(at(program, 'sunOnly'), lightmap.channels === 1 ? 1 : 0);
          gl.uniform1i(at(program, 'fires'), fires ? 1 : 0);
          // the fires' light round the brightness it was baked at; steady for a visitor who asked for less motion
          gl.uniform3fv(at(program, 'toward'), lightmap.toward);
        }
        // the fires round the brightness they were baked at, and their tongues
        // with them; steady for a visitor who asked for less motion
        const seconds = (performance.now() - since) / 1000;
        const moving = burning && !still;
        gl.uniform1f(at(program, 'flicker'), moving ? 1 + FLAMES.swing * wave(seconds) : 1);
        gl.uniform1f(at(program, 'time'), seconds);
        const model = at(program, 'model');
        gl.uniformMatrix4fv(model, false, IDENTITY);
        const { trip } = trips;
        // where the car on the road is, for what it is lit by and what lights it
        const driven =
          traffic === undefined || trip === undefined
            ? undefined
            : stand(
                placing(trip.car),
                along => poseAt(trip.car, along).rear,
                ((performance.now() - trip.started) / 1000) * traffic.speed,
                batches.find(({ vehicle }) => vehicle?.id === trip.id)?.vehicle ?? {
                  behind: 0,
                  ahead: 1,
                }
              );
        const lamps = traffic?.lamps;
        const lit = driven !== undefined && lamps?.cars[trip?.id ?? ''] !== undefined;
        gl.uniform1i(at(program, 'lampCount'), lit ? 2 : 0);
        if (lit && driven !== undefined && lamps !== undefined) {
          const { nose, apart } = lamps.cars[trip?.id ?? ''] as { nose: number; apart: number };
          const m = driven.model;
          const world = (x: number, y: number, z: number) => [
            (m[0] as number) * x + (m[4] as number) * y + (m[8] as number) * z + (m[12] as number),
            (m[1] as number) * x + (m[5] as number) * y + (m[9] as number) * z + (m[13] as number),
            (m[2] as number) * x + (m[6] as number) * y + (m[10] as number) * z + (m[14] as number),
          ];
          gl.uniform3fv(at(program, 'lampAt'), [
            ...world(nose, lamps.height, apart),
            ...world(nose, lamps.height, -apart),
          ]);
          const [o, p] = [world(0, 0, 0), world(1, -lamps.dip, 0)] as [number[], number[]];
          gl.uniform3fv(at(program, 'lampDir'), unit(minus(p as Vec3, o as Vec3)));
          gl.uniform3fv(at(program, 'lampColor'), [1, 0.9, 0.62]);
          gl.uniform4f(
            at(program, 'lampCone'),
            Math.cos(lamps.angle),
            Math.cos(lamps.angle * (1 - lamps.penumbra)),
            lamps.reach,
            lamps.baked
          );
        }
        batches.forEach(
          ({ vao, count, type, offset: pulled, culled, decal, mapped, flame, vehicle }) => {
            // a car is there while it drives, where it has got to
            if (vehicle !== undefined) {
              if (driven === undefined || trip === undefined || trip.id !== vehicle.id) {
                return;
              }
              // a front wheel turns about its own middle, before the car's own
              gl.uniformMatrix4fv(
                model,
                false,
                vehicle.steer === undefined
                  ? driven.model
                  : times(driven.model, turned(vehicle.steer, driven.steer))
              );
            }
            gl.uniform1i(at(program, 'car'), vehicle === undefined ? 0 : 1);
            gl.uniform1i(at(program, 'mapped'), mapped && mapTexture !== undefined ? 1 : 0);
            gl.uniform1i(at(program, 'flame'), flame !== undefined && moving ? 1 : 0);
            if (flame !== undefined) {
              gl.uniform4fv(at(program, 'flameAt'), flame);
            }
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
            // the snow's tracks one over another in their turn: written to the
            // depth, they flickered through each other further off
            gl.depthMask(!decal);
            gl.drawElements(gl.TRIANGLES, count, type, 0);
            gl.depthMask(true);
            if (vehicle !== undefined) {
              gl.uniformMatrix4fv(model, false, IDENTITY);
            }
          }
        );
        // the tracks in the snow, darkening what they lie on
        if (laid !== undefined && marks !== undefined && laid.written > 0) {
          gl.useProgram(markProgram);
          gl.uniformMatrix4fv(at(markProgram, 'transform'), false, matrix);
          gl.uniform1f(at(markProgram, 'now'), clock());
          gl.uniform1f(at(markProgram, 'life'), marks.life);
          gl.uniform1f(at(markProgram, 'tyre'), marks.tyre);
          gl.uniform3fv(at(markProgram, 'tint'), marks.tint);
          gl.disable(gl.CULL_FACE);
          gl.enable(gl.POLYGON_OFFSET_FILL);
          gl.polygonOffset(-6, -6);
          gl.enable(gl.BLEND);
          gl.blendFuncSeparate(gl.DST_COLOR, gl.ZERO, gl.ZERO, gl.ONE);
          gl.depthMask(false);
          gl.bindVertexArray(laid.vao);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, Math.min(laid.written, MARKS.most));
          if (laid.tail.count > 0) {
            gl.bindVertexArray(laid.tail.vao);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, laid.tail.count);
          }
          gl.depthMask(true);
          gl.disable(gl.BLEND);
          gl.disable(gl.POLYGON_OFFSET_FILL);
          gl.useProgram(program);
        }
        // the car's shadow on the road under it, blended over what is drawn,
        // its own body over it
        const body = trip === undefined ? undefined : traffic?.sizes?.[trip.id];
        if (driven !== undefined && body !== undefined) {
          gl.useProgram(shadowProgram);
          gl.uniformMatrix4fv(at(shadowProgram, 'transform'), false, matrix);
          gl.uniformMatrix4fv(at(shadowProgram, 'model'), false, driven.model);
          gl.uniform2f(
            at(shadowProgram, 'extent'),
            (body.length / 2) * (CAR_SHADOW.over[0] as number),
            (body.width / 2) * (CAR_SHADOW.over[1] as number)
          );
          gl.uniform1f(
            at(shadowProgram, 'strength'),
            traffic?.lamps === undefined ? CAR_SHADOW.day : CAR_SHADOW.night
          );
          gl.disable(gl.CULL_FACE);
          gl.enable(gl.POLYGON_OFFSET_FILL);
          gl.polygonOffset(-6, -6);
          gl.enable(gl.BLEND);
          gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
          gl.depthMask(false);
          gl.bindVertexArray(null);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          gl.depthMask(true);
          gl.disable(gl.BLEND);
          gl.disable(gl.POLYGON_OFFSET_FILL);
          gl.useProgram(program);
        }
        const pixels = width / 2 / Math.tan((camera.fov / 2) * (Math.PI / 180));
        if (drift !== undefined && driftVao !== undefined) {
          // over the model, tested against it but not written, blended
          const target = camera.target;
          const distance = Math.hypot(...minus(camera.position, target));
          const wide =
            DRIFT_BOX.find(width => width >= distance) ?? DRIFT_BOX[DRIFT_BOX.length - 1];
          gl.useProgram(driftProgram);
          gl.uniformMatrix4fv(at(driftProgram, 'transform'), false, matrix);
          gl.uniform3fv(at(driftProgram, 'middle'), target);
          gl.uniform1f(at(driftProgram, 'wide'), wide as number);
          gl.uniform1f(at(driftProgram, 'time'), (performance.now() - since) / 1000);
          gl.uniform4f(at(driftProgram, 'motion'), drift.fall, drift.sway, drift.spin, drift.wind);
          gl.uniform1f(at(driftProgram, 'size'), drift.size);
          gl.uniform1f(at(driftProgram, 'pixels'), pixels);
          gl.disable(gl.CULL_FACE);
          gl.disable(gl.POLYGON_OFFSET_FILL);
          gl.enable(gl.BLEND);
          // the colour blended, the canvas left opaque: blending its alpha
          // too left it see-through round every point's soft edge, the page
          // showing through as a ring round it
          gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
          gl.depthMask(false);
          gl.bindVertexArray(driftVao);
          gl.drawArrays(gl.POINTS, 0, drift.count);
          gl.depthMask(true);
          gl.disable(gl.BLEND);
        }
        gl.bindVertexArray(null);
      };
      const resize = (width: number, height: number) => {
        [size.width, size.height] = [Math.max(width, 1), Math.max(height, 1)];
        draw();
      };
      this.#shown = {
        listeners,
        release: () =>
          batches.forEach(({ vao, buffers }) => {
            gl.deleteVertexArray(vao);
            buffers.forEach(buffer => gl.deleteBuffer(buffer));
          }),
      };
      if (header.kind === 'free') {
        this.#orbit(camera, draw, listeners.signal);
      }
      const { path } = header.camera;
      if (header.kind === 'path' && path !== undefined && path.length > 1) {
        this.#looped = header.camera.loop === true;
        this.#follow = this.#along(camera, path, draw, this.#looped);
        this.#follow(this.progress);
        // it only flies while it can be seen
        this.#sighting?.disconnect();
        this.#sighting = new IntersectionObserver(([entry]) => {
          this.#flight.seen = entry?.isIntersecting ?? false;
          this.#fly();
        });
        this.#sighting.observe(this);
      }

      resize(this.clientWidth, this.clientHeight);
      // a view with something drifting or a fire burning is drawn frame by
      // frame while it is on screen and nobody has asked for less motion
      this.drawn = true;
      if (drift !== undefined || burning || traffic !== undefined) {
        this.#drifting?.disconnect();
        let frame: number | undefined;
        let last = 0;
        let was = false;
        const loop = (now: number) => {
          // a car on the road is drawn every frame, as the drift is; a fire
          // alone needs no more frames than a flicker has, and a view with
          // nothing moving none at all
          const driving = advance(performance.now());
          // once more as the car is gone
          const changed = driving || was;
          was = driving;
          // and the tracks in the snow, as they are snowed over, once a second
          if (
            drift !== undefined ||
            changed ||
            (burning && now - last >= 1000 / FLAMES.rate) ||
            ((laid?.written ?? 0) > 0 && now - last >= 1000)
          ) {
            draw();
            last = now;
          }
          frame = requestAnimationFrame(loop);
        };
        this.#drifting = new IntersectionObserver(([entry]) => {
          if (entry?.isIntersecting === true && !still) {
            frame ??= requestAnimationFrame(loop);
          } else if (frame !== undefined) {
            cancelAnimationFrame(frame);
            frame = undefined;
          }
        });
        this.#drifting.observe(this);
        listeners.signal.addEventListener('abort', () => {
          this.#drifting?.disconnect();
          if (frame !== undefined) {
            cancelAnimationFrame(frame);
          }
        });
      }
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
  #orbit(camera: Header['camera'], draw: () => void, signal: AbortSignal): void {
    const { pivot } = camera;
    const from = minus(camera.position, pivot);
    // turned on from where the view before it was left, if there was one
    const kept = this.#turned;
    let distance = kept?.distance ?? Math.hypot(...from);
    let turn = kept?.turn ?? Math.atan2(from[0], from[2]) * (180 / Math.PI);
    let lift = kept?.lift ?? Math.asin(from[1] / distance) * (180 / Math.PI);
    let frame: number | undefined;
    const place = () => {
      this.#turned = { distance, turn, lift };
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
    this.addEventListener(
      'pointerdown',
      event => {
        held = { x: event.clientX, y: event.clientY };
        this.setPointerCapture(event.pointerId);
      },
      { signal }
    );
    this.addEventListener(
      'pointermove',
      event => {
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
      },
      { signal }
    );
    const release = () => (held = undefined);
    this.addEventListener('pointerup', release, { signal });
    this.addEventListener('pointercancel', release, { signal });
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
      { passive: false, signal }
    );
  }

  /**
   * Places a path view's camera where the progress falls along its way: on a
   * smooth curve through the steps it was baked with - a Catmull-Rom spline,
   * as the bake laid the way out - so it neither jerks at a step nor turns
   * there, and draws it once the frame comes round, however often the
   * progress changes before then. Round a loop the last step leads on to
   * the first, and the progress comes round with it.
   */
  #along(
    camera: Header['camera'],
    path: NonNullable<Header['camera']['path']>,
    draw: () => void,
    loop = false
  ): (progress: number) => void {
    let frame: number | undefined;
    const count = path.length;
    const last = loop ? count : count - 1;
    const step = (index: number) =>
      path[
        loop ? ((index % count) + count) % count : Math.min(Math.max(index, 0), count - 1)
      ] as (typeof path)[number];
    const curve = (a: number[], b: number[], c: number[], d: number[], t: number) =>
      b.map((value, axis) => {
        const [p0, p2, p3] = [a[axis], c[axis], d[axis]] as [number, number, number];
        return (
          0.5 *
          (2 * value +
            (p2 - p0) * t +
            (2 * p0 - 5 * value + 4 * p2 - p3) * t * t +
            (3 * value - p0 - 3 * p2 + p3) * t * t * t)
        );
      }) as Vec3;
    return progress => {
      const along = (loop ? ((progress % 1) + 1) % 1 : Math.min(Math.max(progress, 0), 1)) * last;
      const at = Math.min(Math.floor(along), last - 1);
      const [before, from, to, after] = [step(at - 1), step(at), step(at + 1), step(at + 2)];
      const t = along - at;
      camera.position = curve(before.position, from.position, to.position, after.position, t);
      camera.target = curve(before.target, from.target, to.target, after.target, t);
      frame ??= requestAnimationFrame(() => {
        frame = undefined;
        draw();
      });
    };
  }

  /** The drift's points on the card: four seeds a point and its colour. */
  #driftPoints(
    gl: WebGL2RenderingContext,
    drift: NonNullable<Header['drift']>
  ): WebGLVertexArrayObject {
    let state = 1410;
    const next = () => {
      state = (state * 16807) % 2147483647;
      return state / 2147483647;
    };
    const seeds = Float32Array.from({ length: drift.count * 4 }, next);
    const colors = Float32Array.from(
      Array.from(
        { length: drift.count },
        () => drift.colors[Math.floor(next() * drift.colors.length)] ?? [1, 1, 1]
      ).flat()
    );
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    [
      [seeds, 4],
      [colors, 3],
    ].forEach(([data, size], location) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, data as Float32Array, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size as number, gl.FLOAT, false, 0, 0);
    });
    gl.bindVertexArray(null);
    return vao;
  }

  /** A shader program: the one everything is drawn with, the sky's, and the drift's. */
  #program(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
    const program = gl.createProgram();
    [
      [gl.VERTEX_SHADER, vertex],
      [gl.FRAGMENT_SHADER, fragment],
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
    this.#approach?.disconnect();
    this.#approach = undefined;
    this.#arrived = false;
    this.#loaded = undefined;
    this.#shown?.listeners.abort();
    this.#shown?.release();
    this.#shown = undefined;
    this.#follow = undefined;
    this.#sighting?.disconnect();
    this.#sighting = undefined;
    this.#flight.seen = false;
    this.#fly();
  }

  override render() {
    return html`${
        this.loader
          ? html`<div class="loader">
              <kvlm-logo loaded-only loaded=${ifDefined(this.fetched)}></kvlm-logo>
            </div>`
          : this.poster === undefined
            ? nothing
            : html`<img class="backdrop" src=${this.poster} alt="" decoding="async"><img
                  class="poster"
                  src=${this.poster}
                  alt=""
                  decoding="async"
                >`
      }
      <canvas
        role="img"
        aria-label="Die Lochmühle, von der Straße aus"
        ?data-drawn=${this.drawn}
      ></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-scene': Scene;
  }
}
