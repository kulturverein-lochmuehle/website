import type { Color, Material, Object3D } from 'three';
import { Vector3 } from 'three';

import type { Lamp } from './lamps.js';
import { LAMP_CODES, LAMP_GLSL, MAX_LAMPS } from './lamps.js';

/**
 * Snow over the model: whatever faces up is laid white, and the flatter it
 * lies the more - the ground, the roofs, the decks, the spruce's tiers - while
 * walls, stems and railings stay as they are. Done in the shader of every lit
 * material rather than by recolouring each mesh, so it needs no second copy of
 * any geometry and comes and goes with one number. What is drawn unlit - the
 * windows - is left alone, and so is what is named not to take it: the brook
 * runs on under a winter.
 */

/**
 * Where on the way from a wall to level ground snow starts to lie, and where it
 * lies whole. A material may hold its own in `userData.snowLies`: bark catches
 * snow along the top of a limb that would shed it from a roof.
 */
export const SNOW_LIES = { from: 0.35, whole: 0.7 } as const;

/** What is named not to take snow, and everything under it: the brook runs on. */
export const SNOWLESS = ['brook'];

/** How snow lies on a material. */
export const snowLiesOn = (material: Material): { from: number; whole: number } =>
  (material.userData['snowLies'] as { from: number; whole: number } | undefined) ?? SNOW_LIES;

/** Whether snow lies on a material at all: a lit one, not marked `snowless`. */
export const takesSnow = (material: Material): boolean =>
  material.type === 'MeshLambertMaterial' && material.userData['snowless'] !== true;

/** Whether an object is under one named not to take snow. */
export const snowless = (object: Object3D | null, except: string[] = SNOWLESS): boolean =>
  object !== null && (except.includes(object.name) || snowless(object.parent, except));

/** How much snow lies on a face turned up this far, as the shader has it. */
export function snowOn(material: Material, up: number): number {
  const { from, whole } = snowLiesOn(material);
  const t = Math.min(Math.max((up - from) / (whole - from), 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * The snow's handle: how much of it lies, nought to one - and the lamps the
 * lit windows are after dark, which the same shader lights with.
 */
export interface Snow {
  set(amount: number): void;
  /** Lays the shader onto what is added later, a part of the model built since. */
  cover(root: Object3D): void;
  setLamps(lamps: Lamp[], strength: number): void;
  /** How bright each fire burns this frame, nought to one and a little over. */
  flicker(brightness: (index: number) => number): void;
}

interface Patched {
  color: { value: Color };
  amount: { value: number };
  lampAt: { value: Vector3[] };
  lampShape: { value: Vector3[] };
  lampOut: { value: Vector3[] };
  lampCount: { value: number };
  lampColor: { value: Color };
  lanternColor: { value: Color };
  lampStrength: { value: number };
}

/**
 * Lays the snow's shader onto every lit material under a root, once, and
 * hands back the number that says how much lies - none, at first.
 */
export function prepareSnow(
  root: Object3D,
  color: Color,
  lampColor: Color,
  lanternColor: Color,
  except: string[] = SNOWLESS
): Snow {
  const uniforms: Patched = {
    color: { value: color },
    amount: { value: 0 },
    lampAt: { value: Array.from({ length: MAX_LAMPS }, () => new Vector3()) },
    lampShape: { value: Array.from({ length: MAX_LAMPS }, () => new Vector3()) },
    lampOut: { value: Array.from({ length: MAX_LAMPS }, () => new Vector3()) },
    lampCount: { value: 0 },
    lampColor: { value: lampColor },
    lanternColor: { value: lanternColor },
    lampStrength: { value: 0 },
  };
  const patched = new Set<Material>();
  const cover = (root: Object3D) =>
    root.traverse(object => {
      if (snowless(object, except)) {
        return;
      }
      const { material } = object as Object3D & { material?: Material | Material[] };
      (Array.isArray(material) ? material : material === undefined ? [] : [material])
        .filter(one => takesSnow(one) && !patched.has(one))
        .forEach(one => {
          patched.add(one);
          const lies = snowLiesOn(one);
          one.onBeforeCompile = shader => {
            shader.uniforms['snowColor'] = uniforms.color;
            shader.uniforms['snowAmount'] = uniforms.amount;
            (
              [
                'lampAt',
                'lampOut',
                'lampShape',
                'lampCount',
                'lampColor',
                'lanternColor',
                'lampStrength',
              ] as const
            ).forEach(name => (shader.uniforms[name] = uniforms[name]));
            // how far the face turns up, in the world: the instance's turn and
            // the object's both taken in, the camera's not
            shader.vertexShader = shader.vertexShader
              .replace(
                '#include <common>',
                '#include <common>\nvarying float vSnowUp;\nvarying vec3 vLampPlace;\nvarying vec3 vLampNormal;'
              )
              .replace(
                '#include <beginnormal_vertex>',
                [
                  '#include <beginnormal_vertex>',
                  'vec3 snowNormal = objectNormal;',
                  '#ifdef USE_INSTANCING',
                  '  snowNormal = mat3(instanceMatrix) * snowNormal;',
                  '#endif',
                  'vLampNormal = normalize(mat3(modelMatrix) * snowNormal);',
                  'vSnowUp = vLampNormal.y;',
                ].join('\n')
              )
              .replace(
                '#include <worldpos_vertex>',
                [
                  '#include <worldpos_vertex>',
                  'vec4 lampPlace = vec4(transformed, 1.0);',
                  '#ifdef USE_INSTANCING',
                  '  lampPlace = instanceMatrix * lampPlace;',
                  '#endif',
                  'vLampPlace = (modelMatrix * lampPlace).xyz;',
                ].join('\n')
              );
            shader.fragmentShader = shader.fragmentShader
              .replace(
                '#include <common>',
                [
                  '#include <common>',
                  'varying float vSnowUp;',
                  'uniform vec3 snowColor;',
                  'uniform float snowAmount;',
                  'varying vec3 vLampPlace;',
                  'varying vec3 vLampNormal;',
                  LAMP_GLSL,
                ].join('\n')
              )
              .replace(
                '#include <color_fragment>',
                [
                  '#include <color_fragment>',
                  `float snowLies = smoothstep(${lies.from}, ${lies.whole}, vSnowUp) * snowAmount;`,
                  'diffuseColor.rgb = mix(diffuseColor.rgb, snowColor, snowLies);',
                ].join('\n')
              )
              // the lit windows' light onto what faces them, as the sun's is
              .replace(
                '#include <lights_fragment_end>',
                [
                  '#include <lights_fragment_end>',
                  'if (lampStrength > 0.0 && lampCount > 0) {',
                  // the face as it is seen, from its own slope here: a face
                  // drawn from both sides, or wound the wrong way round, still
                  // takes the light on the side that faces it
                  '  vec3 lampFace = normalize(cross(dFdx(vLampPlace), dFdy(vLampPlace)));',
                  '  if (dot(lampFace, cameraPosition - vLampPlace) < 0.0) lampFace = -lampFace;',
                  '  vec2 lamp = lampLight(vLampPlace, lampFace) * lampStrength;',
                  '  reflectedLight.directDiffuse += BRDF_Lambert(diffuseColor.rgb) * (lampColor * lamp.x + lanternColor * lamp.y);',
                  '}',
                ].join('\n')
              );
          };
          // one program for every patched material that lets snow lie alike
          one.customProgramCacheKey = () => `snow:${lies.from}:${lies.whole}`;
          one.needsUpdate = true;
        });
    });
  cover(root);
  // which of the lamps are fires, to flicker, and how bright each burns steady
  const fires: [index: number, steady: number][] = [];
  return {
    set: amount => (uniforms.amount.value = amount),
    cover,
    setLamps: (lamps, strength) => {
      fires.length = 0;
      lamps.slice(0, MAX_LAMPS).forEach(({ at, out, width, height, kind }, index) => {
        if (kind === 'fire') {
          fires.push([index, width > 0 ? width : 1]);
        }
        uniforms.lampAt.value[index]?.set(at[0], at[1], at[2]);
        uniforms.lampShape.value[index]?.set(width, height, LAMP_CODES[kind]);
        uniforms.lampOut.value[index]?.set(out[0], out[1], out[2]);
      });
      uniforms.lampCount.value = Math.min(lamps.length, MAX_LAMPS);
      uniforms.lampStrength.value = strength;
    },
    flicker: brightness =>
      fires.forEach(([index, steady], fire) => {
        const shape = uniforms.lampShape.value[index];
        if (shape !== undefined) {
          shape.x = steady * brightness(fire);
        }
      }),
  };
}
