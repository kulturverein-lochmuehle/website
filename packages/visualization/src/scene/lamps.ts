import type { Object3D, Vector3 } from 'three';

/**
 * The light a lit opening throws out after dark, onto whatever faces it - the
 * ground in front, a wall across the way - and falling off with the distance.
 * A window shines softly outwards, strongest straight out and
 * nothing along its own wall; the open gate throws a cone - it starts at the
 * wall under the gate, as wide as the gate, and runs out square to the wall
 * across the yard, opening a little as it goes and fading out; a bare bulb
 * shines all round, and casts shadows - what stands between it and a point
 * keeps its light off it. The scene's
 * shader and the bake count both the same (`lampLight`, `LAMP_GLSL`).
 */
export interface Lamp {
  /** The opening's middle, in scene space. */
  at: [number, number, number];
  /** Out of its wall, level, unit length. */
  out: [number, number, number];
  /** How wide and how high the opening is. */
  width: number;
  height: number;
  /**
   * A window; the open gate, which throws its cone; a bulb, which shines all
   * round; a street lamp, which shines down; or a lantern on a wall, which
   * shines out of it, down and to the sides; or a stretch of a string of
   * lights, which shines faintly all round; or a campfire, low, orange, all
   * round.
   */
  kind: 'window' | 'gate' | 'bulb' | 'street' | 'wall' | 'string' | 'fire';
  /** Whether it casts shadows: a bulb always, a street lamp where it says. */
  shadow?: boolean;
  /** What it is the light of: hidden - a decoration not put up - it lights nothing. */
  source?: Object3D;
}

/** At most this many lamps: the scene's shader holds them in a fixed array. */
export const MAX_LAMPS = 96;

/**
 * A window's light: how far it reaches before it has fallen to half, per meter
 * of window, and past how far it is gone; how wide its beam opens from
 * straight out - a cosine, 0.15 is about 80°.
 */
export const WINDOW_LAMP = { half: 2.2, gone: 14, open: 0.15 } as const;

/**
 * The gate's cone: its reach and where it is gone as for a window; how much
 * wider it spreads either side per meter out, and how much it rises; how soft
 * its edges are, in meters; and how strongly it lights against a window.
 */
export const GATE_LAMP = {
  half: 1.1,
  gone: 7,
  spread: 0.6,
  rise: 0.15,
  soft: 0.25,
  share: 1.2,
} as const;

/**
 * A bulb hanging bare, as the one under the pavilion's roof: how far it
 * reaches before its light has fallen to half, where it is gone, how
 * strongly it lights against a window, and how big it counts as for its
 * shadows: the bigger, the softer their edges.
 */
export const BULB_LAMP = { half: 1.8, gone: 9, share: 1.5, size: 0.5 } as const;

/**
 * The lamps that shine from a point rather than out of an opening: how far
 * each reaches before its light has fallen to half, where it is gone, and how
 * strongly it lights against a window.
 */
export const ROUND_LAMPS = {
  bulb: BULB_LAMP,
  street: { half: 3.5, gone: 18, share: 2.2, size: 0.5 },
  wall: { half: 1.8, gone: 9, share: 4.5, size: 0.15 },
  string: { half: 0.9, gone: 4, share: 0.16, size: 0.06 },
  fire: { half: 2.4, gone: 12, share: 3, size: 0.4 },
} as const;

/** How strongly the lamps light at most. */
export const LAMP_STRENGTH = 4;

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * How much of a lamp reaches a point facing a way, nought upwards - and, where
 * a lamp casts shadows, only as much as `reaching` says gets past what
 * stands between.
 */
export function lampLight(
  lamps: Lamp[],
  point: Vector3,
  normal: Vector3,
  reaching?: (lamp: Lamp, point: Vector3, normal: Vector3) => number
): number {
  return lamps.reduce((sum, lamp) => {
    const got = unshaded(lamp, point, normal);
    // a shadow is only looked for where the lamp would show: most of what it
    // reaches it lights too faintly to tell
    if (got < LAMP_FAINT) {
      return sum + got;
    }
    return (
      sum + got * (castsShadows(lamp) && reaching !== undefined ? reaching(lamp, point, normal) : 1)
    );
  }, 0);
}

/**
 * How far round towards its wall a wall lantern still lights, as the cosine
 * off straight out it is let in at: all the way to the wall's own plane.
 */
const WALL_WASH = 1;

/** Below this, a lamp's light at a point is taken as it is, its shadow not looked for. */
const LAMP_FAINT = 0.004;

/** How much of a lamp reaches a point facing a way, as though nothing stood between. */
function unshaded(lamp: Lamp, point: Vector3, normal: Vector3): number {
  const { at, out, width, height, kind } = lamp;
  const [dx, dy, dz] = [point.x - at[0], point.y - at[1], point.z - at[2]];
  const distance = Math.hypot(dx, dy, dz);
  if (distance < 1e-3) {
    return 0;
  }
  const facing = Math.max(-(dx * normal.x + dy * normal.y + dz * normal.z) / distance, 0);
  if (facing <= 0) {
    return 0;
  }
  if (
    kind === 'bulb' ||
    kind === 'street' ||
    kind === 'wall' ||
    kind === 'string' ||
    kind === 'fire'
  ) {
    const { half, gone, share } = ROUND_LAMPS[kind];
    if (distance > gone) {
      return 0;
    }
    // a street lamp shines down, a wall's lantern out of its wall
    const aimed =
      kind === 'street'
        ? clamp(-dy / distance + 0.2)
        : kind === 'wall'
          ? // everything before its wall, the wall round it most of all - it
            // hangs a hand's breadth off it - but not above: its head's rim
            // keeps it off there. Aimed out of the wall alone it lit the wall
            // round it not at all, and a dark ring stood round every lantern
            clamp((dx * out[0] + dz * out[2]) / distance + WALL_WASH) *
            clamp((0.2 - dy / distance) / 0.4)
          : 1;
    const fall = 1 / (1 + (distance / half) ** 2);
    const fade = 1 - clamp((distance - gone * 0.6) / (gone * 0.4));
    // a fire's brightness, handed over in its width, a lamp from a point having none
    const bright = kind === 'fire' && width > 0 ? width : 1;
    return aimed * facing * fall * fade * share * bright;
  }
  if (kind === 'window') {
    if (distance > WINDOW_LAMP.gone) {
      return 0;
    }
    const ahead = (dx * out[0] + dy * out[1] + dz * out[2]) / distance;
    const beam = clamp((ahead - WINDOW_LAMP.open) / (1 - WINDOW_LAMP.open));
    const reach = WINDOW_LAMP.half * Math.max(width, height);
    const fall = 1 / (1 + (distance / reach) ** 2);
    const fade = 1 - clamp((distance - WINDOW_LAMP.gone * 0.7) / (WINDOW_LAMP.gone * 0.3));
    return beam * beam * facing * fall * fade;
  }
  // how far out of the wall, and how far to the side and up of the gate
  const ahead = dx * out[0] + dz * out[2];
  if (ahead <= 0.02 || ahead > GATE_LAMP.gone) {
    return 0;
  }
  const aside = Math.abs(dx * -out[2] + dz * out[0]);
  const within =
    clamp((width / 2 + ahead * GATE_LAMP.spread - aside) / GATE_LAMP.soft + 0.5) *
    clamp((height / 2 + ahead * GATE_LAMP.rise - dy) / GATE_LAMP.soft + 0.5);
  const reach = GATE_LAMP.half * Math.max(width, height);
  const fall = 1 / (1 + (ahead / reach) ** 2);
  const fade = 1 - clamp((ahead - GATE_LAMP.gone * 0.6) / (GATE_LAMP.gone * 0.4));
  return within * facing * fall * fade * GATE_LAMP.share;
}

/** How far a lamp's light reaches at most, for looking up the lamps near a point. */
export const lampReach = ({ kind }: Lamp): number =>
  kind === 'window' ? WINDOW_LAMP.gone : kind === 'gate' ? GATE_LAMP.gone : ROUND_LAMPS[kind].gone;

/**
 * The lamps sorted onto a grid by how far they reach, so a point asks only
 * those that can light it rather than all of them.
 */
export function lampGrid(lamps: Lamp[], cell = 6): (point: Vector3) => Lamp[] {
  const cells = new Map<string, Lamp[]>();
  lamps.forEach(lamp => {
    const reach = lampReach(lamp);
    const [x0, x1] = [
      Math.floor((lamp.at[0] - reach) / cell),
      Math.floor((lamp.at[0] + reach) / cell),
    ];
    const [z0, z1] = [
      Math.floor((lamp.at[2] - reach) / cell),
      Math.floor((lamp.at[2] + reach) / cell),
    ];
    for (let x = x0; x <= x1; x += 1) {
      for (let z = z0; z <= z1; z += 1) {
        const key = `${x}:${z}`;
        cells.set(key, [...(cells.get(key) ?? []), lamp]);
      }
    }
  });
  return point => cells.get(`${Math.floor(point.x / cell)}:${Math.floor(point.z / cell)}`) ?? [];
}

/** The same, for the scene's shader: `lampAt`, `lampOut`, `lampShape` and `lampCount` its uniforms. */
export const LAMP_GLSL = `
#define MAX_LAMPS ${MAX_LAMPS}
uniform vec3 lampAt[MAX_LAMPS];
uniform vec3 lampOut[MAX_LAMPS];
uniform vec3 lampShape[MAX_LAMPS];
uniform int lampCount;
uniform vec3 lampColor;
uniform vec3 lanternColor;
uniform float lampStrength;
// how much light reaches a point: the rooms' warm white, and the lanterns' orange
vec2 lampLight(vec3 point, vec3 normal) {
  vec2 sum = vec2(0.0);
  for (int i = 0; i < MAX_LAMPS; i++) {
    if (i >= lampCount) break;
    vec3 d = point - lampAt[i];
    vec3 outward = lampOut[i];
    float width = lampShape[i].x;
    float height = lampShape[i].y;
    float distance = length(d);
    if (distance < 0.001) continue;
    float facing = max(-dot(d / distance, normal), 0.0);
    if (lampShape[i].z > 1.5) {
      // a bulb, a street lamp or a wall's lantern: all round, down, or out
      float kind = lampShape[i].z;
      bool street = kind > 2.5 && kind < 3.5;
      bool wall = kind > 3.5 && kind < 4.5;
      bool string = kind > 4.5 && kind < 5.5;
      bool fire = kind > 5.5;
      float halfway = fire ? ${ROUND_LAMPS.fire.half.toFixed(1)} : string ? ${ROUND_LAMPS.string.half.toFixed(1)} : wall ? ${ROUND_LAMPS.wall.half.toFixed(1)} : street ? ${ROUND_LAMPS.street.half.toFixed(1)} : ${ROUND_LAMPS.bulb.half.toFixed(1)};
      float gone = fire ? ${ROUND_LAMPS.fire.gone.toFixed(1)} : string ? ${ROUND_LAMPS.string.gone.toFixed(1)} : wall ? ${ROUND_LAMPS.wall.gone.toFixed(1)} : street ? ${ROUND_LAMPS.street.gone.toFixed(1)} : ${ROUND_LAMPS.bulb.gone.toFixed(1)};
      float share = fire ? ${ROUND_LAMPS.fire.share.toFixed(2)} : string ? ${ROUND_LAMPS.string.share.toFixed(2)} : wall ? ${ROUND_LAMPS.wall.share.toFixed(2)} : street ? ${ROUND_LAMPS.street.share.toFixed(2)} : ${ROUND_LAMPS.bulb.share.toFixed(2)};
      if (distance > gone) continue;
      float aimed = street ? clamp(-d.y / distance + 0.2, 0.0, 1.0)
        : wall ? clamp(dot(d / distance, outward) + ${WALL_WASH.toFixed(1)}, 0.0, 1.0)
          * clamp((0.2 - d.y / distance) / 0.4, 0.0, 1.0) : 1.0;
      float fall = 1.0 / (1.0 + (distance / halfway) * (distance / halfway));
      float fade = 1.0 - clamp((distance - gone * 0.6) / (gone * 0.4), 0.0, 1.0);
      // a fire's brightness flickers: handed over in its width, a lamp from a point having none
      float bright = fire && width > 0.0 ? width : 1.0;
      float got = aimed * facing * fall * fade * share * bright;
      sum += street || fire ? vec2(0.0, got) : vec2(got, 0.0);
      continue;
    }
    if (lampShape[i].z < 0.5) {
      if (distance > ${WINDOW_LAMP.gone.toFixed(1)}) continue;
      float ahead = dot(d / distance, outward);
      float beam = clamp((ahead - ${WINDOW_LAMP.open}) / ${(1 - WINDOW_LAMP.open).toFixed(2)}, 0.0, 1.0);
      float reach = ${WINDOW_LAMP.half.toFixed(1)} * max(width, height);
      float fall = 1.0 / (1.0 + (distance / reach) * (distance / reach));
      float fade = 1.0 - clamp((distance - ${(WINDOW_LAMP.gone * 0.7).toFixed(1)}) / ${(WINDOW_LAMP.gone * 0.3).toFixed(1)}, 0.0, 1.0);
      sum.x += beam * beam * facing * fall * fade;
      continue;
    }
    float ahead = d.x * outward.x + d.z * outward.z;
    if (ahead <= 0.02 || ahead > ${GATE_LAMP.gone.toFixed(1)}) continue;
    float aside = abs(d.x * -outward.z + d.z * outward.x);
    float within = clamp((width * 0.5 + ahead * ${GATE_LAMP.spread} - aside) / ${GATE_LAMP.soft} + 0.5, 0.0, 1.0)
      * clamp((height * 0.5 + ahead * ${GATE_LAMP.rise} - d.y) / ${GATE_LAMP.soft} + 0.5, 0.0, 1.0);
    float reach = ${GATE_LAMP.half.toFixed(1)} * max(width, height);
    float fall = 1.0 / (1.0 + (ahead / reach) * (ahead / reach));
    float fade = 1.0 - clamp((ahead - ${(GATE_LAMP.gone * 0.6).toFixed(1)}) / ${(GATE_LAMP.gone * 0.4).toFixed(1)}, 0.0, 1.0);
    sum.x += within * facing * fall * fade * ${GATE_LAMP.share};
  }
  return sum;
}
`;

/** How strongly the lamps light, by how much day it is: hardly at all by day. */
export const lampStrength = (day: number): number => LAMP_STRENGTH * (1 - day) ** 1.5;

/**
 * Whether a lamp casts shadows in the bake: every one does - a window's light
 * past its jambs and whatever stands before it, a lantern's round its posts.
 * The editor is for editing: it draws none of them (`mapsShadows`).
 */
export const castsShadows = (_lamp: Lamp): boolean => true;

/** Whether a lamp's shadows get a map of their own in the editor's scene: none do. */
export const mapsShadows = (_lamp: Lamp): boolean => false;

/**
 * Whether a lamp lights at all in the editor, kept simple for speed: the
 * strings' bulbs glow there, but light nothing - their light is the bake's.
 */
export const litInEditor = ({ kind }: Lamp): boolean => kind !== 'string';

/**
 * Whether a lamp's shadow is looked for from round it, soft, or from its
 * middle alone: the bulb and the street lamps are seen bare and big enough to
 * soften theirs; a window, the gate, a lantern or a string's bulb is one look.
 */
export const softShadows = ({ kind }: Lamp): boolean =>
  kind === 'bulb' || kind === 'street' || kind === 'fire';

/** The code a lamp's kind is handed to the shader as. */
export const LAMP_CODES = {
  window: 0,
  gate: 1,
  bulb: 2,
  street: 3,
  wall: 4,
  string: 5,
  fire: 6,
} as const;

/** Whether a lamp lights in the street lamps' orange rather than the rooms' warm white: a fire does too. */
export const orange = ({ kind }: Lamp): boolean => kind === 'street' || kind === 'fire';
