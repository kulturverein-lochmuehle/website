import type { Color, Material, Object3D } from 'three';

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

/** Whether an object is under one named not to take snow. */
export const snowless = (object: Object3D | null, except: string[] = SNOWLESS): boolean =>
  object !== null && (except.includes(object.name) || snowless(object.parent, except));

/** How much snow lies on a face turned up this far, as the shader has it. */
export function snowOn(material: Material, up: number): number {
  const { from, whole } = snowLiesOn(material);
  const t = Math.min(Math.max((up - from) / (whole - from), 0), 1);
  return t * t * (3 - 2 * t);
}

/** The snow's handle: how much of it lies, nought to one. */
export interface Snow {
  set(amount: number): void;
}

interface Patched {
  color: { value: Color };
  amount: { value: number };
}

/**
 * Lays the snow's shader onto every lit material under a root, once, and
 * hands back the number that says how much lies - none, at first.
 */
export function prepareSnow(root: Object3D, color: Color, except: string[] = SNOWLESS): Snow {
  const uniforms: Patched = { color: { value: color }, amount: { value: 0 } };
  const patched = new Set<Material>();
  root.traverse(object => {
    if (snowless(object, except)) {
      return;
    }
    const { material } = object as Object3D & { material?: Material | Material[] };
    (Array.isArray(material) ? material : material === undefined ? [] : [material])
      .filter(one => one.type === 'MeshLambertMaterial' && !patched.has(one))
      .forEach(one => {
        patched.add(one);
        const lies = snowLiesOn(one);
        one.onBeforeCompile = shader => {
          shader.uniforms['snowColor'] = uniforms.color;
          shader.uniforms['snowAmount'] = uniforms.amount;
          // how far the face turns up, in the world: the instance's turn and
          // the object's both taken in, the camera's not
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying float vSnowUp;')
            .replace(
              '#include <beginnormal_vertex>',
              [
                '#include <beginnormal_vertex>',
                'vec3 snowNormal = objectNormal;',
                '#ifdef USE_INSTANCING',
                '  snowNormal = mat3(instanceMatrix) * snowNormal;',
                '#endif',
                'vSnowUp = normalize(mat3(modelMatrix) * snowNormal).y;',
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
              ].join('\n')
            )
            .replace(
              '#include <color_fragment>',
              [
                '#include <color_fragment>',
                `float snowLies = smoothstep(${lies.from}, ${lies.whole}, vSnowUp) * snowAmount;`,
                'diffuseColor.rgb = mix(diffuseColor.rgb, snowColor, snowLies);',
              ].join('\n')
            );
        };
        // one program for every patched material that lets snow lie alike
        one.customProgramCacheKey = () => `snow:${lies.from}:${lies.whole}`;
        one.needsUpdate = true;
      });
  });
  return { set: amount => (uniforms.amount.value = amount) };
}
